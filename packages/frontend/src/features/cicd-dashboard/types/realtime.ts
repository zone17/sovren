/**
 * CI/CD Dashboard - Real-time Updates Type Definitions
 *
 * Type definitions for WebSocket and Server-Sent Events (SSE) real-time updates.
 */

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'deployment_started'
  | 'deployment_updated'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'deployment_cancelled'
  | 'deployment_rolled_back'
  | 'stage_started'
  | 'stage_completed'
  | 'stage_failed'
  | 'health_check_updated'
  | 'smoke_test_started'
  | 'smoke_test_completed'
  | 'smoke_test_failed'
  | 'traffic_shift_updated'
  | 'metrics_updated'
  | 'error_logged'
  | 'ping'
  | 'pong';

/**
 * WebSocket connection status
 */
export type WebSocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * WebSocket message
 */
export interface WebSocketMessage<T = unknown> {
  /** Message type */
  type: WebSocketMessageType;

  /** Message payload */
  payload: T;

  /** Message timestamp */
  timestamp: string;

  /** Message ID */
  id: string;

  /** Deployment ID (if applicable) */
  deploymentId?: string;

  /** Environment (if applicable) */
  environment?: 'staging' | 'production';
}

/**
 * Deployment update payload
 */
export interface DeploymentUpdatePayload {
  /** Deployment ID */
  deploymentId: string;

  /** Deployment status */
  status: string;

  /** Current stage */
  currentStage?: string;

  /** Progress percentage (0-100) */
  progress: number;

  /** Estimated time remaining (milliseconds) */
  estimatedTimeRemaining?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Stage update payload
 */
export interface StageUpdatePayload {
  /** Deployment ID */
  deploymentId: string;

  /** Stage ID */
  stageId: string;

  /** Stage name */
  stageName: string;

  /** Stage status */
  status: string;

  /** Stage progress (0-100) */
  progress: number;

  /** Stage duration (milliseconds) */
  duration?: number;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Health check update payload
 */
export interface HealthCheckUpdatePayload {
  /** Deployment ID */
  deploymentId: string;

  /** Environment */
  environment: 'staging' | 'production';

  /** Health check endpoint */
  endpoint: '/health' | '/ready' | '/live' | '/detailed';

  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Response time (milliseconds) */
  responseTime: number;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Smoke test update payload
 */
export interface SmokeTestUpdatePayload {
  /** Deployment ID */
  deploymentId: string;

  /** Test ID */
  testId: string;

  /** Test name */
  testName: string;

  /** Test status */
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

  /** Test duration (milliseconds) */
  duration?: number;

  /** Error message (if failed) */
  error?: string;

  /** Total tests */
  totalTests: number;

  /** Passed tests */
  passedTests: number;

  /** Failed tests */
  failedTests: number;
}

/**
 * Traffic shift update payload
 */
export interface TrafficShiftUpdatePayload {
  /** Deployment ID */
  deploymentId: string;

  /** Current traffic percentage */
  currentPercentage: number;

  /** Target traffic percentage */
  targetPercentage: number;

  /** Shift status */
  status: 'in_progress' | 'completed' | 'failed';

  /** Current metrics */
  metrics?: {
    errorRate: number;
    responseTimeP95: number;
    requestCount: number;
  };
}

/**
 * Metrics update payload
 */
export interface MetricsUpdatePayload {
  /** Deployment ID */
  deploymentId: string;

  /** Metrics data */
  metrics: {
    errorRate: number;
    responseTimeP50: number;
    responseTimeP95: number;
    responseTimeP99: number;
    requestCount: number;
    activeConnections: number;
  };

  /** Timestamp */
  timestamp: string;
}

/**
 * Error log payload
 */
export interface ErrorLogPayload {
  /** Deployment ID */
  deploymentId: string;

  /** Error severity */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Error message */
  message: string;

  /** Error source */
  source: string;

  /** Error stack trace */
  stackTrace?: string;

  /** Timestamp */
  timestamp: string;
}

/**
 * WebSocket subscription
 */
export interface WebSocketSubscription {
  /** Subscription ID */
  id: string;

  /** Subscription type */
  type: 'deployment' | 'environment' | 'all';

  /** Subscription filter */
  filter?: {
    deploymentId?: string;
    environment?: 'staging' | 'production';
  };

  /** Subscription callback */
  callback: (message: WebSocketMessage) => void;
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  /** WebSocket URL */
  url: string;

  /** Reconnect on disconnect */
  autoReconnect?: boolean;

  /** Reconnect delay (milliseconds) */
  reconnectDelay?: number;

  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;

  /** Ping interval (milliseconds) */
  pingInterval?: number;

  /** Pong timeout (milliseconds) */
  pongTimeout?: number;

  /** Authentication token */
  authToken?: string;

  /** Event handlers */
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

/**
 * Server-Sent Events (SSE) connection options
 */
export interface SSEOptions {
  /** SSE URL */
  url: string;

  /** Reconnect on disconnect */
  autoReconnect?: boolean;

  /** Reconnect delay (milliseconds) */
  reconnectDelay?: number;

  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;

  /** Authentication token */
  authToken?: string;

  /** Event handlers */
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (event: MessageEvent) => void;
}

/**
 * Real-time service configuration
 */
export interface RealtimeServiceConfig {
  /** Preferred connection type */
  preferredType: 'websocket' | 'sse';

  /** WebSocket URL */
  websocketUrl: string;

  /** SSE URL */
  sseUrl: string;

  /** Fallback to SSE if WebSocket fails */
  fallbackToSSE?: boolean;

  /** Auto-reconnect */
  autoReconnect?: boolean;

  /** Reconnect delay (milliseconds) */
  reconnectDelay?: number;

  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;

  /** Authentication token */
  authToken?: string;
}

/**
 * Real-time connection state
 */
export interface RealtimeConnectionState {
  /** Connection type */
  type: 'websocket' | 'sse' | null;

  /** Connection status */
  status: WebSocketStatus;

  /** Last connection time */
  lastConnected?: Date;

  /** Reconnect attempt count */
  reconnectAttempts: number;

  /** Error message (if error) */
  error?: string;

  /** Active subscriptions */
  subscriptions: WebSocketSubscription[];
}
