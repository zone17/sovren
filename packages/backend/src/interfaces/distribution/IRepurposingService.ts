/**
 * Repurposing Service Interface
 * EPIC-009: Multi-Platform Hub
 */

import type {
  RepurposedContent,
  SupportedPlatform,
} from '@shared/types/distribution';

export interface IRepurposingService {
  /** Generate platform-optimized versions of source content */
  repurpose(
    creatorId: string,
    contentId: string,
    targetPlatforms: SupportedPlatform[]
  ): Promise<RepurposedContent[]>;

  /** Get previously repurposed versions for a content item */
  getRepurposed(creatorId: string, contentId: string): Promise<RepurposedContent[]>;

  /** Approve a repurposed version for publishing */
  approve(creatorId: string, repurposedId: string): Promise<RepurposedContent>;
}
