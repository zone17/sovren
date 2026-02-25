/**
 * Cross-Post Service Interface
 * EPIC-009: Multi-Platform Hub
 */

import type {
  CrossPostEntry,
  SupportedPlatform,
} from '@shared/types/distribution';

export interface PublishRequest {
  content_id: string;
  platforms: SupportedPlatform[];
  schedule?: Partial<Record<SupportedPlatform, string>>;
  use_repurposed?: boolean;
}

export interface ICrossPostService {
  /** Queue content for cross-platform publishing */
  publish(
    creatorId: string,
    request: PublishRequest
  ): Promise<{ job_id: string; platforms: CrossPostEntry[] }>;

  /** Get cross-post status for a content item */
  getStatus(creatorId: string, contentId: string): Promise<CrossPostEntry[]>;

  /** Cancel a pending/scheduled cross-post */
  cancel(creatorId: string, crossPostId: string): Promise<void>;
}
