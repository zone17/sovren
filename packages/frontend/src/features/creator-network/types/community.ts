/**
 * Creator Network — Local type re-exports and UI-specific extensions
 * Core domain types live in packages/shared/src/types/community.ts
 */

export type {
  Circle,
  CircleMember,
  CirclePost,
  MentorProfile,
  Mentorship,
  ContentCollaborator,
  ServiceType,
  ServiceListing,
  OrderStatus,
  ServiceOrder,
  OrderReview,
} from '@shared/types/community';

// --- UI-only types ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CircleWithMemberCount {
  id: string;
  name: string;
  description?: string;
  niche?: string;
  maxMembers: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
}

export interface MentorWithProfile {
  creatorId: string;
  niche: string;
  audienceSizeRange: '0-1k' | '1k-10k' | '10k-100k' | '100k+';
  bio?: string;
  maxMentees: number;
  active: boolean;
  currentMenteeCount?: number;
}

export interface RevenueSplitEntry {
  creatorId: string;
  displayName?: string;
  splitBps: number; // 0-10000
}

export interface RevenueSplitPreview {
  entries: RevenueSplitEntry[];
  totalBps: number;
  previewSats: number;
  allocations: Array<{ creatorId: string; displayName?: string; sats: number }>;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  escrow_funded: 'Escrow Funded',
  in_progress: 'In Progress',
  completed: 'Completed',
  disputed: 'Disputed',
  refunded: 'Refunded',
  expired: 'Expired',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  escrow_funded: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-500',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  editing: 'Editing',
  writing: 'Writing',
  design: 'Design',
  consulting: 'Consulting',
  other: 'Other',
};

export const AUDIENCE_SIZE_LABELS: Record<string, string> = {
  '0-1k': 'Under 1K',
  '1k-10k': '1K – 10K',
  '10k-100k': '10K – 100K',
  '100k+': '100K+',
};
