/**
 * WellnessService
 * Work pattern CRUD, pulse check-ins, data deletion
 * EPIC-007: Creator Wellness System (US-E7-001, US-E7-002)
 */

import type {
  WorkPattern,
  WorkPatternAggregation,
  HeatmapData,
  HeatmapEntry,
  PulseCheckIn,
  PulseHistory,
  WellnessBenchmark,
  DailyWorkPattern,
  PulseTrendDirection,
} from '@sovren/shared/types/wellness';
import type {
  IWellnessService,
  CreateWorkPatternInput,
  PulseInput,
} from '../../interfaces/wellness/IWellnessService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

export class WellnessService implements IWellnessService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async recordWorkPattern(creatorId: string, input: CreateWorkPatternInput): Promise<WorkPattern> {
    const now = new Date().toISOString();

    // Use RPC to accumulate work pattern data instead of overwriting.
    // The upsert_work_pattern Postgres function uses ON CONFLICT DO UPDATE
    // to sum durations and post counts when multiple sessions occur on the same day.
    const { data, error } = await this.db.rpc('upsert_work_pattern', {
      p_creator_id: creatorId,
      p_date: input.timestamp.split('T')[0],
      p_content_time_mins: input.type === 'content_creation' ? input.duration_mins : 0,
      p_engagement_time_mins: input.type === 'engagement' ? input.duration_mins : 0,
      p_management_time_mins: input.type === 'management' ? input.duration_mins : 0,
      p_post_count: input.type === 'content_creation' ? 1 : 0,
      p_activity_at: input.timestamp,
    });

    if (error) {
      this.logger.error('Failed to record work pattern', { creatorId, error });
      throw error;
    }

    // RPC returns an array from RETURNS SETOF; take the first (and only) row
    const row = Array.isArray(data) ? data[0] : data;

    return {
      id: row.id,
      creator_id: creatorId,
      type: input.type,
      duration_mins: input.duration_mins,
      timestamp: input.timestamp,
      metadata: input.metadata,
      created_at: row.created_at ?? now,
    };
  }

  async getWorkPatterns(
    creatorId: string,
    period: '7d' | '30d' | '90d'
  ): Promise<WorkPatternAggregation> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: patterns, error } = await this.db
      .from('creator_work_patterns')
      .select('*')
      .eq('creator_id', creatorId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      this.logger.error('Failed to get work patterns', { creatorId, error });
      throw error;
    }

    const rows = patterns || [];
    const totalContentMins = rows.reduce((s: number, r: any) => s + (r.content_time_mins || 0), 0);
    const totalEngagementMins = rows.reduce(
      (s: number, r: any) => s + (r.engagement_time_mins || 0),
      0
    );
    const totalManagementMins = rows.reduce(
      (s: number, r: any) => s + (r.management_time_mins || 0),
      0
    );
    const totalMins = totalContentMins + totalEngagementMins + totalManagementMins;
    const totalHours = totalMins / 60;

    // Count rest days (days with < 30 mins activity)
    const activeDays = new Set(rows.map((r: any) => r.date));
    const restDays = days - activeDays.size;

    // Check if baseline is established (14+ days of data)
    const { count } = await this.db
      .from('creator_work_patterns')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId);

    const daily: DailyWorkPattern[] = rows.map((r: any) => ({
      date: r.date,
      total_hours: parseFloat(r.total_hours) || 0,
      content_creation_mins: r.content_time_mins || 0,
      engagement_mins: r.engagement_time_mins || 0,
      management_mins: r.management_time_mins || 0,
    }));

    return {
      period,
      total_hours: Math.round(totalHours * 10) / 10,
      daily_average_hours: Math.round((totalHours / days) * 10) / 10,
      breakdown: {
        content_creation: {
          hours: Math.round((totalContentMins / 60) * 10) / 10,
          percentage: totalMins > 0 ? Math.round((totalContentMins / totalMins) * 1000) / 10 : 0,
        },
        engagement: {
          hours: Math.round((totalEngagementMins / 60) * 10) / 10,
          percentage: totalMins > 0 ? Math.round((totalEngagementMins / totalMins) * 1000) / 10 : 0,
        },
        management: {
          hours: Math.round((totalManagementMins / 60) * 10) / 10,
          percentage: totalMins > 0 ? Math.round((totalManagementMins / totalMins) * 1000) / 10 : 0,
        },
      },
      daily,
      rest_days: restDays,
      baseline_established: (count || 0) >= 14,
    };
  }

  async getHeatmap(creatorId: string, period: '7d' | '30d'): Promise<HeatmapData> {
    const days = period === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: patterns, error } = await this.db
      .from('creator_work_patterns')
      .select(
        'date, content_time_mins, engagement_time_mins, management_time_mins, first_activity_at, last_activity_at'
      )
      .eq('creator_id', creatorId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      this.logger.error('Failed to get heatmap data', { creatorId, error });
      throw error;
    }

    // Build heatmap from daily patterns
    // We approximate hourly distribution based on first/last activity and total minutes
    const heatmap: HeatmapEntry[] = [];
    const hourCounts: Map<string, number> = new Map();

    for (const row of patterns || []) {
      const date = new Date(row.date);
      const dayOfWeek = (date.getDay() + 6) % 7; // 0=Monday
      const totalMins =
        (row.content_time_mins || 0) +
        (row.engagement_time_mins || 0) +
        (row.management_time_mins || 0);

      if (totalMins === 0) continue;

      // Distribute activity across hours based on first/last activity
      const firstHour = row.first_activity_at ? new Date(row.first_activity_at).getHours() : 9;
      const lastHour = row.last_activity_at ? new Date(row.last_activity_at).getHours() : 17;
      const hourSpan = Math.max(1, lastHour - firstHour + 1);
      const minsPerHour = totalMins / hourSpan;

      for (let h = firstHour; h <= lastHour; h++) {
        const key = `${dayOfWeek}-${h}`;
        hourCounts.set(key, (hourCounts.get(key) || 0) + minsPerHour);
      }
    }

    // Find max for normalization
    const maxMins = Math.max(1, ...Array.from(hourCounts.values()));

    for (const [key, totalMins] of hourCounts) {
      const [day, hour] = key.split('-').map(Number);
      heatmap.push({
        day,
        hour,
        intensity: Math.round((totalMins / maxMins) * 100) / 100,
        total_mins: Math.round(totalMins),
      });
    }

    // Sort by day then hour
    heatmap.sort((a, b) => a.day - b.day || a.hour - b.hour);

    // Determine peak and quiet hours
    const hourTotals: number[] = new Array(24).fill(0);
    for (const entry of heatmap) {
      hourTotals[entry.hour] += entry.total_mins;
    }

    const avgHourTotal = hourTotals.reduce((s, v) => s + v, 0) / 24;
    const peakHours = hourTotals
      .map((v, i) => ({ hour: i, total: v }))
      .filter((h) => h.total > avgHourTotal * 1.5)
      .map((h) => h.hour);
    const quietHours = hourTotals
      .map((v, i) => ({ hour: i, total: v }))
      .filter((h) => h.total === 0)
      .map((h) => h.hour);

    return { period, heatmap, peak_hours: peakHours, quiet_hours: quietHours };
  }

  async recordPulse(creatorId: string, input: PulseInput): Promise<PulseCheckIn> {
    const compositeScore =
      Math.round(((input.energy + input.motivation + (6 - input.stress)) / 3) * 100) / 100;

    const { data, error } = await this.db
      .from('wellness_snapshots')
      .insert({
        creator_id: creatorId,
        energy: input.energy,
        motivation: input.motivation,
        stress: input.stress,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to record pulse', { creatorId, error });
      throw error;
    }

    return {
      id: data.id,
      energy: data.energy,
      motivation: data.motivation,
      stress: data.stress,
      composite_score: parseFloat(data.composite_score) || compositeScore,
      created_at: data.created_at,
    };
  }

  async getPulseHistory(creatorId: string, period: '30d' | '90d' | 'all'): Promise<PulseHistory> {
    let query = this.db
      .from('wellness_snapshots')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (period !== 'all') {
      const days = period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to get pulse history', { creatorId, error });
      throw error;
    }

    const entries: PulseCheckIn[] = (data || []).map((row: any) => ({
      id: row.id,
      energy: row.energy,
      motivation: row.motivation,
      stress: row.stress,
      composite_score: parseFloat(row.composite_score),
      created_at: row.created_at,
    }));

    // Calculate trend
    const avgComposite =
      entries.length > 0 ? entries.reduce((s, e) => s + e.composite_score, 0) / entries.length : 0;

    // Compare first half to second half for trend direction
    const half = Math.floor(entries.length / 2);
    let direction: PulseTrendDirection = 'stable';
    let change = 0;

    if (entries.length >= 4) {
      const recentAvg = entries.slice(0, half).reduce((s, e) => s + e.composite_score, 0) / half;
      const olderAvg =
        entries.slice(half).reduce((s, e) => s + e.composite_score, 0) / (entries.length - half);
      change = Math.round((recentAvg - olderAvg) * 100) / 100;
      direction = change > 0.1 ? 'improving' : change < -0.1 ? 'declining' : 'stable';
    }

    return {
      entries,
      trend: {
        direction,
        average_composite: Math.round(avgComposite * 100) / 100,
        change_from_previous_period: change,
      },
    };
  }

  async deletePulseHistory(creatorId: string): Promise<number> {
    const { count, error } = await this.db
      .from('wellness_snapshots')
      .delete({ count: 'exact' })
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to delete pulse history', { creatorId, error });
      throw error;
    }

    return count || 0;
  }

  async deleteAllWellnessData(creatorId: string): Promise<Record<string, number>> {
    // GDPR right to erasure: all wellness deletes MUST be atomic.
    // Uses a Postgres function to wrap all DELETEs in a single transaction.
    // If any delete fails, the entire operation rolls back — no partial state.
    const { data, error } = await this.db.rpc('delete_all_wellness_data', {
      p_creator_id: creatorId,
    });

    if (error) {
      this.logger.error('Failed to atomically delete all wellness data', { creatorId, error });
      throw new Error(
        `GDPR deletion failed for creator ${creatorId}: ${error.message || 'Unknown database error'}. No data was deleted.`
      );
    }

    // RPC returns JSONB with per-table counts
    const results: Record<string, number> = {
      wellness_snapshots: data?.wellness_snapshots ?? 0,
      creator_work_patterns: data?.creator_work_patterns ?? 0,
      burnout_risk_history: data?.burnout_risk_history ?? 0,
      creator_boundaries: data?.creator_boundaries ?? 0,
    };

    this.logger.info('Atomically deleted all wellness data', { creatorId, results });

    return results;
  }

  async getBenchmark(): Promise<WellnessBenchmark | null> {
    // Query the materialized view for anonymous benchmarks
    const { data, error } = await this.db.from('wellness_benchmarks').select('*').single();

    if (error || !data) {
      this.logger.warn('Benchmark data not available', { error });
      return null;
    }

    // K-anonymity: require minimum 10 participants
    if (data.sample_size < 10) {
      return null;
    }

    // For composite score benchmarks, query pulse data aggregates
    const { data: pulseData } = await this.db.from('wellness_snapshots').select('composite_score');

    const scores = (pulseData || [])
      .map((r: any) => parseFloat(r.composite_score))
      .sort((a: number, b: number) => a - b);
    const avgComposite =
      scores.length > 0 ? scores.reduce((s: number, v: number) => s + v, 0) / scores.length : 0;

    return {
      average_weekly_hours: parseFloat(data.avg_weekly_hours),
      average_composite_score: Math.round(avgComposite * 10) / 10,
      percentile_breakdowns: {
        work_hours: {
          p25: parseFloat(data.p25_hours),
          p50: parseFloat(data.p50_hours),
          p75: parseFloat(data.p75_hours),
        },
        composite_score: {
          p25: scores.length > 0 ? scores[Math.floor(scores.length * 0.25)] : 0,
          p50: scores.length > 0 ? scores[Math.floor(scores.length * 0.5)] : 0,
          p75: scores.length > 0 ? scores[Math.floor(scores.length * 0.75)] : 0,
        },
      },
      sample_size: data.sample_size,
      updated_at: new Date().toISOString(),
    };
  }

  private activityColumn(type: string): string {
    switch (type) {
      case 'content_creation':
        return 'content_time_mins';
      case 'engagement':
        return 'engagement_time_mins';
      case 'management':
        return 'management_time_mins';
      default:
        return 'content_time_mins';
    }
  }
}
