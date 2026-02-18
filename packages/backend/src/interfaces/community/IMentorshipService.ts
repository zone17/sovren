/**
 * Mentorship Service Interface
 * EPIC-010: Creator Network — Mentorship
 */

export interface IMentorshipService {
  registerMentor(
    creatorId: string,
    data: { niche: string; audienceSizeRange: string; bio?: string; maxMentees?: number }
  ): Promise<{ id: string }>;
  getMentors(filters?: { niche?: string; audienceSizeRange?: string }): Promise<any[]>;
  requestMentorship(
    menteeId: string,
    mentorId: string,
    data: { niche?: string; goals?: string[] }
  ): Promise<{ id: string }>;
  respondToRequest(mentorshipId: string, creatorId: string, accept: boolean): Promise<void>;
  getMyMentorships(creatorId: string): Promise<any[]>;
}
