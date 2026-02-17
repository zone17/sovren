/**
 * Unified Inbox Routes (v2)
 * /api/v2/inbox/*
 * EPIC-009: Multi-platform inbox aggregation
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { DistributionValidators } from '../../validators/distribution';
import type { IUnifiedInboxService } from '../../interfaces/distribution/IUnifiedInboxService';

const router = Router();

router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 30 });

// Lazy service resolution
let _inboxService: IUnifiedInboxService | null = null;

function getInboxService(): IUnifiedInboxService {
  if (!_inboxService) _inboxService = container.resolve(TYPES.UnifiedInboxService);
  return _inboxService;
}

// ============================================================================
// GET /messages — Aggregated inbox
// ============================================================================

router.get(
  '/messages',
  authenticate,
  requireCreator,
  validate({ query: DistributionValidators.inboxQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = {
        platform: (req.query.platform as string) || 'all',
        status: (req.query.status as string) || 'unread',
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await getInboxService().getMessages(req.user!.nostr_pubkey, query as any);
      res.json({ success: true, data: result.messages, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// POST /reply/:messageId — Reply routed to correct platform
// ============================================================================

router.post(
  '/reply/:messageId',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({
    params: DistributionValidators.messageIdParam,
    body: DistributionValidators.replyBody,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await getInboxService().reply(
        req.user!.nostr_pubkey,
        req.params.messageId,
        req.body.content
      );
      res.status(201).json({ success: true, data: { sent: true } });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// PUT /batch — Batch actions (mark read, archive)
// ============================================================================

router.put(
  '/batch',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: DistributionValidators.batchBody }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await getInboxService().batchAction(
        req.user!.nostr_pubkey,
        req.body.message_ids,
        req.body.action
      );
      res.json({ success: true, data: { updated } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
