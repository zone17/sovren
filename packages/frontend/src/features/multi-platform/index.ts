// Multi-Platform Hub Feature Module Exports

// Error Boundary
export { DistributionErrorBoundary } from './ErrorBoundary';

// Components (EPIC-009A — existing)
export { MultiPlatformDashboard } from './components/MultiPlatformDashboard';
export { default as PlatformConnector } from './components/PlatformConnector';
export { default as DistributionPanel } from './components/DistributionPanel';
export { default as UnifiedInbox } from './components/UnifiedInbox';
export { default as CrossPlatformAnalytics } from './components/CrossPlatformAnalytics';
export { default as RepurposePreview } from './components/RepurposePreview';

// Components (EPIC-009B — new inbox + analytics)
export { InboxFilterBar } from './components/InboxFilterBar';
export { ReplyComposer } from './components/ReplyComposer';
export { BatchActionToolbar } from './components/BatchActionToolbar';
export { TemplateManager } from './components/TemplateManager';
export { CrossPlatformDashboard } from './components/CrossPlatformDashboard';
export { default as PlatformComparison } from './components/PlatformComparison';
export { default as PlatformROI } from './components/PlatformROI';
export { default as AudienceOverlap } from './components/AudienceOverlap';
export { BYOKSetup } from './components/BYOKSetup';

// Hooks (EPIC-009A — existing)
export {
  usePlatformStatus,
  useConnectPlatform,
  useDisconnectPlatform,
} from './hooks/usePlatformConnections';
export {
  usePublish,
  usePublishStatus,
  useRepurpose,
  useRepurposed,
  useApproveRepurposed,
} from './hooks/useCrossPost';
export {
  useInboxMessages as useLegacyInboxMessages,
  useReplyToMessage as useLegacyReply,
  useBatchAction,
} from './hooks/useInbox';
export {
  useAnalyticsOverview,
  useContentComparison,
  useROI,
} from './hooks/useDistributionAnalytics';

// Hooks (EPIC-009B — new)
export { useInboxMessages } from './hooks/useInboxMessages';
export {
  useReplyToMessage,
  useBatchInboxAction,
  useReplyTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from './hooks/useInboxActions';
export {
  useCrossPlatformOverview,
  usePlatformComparison,
  usePlatformROI,
} from './hooks/useCrossPlatformAnalytics';
export { useBYOK, useBYOKStatus } from './hooks/useBYOK';

// API Services
export { distributionApi } from './services/distributionApi';
export { inboxApi } from './services/inboxApi';
export { analyticsApi } from './services/analyticsApi';

// Types (existing)
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
  PlatformROI as PlatformROIData,
  DistributionPagination,
  ApiResponse as DistributionApiResponse,
  InboxPlatformFilter,
  InboxStatusFilter,
  PublishPayload,
  RepurposePayload,
  ReplyPayload,
  BatchActionPayload,
  PlatformDisplayInfo,
} from './types';
export { PLATFORM_DISPLAY } from './types';

// Types (EPIC-009B — new)
export type {
  InboxFilters,
  SentimentFilter,
  PriorityFilter,
  ReplyTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  BYOKSubmitPayload,
  BYOKValidationResult,
  BYOKStatus,
} from './types/inbox';
