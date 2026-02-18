/**
 * Creator Circle Service Interface
 * EPIC-010: Creator Network — Circles
 */

export interface ICreatorCircleService {
  createCircle(
    creatorId: string,
    data: { name: string; description?: string; niche?: string; maxMembers?: number }
  ): Promise<{ id: string }>;
  getCircles(creatorId: string): Promise<any[]>;
  getSuggestedCircles(creatorId: string): Promise<any[]>;
  joinCircle(creatorId: string, circleId: string): Promise<void>;
  removeMember(circleId: string, memberId: string, requesterId: string): Promise<void>;
  getCirclePosts(circleId: string, creatorId: string): Promise<any[]>;
  createPost(circleId: string, authorId: string, content: string): Promise<{ id: string }>;
}
