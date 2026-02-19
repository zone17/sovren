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
import type { DiversificationGoal } from '@shared/types/finance';
import { getBtcUsdRate, RATE_SOURCE } from '../../utils/btc-rate';

const CONCENTRATION_WARNING_THRESHOLD = 0.5; // >50% from single source = risk
const CACHE_TTL_DISPLAY = 3600; // 1h for display contexts

// #323: Row type interfaces for typed .from<T>() calls
interface RevenueEntryRow {
  id: string;
  creator_id: string;
  source: string;
  amount_sats: number;
  usd_at_time: number | null;
  rate_source: string | null;
  rate_timestamp: string | null;
  description: string | null;
  recorded_at: string;
  created_at: string;
}

interface DiversificationGoalRow {
  id: string;
  creator_id: string;
  target_distribution: Record<string, number>;
  created_at: string;
  updated_at: string;
}

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
    const cached =
      await this.cache.get<Array<{ source: string; totalSats: number; percentage: number }>>(
        cacheKey
      );
    if (cached) return cached;

    let query = this.db
      .from<RevenueEntryRow>('revenue_entries')
      .select('source, amount_sats')
      .eq('creator_id', creatorId);

    if (period?.start) {
      query = query.gte('recorded_at', period.start);
    }
    if (period?.end) {
      query = query.lte('recorded_at', period.end);
    }

    // #318: Add limit to prevent unbounded result sets
    const { data, error } = await query.limit(1000);
    if (error) {
      this.logger.error('Failed to fetch revenue breakdown', { error, creatorId });
      throw new Error('Failed to fetch revenue breakdown');
    }

    const rows: Array<{ source: string; amount_sats: number }> = data ?? [];

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

  async getDiversificationGoals(creatorId: string): Promise<DiversificationGoal | null> {
    this.logger.info('RevenueService.getDiversificationGoals', { creatorId });

    const { data, error } = await this.db
      .from<DiversificationGoalRow>('diversification_goals')
      .select('id, creator_id, target_distribution, created_at, updated_at')
      .eq('creator_id', creatorId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Failed to fetch diversification goals', { error, creatorId });
      throw new Error('Failed to fetch diversification goals');
    }
    return data ?? null;
  }

  async setDiversificationGoals(creatorId: string, targets: Record<string, number>): Promise<void> {
    this.logger.info('RevenueService.setDiversificationGoals', { creatorId });

    // Validate targets sum to 100 (percentages)
    const total = Object.values(targets).reduce((sum, v) => sum + v, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Diversification targets must sum to 100, got ${total}`);
    }

    const { error } = await this.db.from<DiversificationGoalRow>('diversification_goals').upsert(
      {
        creator_id: creatorId,
        target_distribution: targets,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'creator_id' }
    );

    if (error) {
      this.logger.error('Failed to set diversification goals', { error, creatorId });
      throw new Error('Failed to set diversification goals');
    }

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
    const { rate: btcRateUsd, fetchedAt } = await getBtcUsdRate(this.cache, this.logger);
    const usdAtTime = (data.amountSats / 100_000_000) * btcRateUsd;

    const row: Partial<RevenueEntryRow> = {
      creator_id: creatorId,
      source: data.source,
      amount_sats: data.amountSats,
      usd_at_time: Math.round(usdAtTime * 100) / 100,
      rate_source: RATE_SOURCE,
      rate_timestamp: fetchedAt,
    };
    if (data.description) row.description = data.description;

    const { data: inserted, error } = await this.db
      .from<RevenueEntryRow>('revenue_entries')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to record revenue entry', { error, creatorId });
      throw new Error('Failed to record revenue entry');
    }
    if (!inserted) throw new Error('Failed to record revenue entry');

    // Invalidate cached breakdown
    await this.cache.invalidate(`revenue:breakdown:${creatorId}:*`);

    return { id: inserted.id };
  }
}
