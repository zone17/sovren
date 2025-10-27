/**
 * 🚨 ELITE TYPE DEFINITIONS: NOSTR Error Handling
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Comprehensive error types for NOSTR operations:
 * - Error classification and severity levels
 * - Error metadata and context
 * - Retry strategies
 * - Troubleshooting hints
 * - Toast notification types
 */

import type { ReactNode } from 'react';
import { AlertSeverity, AlertType } from '@/services/nostr/types/monitoring';

// ============================================
// ERROR SEVERITY LEVELS
// ============================================

/**
 * Error severity levels for classification
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// ============================================
// ERROR CATEGORIES
// ============================================

/**
 * Error categories based on source
 */
export enum ErrorCategory {
  CONNECTION = 'connection',
  PUBLISHING = 'publishing',
  SUBSCRIPTION = 'subscription',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

// ============================================
// ERROR CODES
// ============================================

/**
 * Standardized error codes for NOSTR operations
 */
export enum NostrErrorCode {
  // Connection Errors (1xxx)
  CONNECTION_TIMEOUT = 'NOSTR_1001',
  CONNECTION_REFUSED = 'NOSTR_1002',
  RELAY_DISCONNECTED = 'NOSTR_1003',
  RELAY_UNREACHABLE = 'NOSTR_1004',
  NO_RELAYS_AVAILABLE = 'NOSTR_1005',
  WEBSOCKET_ERROR = 'NOSTR_1006',

  // Publishing Errors (2xxx)
  PUBLISH_FAILED = 'NOSTR_2001',
  PUBLISH_TIMEOUT = 'NOSTR_2002',
  EVENT_VALIDATION_FAILED = 'NOSTR_2003',
  EVENT_SIGNATURE_INVALID = 'NOSTR_2004',
  RATE_LIMIT_EXCEEDED = 'NOSTR_2005',
  RELAY_REJECTED_EVENT = 'NOSTR_2006',
  DUPLICATE_EVENT = 'NOSTR_2007',

  // Subscription Errors (3xxx)
  SUBSCRIPTION_FAILED = 'NOSTR_3001',
  SUBSCRIPTION_TIMEOUT = 'NOSTR_3002',
  FILTER_VALIDATION_FAILED = 'NOSTR_3003',
  EOSE_NOT_RECEIVED = 'NOSTR_3004',
  SUBSCRIPTION_CLOSED = 'NOSTR_3005',

  // Validation Errors (4xxx)
  INVALID_EVENT_KIND = 'NOSTR_4001',
  INVALID_EVENT_CONTENT = 'NOSTR_4002',
  INVALID_EVENT_TAGS = 'NOSTR_4003',
  INVALID_PUBKEY = 'NOSTR_4004',
  INVALID_FILTER = 'NOSTR_4005',

  // Authentication Errors (5xxx)
  AUTH_REQUIRED = 'NOSTR_5001',
  AUTH_FAILED = 'NOSTR_5002',
  NO_SIGNER_AVAILABLE = 'NOSTR_5003',
  SIGNATURE_FAILED = 'NOSTR_5004',

  // Network Errors (6xxx)
  NETWORK_ERROR = 'NOSTR_6001',
  NETWORK_TIMEOUT = 'NOSTR_6002',
  CORS_ERROR = 'NOSTR_6003',

  // Unknown Errors (9xxx)
  UNKNOWN_ERROR = 'NOSTR_9999',
}

// ============================================
// RETRY STRATEGIES
// ============================================

/**
 * Retry strategy for error recovery
 */
export interface RetryStrategy {
  /** Enable retry */
  enabled: boolean;
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Delay multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Retry timeout in milliseconds */
  timeout?: number;
}

/**
 * Default retry strategy
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  enabled: true,
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
};

// ============================================
// ERROR METADATA
// ============================================

/**
 * Comprehensive error metadata
 */
export interface NostrErrorMetadata {
  /** Error code */
  code: NostrErrorCode;
  /** Error category */
  category: ErrorCategory;
  /** Severity level */
  severity: ErrorSeverity;
  /** Human-readable title */
  title: string;
  /** Detailed error message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Affected relay URL (if applicable) */
  relay?: string;
  /** Affected relays (multiple) */
  relays?: string[];
  /** Event ID (if applicable) */
  eventId?: string;
  /** Subscription ID (if applicable) */
  subscriptionId?: string;
  /** Original error object */
  originalError?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Retry strategy */
  retryStrategy?: RetryStrategy;
  /** Troubleshooting hints */
  troubleshootingHints?: string[];
  /** Recovery suggestions */
  recoverySuggestions?: string[];
  /** Documentation link */
  docsLink?: string;
}

// ============================================
// ERROR TOAST TYPES
// ============================================

/**
 * Error toast notification options
 */
export interface ErrorToastOptions {
  /** Error metadata */
  error: NostrErrorMetadata;
  /** Auto-dismiss duration (0 = never) */
  duration?: number;
  /** Enable dismiss button */
  dismissible?: boolean;
  /** Enable retry button */
  retryable?: boolean;
  /** Retry callback */
  onRetry?: () => void | Promise<void>;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Custom icon */
  icon?: ReactNode;
  /** Custom action button */
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
}

/**
 * Error toast state
 */
export interface ErrorToast extends ErrorToastOptions {
  /** Unique toast ID */
  id: string;
  /** Creation timestamp */
  createdAt: number;
  /** Is currently retrying */
  isRetrying?: boolean;
  /** Retry attempt count */
  retryAttempt?: number;
}

// ============================================
// ERROR BOUNDARY TYPES
// ============================================

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  /** Has error occurred */
  hasError: boolean;
  /** Error object */
  error?: Error;
  /** Error info */
  errorInfo?: React.ErrorInfo;
  /** Error metadata */
  errorMetadata?: NostrErrorMetadata;
  /** Is recovering */
  isRecovering?: boolean;
}

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Fallback UI component */
  fallback?: (props: ErrorFallbackProps) => ReactNode;
  /** Error callback */
  onError?: (error: Error, errorInfo: React.ErrorInfo, metadata?: NostrErrorMetadata) => void;
  /** Reset callback */
  onReset?: () => void;
  /** Enable automatic recovery */
  autoRecover?: boolean;
  /** Recovery delay in milliseconds */
  recoveryDelay?: number;
  /** Recovery attempts */
  maxRecoveryAttempts?: number;
}

/**
 * Error fallback UI props
 */
export interface ErrorFallbackProps {
  /** Error object */
  error: Error;
  /** Error info */
  errorInfo?: React.ErrorInfo;
  /** Error metadata */
  errorMetadata?: NostrErrorMetadata;
  /** Reset function */
  resetError: () => void;
  /** Is recovering */
  isRecovering?: boolean;
}

// ============================================
// CONNECTION ERROR TYPES
// ============================================

/**
 * Relay connection error info
 */
export interface RelayConnectionError {
  /** Relay URL */
  url: string;
  /** Error metadata */
  error: NostrErrorMetadata;
  /** Connection status */
  status: 'disconnected' | 'error' | 'timeout';
  /** Last attempt timestamp */
  lastAttempt: number;
  /** Retry count */
  retryCount: number;
  /** Is currently retrying */
  isRetrying: boolean;
}

/**
 * Connection error display props
 */
export interface ConnectionErrorDisplayProps {
  /** Relay errors */
  errors: RelayConnectionError[];
  /** Retry all callback */
  onRetryAll?: () => void | Promise<void>;
  /** Retry single relay callback */
  onRetrySingle?: (url: string) => void | Promise<void>;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Class name */
  className?: string;
}

// ============================================
// PUBLISH ERROR TYPES
// ============================================

/**
 * Event publish error info
 */
export interface EventPublishError {
  /** Event ID */
  eventId: string;
  /** Event kind */
  eventKind: number;
  /** Error metadata */
  error: NostrErrorMetadata;
  /** Failed relays */
  failedRelays: string[];
  /** Successful relays */
  successfulRelays: string[];
  /** Timestamp */
  timestamp: number;
  /** Retry count */
  retryCount: number;
  /** Is currently retrying */
  isRetrying: boolean;
}

/**
 * Publish error handler props
 */
export interface PublishErrorHandlerProps {
  /** Publish errors */
  errors: EventPublishError[];
  /** Retry callback */
  onRetry?: (eventId: string) => void | Promise<void>;
  /** Clear error callback */
  onClear?: (eventId: string) => void;
  /** Clear all errors callback */
  onClearAll?: () => void;
  /** Max errors to display */
  maxErrors?: number;
  /** Class name */
  className?: string;
}

// ============================================
// SUBSCRIPTION ERROR TYPES
// ============================================

/**
 * Subscription error info
 */
export interface SubscriptionError {
  /** Subscription ID */
  subscriptionId: string;
  /** Error metadata */
  error: NostrErrorMetadata;
  /** Affected relays */
  affectedRelays: string[];
  /** Filter validation errors */
  filterErrors?: string[];
  /** Timestamp */
  timestamp: number;
  /** Is currently retrying */
  isRetrying: boolean;
}

/**
 * Subscription error display props
 */
export interface SubscriptionErrorDisplayProps {
  /** Subscription errors */
  errors: SubscriptionError[];
  /** Retry callback */
  onRetry?: (subscriptionId: string) => void | Promise<void>;
  /** Close subscription callback */
  onClose?: (subscriptionId: string) => void;
  /** Class name */
  className?: string;
}

// ============================================
// GENERIC ERROR MESSAGE TYPES
// ============================================

/**
 * Generic error message props
 */
export interface ErrorMessageProps {
  /** Error metadata */
  error: NostrErrorMetadata;
  /** Show troubleshooting hints */
  showTroubleshooting?: boolean;
  /** Show recovery suggestions */
  showRecoverySuggestions?: boolean;
  /** Show error code */
  showErrorCode?: boolean;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Class name */
  className?: string;
  /** Retry callback */
  onRetry?: () => void | Promise<void>;
  /** Dismiss callback */
  onDismiss?: () => void;
}

// ============================================
// ERROR UTILITY FUNCTIONS
// ============================================

/**
 * Get auto-dismiss duration based on severity
 */
export const getAutoDismissDuration = (severity: ErrorSeverity): number => {
  switch (severity) {
    case ErrorSeverity.INFO:
      return 3000;
    case ErrorSeverity.WARNING:
      return 5000;
    case ErrorSeverity.ERROR:
      return 7000;
    case ErrorSeverity.CRITICAL:
      return 0; // Manual dismiss
    default:
      return 5000;
  }
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (code: NostrErrorCode): boolean => {
  const retryableErrors = [
    NostrErrorCode.CONNECTION_TIMEOUT,
    NostrErrorCode.PUBLISH_TIMEOUT,
    NostrErrorCode.SUBSCRIPTION_TIMEOUT,
    NostrErrorCode.NETWORK_TIMEOUT,
    NostrErrorCode.RELAY_DISCONNECTED,
    NostrErrorCode.RELAY_UNREACHABLE,
    NostrErrorCode.WEBSOCKET_ERROR,
    NostrErrorCode.NETWORK_ERROR,
    NostrErrorCode.RATE_LIMIT_EXCEEDED,
  ];
  return retryableErrors.includes(code);
};

/**
 * Convert AlertSeverity to ErrorSeverity
 */
export const alertSeverityToErrorSeverity = (alertSeverity: AlertSeverity): ErrorSeverity => {
  switch (alertSeverity) {
    case AlertSeverity.INFO:
      return ErrorSeverity.INFO;
    case AlertSeverity.WARNING:
      return ErrorSeverity.WARNING;
    case AlertSeverity.ERROR:
      return ErrorSeverity.ERROR;
    case AlertSeverity.CRITICAL:
      return ErrorSeverity.CRITICAL;
    default:
      return ErrorSeverity.ERROR;
  }
};

/**
 * Convert AlertType to ErrorCategory
 */
export const alertTypeToErrorCategory = (alertType: AlertType): ErrorCategory => {
  switch (alertType) {
    case AlertType.RELAY_DISCONNECTED:
    case AlertType.RELAY_ERROR:
      return ErrorCategory.CONNECTION;
    case AlertType.PUBLISH_FAILURE:
      return ErrorCategory.PUBLISHING;
    case AlertType.SUBSCRIPTION_ERROR:
      return ErrorCategory.SUBSCRIPTION;
    case AlertType.HIGH_ERROR_RATE:
    case AlertType.HIGH_LATENCY:
    case AlertType.PERFORMANCE_DEGRADED:
      return ErrorCategory.NETWORK;
    default:
      return ErrorCategory.UNKNOWN;
  }
};
