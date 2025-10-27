/**
 * CI/CD Dashboard - Type Definitions Barrel Export
 *
 * Centralized export point for all CI/CD dashboard type definitions.
 */

// Deployment types
export type * from './deployment';
export type {
  Deployment,
  DeploymentStage,
  HealthCheckResult,
  HealthCheckDetails,
  SmokeTestResult,
  DeploymentMetrics,
  TrafficShiftStatus,
  TrafficShiftStage,
  DeploymentHistoryQuery,
  DeploymentHistoryResponse,
  DeploymentAnalytics,
  RollbackRequest,
  RollbackResponse,
} from './deployment';

// GitHub Actions types
export type * from './github-actions';
export type {
  GitHubWorkflow,
  GitHubWorkflowRun,
  GitHubWorkflowJob,
  GitHubWorkflowStep,
  GitHubCommit,
  GitHubRepository,
  GitHubUser,
  GitHubWorkflowRunsResponse,
  GitHubWorkflowJobsResponse,
  GitHubAPIError,
  GitHubRateLimit,
  GitHubWorkflowDispatchRequest,
  GitHubWorkflowRunsQuery,
} from './github-actions';

// Real-time types
export type * from './realtime';
export type {
  WebSocketMessage,
  DeploymentUpdatePayload,
  StageUpdatePayload,
  HealthCheckUpdatePayload,
  SmokeTestUpdatePayload,
  TrafficShiftUpdatePayload,
  MetricsUpdatePayload,
  ErrorLogPayload,
  WebSocketSubscription,
  WebSocketOptions,
  SSEOptions,
  RealtimeServiceConfig,
  RealtimeConnectionState,
} from './realtime';
