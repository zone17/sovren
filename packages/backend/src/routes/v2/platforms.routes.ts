/**
 * Platform Connection Routes (v2)
 * /api/v2/platforms/*
 * EPIC-009: OAuth connect/disconnect/status
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { DistributionValidators } from '../../validators/distribution';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';
import type { SupportedPlatform } from '@sovren/shared/types/distribution';

const router = Router();

router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 10 });

// Lazy service resolution
let _platformService: IPlatformConnectionService | null = null;

function getPlatformService(): IPlatformConnectionService {
  if (!_platformService) _platformService = container.resolve(TYPES.PlatformConnectionService);
  return _platformService;
}

// ============================================================================
// POST /connect/:platform — Initiate OAuth flow
// ============================================================================

router.post(
  '/connect/:platform',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ params: DistributionValidators.platformParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const platform = req.params.platform as SupportedPlatform;
      const result = await getPlatformService().initiateConnection(
        req.user!.nostr_pubkey,
        platform,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// GET /callback/:platform — OAuth callback handler
// ============================================================================

router.get(
  '/callback/:platform',
  validate({
    params: DistributionValidators.platformParam,
    query: DistributionValidators.callbackQuery,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const platform = req.params.platform as SupportedPlatform;
      const { code, state } = req.query as { code: string; state: string };

      await getPlatformService().handleCallback(platform, code, state);

      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/settings/platforms?connected=${platform}`);
    } catch (err) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/settings/platforms?error=oauth_failed`);
    }
  }
);

// ============================================================================
// DELETE /disconnect/:platform — Revoke and remove connection
// ============================================================================

router.delete(
  '/disconnect/:platform',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ params: DistributionValidators.platformParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const platform = req.params.platform as SupportedPlatform;
      await getPlatformService().disconnect(req.user!.nostr_pubkey, platform);
      res.json({ success: true, data: { disconnected: true } });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// GET /status — List connected platforms with status
// ============================================================================

router.get(
  '/status',
  authenticate,
  requireCreator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getPlatformService().getStatus(req.user!.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
