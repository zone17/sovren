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
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
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
    const { niche, audienceSizeRange, bio, maxMentees } = req.body;

    if (!niche || typeof niche !== 'string') {
      res.status(400).json({ success: false, error: 'niche is required' });
      return;
    }

    if (!audienceSizeRange || typeof audienceSizeRange !== 'string') {
      res.status(400).json({ success: false, error: 'audienceSizeRange is required' });
      return;
    }

    const data = await getMentorshipService().registerMentor(getAuthUser(req).nostr_pubkey, {
      niche,
      audienceSizeRange,
      bio,
      maxMentees: maxMentees ? Number(maxMentees) : undefined,
    });

    res.status(201).json({ success: true, data });
  })
);

/**
 * GET /api/v2/mentorship/mentors
 * Browse mentors with optional niche/audience filters
 * NOTE: Must come before /:id routes to avoid collision
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

    res.json({ success: true, data });
  })
);

/**
 * GET /api/v2/mentorship/my-mentorships
 * Get all mentorships for the authenticated user (as mentor or mentee)
 * NOTE: Must come before /:id routes to avoid collision
 */
router.get(
  '/my-mentorships',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getMentorshipService().getMyMentorships(getAuthUser(req).nostr_pubkey);
    res.json({ success: true, data });
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
    const { mentorId, niche, goals } = req.body;

    if (!mentorId || typeof mentorId !== 'string') {
      res.status(400).json({ success: false, error: 'mentorId is required' });
      return;
    }

    const data = await getMentorshipService().requestMentorship(
      getAuthUser(req).nostr_pubkey,
      mentorId,
      { niche, goals }
    );

    res.status(201).json({ success: true, data });
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
    const { accept } = req.body;

    if (typeof accept !== 'boolean') {
      res.status(400).json({ success: false, error: 'accept (boolean) is required' });
      return;
    }

    await getMentorshipService().respondToRequest(req.params.id, getAuthUser(req).nostr_pubkey, accept);
    res.json({ success: true });
  })
);

export default router;
