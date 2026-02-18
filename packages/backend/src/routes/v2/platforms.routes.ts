/**
 * Platform Connection Routes (v2)
 * /api/v2/platforms/*
 * EPIC-009: OAuth connect/disconnect/status
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
import { encryptToken, getEncryptionKey } from '../../services/distribution/crypto';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';
import type { SupportedPlatform } from '@sovren/shared/types/distribution';

const router = Router();

/**
 * Get the validated frontend URL for OAuth redirects.
 * Enforces HTTPS in production to prevent open redirect attacks.
 */
function getValidatedFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (process.env.NODE_ENV === 'production') {
    const parsed = new URL(frontendUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('FRONTEND_URL must use HTTPS in production');
    }
  }
  return frontendUrl;
}

router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 10 });

// H-2: Strict rate limit for BYOK key submission (10 attempts per hour per user)
const byokRateLimiter = createUserRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

// H-2: Security headers applied to all BYOK responses
function applyByokSecurityHeaders(res: Response): void {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
}

// Validation schema for BYOK key submission
// H-2: Body is intentionally NOT logged anywhere in this handler
const ByokKeyBodySchema = z.object({
  api_key: z.string().min(1).max(500),
});

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
        getAuthUser(req).nostr_pubkey,
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
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const platform = req.params.platform as SupportedPlatform;
      const { code, state } = req.query as { code: string; state: string };

      await getPlatformService().handleCallback(platform, code, state);

      // Redirect to frontend success page
      const frontendUrl = getValidatedFrontendUrl();
      res.redirect(`${frontendUrl}/settings/platforms?connected=${platform}`);
    } catch (err) {
      const frontendUrl = getValidatedFrontendUrl();
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
      await getPlatformService().disconnect(getAuthUser(req).nostr_pubkey, platform);
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
      const data = await getPlatformService().getStatus(getAuthUser(req).nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// POST /byok/twitter — Store encrypted X/Twitter API key (BYOK)
// H-2: No request body logging. Cache-Control: no-store. No key in errors.
// C-5: Uses BYOK_ENCRYPTION_KEY (separate from PLATFORM_TOKEN_ENCRYPTION_KEY).
// ============================================================================

router.post(
  '/byok/twitter',
  authenticate,
  requireCreator,
  byokRateLimiter,
  validate({ body: ByokKeyBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    applyByokSecurityHeaders(res);

    const creatorId = getAuthUser(req).nostr_pubkey;

    // C-5: use dedicated BYOK_ENCRYPTION_KEY, never the OAuth token key
    const encryptionKey = getEncryptionKey(process.env.BYOK_ENCRYPTION_KEY);

    // Validate the key first by making a test read call to Twitter API
    // H-2: any error thrown here must NOT include the key value
    await validateTwitterApiKey(req.body.api_key);

    // Encrypt with BYOK-specific key
    const { encrypted, iv, authTag } = encryptToken(req.body.api_key, encryptionKey);

    const { error } = await (container.resolve(TYPES.Database) as any)
      .from('platform_connections')
      .update({
        api_key_encrypted: encrypted.toString('hex'),
        api_key_iv: iv.toString('hex'),
        api_key_auth_tag: authTag.toString('hex'),
        key_version: 1,
      })
      .eq('creator_id', creatorId)
      .eq('platform', 'twitter');

    if (error) {
      // H-2: never include the API key in error responses
      throw new Error('Failed to store API key');
    }

    res.status(200).json(createApiResponse(req, { stored: true, platform: 'twitter' }));
  })
);

// ============================================================================
// DELETE /byok/twitter — Remove stored X/Twitter BYOK key (reverts to write-only)
// ============================================================================

router.delete(
  '/byok/twitter',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    applyByokSecurityHeaders(res);

    const creatorId = getAuthUser(req).nostr_pubkey;

    const { error } = await (container.resolve(TYPES.Database) as any)
      .from('platform_connections')
      .update({
        api_key_encrypted: null,
        api_key_iv: null,
        api_key_auth_tag: null,
        key_version: null,
      })
      .eq('creator_id', creatorId)
      .eq('platform', 'twitter');

    if (error) {
      throw new Error('Failed to remove API key');
    }

    res.status(200).json(createApiResponse(req, { removed: true, platform: 'twitter' }));
  })
);

/**
 * Validate a Twitter API key by making a low-cost test call.
 * H-2: Throws a generic error on failure — never exposes the key in the message.
 * M-1: Twitter API endpoint is hardcoded (not user-supplied) — no SSRF risk here.
 */
async function validateTwitterApiKey(apiKey: string): Promise<void> {
  const response = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (response.status === 401 || response.status === 403) {
    // H-2: generic message only — the key itself must NOT appear in errors
    throw new Error('Twitter API key validation failed: invalid or insufficient permissions');
  }

  if (!response.ok && response.status !== 200) {
    // Rate limit or server error — don't reject the key, it may still be valid
    // Log at warn level (without the key) and allow storage
  }
}

export default router;
