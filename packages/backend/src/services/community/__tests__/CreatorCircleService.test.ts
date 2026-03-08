/**
 * Tests for CreatorCircleService
 * EPIC-010: Community Services — Circle management, membership, and posts
 *
 * Coverage targets:
 * - createCircle: max_members validation, DB error, auto-join as admin
 * - getCircles: success, DB error, empty result
 * - getSuggestedCircles: niche match path, fallback path, error paths
 * - joinCircle: capacity check, duplicate member, circle not found, DB error
 * - removeMember: admin auth, self-removal guard, circle not found, DB error
 * - getCirclePosts: success, DB error, empty result
 * - createPost: DB error, success (content validation moved to Zod at route layer per #350)
 */

import { CreatorCircleService } from '../CreatorCircleService';
import { DatabaseError } from '../../../utils/errors';

// ---------------------------------------------------------------------------
// Supabase mock-chain factory
//
// Each test overrides only the leaf method it needs (single/maybeSingle/plain
// resolved value) so the chain always returns `this` until the final call.
// ---------------------------------------------------------------------------
function makeChain(leafResolvedValue: any) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(leafResolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(leafResolvedValue),
  };
  // Plain-resolved value for chains that terminate without single/maybeSingle
  Object.assign(chain, Promise.resolve(leafResolvedValue));
  chain.then = (res: any, rej: any) => Promise.resolve(leafResolvedValue).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(leafResolvedValue).catch(fn);
  return chain;
}

describe('CreatorCircleService', () => {
  let service: CreatorCircleService;
  let mockDb: any;
  let mockLogger: any;
  let mockEventBus: any;

  const CREATOR_ID = 'creator-abc';
  const CIRCLE_ID = 'circle-xyz';

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    // Default db.from returns a chain that resolves to nothing — tests override
    // per call via mockReturnValueOnce / mockImplementation chains.
    mockDb = {
      from: vi.fn(),
      rpc: vi.fn(),
    };
  });

  function buildService() {
    service = new CreatorCircleService(mockDb, mockLogger, mockEventBus);
  }

  // -------------------------------------------------------------------------
  // createCircle
  // -------------------------------------------------------------------------
  describe('createCircle', () => {
    it('creates a circle with default max_members (20) and auto-joins creator as admin', async () => {
      buildService();

      mockDb.rpc.mockResolvedValueOnce({ data: 'new-circle-id', error: null });

      const result = await service.createCircle(CREATOR_ID, { name: 'My Circle' });

      expect(result).toEqual({ id: 'new-circle-id' });
      expect(mockDb.rpc).toHaveBeenCalledWith('create_circle_atomic', {
        p_name: 'My Circle',
        p_description: null,
        p_niche: null,
        p_max_members: 20,
        p_created_by: CREATOR_ID,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circle created',
        expect.objectContaining({ circleId: 'new-circle-id', creatorId: CREATOR_ID })
      );
    });

    it('creates a circle with explicit max_members within the valid range', async () => {
      buildService();

      mockDb.rpc.mockResolvedValueOnce({ data: 'circle-10', error: null });

      const result = await service.createCircle(CREATOR_ID, {
        name: 'Small Circle',
        maxMembers: 10,
      });

      expect(result).toEqual({ id: 'circle-10' });
      expect(mockDb.rpc).toHaveBeenCalledWith(
        'create_circle_atomic',
        expect.objectContaining({
          p_max_members: 10,
        })
      );
    });

    it('throws when max_members is below minimum (5)', async () => {
      buildService();
      await expect(
        service.createCircle(CREATOR_ID, { name: 'Tiny', maxMembers: 4 })
      ).rejects.toThrow('Circle size must be between 5 and 20 members');
    });

    it('throws when max_members exceeds maximum (20)', async () => {
      buildService();
      await expect(
        service.createCircle(CREATOR_ID, { name: 'Huge', maxMembers: 21 })
      ).rejects.toThrow('Circle size must be between 5 and 20 members');
    });

    it('accepts boundary value of 5 (minimum)', async () => {
      buildService();

      mockDb.rpc.mockResolvedValueOnce({ data: 'circle-5', error: null });

      const result = await service.createCircle(CREATOR_ID, { name: 'Min Circle', maxMembers: 5 });
      expect(result).toEqual({ id: 'circle-5' });
    });

    it('throws DatabaseError and logs when the DB insert fails', async () => {
      buildService();

      const dbError = { message: 'connection refused' };
      mockDb.rpc.mockResolvedValueOnce({ data: null, error: dbError });

      await expect(service.createCircle(CREATOR_ID, { name: 'Fail Circle' })).rejects.toThrow(
        DatabaseError
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create circle',
        expect.objectContaining({ error: dbError, creatorId: CREATOR_ID })
      );
    });

    it('includes description and niche when provided', async () => {
      buildService();

      mockDb.rpc.mockResolvedValueOnce({ data: 'circle-with-meta', error: null });

      await service.createCircle(CREATOR_ID, {
        name: 'Niche Circle',
        description: 'For tech creators',
        niche: 'technology',
        maxMembers: 15,
      });

      expect(mockDb.rpc).toHaveBeenCalledWith(
        'create_circle_atomic',
        expect.objectContaining({
          p_description: 'For tech creators',
          p_niche: 'technology',
          p_max_members: 15,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCircles
  // New call order: from('circle_members') memberships → from('creator_circles') created
  // (optionally) from('creator_circles') joined-only circles
  // -------------------------------------------------------------------------
  describe('getCircles', () => {
    it('returns all circles from the database', async () => {
      buildService();

      const dbRows = [
        {
          id: 'c1',
          name: 'Circle 1',
          description: null,
          niche: 'tech',
          max_members: 20,
          created_by: CREATOR_ID,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 'c2',
          name: 'Circle 2',
          description: null,
          niche: null,
          max_members: 10,
          created_by: CREATOR_ID,
          created_at: '2025-01-02',
          updated_at: '2025-01-02',
        },
      ];
      // First: circle_members query — no memberships (creator is not a member of any external circle)
      const membershipsChain = makeChain({ data: [], error: null });
      // Second: creator_circles — created circles
      const createdCirclesChain = makeChain({ data: dbRows, error: null });

      mockDb.from.mockReturnValueOnce(membershipsChain).mockReturnValueOnce(createdCirclesChain);

      const result = await service.getCircles(CREATOR_ID);

      // Service applies rowToCircle() which maps snake_case DB rows to camelCase domain objects
      expect(result).toEqual([
        {
          id: 'c1',
          name: 'Circle 1',
          niche: 'tech',
          maxMembers: 20,
          createdBy: CREATOR_ID,
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: 'c2',
          name: 'Circle 2',
          niche: undefined,
          maxMembers: 10,
          createdBy: CREATOR_ID,
          createdAt: '2025-01-02',
          updatedAt: '2025-01-02',
        },
      ]);
      expect(mockDb.from).toHaveBeenCalledWith('circle_members');
      expect(mockDb.from).toHaveBeenCalledWith('creator_circles');
    });

    it('returns empty array when no circles exist', async () => {
      buildService();
      // No memberships, no created circles
      mockDb.from
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }));

      const result = await service.getCircles(CREATOR_ID);
      expect(result).toEqual([]);
    });

    it('throws DatabaseError and logs when the DB query fails', async () => {
      buildService();
      const dbError = { message: 'timeout' };
      // memberships succeeds (empty), then single OR query fails
      mockDb.from
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: dbError }));

      await expect(service.getCircles(CREATOR_ID)).rejects.toThrow(DatabaseError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get circles',
        expect.objectContaining({ error: dbError, creatorId: CREATOR_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getSuggestedCircles
  // -------------------------------------------------------------------------
  describe('getSuggestedCircles', () => {
    // New flow: 3 DB calls:
    //   1. circle_members → joined circle IDs (exclude from suggestions)
    //   2. creator_circles maybeSingle → creator's niche
    //   3. creator_circles → suggestions (niche-match or fallback)

    it('returns niche-matched circles when creator has a niche', async () => {
      buildService();

      const membershipsChain = makeChain({ data: [], error: null }); // no joined circles
      const myCircleChain = makeChain(null);
      (myCircleChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { niche: 'gaming' },
        error: null,
      });
      const suggestedCircles = [{ id: 's1', name: 'Gamers Hub', niche: 'gaming' }];
      const suggestedChain = makeChain({ data: suggestedCircles, error: null });

      mockDb.from
        .mockReturnValueOnce(membershipsChain) // circle_members → joined IDs
        .mockReturnValueOnce(myCircleChain) // creator's niche lookup
        .mockReturnValueOnce(suggestedChain); // niche-matched suggestions

      const result = await service.getSuggestedCircles(CREATOR_ID);

      expect(result).toEqual(suggestedCircles);
      expect(suggestedChain.eq).toHaveBeenCalledWith('niche', 'gaming');
      expect(suggestedChain.neq).toHaveBeenCalledWith('created_by', CREATOR_ID);
    });

    it('falls back to recently created circles when creator has no niche', async () => {
      buildService();

      const membershipsChain = makeChain({ data: [], error: null });
      const myCircleChain = makeChain(null);
      (myCircleChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });
      const recentDbRows = [
        {
          id: 'r1',
          name: 'Recent Circle',
          description: null,
          niche: null,
          max_members: 20,
          created_by: 'other-creator',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];
      const recentChain = makeChain({ data: recentDbRows, error: null });

      mockDb.from
        .mockReturnValueOnce(membershipsChain)
        .mockReturnValueOnce(myCircleChain)
        .mockReturnValueOnce(recentChain);

      const result = await service.getSuggestedCircles(CREATOR_ID);

      // Service applies rowToCircle() — camelCase domain objects
      expect(result).toEqual([
        {
          id: 'r1',
          name: 'Recent Circle',
          niche: undefined,
          maxMembers: 20,
          createdBy: 'other-creator',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ]);
      expect(recentChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns empty array when fallback query returns null', async () => {
      buildService();

      const membershipsChain = makeChain({ data: [], error: null });
      const myCircleChain = makeChain(null);
      (myCircleChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });
      const emptyChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(membershipsChain)
        .mockReturnValueOnce(myCircleChain)
        .mockReturnValueOnce(emptyChain);

      const result = await service.getSuggestedCircles(CREATOR_ID);
      expect(result).toEqual([]);
    });

    it('throws DatabaseError when niche-matched query fails', async () => {
      buildService();

      const membershipsChain = makeChain({ data: [], error: null });
      const myCircleChain = makeChain(null);
      (myCircleChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { niche: 'tech' },
        error: null,
      });
      const dbError = { message: 'niche query failed' };
      const failChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(membershipsChain)
        .mockReturnValueOnce(myCircleChain)
        .mockReturnValueOnce(failChain);

      await expect(service.getSuggestedCircles(CREATOR_ID)).rejects.toThrow(DatabaseError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get suggested circles',
        expect.objectContaining({ error: dbError, creatorId: CREATOR_ID })
      );
    });

    it('throws DatabaseError when suggestion query fails (no niche)', async () => {
      buildService();

      // Promise.all: memberships and niche queries run in parallel
      const membershipsChain = makeChain({ data: [], error: null });
      const myCircleChain = makeChain(null);
      (myCircleChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });
      const dbError = { message: 'fallback failed' };
      const failChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(membershipsChain)
        .mockReturnValueOnce(myCircleChain)
        .mockReturnValueOnce(failChain);

      await expect(service.getSuggestedCircles(CREATOR_ID)).rejects.toThrow(DatabaseError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get suggested circles',
        expect.objectContaining({ error: dbError })
      );
    });

    it('returns empty array when niche-matched query returns null data', async () => {
      buildService();

      const membershipsChain = makeChain({ data: [], error: null });
      const myCircleChain = makeChain(null);
      (myCircleChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { niche: 'gaming' },
        error: null,
      });
      const suggestedChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(membershipsChain)
        .mockReturnValueOnce(myCircleChain)
        .mockReturnValueOnce(suggestedChain);

      const result = await service.getSuggestedCircles(CREATOR_ID);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // joinCircle
  // -------------------------------------------------------------------------
  describe('joinCircle', () => {
    it('joins a circle with available capacity', async () => {
      buildService();

      // #361: insert-then-verify pattern: circle lookup → insert → count after insert
      const circleChain = makeChain(null);
      (circleChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: CIRCLE_ID, max_members: 5, created_by: 'admin-id' },
        error: null,
      });
      const insertChain = makeChain({ data: null, error: null }); // insert succeeds
      const countChain = makeChain({ count: 2, error: null } as any); // 2 members after insert (under max 5)

      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup
        .mockReturnValueOnce(insertChain) // insert new member
        .mockReturnValueOnce(countChain); // count after insert

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).resolves.toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creator joined circle',
        expect.objectContaining({ circleId: CIRCLE_ID, creatorId: CREATOR_ID })
      );
    });

    it('throws when circle is not found', async () => {
      buildService();

      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).rejects.toThrow('Circle not found');
    });

    it('throws when circle is at maximum capacity', async () => {
      buildService();

      const circleChain = makeChain({ data: { id: CIRCLE_ID, max_members: 3 }, error: null });
      // #361: insert-then-verify — insert succeeds first
      const insertChain = makeChain({ data: null, error: null });
      // Count returns 4 (one more than max_members=3, since we just inserted)
      const countChain = makeChain({ data: null, error: null, count: 4 } as any);
      // Cleanup: delete the just-inserted member
      const deleteChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup
        .mockReturnValueOnce(insertChain) // insert member
        .mockReturnValueOnce(countChain) // count members after insert
        .mockReturnValueOnce(deleteChain); // delete over-capacity member

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).rejects.toThrow(
        'Circle is full (max 3 members)'
      );
    });

    it('throws with "Already a member" when unique constraint is violated (code 23505)', async () => {
      buildService();

      const circleChain = makeChain({ data: { id: CIRCLE_ID, max_members: 20 }, error: null });
      // #361: insert-then-verify — insert fails immediately with unique constraint
      const dupInsertChain = makeChain({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup
        .mockReturnValueOnce(dupInsertChain); // insert fails with 23505

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).rejects.toThrow(
        'Already a member of this circle'
      );
    });

    it('throws DatabaseError and logs when insert fails with a non-duplicate error', async () => {
      buildService();

      const circleChain = makeChain({ data: { id: CIRCLE_ID, max_members: 20 }, error: null });
      // #361: insert-then-verify — insert fails immediately with non-duplicate error
      const dbError = { code: '50000', message: 'insert failed' };
      const insertChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup
        .mockReturnValueOnce(insertChain); // insert fails

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).rejects.toThrow(DatabaseError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to join circle',
        expect.objectContaining({ error: dbError })
      );
    });

    it('handles the boundary case: exactly one slot remaining', async () => {
      buildService();

      // #361: insert-then-verify: circle lookup → insert → count (exactly at capacity)
      const circleChain = makeChain(null);
      (circleChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: CIRCLE_ID, max_members: 3, created_by: 'admin-id' },
        error: null,
      });
      const insertChain = makeChain({ data: null, error: null });
      // After insert: count=3 which equals max_members=3, so NOT over capacity
      const countChain = makeChain({ data: null, error: null, count: 3 } as any);

      mockDb.from
        .mockReturnValueOnce(circleChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain);

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).resolves.toBeUndefined();
    });

    it('treats null member count as zero (first member joining)', async () => {
      buildService();

      // #361: insert-then-verify: circle lookup → insert → count (null = 0, safe)
      const circleChain = makeChain(null);
      (circleChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: CIRCLE_ID, max_members: 5, created_by: 'admin-id' },
        error: null,
      });
      const insertChain = makeChain({ data: null, error: null });
      // count is null (fresh circle) — treated as 0, not over capacity
      const countChain = makeChain({ data: null, error: null, count: null } as any);

      mockDb.from
        .mockReturnValueOnce(circleChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain);

      await expect(service.joinCircle(CREATOR_ID, CIRCLE_ID)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // removeMember
  // -------------------------------------------------------------------------
  describe('removeMember', () => {
    const ADMIN_ID = 'admin-creator';
    const MEMBER_ID = 'member-to-remove';

    it('allows the circle admin (creator) to remove a member', async () => {
      buildService();

      const circleChain = makeChain({ data: { created_by: ADMIN_ID }, error: null });
      const deleteChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(circleChain).mockReturnValueOnce(deleteChain);

      await expect(service.removeMember(CIRCLE_ID, MEMBER_ID, ADMIN_ID)).resolves.toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Member removed from circle',
        expect.objectContaining({ circleId: CIRCLE_ID, memberId: MEMBER_ID, requesterId: ADMIN_ID })
      );
    });

    it('throws when circle is not found', async () => {
      buildService();

      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.removeMember(CIRCLE_ID, MEMBER_ID, ADMIN_ID)).rejects.toThrow(
        'Circle not found'
      );
    });

    it('throws when requester is not the admin', async () => {
      buildService();

      const circleChain = makeChain({ data: { created_by: ADMIN_ID }, error: null });
      mockDb.from.mockReturnValueOnce(circleChain);

      await expect(service.removeMember(CIRCLE_ID, MEMBER_ID, 'not-the-admin')).rejects.toThrow(
        'Only the circle admin can remove members'
      );
    });

    it('throws when admin attempts to remove themselves', async () => {
      buildService();

      const circleChain = makeChain({ data: { created_by: ADMIN_ID }, error: null });
      mockDb.from.mockReturnValueOnce(circleChain);

      await expect(
        service.removeMember(CIRCLE_ID, ADMIN_ID, ADMIN_ID) // memberId === requesterId
      ).rejects.toThrow('Admin cannot remove themselves');
    });

    it('throws DatabaseError and logs when the delete query fails', async () => {
      buildService();

      const circleChain = makeChain({ data: { created_by: ADMIN_ID }, error: null });
      const dbError = { message: 'delete failed' };
      const deleteChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(circleChain).mockReturnValueOnce(deleteChain);

      await expect(service.removeMember(CIRCLE_ID, MEMBER_ID, ADMIN_ID)).rejects.toThrow(
        DatabaseError
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove member',
        expect.objectContaining({ error: dbError, circleId: CIRCLE_ID, memberId: MEMBER_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCirclePosts
  // -------------------------------------------------------------------------
  describe('getCirclePosts', () => {
    it('returns posts for a circle in descending order', async () => {
      buildService();

      // #359: Circle lookup via .single() — creator_id matches CREATOR_ID, so skip membership
      const circleChain = makeChain(null);
      (circleChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: CIRCLE_ID, created_by: CREATOR_ID },
        error: null,
      });

      const postDbRows = [
        {
          id: 'p2',
          circle_id: CIRCLE_ID,
          author_id: 'a',
          content: 'Second',
          created_at: '2025-02-02',
        },
        {
          id: 'p1',
          circle_id: CIRCLE_ID,
          author_id: 'b',
          content: 'First',
          created_at: '2025-02-01',
        },
      ];
      const postsChain = makeChain({ data: postDbRows, error: null });
      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup (creator matches — skip membership)
        .mockReturnValueOnce(postsChain); // posts query

      const result = await service.getCirclePosts(CIRCLE_ID, CREATOR_ID);
      // Service applies rowToCirclePost() — camelCase domain objects
      expect(result).toEqual([
        {
          id: 'p2',
          circleId: CIRCLE_ID,
          authorId: 'a',
          content: 'Second',
          createdAt: '2025-02-02',
        },
        { id: 'p1', circleId: CIRCLE_ID, authorId: 'b', content: 'First', createdAt: '2025-02-01' },
      ]);
      expect(postsChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      // #713: service uses .range() for pagination instead of .limit()
      expect(postsChain.range).toHaveBeenCalledWith(0, 49);
    });

    it('returns empty array when no posts exist', async () => {
      buildService();

      // #359: Circle lookup via .single()
      const circleChain = makeChain(null);
      (circleChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: CIRCLE_ID, created_by: CREATOR_ID },
        error: null,
      });
      const emptyPostsChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup (creator matches)
        .mockReturnValueOnce(emptyPostsChain); // posts query returns null

      const result = await service.getCirclePosts(CIRCLE_ID, CREATOR_ID);
      expect(result).toEqual([]);
    });

    it('throws DatabaseError and logs when the DB query fails', async () => {
      buildService();

      // #359: Circle lookup via .single()
      const circleChain = makeChain(null);
      (circleChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: CIRCLE_ID, created_by: CREATOR_ID },
        error: null,
      });
      const dbError = { message: 'posts query failed' };
      const failChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(circleChain) // circle lookup (creator matches)
        .mockReturnValueOnce(failChain); // posts query fails

      await expect(service.getCirclePosts(CIRCLE_ID, CREATOR_ID)).rejects.toThrow(DatabaseError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get circle posts',
        expect.objectContaining({ error: dbError, circleId: CIRCLE_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // createPost
  // -------------------------------------------------------------------------
  describe('createPost', () => {
    /**
     * Helper: build a circle chain that resolves CREATOR_ID as the circle creator.
     * Since authorId === created_by, the membership check is skipped.
     */
    function makeCreatorCircleChain() {
      const chain = makeChain(null);
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { created_by: CREATOR_ID },
        error: null,
      });
      return chain;
    }

    it('creates a post and returns its id', async () => {
      buildService();

      // #723: circle lookup first, then insert (CREATOR_ID is author = creator, skip membership)
      const circleChain = makeCreatorCircleChain();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'post-123' },
        error: null,
      });
      // Fire-and-forget fan-out gets empty members
      mockDb.from
        .mockReturnValueOnce(circleChain) // #723 circle lookup
        .mockReturnValueOnce(insertChain) // insert post
        .mockReturnValue(makeChain({ data: [], error: null })); // fan-out member pages

      const result = await service.createPost(CIRCLE_ID, CREATOR_ID, 'Hello circle!');

      expect(result).toEqual({ id: 'post-123' });
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          circle_id: CIRCLE_ID,
          author_id: CREATOR_ID,
          content: 'Hello circle!',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circle post created',
        expect.objectContaining({ postId: 'post-123', circleId: CIRCLE_ID })
      );
    });

    it('trims whitespace from post content before saving', async () => {
      buildService();

      const circleChain = makeCreatorCircleChain();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'trimmed-post' },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(circleChain) // #723 circle lookup
        .mockReturnValueOnce(insertChain) // insert post
        .mockReturnValue(makeChain({ data: [], error: null })); // fan-out

      await service.createPost(CIRCLE_ID, CREATOR_ID, '  trimmed content  ');

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'trimmed content' })
      );
    });

    // #350: content empty/whitespace/length validation moved to Zod at route layer

    it('accepts content of exactly 5000 characters (boundary)', async () => {
      buildService();

      const content5000 = 'b'.repeat(5000);
      const circleChain = makeCreatorCircleChain();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'boundary-post' },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(circleChain) // #723 circle lookup
        .mockReturnValueOnce(insertChain) // insert post
        .mockReturnValue(makeChain({ data: [], error: null })); // fan-out

      const result = await service.createPost(CIRCLE_ID, CREATOR_ID, content5000);
      expect(result).toEqual({ id: 'boundary-post' });
    });

    it('throws DatabaseError and logs when the DB insert fails', async () => {
      buildService();

      const circleChain = makeCreatorCircleChain();
      const dbError = { message: 'insert failed' };
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: dbError,
      });
      mockDb.from
        .mockReturnValueOnce(circleChain) // #723 circle lookup
        .mockReturnValueOnce(insertChain); // insert fails

      await expect(service.createPost(CIRCLE_ID, CREATOR_ID, 'content')).rejects.toThrow(
        DatabaseError
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create circle post',
        expect.objectContaining({ error: dbError, circleId: CIRCLE_ID, authorId: CREATOR_ID })
      );
    });
  });
});
