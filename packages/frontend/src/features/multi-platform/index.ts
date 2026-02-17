// Multi-Platform Hub Feature Module Exports

// Error Boundary
export { DistributionErrorBoundary } from './ErrorBoundary';

// Components
export { MultiPlatformDashboard } from './components/MultiPlatformDashboard';
export { default as PlatformConnector } from './components/PlatformConnector';
export { default as DistributionPanel } from './components/DistributionPanel';
export { default as UnifiedInbox } from './components/UnifiedInbox';
export { default as CrossPlatformAnalytics } from './components/CrossPlatformAnalytics';
export { default as RepurposePreview } from './components/RepurposePreview';

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
