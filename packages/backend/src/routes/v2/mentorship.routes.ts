/**
 * Mentorship Routes
 * EPIC-010: Creator Network — Mentor registration, matching, and relationship management
 * /api/v2/mentorship/*
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import {
  RegisterMentorSchema,
  RequestMentorshipSchema,
  RespondMentorshipSchema,
  UpdateMentorProfileSchema,
  UuidParamSchema,
} from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import { getUserIdByPubkey } from '../../utils/getUserIdByPubkey';
import type { IMentorshipService } from '../../interfaces/community/IMentorshipService';

const router = Router();

// Rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

// Lazy service resolution
let _mentorshipService: IMentorshipService | null = null;
function getMentorshipService(): IMentorshipService {
  if (!_mentorshipService) _mentorshipService = container.resolve(TYPES.MentorshipService);
  return _mentorshipService;
}

// ============================================================================
// Mentor Profile
// ============================================================================

/**
 * POST /api/v2/mentorship/register-mentor
 * Register as a mentor (creates mentor_profiles entry)
 */
router.post(
  '/register-mentor',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = RegisterMentorSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const db = container.resolve(TYPES.Database) as Parameters<typeof getUserIdByPubkey>[0];
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const data = await getMentorshipService().registerMentor(creatorId, result.data);
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * GET /api/v2/mentorship/mentors
 * Browse mentors with optional niche/audience filters
 * NOTE: Must come before /:id routes to avoid collision
 * #382/#713: DB-level pagination via service (limit 50 in service)
 */
router.get(
  '/mentors',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const filters: { niche?: string; audienceSizeRange?: string } = {};

    if (req.query.niche && typeof req.query.niche === 'string') {
      filters.niche = req.query.niche;
    }

    if (req.query.audienceSizeRange && typeof req.query.audienceSizeRange === 'string') {
      filters.audienceSizeRange = req.query.audienceSizeRange;
    }

    const data = await getMentorshipService().getMentors(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.json(createApiResponse(req, data));
  })
);

/**
 * GET /api/v2/mentorship/my-mentorships
 * Get all mentorships for the authenticated user (as mentor or mentee)
 * NOTE: Must come before /:id routes to avoid collision
 * #382/#713: DB-level pagination via service (limit 100 in service)
 */
router.get(
  '/my-mentorships',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const db = container.resolve(TYPES.Database) as Parameters<typeof getUserIdByPubkey>[0];
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const data = await getMentorshipService().getMyMentorships(creatorId, { offset, limit });
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Mentorship Requests
// ============================================================================

/**
 * POST /api/v2/mentorship/request
 * Request mentorship from a mentor
 */
router.post(
  '/request',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = RequestMentorshipSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const db = container.resolve(TYPES.Database) as Parameters<typeof getUserIdByPubkey>[0];
    const menteeId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const data = await getMentorshipService().requestMentorship(menteeId, result.data.mentorId, {
      niche: result.data.niche,
      goals: result.data.goals,
    });

    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * PUT /api/v2/mentorship/:id/accept
 * Accept or decline a mentorship request
 */
router.put(
  '/:id/accept',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid mentorship ID format');
    }

    const result = RespondMentorshipSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const db = container.resolve(TYPES.Database) as Parameters<typeof getUserIdByPubkey>[0];
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getMentorshipService().respondToRequest(idResult.data, creatorId, result.data.accept);
    res.json(createApiResponse(req, { accepted: result.data.accept }));
  })
);

/**
 * PUT /api/v2/mentorship/profiles/:id
 * Update a mentor profile
 */
router.put(
  '/profiles/:id',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid profile ID format');
    }

    const result = UpdateMentorProfileSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const db = container.resolve(TYPES.Database) as Parameters<typeof getUserIdByPubkey>[0];
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getMentorshipService().updateMentorProfile(idResult.data, creatorId, result.data);
    res.json(createApiResponse(req, { updated: true }));
  })
);

export default router;
