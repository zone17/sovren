/**
 * Mentorship Service Interface
 * EPIC-010: Creator Network — Mentorship
 * #276: Typed return values instead of any[]
 */

import type { MentorProfile, Mentorship } from '@shared/types/community';

export interface IMentorshipService {
  registerMentor(
    creatorId: string,
    data: { niche: string; audienceSizeRange: string; bio?: string; maxMentees?: number }
  ): Promise<{ id: string }>;
  getMentors(filters?: { niche?: string; audienceSizeRange?: string }): Promise<MentorProfile[]>;
  requestMentorship(
    menteeId: string,
    mentorId: string,
    data: { niche?: string; goals?: string[] }
  ): Promise<{ id: string }>;
  respondToRequest(mentorshipId: string, creatorId: string, accept: boolean): Promise<void>;
  getMyMentorships(
    creatorId: string,
    pagination?: { offset?: number; limit?: number }
  ): Promise<Mentorship[]>;
  updateMentorProfile(
    profileId: string,
    creatorId: string,
    data: { niche?: string; audienceSizeRange?: string; bio?: string; maxMentees?: number }
  ): Promise<void>;
}
