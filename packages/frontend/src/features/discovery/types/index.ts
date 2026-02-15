import type { SubscriptionTier } from '../../../services/api/types';

export interface DiscoveryCreator {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  nip05_verified: boolean;
  stats: {
    follower_count: number;
    post_count: number;
    total_supporters: number;
  };
  subscription_tiers: SubscriptionTier[];
  tags: string[];
  featured_content_title?: string;
}

export interface DiscoveryFilters {
  category: string;
  sortBy: 'relevance' | 'followers' | 'newest' | 'earnings';
  query: string;
}
