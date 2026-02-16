/**
 * IScheduleService Interface
 * Sustainable cadence recommendations
 * EPIC-007: Creator Wellness System
 */

import type { ScheduleRecommendation, BufferDepth } from '@sovren/shared/types/wellness';

export interface IScheduleService {
  getRecommendations(creatorId: string): Promise<ScheduleRecommendation>;
  getBufferDepth(creatorId: string): Promise<BufferDepth>;
}
