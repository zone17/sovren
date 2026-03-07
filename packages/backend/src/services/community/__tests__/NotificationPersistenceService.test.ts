/**
 * Tests for NotificationPersistenceService
 * Slice 8: Creator Network + Notifications
 *
 * Coverage:
 * - create: success, DB error
 * - createBatch: success, empty payload no-op, DB error
 * - list: success with pagination, unreadOnly filter, DB error
 * - getUnreadCount: success, DB error
 * - markRead: success, ownership check (AuthorizationError), not found
 * - markAllRead: timestamp cutoff correctness, DB error
 * - delete: success, ownership check (AuthorizationError), not found
 *
 * Table-aware Supabase mock routing (common-solutions #7).
 * Methods accepting pubkey resolve it to userId via from('users') first.
 */

import { NotificationPersistenceService } from '../NotificationPersistenceService';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../utils/errors';

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
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (res: unknown, rej: unknown) =>
    Promise.resolve(resolvedValue).then(
      res as Parameters<Promise<unknown>['then']>[0],
      rej as Parameters<Promise<unknown>['then']>[1]
    );
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

describe('NotificationPersistenceService', () => {
  const USER_PUBKEY = 'user-pubkey-hex';
  const USER_ID = 'user-uuid';
  const ACTOR_ID = 'actor-uuid';
  const NOTIF_ID = 'notif-uuid';

  const BASE_NOTIF = {
    id: NOTIF_ID,
    user_id: USER_ID,
    actor_id: ACTOR_ID,
    type: 'new_follower',
    title: 'You have a new follower',
    body: null,
    entity_type: 'follow',
    entity_id: null,
    data: {},
    read: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  let service: NotificationPersistenceService;
  let mockDb: { from: ReturnType<typeof vi.fn> };
  let mockLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };
  let mockEventBus: { subscribeToMany: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockEventBus = {
      subscribeToMany: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = { from: vi.fn() };
  });

  function buildService() {
    service = new NotificationPersistenceService(
      mockDb as never,
      mockLogger as never,
      mockEventBus as never
    );
  }

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('inserts a notification and returns the mapped result', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: BASE_NOTIF, error: null });
      mockDb.from.mockReturnValue(chain);

      const result = await service.create({
        userId: USER_ID,
        actorId: ACTOR_ID,
        type: 'new_follower',
        title: 'You have a new follower',
        entityType: 'follow',
      });

      expect(result.id).toBe(NOTIF_ID);
      expect(result.userId).toBe(USER_ID);
      expect(result.type).toBe('new_follower');
      expect(result.read).toBe(false);
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      const chain = makeChain(null);
      (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'constraint violation' },
      });
      mockDb.from.mockReturnValue(chain);

      await expect(
        service.create({ userId: USER_ID, actorId: ACTOR_ID, type: 'new_follower', title: 'Test' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // createBatch
  // -------------------------------------------------------------------------
  describe('createBatch', () => {
    it('is a no-op when called with empty array', async () => {
      buildService();
      await expect(service.createBatch([])).resolves.toBeUndefined();
      expect(mockDb.from).not.toHaveBeenCalled();
    });

    it('inserts multiple rows in one call', async () => {
      buildService();
      mockDb.from.mockReturnValue(makeChain({ error: null }));

      await expect(
        service.createBatch([
          { userId: 'u1', actorId: ACTOR_ID, type: 'circle_post', title: 'New post' },
          { userId: 'u2', actorId: ACTOR_ID, type: 'circle_post', title: 'New post' },
        ])
      ).resolves.toBeUndefined();

      expect(mockDb.from).toHaveBeenCalledOnce();
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      mockDb.from.mockReturnValue(makeChain({ error: { message: 'bulk insert failed' } }));

      await expect(
        service.createBatch([
          { userId: 'u1', actorId: ACTOR_ID, type: 'circle_post', title: 'New post' },
        ])
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // list
  // Table-aware routing: first call = from('users') pubkey lookup, second = from('notifications')
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns paginated notification list', async () => {
      buildService();
      // Table-aware routing: users lookup first, then notifications query
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ data: [BASE_NOTIF], error: null, count: 1 }));

      const result = await service.list(USER_PUBKEY, { page: 1, limit: 20 });
      expect(result.notifications).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('calculates hasNext=true when more pages exist', async () => {
      buildService();
      const items = Array.from({ length: 20 }, (_, i) => ({ ...BASE_NOTIF, id: `notif-${i}` }));
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ data: items, error: null, count: 50 }));

      const result = await service.list(USER_PUBKEY, { page: 1, limit: 20 });
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.total).toBe(50);
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ data: null, error: { message: 'error' }, count: 0 }));

      await expect(service.list(USER_PUBKEY, { page: 1, limit: 20 })).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // getUnreadCount
  // Table-aware routing: first call = from('users') pubkey lookup, second = from('notifications')
  // -------------------------------------------------------------------------
  describe('getUnreadCount', () => {
    it('returns the count from the DB', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ count: 7, error: null }));

      const count = await service.getUnreadCount(USER_PUBKEY);
      expect(count).toBe(7);
    });

    it('returns 0 when count is null', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ count: null, error: null }));

      const count = await service.getUnreadCount(USER_PUBKEY);
      expect(count).toBe(0);
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ count: null, error: { message: 'DB error' } }));

      await expect(service.getUnreadCount(USER_PUBKEY)).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // markRead
  // Table-aware routing: users lookup → ownership fetch → update
  // -------------------------------------------------------------------------
  describe('markRead', () => {
    it('marks a notification as read when caller is the owner', async () => {
      buildService();
      // Call order: from('users'), from('notifications') ownership fetch, from('notifications') update
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(
          (() => {
            const c = makeChain(null);
            (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({
              data: { id: NOTIF_ID, user_id: USER_ID },
              error: null,
            });
            return c;
          })()
        )
        .mockReturnValueOnce(makeChain({ error: null }));

      await expect(service.markRead(NOTIF_ID, USER_PUBKEY)).resolves.toBeUndefined();
    });

    it('throws NotFoundError when notification does not exist', async () => {
      buildService();
      const c = makeChain(null);
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'not found' } });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(c);

      await expect(service.markRead(NOTIF_ID, USER_PUBKEY)).rejects.toThrow(NotFoundError);
    });

    it('throws AuthorizationError when caller does not own the notification', async () => {
      buildService();
      const c = makeChain(null);
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: NOTIF_ID, user_id: 'other-user' },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(c);

      await expect(service.markRead(NOTIF_ID, USER_PUBKEY)).rejects.toThrow(AuthorizationError);
    });
  });

  // -------------------------------------------------------------------------
  // markAllRead
  // Table-aware routing: users lookup → update
  // -------------------------------------------------------------------------
  describe('markAllRead', () => {
    it('calls update with correct timestamp cutoff', async () => {
      buildService();
      const notifChain = makeChain({ error: null });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(notifChain);

      const cutoff = new Date('2024-06-01T12:00:00Z');
      await expect(service.markAllRead(USER_PUBKEY, cutoff)).resolves.toBeUndefined();

      // Verify lte was called with the ISO string of the cutoff
      expect(notifChain.lte).toHaveBeenCalledWith('created_at', cutoff.toISOString());
    });

    it('throws ValidationError on DB error', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(makeChain({ error: { message: 'DB error' } }));

      await expect(service.markAllRead(USER_PUBKEY, new Date())).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // Table-aware routing: users lookup → ownership fetch → delete
  // -------------------------------------------------------------------------
  describe('delete', () => {
    it('deletes a notification when caller is the owner', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(
          (() => {
            const c = makeChain(null);
            (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({
              data: { id: NOTIF_ID, user_id: USER_ID },
              error: null,
            });
            return c;
          })()
        )
        .mockReturnValueOnce(makeChain({ error: null }));

      await expect(service.delete(NOTIF_ID, USER_PUBKEY)).resolves.toBeUndefined();
    });

    it('throws NotFoundError when notification does not exist', async () => {
      buildService();
      const c = makeChain(null);
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'not found' } });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(c);

      await expect(service.delete(NOTIF_ID, USER_PUBKEY)).rejects.toThrow(NotFoundError);
    });

    it('throws AuthorizationError when caller does not own the notification', async () => {
      buildService();
      const c = makeChain(null);
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: NOTIF_ID, user_id: 'other-user' },
        error: null,
      });
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(c);

      await expect(service.delete(NOTIF_ID, USER_PUBKEY)).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError on DB error during delete', async () => {
      buildService();
      mockDb.from
        .mockReturnValueOnce(makeUsersChain(USER_ID))
        .mockReturnValueOnce(
          (() => {
            const c = makeChain(null);
            (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({
              data: { id: NOTIF_ID, user_id: USER_ID },
              error: null,
            });
            return c;
          })()
        )
        .mockReturnValueOnce(makeChain({ error: { message: 'delete failed' } }));

      await expect(service.delete(NOTIF_ID, USER_PUBKEY)).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // subscribeToEvents
  // -------------------------------------------------------------------------
  describe('subscribeToEvents', () => {
    it('calls eventBus.subscribeToMany with the 7 community event types', () => {
      buildService();
      service.subscribeToEvents();

      expect(mockEventBus.subscribeToMany).toHaveBeenCalledOnce();
      const [eventTypes] = (mockEventBus.subscribeToMany as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(eventTypes).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // follow notification entityId fix (Task 4)
  // -------------------------------------------------------------------------
  describe('handleCommunityEvent (via subscribeToEvents)', () => {
    it('creates follow notification with non-null entityId (aggregateId from event)', async () => {
      buildService();

      let capturedHandler: ((event: unknown) => Promise<void>) | undefined;
      (mockEventBus.subscribeToMany as ReturnType<typeof vi.fn>).mockImplementation(
        (_types: unknown, handler: (event: unknown) => Promise<void>) => {
          capturedHandler = handler;
          return 'sub-id';
        }
      );

      service.subscribeToEvents();

      // Simulate COMMUNITY_USER_FOLLOWED event with aggregateId = follow row UUID
      const followEvent = {
        id: 'evt-123',
        type: 'community.user.followed',
        aggregateId: 'follow-row-uuid',
        aggregateType: 'follow',
        payload: { followerId: 'follower-uuid', followingId: 'following-uuid' },
        metadata: { timestamp: new Date(), version: '1.0.0', source: 'FollowService' },
      };

      const insertChain = makeChain(null);
      (insertChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'notif-uuid',
          user_id: 'following-uuid',
          actor_id: 'follower-uuid',
          type: 'new_follower',
          title: 'You have a new follower',
          body: null,
          entity_type: 'follow',
          entity_id: 'follow-row-uuid',
          data: {},
          read: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockDb.from.mockReturnValue(insertChain);

      await capturedHandler!(followEvent);

      // Verify entity_id was set from aggregateId (not null)
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ entity_id: 'follow-row-uuid' })
      );
    });
  });
});
