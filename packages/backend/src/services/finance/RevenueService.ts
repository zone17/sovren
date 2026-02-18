/**
 * Revenue Service
 * EPIC-011: Business Manager — Revenue tracking and diversification planning
 *
 * Security:
 * H-5: Records rate_source + rate_timestamp with every USD conversion
 */

import type { IRevenueService } from '../../interfaces/finance/IRevenueService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { ILogger } from '../../interfaces/shared/ILogger';

const CONCENTRATION_WARNING_THRESHOLD = 0.5; // >50% from single source = risk
const CACHE_TTL_DISPLAY = 3600; // 1h for display contexts
const BTC_RATE_CACHE_KEY = 'btc:usd:rate';
const BTC_RATE_TTL = 300; // 5 minutes
const RATE_SOURCE = 'coingecko';

type RevenueSource =
  | 'subscriptions'
  | 'tips'
  | 'sponsorships'
  | 'services'
  | 'affiliate'
  | 'marketplace'
  | 'other';

export class RevenueService implements IRevenueService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly cache: ICacheService,
    private readonly logger: ILogger
  ) {}

  async getRevenueBreakdown(
    creatorId: string,
    period?: { start: string; end: string }
  ): Promise<Array<{ source: string; totalSats: number; percentage: number }>> {
    this.logger.info('RevenueService.getRevenueBreakdown', { creatorId, period });

    const cacheKey = `revenue:breakdown:${creatorId}:${period?.start ?? 'all'}:${period?.end ?? 'all'}`;
    const cached = await this.cache.get<Array<{ source: string; totalSats: number; percentage: number }>>(cacheKey);
    if (cached) return cached;

    let query = this.db
      .from('revenue_entries')
      .select('source, amount_sats')
      .eq('creator_id', creatorId);

    if (period?.start) {
      query = (query as any).gte('recorded_at', period.start);
    }
    if (period?.end) {
      query = (query as any).lte('recorded_at', period.end);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<{ source: string; amount_sats: number }>;

    // Aggregate by source
    const sourceTotals = new Map<string, number>();
    let grandTotal = 0;

    for (const row of rows) {
      const prev = sourceTotals.get(row.source) ?? 0;
      sourceTotals.set(row.source, prev + row.amount_sats);
      grandTotal += row.amount_sats;
    }

    const breakdown = Array.from(sourceTotals.entries()).map(([source, totalSats]) => ({
      source,
      totalSats,
      percentage: grandTotal > 0 ? Math.round((totalSats / grandTotal) * 10000) / 100 : 0,
    }));

    await this.cache.set(cacheKey, breakdown, CACHE_TTL_DISPLAY);
    return breakdown;
  }

  async getConcentrationRisk(creatorId: string): Promise<{
    riskLevel: string;
    dominantSource: string;
    percentage: number;
    suggestions: string[];
  }> {
    this.logger.info('RevenueService.getConcentrationRisk', { creatorId });

    const breakdown = await this.getRevenueBreakdown(creatorId);

    if (breakdown.length === 0) {
      return {
        riskLevel: 'unknown',
        dominantSource: 'none',
        percentage: 0,
        suggestions: ['Start recording revenue entries to get risk analysis.'],
      };
    }

    const sorted = [...breakdown].sort((a, b) => b.totalSats - a.totalSats);
    const top = sorted[0];
    const topPct = top.percentage / 100;

    let riskLevel: string;
    const suggestions: string[] = [];

    if (topPct > CONCENTRATION_WARNING_THRESHOLD) {
      riskLevel = 'high';
      suggestions.push(
        `${top.source} represents ${top.percentage}% of revenue — diversify to reduce risk.`
      );
      suggestions.push('Consider adding sponsorships, services, or affiliate revenue streams.');
    } else if (topPct > 0.35) {
      riskLevel = 'medium';
      suggestions.push(
        `${top.source} is your primary revenue source. Aim to bring it below 35% for better stability.`
      );
    } else {
      riskLevel = 'low';
      suggestions.push('Your revenue is well-diversified. Keep monitoring for drift.');
    }

    return {
      riskLevel,
      dominantSource: top.source,
      percentage: top.percentage,
      suggestions,
    };
  }

  async getDiversificationGoals(creatorId: string): Promise<any> {
    this.logger.info('RevenueService.getDiversificationGoals', { creatorId });

    const { data, error } = await this.db
      .from('diversification_goals')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data ?? null;
  }

  async setDiversificationGoals(
    creatorId: string,
    targets: Record<string, number>
  ): Promise<void> {
    this.logger.info('RevenueService.setDiversificationGoals', { creatorId });

    // Validate targets sum to 100 (percentages)
    const total = Object.values(targets).reduce((sum, v) => sum + v, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Diversification targets must sum to 100, got ${total}`);
    }

    const { error } = await (this.db.from('diversification_goals') as any).upsert(
      {
        creator_id: creatorId,
        target_distribution: targets,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'creator_id' }
    );

    if (error) throw error;

    // Invalidate cache
    await this.cache.invalidate(`revenue:breakdown:${creatorId}:*`);
  }

  async recordRevenue(
    creatorId: string,
    data: { source: string; amountSats: number; description?: string }
  ): Promise<{ id: string }> {
    this.logger.info('RevenueService.recordRevenue', { creatorId, source: data.source });

    if (data.amountSats <= 0) {
      throw new Error('Revenue amount must be greater than 0 sats');
    }

    // H-5: Record BTC/USD rate with provenance — source + timestamp
    const { rate: btcRateUsd, fetchedAt } = await this.getBtcUsdRate();
    const usdAtTime = (data.amountSats / 100_000_000) * btcRateUsd;

    const row: Record<string, unknown> = {
      creator_id: creatorId,
      source: data.source,
      amount_sats: data.amountSats,
      usd_at_time: Math.round(usdAtTime * 100) / 100,
      rate_source: RATE_SOURCE,
      rate_timestamp: fetchedAt,
    };
    if (data.description) row.description = data.description;

    const { data: inserted, error } = await this.db
      .from('revenue_entries')
      .insert(row)
      .select('id')
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Failed to record revenue entry');

    // Invalidate cached breakdown
    await this.cache.invalidate(`revenue:breakdown:${creatorId}:*`);

    return { id: (inserted as any).id };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /** H-5: Returns rate + metadata for provenance recording */
  private async getBtcUsdRate(): Promise<{ rate: number; fetchedAt: string }> {
    const cached = await this.cache.get<{ rate: number; fetchedAt: string }>(BTC_RATE_CACHE_KEY);
    if (cached !== null) return cached;

    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
      );
      const json = (await response.json()) as { bitcoin?: { usd?: number } };
      const rate = json?.bitcoin?.usd;

      if (typeof rate !== 'number' || rate <= 0) {
        throw new Error('Invalid BTC/USD rate from API');
      }

      const fetchedAt = new Date().toISOString();
      const entry = { rate, fetchedAt };
      await this.cache.set(BTC_RATE_CACHE_KEY, entry, BTC_RATE_TTL);
      await this.cache.set(`${BTC_RATE_CACHE_KEY}:stale`, entry);
      return entry;
    } catch (err) {
      this.logger.error('BTC/USD rate fetch failed, using stale fallback', { err });
      const stale = await this.cache.get<{ rate: number; fetchedAt: string }>(
        `${BTC_RATE_CACHE_KEY}:stale`
      );
      return stale ?? { rate: 50000, fetchedAt: new Date(0).toISOString() };
    }
  }
}
