/**
 * Unified Inbox Routes (v2)
 * /api/v2/inbox/*
 * EPIC-009 + EPIC-009B: Multi-platform inbox aggregation, templates
 */

import { Request, Response, NextFunction, Router } from 'express';
import { z } from 'zod';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { DistributionValidators } from '../../validators/distribution';
import type {
  IUnifiedInboxService,
  InboxQuery,
} from '../../interfaces/distribution/IUnifiedInboxService';
import type { INostrReplyAdapter } from '../../interfaces/distribution/INostrReplyAdapter';

const router = Router();

router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 30 });

// ============================================================================
// Lazy service resolution
// ============================================================================

let _inboxService: IUnifiedInboxService | null = null;
let _nostrReplyAdapter: INostrReplyAdapter | null = null;

function getInboxService(): IUnifiedInboxService {
  if (!_inboxService) _inboxService = container.resolve(TYPES.UnifiedInboxService);
  return _inboxService;
}

function getNostrReplyAdapter(): INostrReplyAdapter {
  if (!_nostrReplyAdapter) _nostrReplyAdapter = container.resolve(TYPES.NostrReplyAdapter);
  return _nostrReplyAdapter;
}

// ============================================================================
// Validation schemas — EPIC-009B additions
// ============================================================================

const CreateTemplateBodySchema = z.object({
  name: z.string().min(1).max(100),
  template_text: z.string().min(1).max(2000),
});

// ============================================================================
// GET /messages — Aggregated inbox
// ============================================================================

router.get(
  '/messages',
  authenticate,
  requireCreator,
  validate({ query: DistributionValidators.inboxQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const query: InboxQuery = {
      platform: ((req.query.platform as string) || 'all') as InboxQuery['platform'],
      status: ((req.query.status as string) || 'unread') as InboxQuery['status'],
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await getInboxService().getMessages(getAuthUser(req).nostr_pubkey, query);
    res.json(createApiResponse(req, { messages: result.messages, pagination: result.pagination }));
  })
);

// ============================================================================
// POST /reply/:messageId — Reply routed to correct platform
// EPIC-009B: NOSTR replies now use NostrReplyAdapter (fixes silent void bug)
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
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { messageId } = req.params;
    const { content } = req.body;

    // Determine platform before routing
    const { data: message } = await (container.resolve(TYPES.Database) as any)
      .from('inbox_messages')
      .select('platform, platform_message_id')
      .eq('id', messageId)
      .eq('creator_id', creatorId)
      .single();

    if (message?.platform === 'nostr') {
      // Route NOSTR replies through the dedicated adapter (fixes EPIC-009B P1 bug)
      const result = await getNostrReplyAdapter().reply(
        creatorId,
        message.platform_message_id,
        content
      );
      res.status(201).json(createApiResponse(req, { sent: true, eventId: result.eventId }));
      return;
    }

    // All other platforms use UnifiedInboxService
    await getInboxService().reply(creatorId, messageId, content);
    res.status(201).json(createApiResponse(req, { sent: true }));
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await getInboxService().batchAction(
      getAuthUser(req).nostr_pubkey,
      req.body.message_ids,
      req.body.action
    );
    res.json(createApiResponse(req, { updated }));
  })
);

// ============================================================================
// GET /templates — Response templates
// ============================================================================

router.get(
  '/templates',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;

    const { data, error } = await (container.resolve(TYPES.Database) as any)
      .from('reply_templates')
      .select('id, name, template_text, created_at')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(createApiResponse(req, { templates: data || [] }));
  })
);

// ============================================================================
// POST /templates — Create template
// ============================================================================

router.post(
  '/templates',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: CreateTemplateBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { name, template_text } = req.body;

    const { data, error } = await (container.resolve(TYPES.Database) as any)
      .from('reply_templates')
      .insert({ creator_id: creatorId, name, template_text })
      .select('id, name, template_text, created_at')
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(createApiResponse(req, { template: data }));
  })
);

export default router;
