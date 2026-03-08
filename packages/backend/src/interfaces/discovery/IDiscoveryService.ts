/**
 * IDiscoveryService — Creator discovery and search interface
 * Todo #568: Extracted from inline discovery.routes.ts logic
 */

import type {
  CreatorProfileDetail,
  DiscoveryCategory,
  DiscoveryResponse,
} from '@shared/types/discovery';

export interface SearchCreatorsParams {
  q?: string;
  category?: DiscoveryCategory;
  sortBy: 'relevance' | 'followers' | 'newest';
  page: number;
  limit: number;
}

export interface IDiscoveryService {
  /**
   * Search creators with optional text query, category filter, and sorting.
   */
  searchCreators(params: SearchCreatorsParams): Promise<DiscoveryResponse>;

  /**
   * Get detailed creator profile by ID, including subscription tiers and user data.
   */
  getCreatorProfile(id: string): Promise<CreatorProfileDetail>;
}
