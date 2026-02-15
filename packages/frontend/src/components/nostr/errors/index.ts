/**
 * 🚨 ELITE MODULE: NOSTR Error Handling Components
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Comprehensive error handling UI components:
 * - Error boundaries for unhandled errors
 * - Toast notifications for errors
 * - Connection error display
 * - Publish error handler
 * - Subscription error display
 * - Generic error message component
 */

// Components
export { ErrorMessage } from './ErrorMessage';
export { ErrorToastContainer, useErrorToast, errorToast } from './ErrorToast';
export { ConnectionErrorDisplay } from './ConnectionErrorDisplay';
export { PublishErrorHandler } from './PublishErrorHandler';
export { SubscriptionErrorDisplay } from './SubscriptionErrorDisplay';

// Types
export type {
  // Error metadata
  NostrErrorMetadata,

  // Error toast
  ErrorToast,
  ErrorToastOptions,

  // Error boundary
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorFallbackProps,

  // Connection errors
  RelayConnectionError,
  ConnectionErrorDisplayProps,

  // Publish errors
  EventPublishError,
  PublishErrorHandlerProps,

  // Subscription errors
  SubscriptionError,
  SubscriptionErrorDisplayProps,

  // Generic error message
  ErrorMessageProps,

  // Retry strategy
  RetryStrategy,
} from './types';

export {
  // Enums
  ErrorSeverity,
  ErrorCategory,
  NostrErrorCode,

  // Utilities
  getAutoDismissDuration,
  isRetryableError,
  alertSeverityToErrorSeverity,
  alertTypeToErrorCategory,

  // Constants
  DEFAULT_RETRY_STRATEGY,
} from './types';
