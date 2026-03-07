// @ts-nocheck
/**
 * Creator Circle Service Interface
 * EPIC-010: Creator Network — Circles
 * #276: Typed return values instead of any[]
 */

import type { Circle, CirclePost } from '@shared/types/community';

export interface ICreatorCircleService {
  createCircle(
    creatorId: string,
    data: { name: string; description?: string; niche?: string; maxMembers?: number }
  ): Promise<{ id: string }>;
  getCircles(creatorId: string): Promise<Circle[]>;
  getCircleById(circleId: string): Promise<Circle>;
  getSuggestedCircles(creatorId: string): Promise<Circle[]>;
  joinCircle(creatorId: string, circleId: string): Promise<void>;
  leaveCircle(creatorId: string, circleId: string): Promise<void>;
  removeMember(circleId: string, memberId: string, requesterId: string): Promise<void>;
  getCirclePosts(
    circleId: string,
    creatorId: string,
    pagination?: { offset?: number; limit?: number }
  ): Promise<CirclePost[]>;
  createPost(circleId: string, authorId: string, content: string): Promise<{ id: string }>;
}
