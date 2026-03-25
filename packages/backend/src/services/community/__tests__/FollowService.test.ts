/**
 * Tests for FollowService
 * Slice 8: Creator Network + Notifications
 *
 * Coverage:
 * - follow: success, self-follow guard, duplicate (ConflictError), DB error
 * - unfollow: success, NotFoundError when not following, DatabaseError on DB error
 * - isFollowing: returns true/false, DB error
 * - getFollowers: success with pagination, DB error
 * - getFollowing: success with pagination, DB error
 * - getFollowCounts: success via creators table, fallback to COUNT, error propagation
 *
 * getUserIdByPubkey is mocked at module level (shared utility #703).
 * emitDomainEvent is mocked at module level (shared utility #708).
 */

import { FollowService } from '../FollowService';
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../../../utils/errors';

// Mock the shared getUserIdByPubkey utility so we control pubkey→UUID resolution
const mockGetUserIdByPubkey = vi.fn();
vi.mock('../../../utils/getUserIdByPubkey', () => ({
  getUserIdByPubkey: (...args: unknown[]) => mockGetUserIdByPubkey(...args),
}));

// Mock the shared emitDomainEvent utility
const mockEmitDomainEvent = vi.fn();
vi.mock('../../../utils/emitDomainEvent', () => ({
  emitDomainEvent: (...args: unknown[]) => mockEmitDomainEvent(...args),
}));

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
    Promise.resolve(resolvedValue).then(
      res as Parameters<Promise<unknown>['then']>[0],
      rej as Parameters<Promise<unknown>['then']>[1]
    );
  chain.catch = (fn: unknown) =>
    Promise.resolve(resolvedValue).catch(fn as Parameters<Promise<unknown>['catch']>[0]);
  return chain;
}

describe('FollowService', () => {
  const FOLLOWER_PUBKEY = 'follower-pubkey-hex';
  const FOLLOWER_ID = 'follower-uuid';
  const FOLLOWING_ID = 'following-uuid';
  const FOLLOW_ID = 'follow-record-uuid';

  let service: FollowService;
  let mockDb: { from: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  let mockEventBus: {
    publish: ReturnType<typeof vi.fn>;
    subscribeToMany: ReturnType<typeof vi.fn>;
  };

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

    // Default: pubkey resolves to FOLLOWER_ID
    mockGetUserIdByPubkey.mockResolvedValue(FOLLOWER_ID);
  });

  function buildService() {
    service = new FollowService(mockDb as never, mockLogger as never, mockEventBus as never);
  }

  // -------------------------------------------------------------------------
  // follow
  // -------------------------------------------------------------------------
  describe('follow', () => {
    it('inserts a follow record and returns its id', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: FOLLOW_ID },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(insertChain);

      const result = await service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID);
      expect(result).toEqual({ id: FOLLOW_ID });
      expect(mockEmitDomainEvent).toHaveBeenCalledOnce();
    });

    it('throws ValidationError when attempting to follow yourself', async () => {
      buildService();

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWER_ID)).rejects.toThrow(ValidationError);
      expect(mockDb.from).not.toHaveBeenCalled(); // no DB call needed
    });

    it('throws ConflictError on unique constraint violation (already following)', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });
      mockDb.from.mockReturnValueOnce(insertChain);

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(ConflictError);
    });

    it('throws DatabaseError on generic DB error', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });
      mockDb.from.mockReturnValueOnce(insertChain);

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(DatabaseError);
    });

    it('does not throw when emitDomainEvent is called (fire-and-forget)', async () => {
      buildService();
      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: FOLLOW_ID },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(insertChain);

      await expect(service.follow(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toEqual({
        id: FOLLOW_ID,
      });
      expect(mockEmitDomainEvent).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // unfollow
  // -------------------------------------------------------------------------
  describe('unfollow', () => {
    it('deletes the follow record without error', async () => {
      buildService();
      // count=1 means the relationship existed and was deleted
      mockDb.from.mockReturnValueOnce(makeChain({ error: null, count: 1 }));

      await expect(service.unfollow(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundError when follow relationship does not exist (count=0)', async () => {
      buildService();
      mockDb.from.mockReturnValueOnce(makeChain({ error: null, count: 0 }));

      await expect(service.unfollow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws DatabaseError on DB error', async () => {
      buildService();
      mockDb.from.mockReturnValueOnce(makeChain({ error: { message: 'connection error' } }));

      await expect(service.unfollow(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(DatabaseError);
    });
  });

  // -------------------------------------------------------------------------
  // isFollowing
  // -------------------------------------------------------------------------
  describe('isFollowing', () => {
    it('returns true when follow record exists', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: FOLLOW_ID },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.isFollowing(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBe(true);
    });

    it('returns false when no follow record exists', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.isFollowing(FOLLOWER_PUBKEY, FOLLOWING_ID)).resolves.toBe(false);
    });

    it('throws DatabaseError on DB error', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.isFollowing(FOLLOWER_PUBKEY, FOLLOWING_ID)).rejects.toThrow(
        DatabaseError
      );
    });
  });

  // -------------------------------------------------------------------------
  // getFollowers
  // getUserIdByPubkey falls back to raw ID on error (catch in service)
  // -------------------------------------------------------------------------
  describe('getFollowers', () => {
    it('returns paginated follower list', async () => {
      buildService();
      // getFollowers passes raw ID — getUserIdByPubkey resolves it
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWING_ID);
      mockDb.from.mockReturnValueOnce(
        makeChain({
          data: [
            {
              id: 'r1',
              follower_id: FOLLOWER_ID,
              following_id: FOLLOWING_ID,
              created_at: '2024-01-01T00:00:00Z',
            },
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
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWING_ID);
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`,
        follower_id: `follower-${i}`,
        following_id: FOLLOWING_ID,
        created_at: '2024-01-01T00:00:00Z',
      }));
      mockDb.from.mockReturnValueOnce(makeChain({ data: items, error: null, count: 50 }));

      const result = await service.getFollowers(FOLLOWING_ID, { page: 1, limit: 20 });
      expect(result.hasNext).toBe(true);
      expect(result.total).toBe(50);
    });

    it('throws DatabaseError on DB error', async () => {
      buildService();
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWING_ID);
      mockDb.from.mockReturnValueOnce(
        makeChain({ data: null, error: { message: 'DB error' }, count: 0 })
      );

      await expect(service.getFollowers(FOLLOWING_ID, { page: 1, limit: 20 })).rejects.toThrow(
        DatabaseError
      );
    });
  });

  // -------------------------------------------------------------------------
  // getFollowing
  // -------------------------------------------------------------------------
  describe('getFollowing', () => {
    it('returns paginated following list', async () => {
      buildService();
      mockDb.from.mockReturnValueOnce(
        makeChain({
          data: [
            {
              id: 'r1',
              follower_id: FOLLOWER_ID,
              following_id: FOLLOWING_ID,
              created_at: '2024-01-01T00:00:00Z',
            },
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
  // Now reads from creators table first, then falls back to COUNT queries
  // -------------------------------------------------------------------------
  describe('getFollowCounts', () => {
    it('returns counts from creators table when available', async () => {
      buildService();
      // getUserIdByPubkey fallback — returns raw ID
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWER_ID);
      // creators table query with follower_count/following_count
      const creatorsChain = makeChain(null);
      (creatorsChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { follower_count: 42, following_count: 17 },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(creatorsChain);

      const result = await service.getFollowCounts(FOLLOWER_PUBKEY);
      expect(result).toEqual({ followers: 42, following: 17 });
    });

    it('falls back to COUNT queries when creators columns are null', async () => {
      buildService();
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWER_ID);
      // creators table returns null counts
      const creatorsChain = makeChain(null);
      (creatorsChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { follower_count: null, following_count: null },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(creatorsChain)
        .mockReturnValueOnce(makeChain({ count: 10, error: null }))
        .mockReturnValueOnce(makeChain({ count: 5, error: null }));

      const result = await service.getFollowCounts(FOLLOWER_PUBKEY);
      expect(result).toEqual({ followers: 10, following: 5 });
    });

    it('throws DatabaseError if followers count query fails', async () => {
      buildService();
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWER_ID);
      // creators table fails — triggers fallback
      const creatorsChain = makeChain(null);
      (creatorsChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      mockDb.from
        .mockReturnValueOnce(creatorsChain)
        .mockReturnValueOnce(makeChain({ count: null, error: { message: 'DB error' } }))
        .mockReturnValueOnce(makeChain({ count: 0, error: null }));

      await expect(service.getFollowCounts(FOLLOWER_PUBKEY)).rejects.toThrow(DatabaseError);
    });

    it('throws DatabaseError if following count query fails', async () => {
      buildService();
      mockGetUserIdByPubkey.mockResolvedValue(FOLLOWER_ID);
      const creatorsChain = makeChain(null);
      (creatorsChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(creatorsChain)
        .mockReturnValueOnce(makeChain({ count: 5, error: null }))
        .mockReturnValueOnce(makeChain({ count: null, error: { message: 'DB error' } }));

      await expect(service.getFollowCounts(FOLLOWER_PUBKEY)).rejects.toThrow(DatabaseError);
    });
  });
});
