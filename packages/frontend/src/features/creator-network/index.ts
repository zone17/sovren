// Creator Network Feature Module — EPIC-010
// Lazy-load the full module via React.lazy() at the route level

// Error Boundary
export { CreatorNetworkErrorBoundary } from './ErrorBoundary';

// Components
export { default as CreatorNetworkDashboard } from './components/CreatorNetworkDashboard';
export { default as CommunityNav } from './components/CommunityNav';
export { default as CirclesBrowser } from './components/CirclesBrowser';
export { default as CircleFeed } from './components/CircleFeed';
export { default as CircleManagement } from './components/CircleManagement';
export { default as MentorDirectory } from './components/MentorDirectory';
export { default as MentorshipDashboard } from './components/MentorshipDashboard';
export { default as CollaborationInvite } from './components/CollaborationInvite';
export { default as RevenueSplitEditor } from './components/RevenueSplitEditor';
export { default as MarketplaceBrowser } from './components/MarketplaceBrowser';
export { default as ServiceListingForm } from './components/ServiceListingForm';
export { default as OrderTracker } from './components/OrderTracker';
export { default as EscrowStatus } from './components/EscrowStatus';

// Hooks
export {
  useCircles,
  useSuggestedCircles,
  useCreateCircle,
  useJoinCircle,
  useRemoveMember,
  useCirclePosts,
  usePostToCircle,
} from './hooks/useCircles';

export {
  useMentors,
  useMyMentorships,
  useRegisterMentor,
  useRequestMentorship,
  useRespondToMentorship,
} from './hooks/useMentorship';

export {
  useCollaborators,
  useInviteCollaborators,
  useUpdateRevenueSplit,
  useRespondToCollaboration,
} from './hooks/useCollaboration';

export {
  useListings,
  useCreateListing,
  usePlaceOrder,
  useStartOrder,
  useCompleteOrder,
  useDisputeOrder,
  useReviewOrder,
} from './hooks/useMarketplace';

// API services
export { circlesApi } from './services/circlesApi';
export { mentorshipApi } from './services/mentorshipApi';
export { collaborationApi } from './services/collaborationApi';
export { marketplaceApi } from './services/marketplaceApi';

// Types
export type {
  ApiResponse as CommunityApiResponse,
  Pagination,
  CircleWithMemberCount,
  MentorWithProfile,
  RevenueSplitEntry,
  RevenueSplitPreview,
} from './types/community';

export {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  AUDIENCE_SIZE_LABELS,
} from './types/community';
