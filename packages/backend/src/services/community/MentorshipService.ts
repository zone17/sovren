/**
 * Mentorship Service
 * EPIC-010: Creator Network — Mentor registration, matching, and relationship management
 */

import type { IMentorshipService } from '../../interfaces/community/IMentorshipService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';

interface MentorProfileRow {
  id: string;
  creator_id: string;
  niche: string;
  audience_size_range: string;
  bio: string | null;
  max_mentees: number;
  active: boolean;
  created_at: string;
}

interface MentorshipRow {
  id: string;
  mentor_id: string;
  mentee_id: string;
  niche: string | null;
  goals: string[];
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const VALID_AUDIENCE_RANGES = ['0-1k', '1k-10k', '10k-100k', '100k+'] as const;

export class MentorshipService implements IMentorshipService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;

  constructor(db: ISupabaseClient, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  async registerMentor(
    creatorId: string,
    data: { niche: string; audienceSizeRange: string; bio?: string; maxMentees?: number }
  ): Promise<{ id: string }> {
    if (!data.niche || data.niche.trim().length === 0) {
      throw new Error('Niche is required');
    }

    if (!(VALID_AUDIENCE_RANGES as readonly string[]).includes(data.audienceSizeRange)) {
      throw new Error(
        `Invalid audience size range. Must be one of: ${VALID_AUDIENCE_RANGES.join(', ')}`
      );
    }

    const maxMentees = data.maxMentees ?? 3;
    if (maxMentees < 1 || maxMentees > 10) {
      throw new Error('max_mentees must be between 1 and 10');
    }

    // Upsert: if creator already has a profile, update it
    const { data: rows, error } = await this.db
      .from<MentorProfileRow>('mentor_profiles')
      .upsert(
        {
          creator_id: creatorId,
          niche: data.niche.trim(),
          audience_size_range: data.audienceSizeRange,
          bio: data.bio ?? null,
          max_mentees: maxMentees,
          active: true,
        },
        { onConflict: 'creator_id' }
      )
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to register mentor', { error, creatorId });
      throw new Error(`Failed to register mentor: ${error?.message}`);
    }

    this.logger.info('Mentor registered', { mentorProfileId: rows.id, creatorId });
    return { id: rows.id };
  }

  async getMentors(filters?: {
    niche?: string;
    audienceSizeRange?: string;
  }): Promise<MentorProfileRow[]> {
    let query = this.db
      .from<MentorProfileRow>('mentor_profiles')
      .select('id, creator_id, niche, audience_size_range, bio, max_mentees, active, created_at')
      .eq('active', true);

    if (filters?.niche) {
      query = query.eq('niche', filters.niche);
    }

    if (filters?.audienceSizeRange) {
      query = query.eq('audience_size_range', filters.audienceSizeRange);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

    if (error) {
      this.logger.error('Failed to get mentors', { error, filters });
      throw new Error(`Failed to get mentors: ${error.message}`);
    }

    return data ?? [];
  }

  async requestMentorship(
    menteeId: string,
    mentorId: string,
    data: { niche?: string; goals?: string[] }
  ): Promise<{ id: string }> {
    if (menteeId === mentorId) {
      throw new Error('Cannot request mentorship from yourself');
    }

    // Verify mentor profile exists and is active
    const { data: mentorProfile, error: profileError } = await this.db
      .from<MentorProfileRow>('mentor_profiles')
      .select('id, max_mentees, active')
      .eq('creator_id', mentorId)
      .eq('active', true)
      .maybeSingle();

    if (profileError || !mentorProfile) {
      throw new Error('Mentor not found or not accepting requests');
    }

    // Check mentor has capacity (count active mentorships)
    const { data: activeMentorships } = await this.db
      .from<MentorshipRow>('mentorships')
      .select('id')
      .eq('mentor_id', mentorId)
      .eq('status', 'active');

    const activeCount = (activeMentorships ?? []).length;
    if (activeCount >= mentorProfile.max_mentees) {
      throw new Error('Mentor has reached their maximum mentee capacity');
    }

    // Check no pending/active mentorship already exists
    const { data: existingRequest } = await this.db
      .from<MentorshipRow>('mentorships')
      .select('id, status')
      .eq('mentor_id', mentorId)
      .eq('mentee_id', menteeId)
      .in('status', ['pending', 'active'])
      .maybeSingle();

    if (existingRequest) {
      throw new Error(`Mentorship request already ${existingRequest.status}`);
    }

    const { data: rows, error } = await this.db
      .from<MentorshipRow>('mentorships')
      .insert({
        mentor_id: mentorId,
        mentee_id: menteeId,
        niche: data.niche ?? null,
        goals: data.goals ?? [],
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to create mentorship request', { error, menteeId, mentorId });
      throw new Error(`Failed to request mentorship: ${error?.message}`);
    }

    this.logger.info('Mentorship requested', { mentorshipId: rows.id, menteeId, mentorId });
    return { id: rows.id };
  }

  async respondToRequest(mentorshipId: string, creatorId: string, accept: boolean): Promise<void> {
    const { data: mentorship, error: findError } = await this.db
      .from<MentorshipRow>('mentorships')
      .select('id, mentor_id, status')
      .eq('id', mentorshipId)
      .single();

    if (findError || !mentorship) {
      throw new Error('Mentorship not found');
    }

    if (mentorship.mentor_id !== creatorId) {
      throw new Error('Only the mentor can respond to mentorship requests');
    }

    if (mentorship.status !== 'pending') {
      throw new Error(`Cannot respond to a mentorship in '${mentorship.status}' status`);
    }

    const newStatus = accept ? 'active' : 'declined';
    const updates: Partial<MentorshipRow> = accept
      ? { status: newStatus, started_at: new Date().toISOString() }
      : { status: newStatus };

    const { error } = await this.db
      .from<MentorshipRow>('mentorships')
      .update(updates)
      .eq('id', mentorshipId)
      .eq('status', 'pending'); // Atomic status guard

    if (error) {
      this.logger.error('Failed to respond to mentorship', { error, mentorshipId, accept });
      throw new Error(`Failed to respond to mentorship: ${error.message}`);
    }

    this.logger.info('Mentorship response recorded', { mentorshipId, accept, newStatus });
  }

  async getMyMentorships(creatorId: string): Promise<MentorshipRow[]> {
    // #260: Validate creatorId format to prevent .or() filter injection
    if (!/^[a-zA-Z0-9_-]+$/.test(creatorId)) {
      throw new Error('Invalid creator ID format');
    }

    const { data, error } = await this.db
      .from<MentorshipRow>('mentorships')
      .select(
        'id, mentor_id, mentee_id, niche, goals, status, started_at, completed_at, created_at'
      )
      .or(`mentor_id.eq.${creatorId},mentee_id.eq.${creatorId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error('Failed to get mentorships', { error, creatorId });
      throw new Error(`Failed to get mentorships: ${error.message}`);
    }

    return data ?? [];
  }
}
