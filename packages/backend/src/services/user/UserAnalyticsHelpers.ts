/**
 * UserAnalyticsHelpers
 * Extracted from UserAnalyticsService (SOV-REFACTOR-001).
 *
 * Contains stateless pure-function utilities that carry no dependency on class
 * instance state (no `this.` references). Safe to import and unit-test in
 * isolation without instantiating the full service.
 *
 * Functions exported here are re-used by:
 *   - UserAnalyticsService (via direct import)
 *   - Future: UserChurnService, UserGrowthService
 */

import crypto from 'crypto';
import {
  ChurnRiskFactor,
  GrowthProjection,
  SeasonalityPattern,
  TrendPoint,
} from '../../types/user-analytics';

// ---------------------------------------------------------------------------
// Churn scoring helpers
// ---------------------------------------------------------------------------

/**
 * Computes a 0–100 churn risk score by weighting each contributing factor.
 */
export function calculateChurnRiskScore(factors: ChurnRiskFactor[]): number {
  let score = 0;

  factors.forEach((factor) => {
    let factorScore = 0;

    // Normalize factor value to 0-100 scale
    if (factor.factor === 'days_since_activity') {
      factorScore = Math.min((factor.value / 30) * 100, 100);
    } else if (factor.factor === 'engagement_score') {
      factorScore = 100 - factor.value;
    } else if (factor.factor === 'subscription_status') {
      factorScore = 100 - factor.value;
    } else if (factor.factor === 'account_age') {
      factorScore = factor.value < 30 ? 50 : 0;
    } else if (factor.factor === 'activity_level') {
      factorScore = 100 - factor.value;
    }

    score += factorScore * factor.weight;
  });

  return Math.round(Math.min(score, 100));
}

/**
 * Maps a numeric risk score to a named risk level bucket.
 */
export function getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 50) return 'high';
  if (riskScore >= 25) return 'medium';
  return 'low';
}

/**
 * Derives a list of recommended retention actions from the risk factors and
 * overall risk level.
 */
export function generateRetentionActions(factors: ChurnRiskFactor[], riskLevel: string): string[] {
  const actions: string[] = [];

  factors.forEach((factor) => {
    if (factor.impact === 'negative') {
      switch (factor.factor) {
        case 'days_since_activity':
          actions.push('Send re-engagement email with personalized content');
          break;
        case 'engagement_score':
          actions.push('Recommend high-engagement content based on preferences');
          break;
        case 'subscription_status':
          actions.push('Offer limited-time subscription discount');
          break;
        case 'account_age':
          actions.push('Provide onboarding assistance and tutorials');
          break;
        case 'activity_level':
          actions.push('Gamify experience with challenges and rewards');
          break;
      }
    }
  });

  if (riskLevel === 'critical') {
    actions.push('Immediate intervention: Personal outreach from support team');
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Growth projection helpers
// ---------------------------------------------------------------------------

/**
 * Classifies the shape of a growth trend from a series of data points.
 */
export function determineGrowthType(
  trends: TrendPoint[]
): 'linear' | 'exponential' | 'plateau' | 'declining' {
  if (trends.length < 3) return 'linear';

  const recentTrends = trends.slice(-10);
  const upTrends = recentTrends.filter((t) => t.trend === 'up').length;
  const downTrends = recentTrends.filter((t) => t.trend === 'down').length;

  if (upTrends > 7) return 'exponential';
  if (downTrends > 7) return 'declining';
  if (upTrends < 3 && downTrends < 3) return 'plateau';
  return 'linear';
}

/**
 * Projects user growth 30 days forward using a simple linear extrapolation
 * over the most recent 30 data points.
 */
export function projectGrowth(trends: TrendPoint[]): GrowthProjection {
  if (trends.length < 2) {
    return {
      method: 'linear',
      projectedUsers: 0,
      projectionDate: new Date(),
      confidenceInterval: { lower: 0, upper: 0 },
    };
  }

  // Simple linear projection
  const recentTrends = trends.slice(-30); // Last 30 days
  const avgDailyGrowth =
    recentTrends.length > 1
      ? (recentTrends[recentTrends.length - 1].value - recentTrends[0].value) /
        recentTrends.length
      : 0;

  const projectionDate = new Date();
  projectionDate.setDate(projectionDate.getDate() + 30); // 30 days ahead

  const currentValue = trends[trends.length - 1].value;
  const projectedUsers = Math.round(currentValue + avgDailyGrowth * 30);

  return {
    method: 'linear',
    projectedUsers,
    projectionDate,
    confidenceInterval: {
      lower: Math.round(projectedUsers * 0.8),
      upper: Math.round(projectedUsers * 1.2),
    },
    accuracy: 85,
  };
}

/**
 * Returns a simplified seasonality pattern from a trend series.
 * TODO(SOV-REFACTOR-001): Replace stub with real FFT/autocorrelation analysis.
 */
export function identifySeasonality(trends: TrendPoint[]): SeasonalityPattern[] {
  // Simplified seasonality detection
  return [
    {
      pattern: 'weekly',
      peakPeriods: ['Monday', 'Wednesday'],
      averageVariance: 15,
    },
  ];
}

// ---------------------------------------------------------------------------
// User health / scoring helpers
// ---------------------------------------------------------------------------

/**
 * Recency score: 100 at time-of-activity, loses 3 points per day of inactivity.
 */
export function calculateRecencyScore(lastActivity: Date): number {
  const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, 100 - daysSince * 3); // Lose 3 points per day
}

/**
 * Loyalty score: 0–100 linearly over the first year of account age.
 */
export function calculateLoyaltyScore(user: { created_at: string | Date }): number {
  const accountAgeDays =
    (Date.now() - new Date(user.created_at).getTime()) / (24 * 60 * 60 * 1000);
  return Math.min((accountAgeDays / 365) * 100, 100); // 100 points at 1 year
}

/**
 * Returns the account age in fractional days.
 */
export function calculateAccountAge(user: { created_at: string | Date }): number {
  return (Date.now() - new Date(user.created_at).getTime()) / (24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Export / serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialises an array of objects to a simple CSV string.
 * First row contains header keys derived from the first element.
 */
export function formatAsCSV(data: any[]): string {
  // Simple CSV formatting
  const rows: string[] = [];

  // Add headers
  if (data.length > 0) {
    rows.push(Object.keys(data[0]).join(','));
  }

  // Add data rows
  data.forEach((item) => {
    rows.push(Object.values(item).join(','));
  });

  return rows.join('\n');
}

/**
 * Generates a collision-resistant export identifier.
 */
export function generateExportId(): string {
  return `export-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
}
