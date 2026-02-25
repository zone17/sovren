/**
 * IBoundaryService Interface
 * Focus hours, DND, auto-responses
 * EPIC-007: Creator Wellness System
 */

import type { CreatorBoundaries } from '@shared/types/wellness';

export interface BoundaryUpdateInput {
  focus_hours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
    days: string[];
  };
  weekly_engagement_budget_mins?: number;
  dnd_mode?: {
    auto_response_enabled: boolean;
    auto_response_template: string;
  };
  availability_status?: string;
  notification_batching?: boolean;
}

export interface IBoundaryService {
  getBoundaries(creatorId: string): Promise<CreatorBoundaries>;
  updateBoundaries(creatorId: string, input: BoundaryUpdateInput): Promise<CreatorBoundaries>;
}
