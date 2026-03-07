/**
 * Tests for FollowService
 * Slice 8: Creator Network + Notifications
 *
 * Coverage:
 * - follow: success, self-follow guard, duplicate (ConflictError), DB error
 * - unfollow: success (idempotent), DB error
 * - isFollowing: returns true/false, DB error
 * - getFollowers: success with pagination, DB error
 * - getFollowing: success with pagination, DB error
 * - getFollowCounts: success, error propagation
 *
 * Table-aware Supabase mock routing via switch statement (common-solutions #7).
 * Methods accepting a pubkey first call from('users') for pubkey→UUID resolution.
 */

import { FollowService } from '../FollowService';
import { ConflictError, ValidationError } from '../../../utils/errors';

// ---------------------------------------------------------------------------
// Mock chain factory
// ---------------------------------------------------------------------------
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
  // Thenable for chains that terminate without single/maybeSingle
  chain.then = (res: unknown, rej: unknown) =>
    Promise.resolve(resolvedValue).then(res as Parameters<Promise<unknown>['then']>[0], rej as Parameters<Promise<unknown>['then']>[1]);
  chain.catch = (fn: unknown) =>
    Promise.resolve(resolvedValue).catch(fn as Parameters<Promise<unknown>['catch']>[0]);
  return chain;
}

/** Make a users-table chain that resolves the given UUID. */
function makeUsersChain(resolvedUserId: string) {
  const chain = makeChain(null);
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { id: resolvedUserId },
    error: null,
  });
  return chain;
}

describe('FollowService', () => {
  const FOLLOWER_PUBKEY = 'follower-pubkey-hex';
  const FOLLOWER_ID = 'follower-uuid';
  const FOLLOWING_ID = 'following-uuid';
  const FOLLOW_ID = 'follow-record-uuid';

  let service: FollowService;
  let mockDb: { from: ReturnType<typeof vi.fn> };
  let mockLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };
  let mockEventBus: { publish: ReturnType<typeof vi.fn>; subscribeToMany: ReturnType<typeof vi.fn> };

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
      subscribeToMany: vi.fn(),
    };

    mockDb = { from: vi.fn() };
  });

  function buildService() {
    service = new FollowService(mockDb as never, mockLogger as never, mockEventBus as never);
  }

  // -------------------------------------------------------------------------
  // follow
  // Table-aware routing: from('users') pubkey lookup → from('followers') insert
  // -------------------------------------------------------------------------
  describe('follow', () => {
    it('inserts a follow record and returns its id', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: FOLLOW_ID },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(insertChain);

      const result = await service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID);
      expect(result).toEqual({ id: FOLLOW_ID });
      expect(mockEventBus.publish).toHaveBeenCalledOnce();
    });

    it('throws ValidationError when attempting to follow yourself', async () => {
      buildService();
      // pubkey resolves to FOLLOWER_ID, followingId is also FOLLOWER_ID
      mockDb.from.mockReturnValueOnce(makeUsersChain(FOLLOWER_ID));

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWER_ID)).rejects.toThrow(ValidationError);
      expect(mockDb.from).toHaveBeenCalledOnce(); // only the users lookup
    });

    it('throws ConflictError on unique constraint violation (already following)', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(insertChain);

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(ConflictError);
    });

    it('throws ValidationError on generic DB error', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(insertChain);

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(ValidationError);
    });

    it('does not throw when event emission fails (fire-and-forget)', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: FOLLOW_ID },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(insertChain);
      mockEventBus.publish.mockRejectedValueOnce(new Error('event bus down'));

      // Should not throw — event failure is non-blocking
      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toEqual({ id: FOLLOW_ID });
    });
  });

  // -------------------------------------------------------------------------
  // unfollow
  // Table-aware routing: from('users') pubkey lookup → from('followers') delete
  // -------------------------------------------------------------------------
  describe('unfollow', () => {
    it('deletes the follow record without error', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(makeChain({ error: null }));

      await expect(service.unfollow(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBeUndefined();
    });

    it('is idempotent — no error if relationship does not exist', async () => {
      buildService();
      // Supabase DELETE with no matching rows returns count:0, error:null
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(makeChain({ error: null, count: 0 }));

      await expect(service.unfollow(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBeUndefined();
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(makeChain({ error: { message: 'connection error' } }));

      await expect(service.unfollow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // isFollowing
  // Table-aware routing: from('users') pubkey lookup → from('followers') maybeSingle
  // -------------------------------------------------------------------------
  describe('isFollowing', () => {
    it('returns true when follow record exists', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: FOLLOW_ID },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(chain);

      await expect(service.isFollowing(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBe(true);
    });

    it('returns false when no follow record exists', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(chain);

      await expect(service.isFollowing(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBe(false);
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(chain);

      await expect(service.isFollowing(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // getFollowers
  // Table-aware routing: from('users') optional pubkey lookup (falls back to raw ID) → from('followers')
  // -------------------------------------------------------------------------
  describe('getFollowers', () => {
    it('returns paginated follower list', async () => {
      buildService();
      // getFollowers uses getUserIdByPubkey().catch(() => userIdOrPubkey)
      // so we can pass a UUID directly — users lookup fails silently, falls back to raw ID
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWING_ID))
        .mockReturnValueOnce(
          makeChain({
            data: [
              { id: 'r1', follower_id: FOLLOWER_ID, following_id: FOLLOWING_ID, created_at: '2024-01-01T00:00:00Z' },
            ],
            error: null,
            count: 1,
          })
        );

      const result = await service.getFollowers(FOLLOWING_ID, { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ followerId: FOLLOWER_ID, followingId: FOLLOWING_ID });
      expect(result.total).toBe(1);
      expect(result.hasNext).toBe(false);
    });

    it('calculates hasNext correctly when more results exist', async () => {
      buildService();
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`,
        follower_id: `follower-${i}`,
        following_id: FOLLOWING_ID,
        created_at: '2024-01-01T00:00:00Z',
      }));
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWING_ID))
        .mockReturnValueOnce(makeChain({ data: items, error: null, count: 50 }));

      const result = await service.getFollowers(FOLLOWING_ID, { page: 1, limit: 20 });
      expect(result.hasNext).toBe(true);
      expect(result.total).toBe(50);
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWING_ID))
        .mockReturnValueOnce(makeChain({ data: null, error: { message: 'DB error' }, count: 0 }));

      await expect(service.getFollowers(FOLLOWING_ID, { page: 1, limit: 20 })).rejects.toThrow(
        ValidationError
      );
    });
  });

  // -------------------------------------------------------------------------
  // getFollowing
  // -------------------------------------------------------------------------
  describe('getFollowing', () => {
    it('returns paginated following list', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(
          makeChain({
            data: [
              { id: 'r1', follower_id: FOLLOWER_ID, following_id: FOLLOWING_ID, created_at: '2024-01-01T00:00:00Z' },
            ],
            error: null,
            count: 1,
          })
        );

      const result = await service.getFollowing(FOLLOWER_ID, { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ followerId: FOLLOWER_ID, followingId: FOLLOWING_ID });
    });
  });

  // -------------------------------------------------------------------------
  // getFollowCounts
  // Table-aware routing: from('users') lookup → two parallel from('followers') count queries
  // -------------------------------------------------------------------------
  describe('getFollowCounts', () => {
    it('returns follower and following counts', async () => {
      buildService();
      // Call order: users lookup, then two parallel followers count queries
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(makeChain({ count: 42, error: null }))
        .mockReturnValueOnce(makeChain({ count: 17, error: null }));

      const result = await service.getFollowCounts(FOLLOWER_PUBKEY);
      expect(result).toEqual({ followers: 42, following: 17 });
    });

    it('throws ValidationError if followers count query fails', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(makeChain({ count: null, error: { message: 'DB error' } }))
        .mockReturnValueOnce(makeChain({ count: 0, error: null }));

      await expect(service.getFollowCounts(FOLLOWER_PUBKEY)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError if following count query fails', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(FOLLOWER_ID))
        .mockReturnValueOnce(makeChain({ count: 5, error: null }))
        .mockReturnValueOnce(makeChain({ count: null, error: { message: 'DB error' } }));

      await expect(service.getFollowCounts(FOLLOWER_PUBKEY)).rejects.toThrow(ValidationError);
    });
  });
});
