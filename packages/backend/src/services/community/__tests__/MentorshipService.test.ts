/**
 * Tests for MentorshipService
 * EPIC-010: Community Services — Mentor registration, matching, and relationship management
 *
 * Coverage targets:
 * - registerMentor: maxMentees bounds, upsert on conflict, DB error
 *   (niche & audienceSizeRange validation moved to Zod at route layer per #350)
 * - getMentors: no filters, niche filter, audienceSizeRange filter, combined, DB error, empty
 * - requestMentorship: self-request guard, mentor not found, capacity check,
 *   duplicate request guard, DB error, success
 * - respondToRequest: authorization (mentor only), wrong status, accept path,
 *   decline path, DB error
 * - getMyMentorships: success, empty, DB error
 */

import { MentorshipService } from '../MentorshipService';

// ---------------------------------------------------------------------------
// Supabase mock-chain factory — see CreatorCircleService.test.ts for rationale
// ---------------------------------------------------------------------------
function makeChain(leafResolvedValue: any) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(leafResolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(leafResolvedValue),
  };
  chain.then = (res: any, rej: any) => Promise.resolve(leafResolvedValue).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(leafResolvedValue).catch(fn);
  return chain;
}

describe('MentorshipService', () => {
  let service: MentorshipService;
  let mockDb: any;
  let mockLogger: any;

  const MENTOR_ID = 'mentor-pub-key';
  const MENTEE_ID = 'mentee-pub-key';
  const MENTORSHIP_ID = 'mentorship-uuid-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockDb = { from: vi.fn() };
    const mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    service = new MentorshipService(mockDb, mockLogger, mockEventBus);
  });

  // -------------------------------------------------------------------------
  // registerMentor
  // -------------------------------------------------------------------------
  describe('registerMentor', () => {
    it('registers a new mentor with valid data (upsert)', async () => {
      const upsertChain = makeChain({ data: { id: 'mentor-profile-id' }, error: null });
      mockDb.from.mockReturnValueOnce(upsertChain);

      const result = await service.registerMentor(MENTOR_ID, {
        niche: 'technology',
        audienceSizeRange: '1k-10k',
        bio: 'I mentor devs',
        maxMentees: 5,
      });

      expect(result).toEqual({ id: 'mentor-profile-id' });
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: MENTOR_ID,
          niche: 'technology',
          audience_size_range: '1k-10k',
          bio: 'I mentor devs',
          max_mentees: 5,
          active: true,
        }),
        { onConflict: 'creator_id' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Mentor registered',
        expect.objectContaining({ creatorId: MENTOR_ID, mentorProfileId: 'mentor-profile-id' })
      );
    });

    it('uses default maxMentees of 3 when not specified', async () => {
      const upsertChain = makeChain({ data: { id: 'default-mentees-profile' }, error: null });
      mockDb.from.mockReturnValueOnce(upsertChain);

      await service.registerMentor(MENTOR_ID, {
        niche: 'gaming',
        audienceSizeRange: '0-1k',
      });

      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ max_mentees: 3 }),
        expect.any(Object)
      );
    });

    it('trims whitespace from niche', async () => {
      const upsertChain = makeChain({ data: { id: 'trimmed' }, error: null });
      mockDb.from.mockReturnValueOnce(upsertChain);

      await service.registerMentor(MENTOR_ID, {
        niche: '  tech  ',
        audienceSizeRange: '100k+',
      });

      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ niche: 'tech' }),
        expect.any(Object)
      );
    });

    // #350: niche empty/whitespace validation moved to Zod at route layer

    it.each(['0-1k', '1k-10k', '10k-100k', '100k+'])(
      'accepts valid audienceSizeRange: %s',
      async (range) => {
        const upsertChain = makeChain({ data: { id: `profile-${range}` }, error: null });
        mockDb.from.mockReturnValueOnce(upsertChain);

        const result = await service.registerMentor(MENTOR_ID, {
          niche: 'test',
          audienceSizeRange: range,
        });

        expect(result.id).toBeDefined();
      }
    );

    // #350: audienceSizeRange validation moved to Zod at route layer

    it('throws when maxMentees is 0 (below minimum)', async () => {
      await expect(
        service.registerMentor(MENTOR_ID, {
          niche: 'tech',
          audienceSizeRange: '0-1k',
          maxMentees: 0,
        })
      ).rejects.toThrow('max_mentees must be between 1 and 10');
    });

    it('throws when maxMentees exceeds 10', async () => {
      await expect(
        service.registerMentor(MENTOR_ID, {
          niche: 'tech',
          audienceSizeRange: '0-1k',
          maxMentees: 11,
        })
      ).rejects.toThrow('max_mentees must be between 1 and 10');
    });

    it('accepts boundary values of maxMentees (1 and 10)', async () => {
      for (const maxMentees of [1, 10]) {
        const upsertChain = makeChain({ data: { id: `profile-${maxMentees}` }, error: null });
        mockDb.from.mockReturnValueOnce(upsertChain);

        const result = await service.registerMentor(MENTOR_ID, {
          niche: 'tech',
          audienceSizeRange: '0-1k',
          maxMentees,
        });
        expect(result.id).toBeDefined();
      }
    });

    it('throws and logs when the DB upsert fails', async () => {
      const dbError = { message: 'upsert conflict' };
      const upsertChain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValueOnce(upsertChain);

      await expect(
        service.registerMentor(MENTOR_ID, { niche: 'tech', audienceSizeRange: '0-1k' })
      ).rejects.toThrow('Failed to register mentor: upsert conflict');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to register mentor',
        expect.objectContaining({ error: dbError, creatorId: MENTOR_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getMentors
  // -------------------------------------------------------------------------
  describe('getMentors', () => {
    it('returns all active mentors with no filters', async () => {
      const mentors = [{ id: 'm1', creator_id: MENTOR_ID, niche: 'tech', active: true }];
      const chain = makeChain({ data: mentors, error: null });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getMentors();

      expect(result).toEqual(mentors);
      expect(chain.eq).toHaveBeenCalledWith('active', true);
    });

    it('applies niche filter when provided', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValueOnce(chain);

      await service.getMentors({ niche: 'gaming' });

      expect(chain.eq).toHaveBeenCalledWith('niche', 'gaming');
    });

    it('applies audienceSizeRange filter when provided', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValueOnce(chain);

      await service.getMentors({ audienceSizeRange: '1k-10k' });

      expect(chain.eq).toHaveBeenCalledWith('audience_size_range', '1k-10k');
    });

    it('applies both filters when both are provided', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValueOnce(chain);

      await service.getMentors({ niche: 'tech', audienceSizeRange: '10k-100k' });

      expect(chain.eq).toHaveBeenCalledWith('niche', 'tech');
      expect(chain.eq).toHaveBeenCalledWith('audience_size_range', '10k-100k');
    });

    it('returns empty array when no mentors match', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getMentors({ niche: 'nonexistent' });
      expect(result).toEqual([]);
    });

    it('throws and logs when the DB query fails', async () => {
      const dbError = { message: 'query failed' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.getMentors()).rejects.toThrow('Failed to get mentors: query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get mentors',
        expect.objectContaining({ error: dbError })
      );
    });
  });

  // -------------------------------------------------------------------------
  // requestMentorship
  // -------------------------------------------------------------------------
  describe('requestMentorship', () => {
    // New call order (TOCTOU-safe insert-first pattern):
    //   1. from('mentor_profiles') — profile lookup (maybySingle)
    //   2. from('mentorships') — existing request check (maybySingle)
    //   3. from('mentorships') — insert new request (single)
    //   4. from('mentorships') — count active mentorships after insert (head count)
    //   5. (if over capacity) from('mentorships') — delete rollback

    it('creates a pending mentorship request', async () => {
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 3, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({ data: null, error: null }); // no duplicate
      const insertChain = makeChain({ data: { id: MENTORSHIP_ID }, error: null });
      // After insert: count active mentorships — 1 active (under max_mentees=3)
      const activeCountChain = makeChain({ count: 1, error: null } as any);

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(activeCountChain);

      const result = await service.requestMentorship(MENTEE_ID, MENTOR_ID, {
        niche: 'tech',
        goals: ['improve coding', 'grow audience'],
      });

      expect(result).toEqual({ id: MENTORSHIP_ID });
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor_id: MENTOR_ID,
          mentee_id: MENTEE_ID,
          niche: 'tech',
          goals: ['improve coding', 'grow audience'],
          status: 'pending',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Mentorship requested',
        expect.objectContaining({ mentorshipId: MENTORSHIP_ID })
      );
    });

    it('throws when mentee attempts to request mentorship from themselves', async () => {
      await expect(service.requestMentorship(MENTOR_ID, MENTOR_ID, {})).rejects.toThrow(
        'Cannot request mentorship from yourself'
      );
    });

    it('throws when mentor profile is not found or not active', async () => {
      const notFoundChain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.requestMentorship(MENTEE_ID, MENTOR_ID, {})).rejects.toThrow(
        'Mentor not found or not accepting requests'
      );
    });

    it('throws when mentor profile lookup returns an error', async () => {
      const errorChain = makeChain({ data: null, error: { message: 'lookup failed' } });
      mockDb.from.mockReturnValueOnce(errorChain);

      await expect(service.requestMentorship(MENTEE_ID, MENTOR_ID, {})).rejects.toThrow(
        'Mentor not found or not accepting requests'
      );
    });

    it('throws when mentor is at maximum mentee capacity (insert-then-revert pattern)', async () => {
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 2, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: { id: 'ms-over-cap' }, error: null });
      // After insert: activeCount > max_mentees — triggers rollback delete
      const activeCountChain = makeChain({ count: 3, error: null } as any); // 3 > 2
      const deleteChain = makeChain({ error: null });

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(activeCountChain)
        .mockReturnValueOnce(deleteChain); // rollback delete

      await expect(service.requestMentorship(MENTEE_ID, MENTOR_ID, {})).rejects.toThrow(
        'Mentor has reached their maximum mentee capacity'
      );
    });

    it('throws when a pending mentorship request already exists', async () => {
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 5, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({
        data: { id: 'existing-ms', status: 'pending' },
        error: null,
      });

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain);

      await expect(service.requestMentorship(MENTEE_ID, MENTOR_ID, {})).rejects.toThrow(
        'Mentorship request already pending'
      );
    });

    it('throws when an active mentorship already exists', async () => {
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 5, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({
        data: { id: 'active-ms', status: 'active' },
        error: null,
      });

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain);

      await expect(service.requestMentorship(MENTEE_ID, MENTOR_ID, {})).rejects.toThrow(
        'Mentorship request already active'
      );
    });

    it('throws and logs when the DB insert fails', async () => {
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 5, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({ data: null, error: null });
      const dbError = { message: 'insert failed' };
      const insertChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain)
        .mockReturnValueOnce(insertChain);

      await expect(service.requestMentorship(MENTEE_ID, MENTOR_ID, {})).rejects.toThrow(
        'Failed to request mentorship: insert failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create mentorship request',
        expect.objectContaining({ error: dbError })
      );
    });

    it('treats null activeCount as zero (no active mentorships yet)', async () => {
      // Covers the (activeCount ?? 0) null-coalescing branch for the post-insert count
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 1, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: { id: 'ms-null-active' }, error: null });
      // count is null — treated as 0, so 0 <= max_mentees=1 → NOT over capacity
      const activeCountChain = makeChain({ count: null, error: null } as any);

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(activeCountChain);

      const result = await service.requestMentorship(MENTEE_ID, MENTOR_ID, {});
      expect(result).toEqual({ id: 'ms-null-active' });
    });

    it('uses empty array for goals when goals are not provided', async () => {
      const mentorProfileChain = makeChain({
        data: { id: 'mp-1', max_mentees: 5, active: true },
        error: null,
      });
      const existingRequestChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: { id: 'ms-no-goals' }, error: null });
      const activeCountChain = makeChain({ count: 1, error: null } as any);

      mockDb.from
        .mockReturnValueOnce(mentorProfileChain)
        .mockReturnValueOnce(existingRequestChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(activeCountChain);

      await service.requestMentorship(MENTEE_ID, MENTOR_ID, {});

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ goals: [], niche: null })
      );
    });
  });

  // -------------------------------------------------------------------------
  // respondToRequest
  // -------------------------------------------------------------------------
  describe('respondToRequest', () => {
    it('allows the mentor to accept a pending request', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'pending' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });
      // #362: Accept-then-verify — mentor profile lookup after accepting
      const mentorProfileChain = makeChain({
        data: { max_mentees: 5 },
        error: null,
      });
      // #362: Count active mentorships (under capacity)
      const activeCountChain = makeChain({ data: null, error: null, count: 1 } as any);

      mockDb.from
        .mockReturnValueOnce(findChain) // find mentorship
        .mockReturnValueOnce(updateChain) // update status to active
        .mockReturnValueOnce(mentorProfileChain) // mentor profile lookup
        .mockReturnValueOnce(activeCountChain); // count active mentorships

      await expect(
        service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, true)
      ).resolves.toBeUndefined();

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Mentorship response recorded',
        expect.objectContaining({ mentorshipId: MENTORSHIP_ID, accept: true, newStatus: 'active' })
      );
    });

    it('allows the mentor to decline a pending request', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'pending' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(
        service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, false)
      ).resolves.toBeUndefined();

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'declined' })
      );
    });

    it('sets started_at when accepting', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'pending' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });
      // #362: Accept-then-verify — mentor profile lookup after accepting
      const mentorProfileChain = makeChain({
        data: { max_mentees: 5 },
        error: null,
      });
      // #362: Count active mentorships (under capacity)
      const activeCountChain = makeChain({ data: null, error: null, count: 1 } as any);

      mockDb.from
        .mockReturnValueOnce(findChain) // find mentorship
        .mockReturnValueOnce(updateChain) // update status to active
        .mockReturnValueOnce(mentorProfileChain) // mentor profile lookup
        .mockReturnValueOnce(activeCountChain); // count active mentorships

      await service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, true);

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ started_at: expect.any(String) })
      );
    });

    it('does NOT set started_at when declining', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'pending' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, false);

      const updateArg = updateChain.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('started_at');
    });

    it('throws when mentorship is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, true)).rejects.toThrow(
        'Mentorship not found'
      );
    });

    it('throws when requester is not the mentor', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'pending' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.respondToRequest(MENTORSHIP_ID, 'not-the-mentor', true)).rejects.toThrow(
        'Only the mentor can respond to mentorship requests'
      );
    });

    it('throws when mentorship is not in pending status', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'active' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, true)).rejects.toThrow(
        "Cannot respond to a mentorship in 'active' status"
      );
    });

    it('throws when mentorship is in declined status', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'declined' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, true)).rejects.toThrow(
        "Cannot respond to a mentorship in 'declined' status"
      );
    });

    it('throws and logs when the DB update fails', async () => {
      const findChain = makeChain({
        data: { id: MENTORSHIP_ID, mentor_id: MENTOR_ID, status: 'pending' },
        error: null,
      });
      const dbError = { message: 'update failed' };
      const updateChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.respondToRequest(MENTORSHIP_ID, MENTOR_ID, true)).rejects.toThrow(
        'Failed to respond to mentorship: update failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to respond to mentorship',
        expect.objectContaining({ error: dbError, mentorshipId: MENTORSHIP_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getMyMentorships
  // -------------------------------------------------------------------------
  describe('getMyMentorships', () => {
    it('returns all mentorships for a creator (as mentor or mentee)', async () => {
      const mentorships = [
        { id: 'ms-1', mentor_id: MENTOR_ID, mentee_id: MENTEE_ID, status: 'active' },
        { id: 'ms-2', mentor_id: 'other-mentor', mentee_id: MENTOR_ID, status: 'pending' },
      ];
      const chain = makeChain({ data: mentorships, error: null });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getMyMentorships(MENTOR_ID);

      expect(result).toEqual(mentorships);
      expect(chain.or).toHaveBeenCalledWith(`mentor_id.eq.${MENTOR_ID},mentee_id.eq.${MENTOR_ID}`);
    });

    it('returns empty array when no mentorships exist', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getMyMentorships(MENTOR_ID);
      expect(result).toEqual([]);
    });

    it('throws and logs when the DB query fails', async () => {
      const dbError = { message: 'query failed' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.getMyMentorships(MENTOR_ID)).rejects.toThrow(
        'Failed to get mentorships: query failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get mentorships',
        expect.objectContaining({ error: dbError, creatorId: MENTOR_ID })
      );
    });
  });
});
