// @ts-nocheck
/**
 * Mentorship Service
 * EPIC-010: Creator Network — Mentor registration, matching, and relationship management
 */

import type { IMentorshipService } from '../../interfaces/community/IMentorshipService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import crypto from 'crypto';

/** Strip ASCII control characters (U+0000–U+001F) from user-supplied strings */
function stripControlChars(input: string): string {
  return input.replace(/[\x00-\x1F]/g, '');
}

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

export class MentorshipService implements IMentorshipService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;

  constructor(db: ISupabaseClient, logger: ILogger, eventBus: IEventBus) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  private emitEvent(type: DomainEventType, aggregateId: string, payload: Record<string, unknown>): void {
    // Fire-and-forget — notification failures must NOT block the main operation
    void this.eventBus
      .publish({
        id: `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
        type,
        aggregateId,
        aggregateType: 'mentorship',
        payload,
        metadata: {
          timestamp: new Date(),
          version: '1.0.0',
          source: 'MentorshipService',
        },
      })
      .catch((err) => {
        this.logger.error('MentorshipService: event emission failed (non-blocking)', { err, type, aggregateId });
      });
  }

  async registerMentor(
    creatorId: string,
    data: { niche: string; audienceSizeRange: string; bio?: string; maxMentees?: number }
  ): Promise<{ id: string }> {
    // Input format validation (niche, audienceSizeRange) is handled by Zod at the route layer.
    // Only business-rule validation (capacity limits, DB-state checks) remains here.
    const maxMentees = data.maxMentees ?? 3;
    if (maxMentees < 1 || maxMentees > 10) {
      throw new ValidationError('max_mentees must be between 1 and 10');
    }

    // Upsert: if creator already has a profile, update it
    const { data: rows, error } = await this.db
      .from<MentorProfileRow>('mentor_profiles')
      .upsert(
        {
          creator_id: creatorId,
          niche: stripControlChars(data.niche.trim()),
          audience_size_range: data.audienceSizeRange,
          bio: data.bio != null ? stripControlChars(data.bio) : null,
          max_mentees: maxMentees,
          active: true,
        },
        { onConflict: 'creator_id' }
      )
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to register mentor', { error, creatorId });
      throw new ValidationError(`Failed to register mentor: ${error?.message}`);
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
      throw new ValidationError(`Failed to get mentors: ${error.message}`);
    }

    return data ?? [];
  }

  async requestMentorship(
    menteeId: string,
    mentorId: string,
    data: { niche?: string; goals?: string[] }
  ): Promise<{ id: string }> {
    if (menteeId === mentorId) {
      throw new ValidationError('Cannot request mentorship from yourself');
    }

    // Verify mentor profile exists and is active
    const { data: mentorProfile, error: profileError } = await this.db
      .from<MentorProfileRow>('mentor_profiles')
      .select('id, max_mentees, active')
      .eq('creator_id', mentorId)
      .eq('active', true)
      .maybeSingle();

    if (profileError || !mentorProfile) {
      throw new NotFoundError('Mentor not found or not accepting requests');
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
      throw new ConflictError(`Mentorship request already ${existingRequest.status}`);
    }

    // Strip control characters from goals
    const sanitizedGoals = (data.goals ?? []).map((g) => stripControlChars(g));

    // #TOCTOU fix (critical-patterns.md #1a): INSERT first, then count active mentorships.
    // If over capacity, DELETE the just-inserted row and return 409.
    // This eliminates the race window between SELECT count and INSERT.
    const { data: rows, error } = await this.db
      .from<MentorshipRow>('mentorships')
      .insert({
        mentor_id: mentorId,
        mentee_id: menteeId,
        niche: data.niche != null ? stripControlChars(data.niche) : null,
        goals: sanitizedGoals,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to create mentorship request', { error, menteeId, mentorId });
      throw new ValidationError(`Failed to request mentorship: ${error?.message}`);
    }

    // Count active mentorships AFTER insert — if over capacity, rollback
    const { count: activeCount, error: countError } = await this.db
      .from<MentorshipRow>('mentorships')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_id', mentorId)
      .eq('status', 'active');

    if (countError) {
      // Cleanup the just-inserted row on count failure
      await this.db.from<MentorshipRow>('mentorships').delete().eq('id', rows.id);
      throw new ValidationError(`Failed to count active mentorships: ${countError.message}`);
    }

    if ((activeCount ?? 0) > mentorProfile.max_mentees) {
      // Over capacity — remove the just-inserted request and return 409
      await this.db.from<MentorshipRow>('mentorships').delete().eq('id', rows.id);
      throw new ConflictError('Mentor has reached their maximum mentee capacity');
    }

    this.logger.info('Mentorship requested', { mentorshipId: rows.id, menteeId, mentorId });

    this.emitEvent(DomainEventType.COMMUNITY_MENTORSHIP_REQUESTED, rows.id, {
      mentorId,
      menteeId,
      mentorshipId: rows.id,
    });

    return { id: rows.id };
  }

  async respondToRequest(mentorshipId: string, creatorId: string, accept: boolean): Promise<void> {
    const { data: mentorship, error: findError } = await this.db
      .from<MentorshipRow>('mentorships')
      .select('id, mentor_id, mentee_id, status')
      .eq('id', mentorshipId)
      .single();

    if (findError || !mentorship) {
      throw new NotFoundError('Mentorship');
    }

    if (mentorship.mentor_id !== creatorId) {
      throw new AuthorizationError('Only the mentor can respond to mentorship requests');
    }

    if (mentorship.status !== 'pending') {
      throw new ConflictError(`Cannot respond to a mentorship in '${mentorship.status}' status`);
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
      throw new ValidationError(`Failed to respond to mentorship: ${error.message}`);
    }

    // #362: Accept-then-verify to prevent TOCTOU race on mentor capacity.
    // After atomically accepting, count active mentorships. If over capacity,
    // revert this acceptance back to 'pending' and return 409.
    if (accept) {
      const { data: mentorProfile, error: profileError } = await this.db
        .from<MentorProfileRow>('mentor_profiles')
        .select('max_mentees')
        .eq('creator_id', creatorId)
        .eq('active', true)
        .maybeSingle();

      if (profileError || !mentorProfile) {
        // Revert: mentor profile disappeared — roll back acceptance
        await this.db
          .from<MentorshipRow>('mentorships')
          .update({ status: 'pending', started_at: null })
          .eq('id', mentorshipId)
          .eq('status', 'active');
        throw new NotFoundError('Mentor profile not found — acceptance reverted');
      }

      const { count: activeCount, error: countError } = await this.db
        .from<MentorshipRow>('mentorships')
        .select('id', { count: 'exact', head: true })
        .eq('mentor_id', creatorId)
        .eq('status', 'active');

      if (countError) {
        // Revert on count failure
        await this.db
          .from<MentorshipRow>('mentorships')
          .update({ status: 'pending', started_at: null })
          .eq('id', mentorshipId)
          .eq('status', 'active');
        throw new ValidationError(`Failed to verify mentor capacity: ${countError.message}`);
      }

      if ((activeCount ?? 0) > mentorProfile.max_mentees) {
        // Over capacity — revert acceptance and return 409
        await this.db
          .from<MentorshipRow>('mentorships')
          .update({ status: 'pending', started_at: null })
          .eq('id', mentorshipId)
          .eq('status', 'active');
        throw new ConflictError('Mentor has reached their maximum mentee capacity');
      }
    }

    this.logger.info('Mentorship response recorded', { mentorshipId, accept, newStatus });

    const eventType = accept
      ? DomainEventType.COMMUNITY_MENTORSHIP_ACCEPTED
      : DomainEventType.COMMUNITY_MENTORSHIP_DECLINED;

    this.emitEvent(eventType, mentorshipId, {
      mentorId: creatorId,
      menteeId: mentorship.mentee_id,
      mentorshipId,
    });
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
      throw new ValidationError(`Failed to get mentorships: ${error.message}`);
    }

    return data ?? [];
  }

  async updateMentorProfile(
    profileId: string,
    creatorId: string,
    data: { niche?: string; audienceSizeRange?: string; bio?: string; maxMentees?: number }
  ): Promise<void> {
    this.logger.info('MentorshipService.updateMentorProfile', { profileId, creatorId });

    const updates: Record<string, unknown> = {};
    if (data.niche !== undefined) updates.niche = data.niche.trim();
    if (data.audienceSizeRange !== undefined) updates.audience_size_range = data.audienceSizeRange;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.maxMentees !== undefined) {
      if (data.maxMentees < 1 || data.maxMentees > 10) {
        throw new ValidationError('max_mentees must be between 1 and 10');
      }
      updates.max_mentees = data.maxMentees;
    }

    const { error } = await this.db
      .from<MentorProfileRow>('mentor_profiles')
      .update(updates)
      .eq('id', profileId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to update mentor profile', { error, profileId, creatorId });
      throw new ValidationError('Failed to update mentor profile');
    }
  }
}
