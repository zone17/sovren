// @ts-nocheck
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createSessionService } from '../services/session-service';

const router = express.Router();
const sessionService = createSessionService();

// 🔒 Rate limiting for session management endpoints
const sessionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    error: 'Too many session management requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔒 Strict rate limiting for revocation endpoints
const revocationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit revocation requests
  message: {
    success: false,
    error: 'Too many revocation requests, please try again later',
    code: 'REVOCATION_RATE_LIMIT',
  },
});

// 📝 Request Validation Schemas
const DeviceInfoSchema = z.object({
  userAgent: z.string().min(1),
  platform: z.string().min(1),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']),
  browser: z.string().min(1),
  browserVersion: z.string().min(1),
  os: z.string().min(1),
  osVersion: z.string().min(1),
  fingerprint: z.string().min(1),
  screenResolution: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

const UpdateActivitySchema = z.object({
  activity_type: z.enum(['login', 'api_call', 'page_view', 'logout', 'token_refresh']).optional(),
});

const RevokeSessionSchema = z.object({
  session_id: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * 📋 GET /api/sessions
 * List all active sessions for the authenticated user
 */
router.get('/', sessionRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const result = await sessionService.listUserSessions(req.user.nostr_pubkey);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'SESSION_LIST_FAILED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        sessions: result.sessions,
        total_count: result.sessions?.length || 0,
        metadata: {
          max_sessions: 10,
          current_session_id: await getCurrentSessionId(req),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Session listing failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * 🔄 PUT /api/sessions/:sessionId/activity
 * Update last activity for a specific session
 */
router.put(
  '/:sessionId/activity',
  sessionRateLimit,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const sessionId = req.params.sessionId;
      const validatedData = UpdateActivitySchema.parse(req.body);

      const result = await sessionService.updateLastActivity(
        sessionId,
        validatedData.activity_type
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'ACTIVITY_UPDATE_FAILED',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          session_id: sessionId,
          updated_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      console.error('Activity update failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * 🚫 DELETE /api/sessions/:sessionId
 * Revoke a specific session
 */
router.delete(
  '/:sessionId',
  revocationRateLimit,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const sessionId = req.params.sessionId;
      const userId = await getUserIdFromNostrPubkey(req.user.nostr_pubkey);

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const result = await sessionService.revokeSession(sessionId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'SESSION_REVOCATION_FAILED',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          session_id: sessionId,
          revoked_at: new Date().toISOString(),
          message: 'Session successfully revoked',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Session revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * 🚫 POST /api/sessions/revoke-all
 * Revoke all sessions except the current one
 */
router.post(
  '/revoke-all',
  revocationRateLimit,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const userId = await getUserIdFromNostrPubkey(req.user.nostr_pubkey);
      const currentSessionId = await getCurrentSessionId(req);

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const result = await sessionService.revokeAllSessions(userId, currentSessionId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'BULK_REVOCATION_FAILED',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          revoked_count: result.revokedCount,
          current_session_preserved: !!currentSessionId,
          revoked_at: new Date().toISOString(),
          message: `Successfully revoked ${result.revokedCount} sessions`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Bulk session revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * 🚫 POST /api/sessions/revoke-others
 * Revoke all other sessions (keeping current session active)
 */
router.post(
  '/revoke-others',
  revocationRateLimit,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const userId = await getUserIdFromNostrPubkey(req.user.nostr_pubkey);
      const currentSessionId = await getCurrentSessionId(req);

      if (!userId || !currentSessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session context not found',
          code: 'SESSION_CONTEXT_ERROR',
        });
      }

      const result = await sessionService.revokeAllSessions(userId, currentSessionId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'SELECTIVE_REVOCATION_FAILED',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          revoked_count: result.revokedCount,
          current_session_id: currentSessionId,
          revoked_at: new Date().toISOString(),
          message: `Successfully revoked ${result.revokedCount} other sessions`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Selective session revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * 📊 GET /api/sessions/stats
 * Get session statistics for the authenticated user
 */
router.get('/stats', sessionRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const userId = await getUserIdFromNostrPubkey(req.user.nostr_pubkey);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const sessionsResult = await sessionService.listUserSessions(userId);

    if (!sessionsResult.success || !sessionsResult.sessions) {
      return res.status(400).json({
        success: false,
        error: 'Failed to retrieve session statistics',
        code: 'STATS_RETRIEVAL_FAILED',
      });
    }

    const sessions = sessionsResult.sessions;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total_active_sessions: sessions.length,
      sessions_by_device: sessions.reduce(
        (acc, session) => {
          const deviceType = session.device_info.deviceType;
          acc[deviceType] = (acc[deviceType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      recent_activity: sessions.filter((session) => new Date(session.last_activity_at) > oneDayAgo)
        .length,
      oldest_session: sessions.reduce(
        (oldest, session) =>
          new Date(session.created_at) < new Date(oldest.created_at) ? session : oldest,
        sessions[0]
      )?.created_at,
      most_recent_activity: sessions.reduce(
        (recent, session) =>
          new Date(session.last_activity_at) > new Date(recent.last_activity_at) ? session : recent,
        sessions[0]
      )?.last_activity_at,
    };

    return res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Session stats retrieval failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

// 🔧 Helper Functions

async function getCurrentSessionId(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.substring(7); // Remove 'Bearer '
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await sessionService.getSessionByTokenHash(tokenHash);
    return result.session?.id || null;
  } catch (error) {
    console.warn('Failed to get current session ID:', error);
    return null;
  }
}

async function getUserIdFromNostrPubkey(nostrPubkey: string): Promise<string | null> {
  try {
    // Mock implementation - in production, query users table
    return `user_${nostrPubkey.substring(0, 8)}`;
  } catch (error) {
    console.warn('Failed to get user ID:', error);
    return null;
  }
}

export default router;
