// Multi-Platform Hub Feature Module Exports

// Error Boundary
export { DistributionErrorBoundary } from './ErrorBoundary';

// Hooks
export { usePlatformStatus, useConnectPlatform, useDisconnectPlatform } from './hooks/usePlatformConnections';
export { usePublish, usePublishStatus, useRepurpose, useRepurposed, useApproveRepurposed } from './hooks/useCrossPost';
export { useInboxMessages, useReplyToMessage, useBatchAction } from './hooks/useInbox';
export { useAnalyticsOverview, useContentComparison, useROI } from './hooks/useDistributionAnalytics';

// API Service
export { distributionApi } from './services/distributionApi';

// Types
export type {
  SupportedPlatform,
  AllPlatform,
  ConnectionStatus,
  PlatformStatus,
  CrossPostStatus,
  CrossPostEntry,
  RepurposeFormatType,
  RepurposedContent,
  InboxMessageType,
  InboxMessage,
  PlatformOverview,
  PlatformMetricsSummary,
  ContentComparison,
  PlatformROI,
  DistributionPagination,
  ApiResponse,
  InboxPlatformFilter,
  InboxStatusFilter,
  PublishPayload,
  RepurposePayload,
  ReplyPayload,
  BatchActionPayload,
  PlatformDisplayInfo,
} from './types';
export { PLATFORM_DISPLAY } from './types';
