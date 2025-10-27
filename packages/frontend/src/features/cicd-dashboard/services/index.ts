/**
 * CI/CD Dashboard - Services Barrel Export
 *
 * Centralized export point for all CI/CD dashboard services.
 */

// GitHub Actions Service
export {
  GitHubActionsService,
  initGitHubActionsService,
  getGitHubActionsService,
} from './githubActionsService';

// Health Check Service
export {
  HealthCheckService,
  initHealthCheckService,
  getHealthCheckService,
} from './healthCheckService';

// Real-time Service
export {
  RealtimeService,
  initRealtimeService,
  getRealtimeService,
} from './realtimeService';

// Deployment Metrics Service
export {
  calculateDeploymentMetrics,
  calculateDeploymentAnalytics,
  filterDeployments,
  paginateDeployments,
  calculateDeploymentTrend,
  getDeploymentHealthScore,
} from './deploymentMetricsService';
