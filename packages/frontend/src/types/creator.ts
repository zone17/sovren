/**
 * Creator type definitions for React Query hooks
 */

export interface Creator {
  id: string;
  pubkey: string;
  npub?: string;
  name: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  nip05Verified?: boolean;
  website?: string;
  lud16?: string; // Lightning address
  followerCount: number;
  followingCount: number;
  contentCount: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  category?: string;
  tags?: string[];
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorProfile extends Creator {
  stats: {
    totalViews: number;
    totalLikes: number;
    totalZaps: number;
    averageEngagement: number;
    growthRate: number;
  };
  subscription?: {
    id: string;
    price: number;
    currency: string;
    interval: 'monthly' | 'yearly';
    benefits: string[];
  };
  recentContent?: {
    id: string;
    title: string;
    preview: string;
    publishedAt: string;
    engagement: number;
  }[];
}

export interface CreatorFilters {
  page?: number;
  limit?: number;
  category?: string;
  sortBy?: 'popular' | 'recent' | 'revenue' | 'followers';
  search?: string;
  verified?: boolean;
  hasSubscription?: boolean;
}

export interface CreatorsResponse {
  creators: Creator[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateCreatorInput {
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  lud16?: string;
  category?: string;
  tags?: string[];
  subscription?: {
    price: number;
    currency: string;
    interval: 'monthly' | 'yearly';
    benefits: string[];
  };
}
