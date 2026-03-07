/**
 * Notifications Routes
 * Slice 8: Creator Network + Notifications
 * /api/v2/notifications/*
 *
 * Route ordering: named segments (/unread-count, /mark-all-read) before /:id
 * to avoid named segments being matched as ID values.
 */

import { Router } from 'express';
import { z } from 'zod';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireAuth, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { UuidParamSchema } from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import type { INotificationPersistenceService } from '../../interfaces/community/INotificationPersistenceService';

const router = Router();

// Rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60_000, max: 60 });

// Validators
const MarkAllReadSchema = z.object({
  before: z
    .string()
    .datetime({ message: 'before must be a valid ISO 8601 datetime' })
    .transform((v) => new Date(v)),
});

const MarkSingleReadSchema = z.object({
  read: z.literal(true, { errorMap: () => ({ message: 'read must be true' }) }),
});

// Lazy service resolution
let _notificationService: INotificationPersistenceService | null = null;
function getNotificationService(): INotificationPersistenceService {
  if (!_notificationService)
    _notificationService = container.resolve(TYPES.NotificationPersistenceService);
  return _notificationService;
}

// ============================================================================
// GET /api/v2/notifications
// ============================================================================

/**
 * GET /api/v2/notifications
 * List notifications for the authenticated user, newest first.
 * Query params: page (default 1), limit (default 20, max 50), unreadOnly (boolean)
 */
router.get(
  '/',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';

    const data = await getNotificationService().list(getAuthUser(req).nostr_pubkey, {
      page,
      limit,
      unreadOnly,
    });

    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /api/v2/notifications/unread-count
// NOTE: Must come before /:id to avoid "unread-count" matching as ID value
// ============================================================================

/**
 * GET /api/v2/notifications/unread-count
 * Get the count of unread notifications for the authenticated user.
 * Leverages partial index idx_notifications_user_unread.
 */
router.get(
  '/unread-count',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await getNotificationService().getUnreadCount(getAuthUser(req).nostr_pubkey);

    res.json(createApiResponse(req, { count }));
  })
);

// ============================================================================
// POST /api/v2/notifications/mark-all-read
// NOTE: Must come before /:id to avoid "mark-all-read" matching as ID value
// ============================================================================

/**
 * POST /api/v2/notifications/mark-all-read
 * Mark all unread notifications before a timestamp as read.
 * Body: { before: ISO 8601 datetime }
 * RC-4: Uses timestamp cutoff to prevent marking newly-arrived notifications as read
 */
router.post(
  '/mark-all-read',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = MarkAllReadSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    await getNotificationService().markAllRead(getAuthUser(req).nostr_pubkey, result.data.before);

    res.json(createApiResponse(req, { markedRead: true }));
  })
);

// ============================================================================
// PATCH /api/v2/notifications/:id
// ============================================================================

/**
 * PATCH /api/v2/notifications/:id
 * Mark a single notification as read. Body: { read: true }
 */
router.patch(
  '/:id',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid notification ID format');
    }

    const bodyResult = MarkSingleReadSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError(bodyResult.error.issues[0]?.message ?? 'Invalid input');
    }

    await getNotificationService().markRead(idResult.data, getAuthUser(req).nostr_pubkey);

    res.json(createApiResponse(req, { markedRead: true }));
  })
);

// ============================================================================
// DELETE /api/v2/notifications/:id
// ============================================================================

/**
 * DELETE /api/v2/notifications/:id
 * Delete a notification. Only the notification's owner may delete it.
 */
router.delete(
  '/:id',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid notification ID format');
    }

    await getNotificationService().delete(idResult.data, getAuthUser(req).nostr_pubkey);

    res.json(createApiResponse(req, null));
  })
);

export default router;
