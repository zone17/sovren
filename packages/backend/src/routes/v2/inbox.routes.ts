/**
 * Unified Inbox Routes (v2)
 * /api/v2/inbox/*
 * EPIC-009 + EPIC-009B: Multi-platform inbox aggregation, templates
 */

import { Request, Response, Router } from 'express';
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
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';

const router = Router();

router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 30 });

// ============================================================================
// Lazy service resolution
// ============================================================================

let _inboxService: IUnifiedInboxService | null = null;
let _nostrReplyAdapter: INostrReplyAdapter | null = null;
let _db: ISupabaseClient | null = null;

function getInboxService(): IUnifiedInboxService {
  if (!_inboxService) _inboxService = container.resolve(TYPES.UnifiedInboxService);
  return _inboxService;
}

function getNostrReplyAdapter(): INostrReplyAdapter {
  if (!_nostrReplyAdapter) _nostrReplyAdapter = container.resolve(TYPES.NostrReplyAdapter);
  return _nostrReplyAdapter;
}

function getDb(): ISupabaseClient {
  if (!_db) _db = container.resolve(TYPES.Database) as unknown as ISupabaseClient;
  return _db;
}

// ============================================================================
// Validation schemas — EPIC-009B additions
// ============================================================================

const CreateTemplateBodySchema = z.object({
  name: z.string().min(1).max(100),
  template_text: z.string().min(1).max(2000),
});

// #265: Schema for updating a template
const UpdateTemplateBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    template_text: z.string().min(1).max(2000).optional(),
  })
  .refine((d) => d.name !== undefined || d.template_text !== undefined, {
    message: 'At least one of name or template_text must be provided',
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
// GET /messages/:id — Single message (#338)
// ============================================================================

router.get(
  '/messages/:id',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;

    const { data: message, error } = await getDb()
      .from('inbox_messages')
      .select('*')
      .eq('id', req.params.id)
      .eq('creator_id', creatorId)
      .single();

    if (error || !message) {
      res.status(404).json({ success: false, error: 'Message not found' });
      return;
    }

    res.json(createApiResponse(req, { message }));
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
    const { data: message } = await getDb()
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

    const { data, error } = await getDb()
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

    const { data, error } = await getDb()
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

// ============================================================================
// PUT /templates/:id — Update template (#265)
// ============================================================================

router.put(
  '/templates/:id',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: UpdateTemplateBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const templateId = req.params.id;
    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.template_text !== undefined) updates.template_text = req.body.template_text;

    const { data, error } = await getDb()
      .from('reply_templates')
      .update(updates)
      .eq('id', templateId)
      .eq('creator_id', creatorId)
      .select('id, name, template_text, created_at')
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.json(createApiResponse(req, { template: data }));
  })
);

// ============================================================================
// DELETE /templates/:id — Delete template (#265)
// ============================================================================

router.delete(
  '/templates/:id',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const templateId = req.params.id;

    const { error, count } = await getDb()
      .from('reply_templates')
      .delete()
      .eq('id', templateId)
      .eq('creator_id', creatorId);

    if (error) throw error;
    if (count === 0) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.json(createApiResponse(req, { deleted: true }));
  })
);

export default router;
