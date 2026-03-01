/**
 * BurnoutScoringService
 * Weighted 5-factor burnout scoring algorithm per ADR-019
 * EPIC-007: Creator Wellness System (US-E7-003)
 *
 * Factors and weights:
 * - Work hours trend: 0.25
 * - Posting frequency spike: 0.20
 * - Engagement drop: 0.20
 * - Hour regularity: 0.15
 * - Rest day deficit: 0.20
 */

import type {
  BurnoutRiskScore,
  BurnoutLevel,
  BurnoutFactors,
  BurnoutHistoryEntry,
  SensitivityLevel,
} from '@shared/types/wellness';
import type { IBurnoutScoringService } from '../../interfaces/wellness/IBurnoutScoringService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

const FACTOR_WEIGHTS = {
  work_hours_trend: 0.25,
  posting_frequency: 0.2,
  engagement_drop: 0.2,
  hour_regularity: 0.15,
  rest_day_deficit: 0.2,
} as const;

// Sensitivity multipliers for trigger thresholds
const SENSITIVITY_MULTIPLIERS: Record<SensitivityLevel, number> = {
  relaxed: 1.25,
  normal: 1.0,
  sensitive: 0.75,
};

function getLevel(score: number): BurnoutLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'critical';
}

export class BurnoutScoringService implements IBurnoutScoringService {
  // TTL-based cache backed by database (creator_boundaries.sensitivity_level)
  private sensitivityCache = new Map<string, { level: SensitivityLevel; expiresAt: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly DEFAULT_SENSITIVITY: SensitivityLevel = 'normal';

  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async calculateScore(creatorId: string): Promise<BurnoutRiskScore> {
    // Check if baseline is established (14+ days of data)
    const { count: totalDays, error: countError } = await this.db
      .from('creator_work_patterns')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId);

    if (countError) {
      this.logger.error('Failed to fetch work pattern count for burnout scoring', {
        error: countError instanceof Error ? countError.message : String(countError),
        creatorId,
      });
      throw countError;
    }

    if ((totalDays || 0) < 14) {
      return {
        score: null,
        level: 'low',
        factors: this.emptyFactors(),
        baseline_ready: false,
        baseline_days_remaining: 14 - (totalDays || 0),
        history: [],
        recommendations: [],
        updated_at: new Date().toISOString(),
      };
    }

    const sensitivity = await this.getSensitivity(creatorId);
    const multiplier = SENSITIVITY_MULTIPLIERS[sensitivity];

    // Get current week data (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get baseline (4-week rolling average, days 8-35)
    const baselineStart = new Date(now);
    baselineStart.setDate(baselineStart.getDate() - 35);

    const { data: currentWeek, error: currentWeekError } = await this.db
      .from('creator_work_patterns')
      .select('*')
      .eq('creator_id', creatorId)
      .gte('date', weekAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (currentWeekError) {
      this.logger.error('Failed to fetch current week work patterns for burnout scoring', {
        error:
          currentWeekError instanceof Error ? currentWeekError.message : String(currentWeekError),
        creatorId,
      });
      throw currentWeekError;
    }

    const { data: baselineData, error: baselineError } = await this.db
      .from('creator_work_patterns')
      .select('*')
      .eq('creator_id', creatorId)
      .gte('date', baselineStart.toISOString().split('T')[0])
      .lt('date', weekAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (baselineError) {
      this.logger.error('Failed to fetch baseline work patterns for burnout scoring', {
        error: baselineError instanceof Error ? baselineError.message : String(baselineError),
        creatorId,
      });
      throw baselineError;
    }

    const current = currentWeek || [];
    const baseline = baselineData || [];

    // Calculate each factor
    const factors = this.computeFactors(current, baseline, multiplier);

    // Calculate final score
    const score = Math.round(
      (factors.work_hours_trend.value * factors.work_hours_trend.weight +
        factors.posting_frequency.value * factors.posting_frequency.weight +
        factors.engagement_drop.value * factors.engagement_drop.weight +
        factors.hour_regularity.value * factors.hour_regularity.weight +
        factors.rest_day_deficit.value * factors.rest_day_deficit.weight) *
        100
    );

    const clampedScore = Math.min(100, Math.max(0, score));
    const level = getLevel(clampedScore);

    // Get history
    const { data: historyData, error: historyError } = await this.db
      .from('burnout_risk_history')
      .select('week, score, level')
      .eq('creator_id', creatorId)
      .order('week', { ascending: false })
      .limit(8);

    if (historyError) {
      this.logger.error('Failed to fetch burnout risk history', {
        error: historyError instanceof Error ? historyError.message : String(historyError),
        creatorId,
      });
      throw historyError;
    }

    const history: BurnoutHistoryEntry[] = (historyData || []).map((h: any) => ({
      week: h.week,
      score: h.score,
      level: h.level,
    }));

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, current);

    // Save current week's score to history
    const isoWeek = this.getISOWeek(now);
    const { error: upsertError } = await this.db.from('burnout_risk_history').upsert(
      {
        creator_id: creatorId,
        week: isoWeek,
        score: clampedScore,
        level,
        factors: JSON.stringify(factors),
      },
      { onConflict: 'creator_id,week' }
    );

    if (upsertError) {
      this.logger.error('Failed to save burnout risk score to history', {
        error: upsertError instanceof Error ? upsertError.message : String(upsertError),
        creatorId,
        week: isoWeek,
      });
      throw upsertError;
    }

    return {
      score: clampedScore,
      level,
      factors,
      baseline_ready: true,
      baseline_days_remaining: 0,
      history,
      recommendations,
      updated_at: new Date().toISOString(),
    };
  }

  async setSensitivity(
    creatorId: string,
    sensitivity: SensitivityLevel
  ): Promise<{ sensitivity: SensitivityLevel; updated_at: string }> {
    const now = new Date().toISOString();

    // Persist to database via upsert on creator_boundaries
    const { error } = await this.db
      .from('creator_boundaries')
      .upsert(
        { creator_id: creatorId, sensitivity_level: sensitivity, updated_at: now },
        { onConflict: 'creator_id' }
      );

    if (error) {
      this.logger.error('Failed to persist sensitivity setting', { creatorId, error });
      throw error;
    }

    // Update cache
    this.sensitivityCache.set(creatorId, {
      level: sensitivity,
      expiresAt: Date.now() + BurnoutScoringService.CACHE_TTL,
    });

    this.logger.info('Burnout sensitivity updated', { creatorId, sensitivity });
    return { sensitivity, updated_at: now };
  }

  async getSensitivity(creatorId: string): Promise<SensitivityLevel> {
    // Check cache first
    const cached = this.sensitivityCache.get(creatorId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.level;
    }

    // Read from database
    try {
      const { data, error } = await this.db
        .from('creator_boundaries')
        .select('sensitivity_level')
        .eq('creator_id', creatorId)
        .single();

      if (error || !data) {
        return BurnoutScoringService.DEFAULT_SENSITIVITY;
      }

      const level =
        (data.sensitivity_level as SensitivityLevel) || BurnoutScoringService.DEFAULT_SENSITIVITY;

      // Cache the result
      this.sensitivityCache.set(creatorId, {
        level,
        expiresAt: Date.now() + BurnoutScoringService.CACHE_TTL,
      });

      return level;
    } catch {
      // Graceful degradation: use cached value if available, otherwise default
      if (cached) {
        return cached.level;
      }
      return BurnoutScoringService.DEFAULT_SENSITIVITY;
    }
  }

  private computeFactors(current: any[], baseline: any[], multiplier: number): BurnoutFactors {
    // Factor 1: Work hours trend
    const currentHours = current.reduce(
      (s: number, r: any) => s + parseFloat(r.total_hours || 0),
      0
    );
    const baselineWeeks = Math.max(1, Math.ceil(baseline.length / 7));
    const baselineHoursPerWeek =
      baseline.reduce((s: number, r: any) => s + parseFloat(r.total_hours || 0), 0) / baselineWeeks;
    const hoursRatio = baselineHoursPerWeek > 0 ? currentHours / baselineHoursPerWeek : 0;
    const workHoursValue = Math.min(1.0, Math.max(0, (hoursRatio - 1.0 * multiplier) / 0.5));

    // Factor 2: Posting frequency spike
    const currentPosts = current.reduce((s: number, r: any) => s + (r.post_count || 0), 0);
    const baselinePostsPerWeek =
      baseline.reduce((s: number, r: any) => s + (r.post_count || 0), 0) / baselineWeeks;
    const postRatio = baselinePostsPerWeek > 0 ? currentPosts / baselinePostsPerWeek : 0;
    const postFreqValue = Math.min(1.0, Math.max(0, (postRatio - 1.0 * multiplier) / 1.0));

    // Factor 3: Engagement drop (approximated from activity patterns)
    // Since we track activity, we use engagement time as a proxy
    const currentEngagement = current.reduce(
      (s: number, r: any) => s + (r.engagement_time_mins || 0),
      0
    );
    const baselineEngPerWeek =
      baseline.reduce((s: number, r: any) => s + (r.engagement_time_mins || 0), 0) / baselineWeeks;
    const engRatio = baselineEngPerWeek > 0 ? currentEngagement / baselineEngPerWeek : 1;
    const engDropValue = Math.min(1.0, Math.max(0, (1.0 - engRatio) / (0.3 * multiplier)));

    // Factor 4: Hour regularity (stddev of first_activity_at hours)
    const startHours = current
      .filter((r: any) => r.first_activity_at)
      .map((r: any) => new Date(r.first_activity_at).getHours());
    let stddevHours = 0;
    if (startHours.length > 1) {
      const mean = startHours.reduce((s: number, h: number) => s + h, 0) / startHours.length;
      const variance =
        startHours.reduce((s: number, h: number) => s + Math.pow(h - mean, 2), 0) /
        startHours.length;
      stddevHours = Math.sqrt(variance);
    }
    const hourRegValue = Math.min(1.0, Math.max(0, (stddevHours - 1.0 * multiplier) / 3.0));

    // Factor 5: Rest day deficit
    const activeDays = new Set(current.map((r: any) => r.date)).size;
    const restDays = 7 - activeDays;
    const restDeficitValue = Math.min(
      1.0,
      Math.max(0, (2 * multiplier - restDays) / (2 * multiplier))
    );

    return {
      work_hours_trend: {
        value: Math.round(workHoursValue * 100) / 100,
        weight: FACTOR_WEIGHTS.work_hours_trend,
        detail: `Working ${Math.round(hoursRatio * 100)}% of baseline`,
      },
      posting_frequency: {
        value: Math.round(postFreqValue * 100) / 100,
        weight: FACTOR_WEIGHTS.posting_frequency,
        detail: `Posting ${Math.round(postRatio * 100)}% of 4-week avg`,
      },
      engagement_drop: {
        value: Math.round(engDropValue * 100) / 100,
        weight: FACTOR_WEIGHTS.engagement_drop,
        detail: `Engagement at ${Math.round(engRatio * 100)}% of avg`,
      },
      hour_regularity: {
        value: Math.round(hourRegValue * 100) / 100,
        weight: FACTOR_WEIGHTS.hour_regularity,
        detail: stddevHours > 1 ? 'High schedule variance' : 'Regular schedule',
      },
      rest_day_deficit: {
        value: Math.round(restDeficitValue * 100) / 100,
        weight: FACTOR_WEIGHTS.rest_day_deficit,
        detail: `${restDays} rest day${restDays !== 1 ? 's' : ''} this week (target: 2)`,
      },
    };
  }

  private generateRecommendations(factors: BurnoutFactors, current: any[]): string[] {
    const recs: string[] = [];

    if (factors.rest_day_deficit.value > 0.3) {
      const activeDays = new Set(current.map((r: any) => r.date)).size;
      if (activeDays >= 6) {
        recs.push(`Consider taking tomorrow off — you've worked ${activeDays} consecutive days`);
      }
    }

    if (factors.posting_frequency.value > 0.3) {
      recs.push('Your posting frequency is above sustainable pace');
    }

    if (factors.work_hours_trend.value > 0.3) {
      recs.push('Your work hours are trending above your baseline — consider reducing');
    }

    if (factors.hour_regularity.value > 0.3) {
      recs.push('Your schedule is irregular — consistent hours may reduce fatigue');
    }

    if (factors.engagement_drop.value > 0.3) {
      recs.push('Engagement has dropped — this can be a sign of burnout');
    }

    return recs;
  }

  private emptyFactors(): BurnoutFactors {
    return {
      work_hours_trend: {
        value: 0,
        weight: FACTOR_WEIGHTS.work_hours_trend,
        detail: 'Baseline not ready',
      },
      posting_frequency: {
        value: 0,
        weight: FACTOR_WEIGHTS.posting_frequency,
        detail: 'Baseline not ready',
      },
      engagement_drop: {
        value: 0,
        weight: FACTOR_WEIGHTS.engagement_drop,
        detail: 'Baseline not ready',
      },
      hour_regularity: {
        value: 0,
        weight: FACTOR_WEIGHTS.hour_regularity,
        detail: 'Baseline not ready',
      },
      rest_day_deficit: {
        value: 0,
        weight: FACTOR_WEIGHTS.rest_day_deficit,
        detail: 'Baseline not ready',
      },
    };
  }

  private getISOWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}
