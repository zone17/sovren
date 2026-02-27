/**
 * Discovery Domain Types
 * Shared types for Slice 2: Discovery MVP
 *
 * Used by both backend routes and frontend hooks.
 * Backend queries the `discovery_creators` view to build CreatorSearchResult.
 */

/** Valid discovery categories (excludes "All" which is UI-only). */
export const DISCOVERY_CATEGORIES = [
  'Art',
  'Writing',
  'Music',
  'Podcast',
  'Education',
  'Photography',
  'Development',
  'Bitcoin',
] as const;

export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export interface CreatorSearchResult {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  nip05Verified: boolean;
  categories: DiscoveryCategory[];
  tags: string[];
  followerCount: number;
  contentCount: number;
  verified: boolean;
  createdAt: string;
}

export interface DiscoveryFilters {
  query?: string;
  category?: DiscoveryCategory;
  sortBy?: 'relevance' | 'followers' | 'newest';
  page?: number;
  limit?: number;
}

import type { Pagination } from './provenance';

export interface DiscoveryResponse {
  creators: CreatorSearchResult[];
  pagination: Pagination;
}
