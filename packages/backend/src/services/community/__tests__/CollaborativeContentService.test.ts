/**
 * Tests for CollaborativeContentService
 * EPIC-010: Community Services — Co-authoring with revenue splits (basis points)
 *
 * Coverage targets:
 * - inviteCollaborator: self-invite guard, bps validation (0, fractional, >10000),
 *   content not found, ownership check, duplicate check, DB trigger error for sum >10000,
 *   DB error, success
 * - respondToInvitation: authorization, wrong status, accept/decline paths,
 *   accepted_at timestamp, DB error
 * - updateRevenueSplit: ownership, sum != 10000, invalid individual bps, DB error, success
 * - getCollaborators: success, empty, DB error
 * - allocateRevenue: invalid totalSats, DB error, empty collaborators,
 *   splits not summing to 10000, largest-remainder algorithm correctness
 */

import { CollaborativeContentService } from '../CollaborativeContentService';

// ---------------------------------------------------------------------------
// Supabase mock-chain factory
//
// Builds a fluent mock where every chainable method returns `this`, and
// terminal methods (single / maybeSingle) resolve with the supplied value.
// The chain also implements `.then` so that awaiting the chain directly
// (without calling single/maybeSingle) resolves correctly.
// ---------------------------------------------------------------------------
function makeChain(leafResolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(leafResolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(leafResolvedValue),
  };
  // Allow `await chain` (used by update chains that resolve directly)
  chain.then = (res: any, rej: any) => Promise.resolve(leafResolvedValue).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(leafResolvedValue).catch(fn);
  return chain;
}

describe('CollaborativeContentService', () => {
  let service: CollaborativeContentService;
  let mockDb: any;
  let mockLogger: any;

  const CONTENT_ID = 'content-uuid-abc';
  const OWNER_ID = 'owner-creator';
  const COLLABORATOR_ID = 'collab-creator';
  const COLLAB_ROW_ID = 'collab-row-uuid';

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDb = { from: jest.fn() };
    service = new CollaborativeContentService(mockDb, mockLogger);
  });

  // -------------------------------------------------------------------------
  // inviteCollaborator
  // -------------------------------------------------------------------------
  describe('inviteCollaborator', () => {
    it('creates a collaboration invitation with valid data', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: { id: COLLAB_ROW_ID }, error: null });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain);

      const result = await service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 3000);

      expect(result).toEqual({ id: COLLAB_ROW_ID });
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content_id: CONTENT_ID,
          creator_id: COLLABORATOR_ID,
          revenue_split_bps: 3000,
          status: 'invited',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Collaborator invited',
        expect.objectContaining({
          collaborationId: COLLAB_ROW_ID,
          contentId: CONTENT_ID,
          collaboratorId: COLLABORATOR_ID,
          revenueSplitBps: 3000,
        })
      );
    });

    it('throws when owner attempts to invite themselves', async () => {
      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, OWNER_ID, 5000)
      ).rejects.toThrow('Cannot invite yourself as a collaborator');
    });

    it('throws when revenue_split_bps is zero', async () => {
      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 0)
      ).rejects.toThrow('revenue_split_bps must be an integer between 1 and 10000');
    });

    it('throws when revenue_split_bps is negative', async () => {
      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, -100)
      ).rejects.toThrow('revenue_split_bps must be an integer between 1 and 10000');
    });

    it('throws when revenue_split_bps exceeds 10000', async () => {
      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 10001)
      ).rejects.toThrow('revenue_split_bps must be an integer between 1 and 10000');
    });

    it('throws when revenue_split_bps is a float (non-integer)', async () => {
      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 33.33)
      ).rejects.toThrow('revenue_split_bps must be an integer between 1 and 10000');
    });

    it('accepts boundary value 1 for revenue_split_bps', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: { id: 'collab-1bps' }, error: null });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain);

      const result = await service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 1);
      expect(result.id).toBe('collab-1bps');
    });

    it('accepts boundary value 10000 for revenue_split_bps', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: { id: 'collab-10000bps' }, error: null });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain);

      const result = await service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 10000);
      expect(result.id).toBe('collab-10000bps');
    });

    it('throws when content is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 5000)
      ).rejects.toThrow('Content not found');
    });

    it('throws when single() returns null data (row missing)', async () => {
      const missingChain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValueOnce(missingChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 5000)
      ).rejects.toThrow('Content not found');
    });

    it('throws when requester is not the content owner', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: 'someone-else' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(contentChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 5000)
      ).rejects.toThrow('Only the content owner can invite collaborators');
    });

    it('throws when a collaboration already exists with status "invited"', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({ data: { id: 'existing', status: 'invited' }, error: null });

      mockDb.from.mockReturnValueOnce(contentChain).mockReturnValueOnce(existingChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 5000)
      ).rejects.toThrow('Collaboration already exists with status: invited');
    });

    it('throws when a collaboration already exists with status "accepted"', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({
        data: { id: 'existing', status: 'accepted' },
        error: null,
      });

      mockDb.from.mockReturnValueOnce(contentChain).mockReturnValueOnce(existingChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 5000)
      ).rejects.toThrow('Collaboration already exists with status: accepted');
    });

    it('re-throws DB trigger error when revenue splits would exceed 10000 bps total', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({ data: null, error: null });
      const triggerError = {
        message: 'Revenue splits cannot exceed 10000 bps for a single content item',
      };
      const insertChain = makeChain({ data: null, error: triggerError });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 9999)
      ).rejects.toThrow('Cannot add collaborator: total revenue splits would exceed 100%');
    });

    it('throws and logs on a generic DB insert error', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const existingChain = makeChain({ data: null, error: null });
      const dbError = { message: 'insert failed' };
      const insertChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain);

      await expect(
        service.inviteCollaborator(CONTENT_ID, OWNER_ID, COLLABORATOR_ID, 5000)
      ).rejects.toThrow('Failed to invite collaborator: insert failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to invite collaborator',
        expect.objectContaining({ error: dbError, contentId: CONTENT_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // respondToInvitation
  // -------------------------------------------------------------------------
  describe('respondToInvitation', () => {
    it('allows the invited collaborator to accept', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(
        service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true)
      ).resolves.toBeUndefined();

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'accepted' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Collaboration invitation responded',
        expect.objectContaining({
          collaborationId: COLLAB_ROW_ID,
          accept: true,
          newStatus: 'accepted',
        })
      );
    });

    it('sets accepted_at timestamp when accepting', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true);

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ accepted_at: expect.any(String) })
      );
    });

    it('allows the invited collaborator to decline', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(
        service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, false)
      ).resolves.toBeUndefined();

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'declined' })
      );
    });

    it('does NOT set accepted_at when declining', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, false);

      const updateArg = updateChain.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('accepted_at');
    });

    it('uses atomic status guard on the update (eq status=invited)', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true);

      expect(updateChain.eq).toHaveBeenCalledWith('status', 'invited');
    });

    it('throws when collaboration is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(
        service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true)
      ).rejects.toThrow('Collaboration not found');
    });

    it('throws when requester is not the invited collaborator', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.respondToInvitation(COLLAB_ROW_ID, 'interloper', true)).rejects.toThrow(
        'Only the invited collaborator can respond'
      );
    });

    it('throws when collaboration status is not "invited"', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'accepted' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(
        service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true)
      ).rejects.toThrow("Cannot respond to collaboration in 'accepted' status");
    });

    it('throws when collaboration status is "declined"', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'declined' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(
        service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true)
      ).rejects.toThrow("Cannot respond to collaboration in 'declined' status");
    });

    it('throws and logs when the DB update fails', async () => {
      const findChain = makeChain({
        data: { id: COLLAB_ROW_ID, creator_id: COLLABORATOR_ID, status: 'invited' },
        error: null,
      });
      const dbError = { message: 'update failed' };
      const updateChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(
        service.respondToInvitation(COLLAB_ROW_ID, COLLABORATOR_ID, true)
      ).rejects.toThrow('Failed to respond to invitation: update failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to respond to invitation',
        expect.objectContaining({ error: dbError, collaborationId: COLLAB_ROW_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateRevenueSplit
  // -------------------------------------------------------------------------
  describe('updateRevenueSplit', () => {
    it('updates splits successfully when sum equals exactly 10000 bps', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      // L-3: beforeState query for audit log
      const beforeStateChain = makeChain({ data: [], error: null });
      const update1 = makeChain({ data: null, error: null });
      const update2 = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(beforeStateChain)
        .mockReturnValueOnce(update1)
        .mockReturnValueOnce(update2);

      const splits = [
        { creatorId: 'creator-a', bps: 6000 },
        { creatorId: 'creator-b', bps: 4000 },
      ];

      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, splits)
      ).resolves.toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Revenue splits updated — audit trail',
        expect.objectContaining({ contentId: CONTENT_ID, audit: true })
      );
    });

    it('accepts a single-collaborator split with 10000 bps', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const beforeStateChain = makeChain({ data: [], error: null });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(beforeStateChain)
        .mockReturnValueOnce(updateChain);

      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, [{ creatorId: 'solo', bps: 10000 }])
      ).resolves.toBeUndefined();
    });

    it('throws when content is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, [{ creatorId: 'a', bps: 10000 }])
      ).rejects.toThrow('Content not found');
    });

    it('throws when requester is not the content owner', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: 'actual-owner' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(contentChain);

      await expect(
        service.updateRevenueSplit(CONTENT_ID, 'not-the-owner', [{ creatorId: 'a', bps: 10000 }])
      ).rejects.toThrow('Only the content owner can update revenue splits');
    });

    it('throws when splits sum to less than 10000 bps', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(contentChain);

      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, [
          { creatorId: 'a', bps: 3000 },
          { creatorId: 'b', bps: 3000 },
        ])
      ).rejects.toThrow(
        'Revenue splits must sum to exactly 10000 bps (100%). Current sum: 6000 bps'
      );
    });

    it('throws when splits sum to more than 10000 bps', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(contentChain);

      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, [
          { creatorId: 'a', bps: 6000 },
          { creatorId: 'b', bps: 5000 },
        ])
      ).rejects.toThrow('Revenue splits must sum to exactly 10000 bps');
    });

    it('throws when an individual bps value is zero', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(contentChain);

      // Sum is 10000 but one split is zero (invalid individually)
      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, [
          { creatorId: 'a', bps: 0 },
          { creatorId: 'b', bps: 10000 },
        ])
      ).rejects.toThrow('Invalid bps value 0');
    });

    it('throws and logs when a DB update query fails', async () => {
      const contentChain = makeChain({
        data: { id: CONTENT_ID, creator_id: OWNER_ID },
        error: null,
      });
      const beforeStateChain = makeChain({ data: [], error: null });
      const dbError = { message: 'update failed' };
      const updateChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(contentChain)
        .mockReturnValueOnce(beforeStateChain)
        .mockReturnValueOnce(updateChain);

      await expect(
        service.updateRevenueSplit(CONTENT_ID, OWNER_ID, [{ creatorId: 'a', bps: 10000 }])
      ).rejects.toThrow('Failed to update split for creator a: update failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update revenue split',
        expect.objectContaining({ error: dbError, contentId: CONTENT_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCollaborators
  // -------------------------------------------------------------------------
  describe('getCollaborators', () => {
    it('returns collaborators excluding "removed" status', async () => {
      const collaborators = [
        { id: 'c1', creator_id: 'a', status: 'accepted', revenue_split_bps: 5000 },
        { id: 'c2', creator_id: 'b', status: 'invited', revenue_split_bps: 5000 },
      ];
      const chain = makeChain({ data: collaborators, error: null });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getCollaborators(CONTENT_ID, OWNER_ID);

      expect(result).toEqual(collaborators);
      expect(chain.not).toHaveBeenCalledWith('status', 'in', '("removed")');
    });

    it('returns empty array when no collaborators exist', async () => {
      const chain = makeChain({ data: null, error: null });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getCollaborators(CONTENT_ID, OWNER_ID);
      expect(result).toEqual([]);
    });

    it('orders results by invited_at ascending', async () => {
      const chain = makeChain({ data: [], error: null });
      mockDb.from.mockReturnValueOnce(chain);

      await service.getCollaborators(CONTENT_ID, OWNER_ID);

      expect(chain.order).toHaveBeenCalledWith('invited_at', { ascending: true });
    });

    it('throws and logs when the DB query fails', async () => {
      const dbError = { message: 'query failed' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.getCollaborators(CONTENT_ID, OWNER_ID)).rejects.toThrow(
        'Failed to get collaborators: query failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get collaborators',
        expect.objectContaining({ error: dbError, contentId: CONTENT_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // allocateRevenue — largest-remainder algorithm
  // -------------------------------------------------------------------------
  describe('allocateRevenue', () => {
    describe('input validation', () => {
      it('throws when totalSats is zero', async () => {
        await expect(service.allocateRevenue(CONTENT_ID, 0)).rejects.toThrow(
          'totalSats must be a positive integer'
        );
      });

      it('throws when totalSats is negative', async () => {
        await expect(service.allocateRevenue(CONTENT_ID, -100)).rejects.toThrow(
          'totalSats must be a positive integer'
        );
      });

      it('throws when totalSats is a float', async () => {
        await expect(service.allocateRevenue(CONTENT_ID, 100.5)).rejects.toThrow(
          'totalSats must be a positive integer'
        );
      });
    });

    describe('DB error handling', () => {
      it('throws and logs when the collaborator query fails', async () => {
        const dbError = { message: 'db failed' };
        const chain = makeChain({ data: null, error: dbError });
        mockDb.from.mockReturnValueOnce(chain);

        await expect(service.allocateRevenue(CONTENT_ID, 1000)).rejects.toThrow(
          'Failed to get collaborators: db failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get collaborators for revenue allocation',
          expect.objectContaining({ error: dbError, contentId: CONTENT_ID })
        );
      });
    });

    describe('edge cases', () => {
      it('returns empty array when there are no accepted collaborators', async () => {
        const chain = makeChain({ data: [], error: null });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 1000);
        expect(result).toEqual([]);
      });

      it('returns empty array when collaborators data is null', async () => {
        const chain = makeChain({ data: null, error: null });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 1000);
        expect(result).toEqual([]);
      });

      it('throws when accepted collaborator splits do not sum to 10000 bps', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'a', revenue_split_bps: 5000 },
            { creator_id: 'b', revenue_split_bps: 3000 }, // sum=8000
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        await expect(service.allocateRevenue(CONTENT_ID, 1000)).rejects.toThrow(
          'Revenue splits do not sum to 10000 bps'
        );
      });
    });

    describe('allocation correctness', () => {
      it('allocates exact amounts when splits divide evenly', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'a', revenue_split_bps: 5000 },
            { creator_id: 'b', revenue_split_bps: 5000 },
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 1000);

        expect(result).toEqual([
          { creatorId: 'a', amountSats: 500 },
          { creatorId: 'b', amountSats: 500 },
        ]);
        const total = result.reduce((s, r) => s + r.amountSats, 0);
        expect(total).toBe(1000);
      });

      it('handles single collaborator with 100% split correctly', async () => {
        const chain = makeChain({
          data: [{ creator_id: 'solo', revenue_split_bps: 10000 }],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 7500);

        expect(result).toEqual([{ creatorId: 'solo', amountSats: 7500 }]);
      });

      it('largest-remainder: 3334/3333/3333 bps on 10000 sats yields 3334, 3333, 3333', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'creator-A', revenue_split_bps: 3334 },
            { creator_id: 'creator-B', revenue_split_bps: 3333 },
            { creator_id: 'creator-C', revenue_split_bps: 3333 },
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 10000);

        expect(result).toHaveLength(3);
        const total = result.reduce((s, r) => s + r.amountSats, 0);
        expect(total).toBe(10000); // No sat lost to rounding

        const a = result.find((r) => r.creatorId === 'creator-A');
        const b = result.find((r) => r.creatorId === 'creator-B');
        const c = result.find((r) => r.creatorId === 'creator-C');

        expect(a?.amountSats).toBe(3334);
        expect(b?.amountSats).toBe(3333);
        expect(c?.amountSats).toBe(3333);
      });

      it('largest-remainder: 3333/3333/3334 bps on 100 sats yields amounts [33, 33, 34]', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'A', revenue_split_bps: 3333 },
            { creator_id: 'B', revenue_split_bps: 3333 },
            { creator_id: 'C', revenue_split_bps: 3334 },
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 100);

        const total = result.reduce((s, r) => s + r.amountSats, 0);
        expect(total).toBe(100);

        const sorted = result.map((r) => r.amountSats).sort((a, b) => a - b);
        expect(sorted).toEqual([33, 33, 34]);
      });

      it('largest-remainder: distributes 1 sat to the collaborator with highest fractional remainder', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'a', revenue_split_bps: 4000 },
            { creator_id: 'b', revenue_split_bps: 3000 },
            { creator_id: 'c', revenue_split_bps: 3000 },
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 1);

        const total = result.reduce((s, r) => s + r.amountSats, 0);
        expect(total).toBe(1);

        // Only one creator should receive the single sat
        const nonZero = result.filter((r) => r.amountSats > 0);
        expect(nonZero).toHaveLength(1);
      });

      it('all allocations are whole integers (no fractional sats)', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'a', revenue_split_bps: 3334 },
            { creator_id: 'b', revenue_split_bps: 3333 },
            { creator_id: 'c', revenue_split_bps: 3333 },
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        const result = await service.allocateRevenue(CONTENT_ID, 7);

        result.forEach((r) => {
          expect(Number.isInteger(r.amountSats)).toBe(true);
        });
      });

      it('logs the allocation summary on success', async () => {
        const chain = makeChain({
          data: [
            { creator_id: 'a', revenue_split_bps: 7000 },
            { creator_id: 'b', revenue_split_bps: 3000 },
          ],
          error: null,
        });
        mockDb.from.mockReturnValueOnce(chain);

        await service.allocateRevenue(CONTENT_ID, 100);

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Revenue allocated',
          expect.objectContaining({ contentId: CONTENT_ID, totalSats: 100 })
        );
      });
    });
  });
});
