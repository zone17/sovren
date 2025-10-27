/**
 * CI/CD Dashboard - Deployment Type Definitions
 *
 * Comprehensive type system for deployment tracking, monitoring, and management.
 * Follows strict TypeScript standards with zero `any` types.
 */

export type DeploymentEnvironment = 'staging' | 'production';

export type DeploymentStatus =
  | 'queued'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'rolled_back'
  | 'rolling_back';

export type DeploymentStageType =
  | 'quality-gates'
  | 'build'
  | 'deploy'
  | 'health-check'
  | 'smoke-test'
  | 'traffic-shift'
  | 'validation';

export type StageStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled';

/**
 * Deployment metadata and tracking information
 */
export interface Deployment {
  /** Unique deployment identifier */
  id: string;

  /** Target deployment environment */
  environment: DeploymentEnvironment;

  /** Current deployment status */
  status: DeploymentStatus;

  /** Git commit SHA */
  commitSha: string;

  /** Git commit message */
  commitMessage: string;

  /** Commit author name */
  author: string;

  /** Commit author email */
  authorEmail: string;

  /** Deployment start timestamp */
  startTime: Date;

  /** Deployment end timestamp (if completed) */
  endTime?: Date;

  /** Deployment duration in milliseconds */
  duration?: number;

  /** GitHub Actions workflow run ID */
  workflowRunId: number;

  /** GitHub Actions workflow name */
  workflowName: string;

  /** Deployment stages */
  stages: DeploymentStage[];

  /** Health check results */
  healthChecks: HealthCheckResult[];

  /** Smoke test results */
  smokeTests: SmokeTestResult[];

  /** Deployment metrics */
  metrics: DeploymentMetrics;

  /** Previous deployment ID (for rollback tracking) */
  previousDeploymentId?: string;

  /** Rollback reason (if rolled back) */
  rollbackReason?: string;

  /** Deployment tags */
  tags: string[];
}

/**
 * Individual deployment stage information
 */
export interface DeploymentStage {
  /** Stage identifier */
  id: string;

  /** Stage type */
  type: DeploymentStageType;

  /** Stage name (human-readable) */
  name: string;

  /** Stage description */
  description: string;

  /** Current stage status */
  status: StageStatus;

  /** Stage start timestamp */
  startTime?: Date;

  /** Stage end timestamp */
  endTime?: Date;

  /** Stage duration in milliseconds */
  duration?: number;

  /** Stage progress percentage (0-100) */
  progress: number;

  /** GitHub Actions job ID */
  jobId?: number;

  /** Stage logs (truncated for UI) */
  logs?: string[];

  /** Stage error message (if failed) */
  error?: string;

  /** Stage error stack trace (if failed) */
  stackTrace?: string;

  /** Stage dependencies (must complete before this stage) */
  dependencies: string[];
}

/**
 * Health check endpoint result
 */
export interface HealthCheckResult {
  /** Health check endpoint path */
  endpoint: '/health' | '/ready' | '/live' | '/detailed';

  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Response time in milliseconds */
  responseTime: number;

  /** Check timestamp */
  timestamp: Date;

  /** HTTP status code */
  statusCode: number;

  /** Detailed health information */
  details?: HealthCheckDetails;

  /** Error message (if unhealthy) */
  error?: string;
}

/**
 * Detailed health check response data
 */
export interface HealthCheckDetails {
  /** Service version */
  version: string;

  /** Service uptime in seconds */
  uptime: number;

  /** Database connection status */
  database?: {
    connected: boolean;
    responseTime: number;
    activeConnections: number;
  };

  /** Cache connection status */
  cache?: {
    connected: boolean;
    responseTime: number;
    hitRate: number;
  };

  /** Memory usage */
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };

  /** CPU usage */
  cpu?: {
    usage: number;
    loadAverage: number[];
  };
}

/**
 * Smoke test result
 */
export interface SmokeTestResult {
  /** Test identifier */
  id: string;

  /** Test name */
  name: string;

  /** Test description */
  description: string;

  /** Test category */
  category: 'api' | 'database' | 'cache' | 'auth' | 'integration' | 'performance';

  /** Test status */
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

  /** Test start time */
  startTime?: Date;

  /** Test end time */
  endTime?: Date;

  /** Test duration in milliseconds */
  duration?: number;

  /** Error message (if failed) */
  error?: string;

  /** Error stack trace (if failed) */
  stackTrace?: string;

  /** Test assertions */
  assertions?: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Deployment metrics and analytics
 */
export interface DeploymentMetrics {
  /** Number of files changed */
  filesChanged: number;

  /** Number of lines added */
  linesAdded: number;

  /** Number of lines deleted */
  linesDeleted: number;

  /** HTTP 5xx error rate (0-100) */
  errorRate: number;

  /** Response time P50 in milliseconds */
  responseTimeP50: number;

  /** Response time P95 in milliseconds */
  responseTimeP95: number;

  /** Response time P99 in milliseconds */
  responseTimeP99: number;

  /** Health check success rate (0-100) */
  healthCheckSuccessRate: number;

  /** Smoke test pass rate (0-100) */
  smokeTestPassRate: number;

  /** Total number of smoke tests */
  totalSmokeTests: number;

  /** Number of passed smoke tests */
  passedSmokeTests: number;

  /** Number of failed smoke tests */
  failedSmokeTests: number;

  /** Traffic shift status */
  trafficShift?: TrafficShiftStatus;
}

/**
 * Blue-green deployment traffic shift tracking
 */
export interface TrafficShiftStatus {
  /** Current traffic percentage on new version */
  currentPercentage: number;

  /** Target traffic percentage */
  targetPercentage: number;

  /** Shift start time */
  startTime: Date;

  /** Shift end time (if completed) */
  endTime?: Date;

  /** Shift duration in milliseconds */
  duration?: number;

  /** Shift stages */
  stages: TrafficShiftStage[];
}

/**
 * Individual traffic shift stage
 */
export interface TrafficShiftStage {
  /** Target traffic percentage for this stage */
  percentage: number;

  /** Stage status */
  status: 'pending' | 'in_progress' | 'success' | 'failed';

  /** Stage start time */
  startTime?: Date;

  /** Stage end time */
  endTime?: Date;

  /** Metrics during this stage */
  metrics?: {
    errorRate: number;
    responseTimeP95: number;
    requestCount: number;
  };
}

/**
 * Deployment history query parameters
 */
export interface DeploymentHistoryQuery {
  /** Environment filter */
  environment?: DeploymentEnvironment;

  /** Status filter */
  status?: DeploymentStatus;

  /** Author filter */
  author?: string;

  /** Start date filter */
  startDate?: Date;

  /** End date filter */
  endDate?: Date;

  /** Page number */
  page?: number;

  /** Items per page */
  limit?: number;

  /** Sort field */
  sortBy?: 'startTime' | 'duration' | 'status' | 'author';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated deployment history response
 */
export interface DeploymentHistoryResponse {
  /** Deployment records */
  deployments: Deployment[];

  /** Total number of deployments */
  total: number;

  /** Current page number */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of pages */
  totalPages: number;

  /** Has next page */
  hasNextPage: boolean;

  /** Has previous page */
  hasPreviousPage: boolean;
}

/**
 * Deployment analytics aggregation
 */
export interface DeploymentAnalytics {
  /** Time period */
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';

  /** Total deployments */
  totalDeployments: number;

  /** Successful deployments */
  successfulDeployments: number;

  /** Failed deployments */
  failedDeployments: number;

  /** Rolled back deployments */
  rolledBackDeployments: number;

  /** Success rate (0-100) */
  successRate: number;

  /** Average deployment duration in milliseconds */
  averageDuration: number;

  /** Median deployment duration in milliseconds */
  medianDuration: number;

  /** Average time to rollback in milliseconds */
  averageRollbackTime: number;

  /** Deployment frequency (deployments per day) */
  deploymentFrequency: number;

  /** Mean time to recovery (MTTR) in milliseconds */
  meanTimeToRecovery: number;

  /** Change failure rate (0-100) */
  changeFailureRate: number;

  /** Deployment size distribution */
  sizeDistribution: {
    small: number; // < 100 files
    medium: number; // 100-500 files
    large: number; // > 500 files
  };

  /** Deployment time distribution */
  timeDistribution: {
    fast: number; // < 10 min
    normal: number; // 10-20 min
    slow: number; // > 20 min
  };
}

/**
 * Rollback request parameters
 */
export interface RollbackRequest {
  /** Deployment ID to rollback */
  deploymentId: string;

  /** Target environment */
  environment: DeploymentEnvironment;

  /** Rollback reason */
  reason: string;

  /** Target commit SHA (optional, defaults to previous deployment) */
  targetCommitSha?: string;

  /** Force rollback (skip validations) */
  force?: boolean;
}

/**
 * Rollback response
 */
export interface RollbackResponse {
  /** New deployment ID for rollback */
  deploymentId: string;

  /** GitHub Actions workflow run ID */
  workflowRunId: number;

  /** Rollback status */
  status: 'initiated' | 'in_progress' | 'success' | 'failed';

  /** Estimated rollback time in milliseconds */
  estimatedTime: number;

  /** Rollback message */
  message: string;
}
