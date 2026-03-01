/**
 * CI/CD Dashboard - Deployment Metrics Service
 *
 * Service for calculating and aggregating deployment metrics and analytics.
 * Provides insights into deployment performance, success rates, and trends.
 */

import type {
  Deployment,
  DeploymentAnalytics,
  DeploymentMetrics,
  DeploymentHistoryQuery,
} from '../types';

/**
 * Calculate deployment metrics from deployment data
 */
export function calculateDeploymentMetrics(deployment: Deployment): DeploymentMetrics {
  const totalSmokeTests = deployment.smokeTests.length;
  const passedSmokeTests = deployment.smokeTests.filter((test) => test.status === 'passed').length;
  const failedSmokeTests = deployment.smokeTests.filter((test) => test.status === 'failed').length;

  const healthChecks = deployment.healthChecks;
  const successfulHealthChecks = healthChecks.filter((check) => check.status === 'healthy').length;

  return {
    filesChanged: deployment.metrics.filesChanged,
    linesAdded: deployment.metrics.linesAdded,
    linesDeleted: deployment.metrics.linesDeleted,
    errorRate: deployment.metrics.errorRate,
    responseTimeP50: deployment.metrics.responseTimeP50,
    responseTimeP95: deployment.metrics.responseTimeP95,
    responseTimeP99: deployment.metrics.responseTimeP99,
    healthCheckSuccessRate:
      healthChecks.length > 0 ? (successfulHealthChecks / healthChecks.length) * 100 : 0,
    smokeTestPassRate: totalSmokeTests > 0 ? (passedSmokeTests / totalSmokeTests) * 100 : 0,
    totalSmokeTests,
    passedSmokeTests,
    failedSmokeTests,
    trafficShift: deployment.metrics.trafficShift,
  };
}

/**
 * Calculate deployment analytics from historical data
 */
export function calculateDeploymentAnalytics(
  deployments: Deployment[],
  period: 'day' | 'week' | 'month' | 'quarter' | 'year'
): DeploymentAnalytics {
  const totalDeployments = deployments.length;

  if (totalDeployments === 0) {
    return {
      period,
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      rolledBackDeployments: 0,
      successRate: 0,
      averageDuration: 0,
      medianDuration: 0,
      averageRollbackTime: 0,
      deploymentFrequency: 0,
      meanTimeToRecovery: 0,
      changeFailureRate: 0,
      sizeDistribution: { small: 0, medium: 0, large: 0 },
      timeDistribution: { fast: 0, normal: 0, slow: 0 },
    };
  }

  // Count deployment statuses
  const successfulDeployments = deployments.filter((d) => d.status === 'success').length;
  const failedDeployments = deployments.filter((d) => d.status === 'failed').length;
  const rolledBackDeployments = deployments.filter((d) => d.status === 'rolled_back').length;

  // Calculate success rate
  const successRate = (successfulDeployments / totalDeployments) * 100;

  // Calculate durations
  const deploymentsWithDuration = deployments.filter((d) => d.duration);
  const durations = deploymentsWithDuration.map((d) => d.duration!);

  const averageDuration =
    durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

  const medianDuration = durations.length > 0 ? calculateMedian(durations) : 0;

  // Calculate rollback metrics
  const rollbackTimes = deployments
    .filter((d) => d.status === 'rolled_back' && d.duration)
    .map((d) => d.duration!);

  const averageRollbackTime =
    rollbackTimes.length > 0
      ? rollbackTimes.reduce((sum, t) => sum + t, 0) / rollbackTimes.length
      : 0;

  // Calculate deployment frequency (deployments per day)
  const periodDays = getPeriodDays(period);
  const deploymentFrequency = totalDeployments / periodDays;

  // Calculate MTTR (Mean Time To Recovery)
  const failedDeploymentsData = deployments.filter(
    (d) => d.status === 'failed' || d.status === 'rolled_back'
  );
  const recoveryTimes = failedDeploymentsData.map((d) => d.duration ?? 0);
  const meanTimeToRecovery =
    recoveryTimes.length > 0
      ? recoveryTimes.reduce((sum, t) => sum + t, 0) / recoveryTimes.length
      : 0;

  // Calculate change failure rate
  const changesIntroducingFailures = failedDeployments + rolledBackDeployments;
  const changeFailureRate = (changesIntroducingFailures / totalDeployments) * 100;

  // Calculate size distribution
  let small = 0,
    medium = 0,
    large = 0;
  deployments.forEach((d) => {
    if (d.metrics.filesChanged < 100) small++;
    else if (d.metrics.filesChanged <= 500) medium++;
    else large++;
  });

  // Calculate time distribution (based on duration)
  let fast = 0,
    normal = 0,
    slow = 0;
  deploymentsWithDuration.forEach((d) => {
    const durationMinutes = d.duration! / 60000;
    if (durationMinutes < 10) fast++;
    else if (durationMinutes <= 20) normal++;
    else slow++;
  });

  return {
    period,
    totalDeployments,
    successfulDeployments,
    failedDeployments,
    rolledBackDeployments,
    successRate,
    averageDuration,
    medianDuration,
    averageRollbackTime,
    deploymentFrequency,
    meanTimeToRecovery,
    changeFailureRate,
    sizeDistribution: { small, medium, large },
    timeDistribution: { fast, normal, slow },
  };
}

/**
 * Filter deployments by query parameters
 */
export function filterDeployments(
  deployments: Deployment[],
  query: DeploymentHistoryQuery
): Deployment[] {
  let filtered = [...deployments];

  // Filter by environment
  if (query.environment) {
    filtered = filtered.filter((d) => d.environment === query.environment);
  }

  // Filter by status
  if (query.status) {
    filtered = filtered.filter((d) => d.status === query.status);
  }

  // Filter by author
  if (query.author) {
    filtered = filtered.filter(
      (d) =>
        d.author.toLowerCase().includes(query.author!.toLowerCase()) ||
        d.authorEmail.toLowerCase().includes(query.author!.toLowerCase())
    );
  }

  // Filter by date range
  if (query.startDate) {
    filtered = filtered.filter((d) => d.startTime >= query.startDate!);
  }

  if (query.endDate) {
    filtered = filtered.filter((d) => d.startTime <= query.endDate!);
  }

  // Sort deployments
  if (query.sortBy) {
    filtered.sort((a, b) => {
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

      switch (query.sortBy) {
        case 'startTime':
          return (a.startTime.getTime() - b.startTime.getTime()) * sortOrder;
        case 'duration':
          return ((a.duration ?? 0) - (b.duration ?? 0)) * sortOrder;
        case 'status':
          return a.status.localeCompare(b.status) * sortOrder;
        case 'author':
          return a.author.localeCompare(b.author) * sortOrder;
        default:
          return 0;
      }
    });
  }

  return filtered;
}

/**
 * Paginate deployments
 */
export function paginateDeployments(
  deployments: Deployment[],
  page = 1,
  limit = 20
): {
  deployments: Deployment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  const total = deployments.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  return {
    deployments: deployments.slice(startIndex, endIndex),
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Calculate median value
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

/**
 * Get period duration in days
 */
function getPeriodDays(period: 'day' | 'week' | 'month' | 'quarter' | 'year'): number {
  switch (period) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case 'year':
      return 365;
    default:
      return 30;
  }
}

/**
 * Calculate deployment trend
 */
export function calculateDeploymentTrend(
  currentPeriodMetrics: DeploymentAnalytics,
  previousPeriodMetrics: DeploymentAnalytics
): {
  successRateTrend: number;
  deploymentFrequencyTrend: number;
  averageDurationTrend: number;
  changeFailureRateTrend: number;
} {
  return {
    successRateTrend:
      previousPeriodMetrics.successRate > 0
        ? ((currentPeriodMetrics.successRate - previousPeriodMetrics.successRate) /
            previousPeriodMetrics.successRate) *
          100
        : 0,
    deploymentFrequencyTrend:
      previousPeriodMetrics.deploymentFrequency > 0
        ? ((currentPeriodMetrics.deploymentFrequency - previousPeriodMetrics.deploymentFrequency) /
            previousPeriodMetrics.deploymentFrequency) *
          100
        : 0,
    averageDurationTrend:
      previousPeriodMetrics.averageDuration > 0
        ? ((currentPeriodMetrics.averageDuration - previousPeriodMetrics.averageDuration) /
            previousPeriodMetrics.averageDuration) *
          100
        : 0,
    changeFailureRateTrend:
      previousPeriodMetrics.changeFailureRate > 0
        ? ((currentPeriodMetrics.changeFailureRate - previousPeriodMetrics.changeFailureRate) /
            previousPeriodMetrics.changeFailureRate) *
          100
        : 0,
  };
}

/**
 * Get deployment health score (0-100)
 */
export function getDeploymentHealthScore(deployment: Deployment): number {
  let score = 0;

  // Success = 40 points
  if (deployment.status === 'success') {
    score += 40;
  } else if (deployment.status === 'in_progress') {
    score += 20;
  }

  // Health checks = 20 points
  const healthyChecks = deployment.healthChecks.filter(
    (check) => check.status === 'healthy'
  ).length;
  const healthCheckScore =
    deployment.healthChecks.length > 0 ? (healthyChecks / deployment.healthChecks.length) * 20 : 0;
  score += healthCheckScore;

  // Smoke tests = 20 points
  const passedTests = deployment.smokeTests.filter((test) => test.status === 'passed').length;
  const smokeTestScore =
    deployment.smokeTests.length > 0 ? (passedTests / deployment.smokeTests.length) * 20 : 0;
  score += smokeTestScore;

  // Performance = 20 points
  const errorRateScore = deployment.metrics.errorRate < 5 ? 10 : 0;
  const responseTimeScore = deployment.metrics.responseTimeP95 < 1000 ? 10 : 0;
  score += errorRateScore + responseTimeScore;

  return Math.round(score);
}
