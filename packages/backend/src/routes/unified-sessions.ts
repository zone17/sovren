// @ts-nocheck
/**
 * 🔐 US-311: Unified Session Management API Routes
 * WHY: RESTful API for unified NOSTR session management across devices
 *
 * Features:
 * - Session creation and validation
 * - Multi-device session tracking
 * - Automatic expiration handling
 * - Activity logging and audit trails
 * - Device-specific revocation
 * - Session statistics and monitoring
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error-handler-middleware';
import { getClientIP } from '../utils/client-ip';
import { z } from 'zod';
import { DatabaseSessionManager } from '../services/DatabaseSessionManager';
import { SessionMetadata } from '@shared/services/UnifiedSessionManager';

const router = express.Router();

// =====================================================
// CONFIGURATION
// =====================================================

const sessionManager = new DatabaseSessionManager({
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
  defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxSessionsPerUser: 5,
  enableActivityLogging: true,
  enableIPValidation: true,
});

// =====================================================
// RATE LIMITING
// =====================================================

const createSessionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 session creations per 15 minutes
  message: {
    success: false,
    error: 'Too many session creation attempts',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const validateSessionRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 validations per minute
  message: {
    success: false,
    error: 'Too many validation requests',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const refreshRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Max 20 refreshes per 5 minutes
  message: {
    success: false,
    error: 'Too many refresh requests',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const revokeRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // Max 15 revocations per 5 minutes
  message: {
    success: false,
    error: 'Too many revocation requests',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

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

const SessionMetadataSchema = z.object({
  device_fingerprint: z.string().min(1),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  device_info: DeviceInfoSchema,
  lightning_enabled: z.boolean().optional(),
  lightning_permissions: z.record(z.any()).optional(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
});

const CreateSessionSchema = z.object({
  pubkey: z.string().length(64, 'Invalid NOSTR pubkey'),
  metadata: SessionMetadataSchema,
});

const ValidateSessionSchema = z.object({
  session_id: z.string().startsWith('sess_'),
  token: z.string().min(32),
  metadata: SessionMetadataSchema.optional(),
});

const RefreshSessionSchema = z.object({
  session_id: z.string().startsWith('sess_'),
  token: z.string().min(32),
});

const RevokeSessionSchema = z.object({
  session_id: z.string().startsWith('sess_'),
  reason: z.string().optional(),
});

const RevokeDeviceSchema = z.object({
  pubkey: z.string().length(64),
  device_id: z.string().min(1),
});

// =====================================================
// MIDDLEWARE
// =====================================================

// getClientIP imported from '../utils/client-ip'

// asyncHandler imported from '../middleware/error-handler-middleware'

// =====================================================
// ROUTES
// =====================================================

/**
 * POST /api/unified-sessions/create
 * Create a new session
 *
 * Body:
 * - pubkey: NOSTR public key (64 chars)
 * - metadata: Device and location metadata
 *
 * Response:
 * - session: Created session object (includes token - only time it's returned!)
 * - token: Session token (store securely, never returned again)
 */
router.post(
  '/create',
  createSessionRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = CreateSessionSchema.parse(req.body);

      // Add IP address to metadata
      const metadata: SessionMetadata = {
        ...validatedData.metadata,
        ip_address: validatedData.metadata.ip_address || getClientIP(req),
        user_agent: validatedData.metadata.user_agent || req.headers['user-agent'],
      };

      // Create session
      const session = await sessionManager.createSession(
        validatedData.pubkey,
        metadata
      );

      return res.status(201).json({
        success: true,
        data: {
          session: {
            id: session.id,
            pubkey: session.pubkey,
            device_id: session.device_id,
            device_info: session.device_info,
            created_at: session.created_at,
            expires_at: session.expires_at,
            last_activity: session.last_activity,
          },
          token: session.token, // Only time token is returned!
        },
        message: 'Session created successfully',
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

      console.error('Session creation failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Session creation failed',
        code: 'SESSION_CREATION_FAILED',
      });
    }
  })
);

/**
 * POST /api/unified-sessions/validate
 * Validate a session token
 *
 * Body:
 * - session_id: Session ID
 * - token: Session token
 * - metadata: Optional metadata for validation
 *
 * Response:
 * - valid: Boolean indicating if session is valid
 * - session: Session object (if valid)
 * - reason: Reason for invalid session (if invalid)
 */
router.post(
  '/validate',
  validateSessionRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = ValidateSessionSchema.parse(req.body);

      // Add current IP to metadata if provided
      const metadata = validatedData.metadata
        ? {
            ...validatedData.metadata,
            ip_address: validatedData.metadata.ip_address || getClientIP(req),
          }
        : undefined;

      const validation = await sessionManager.validateSession(
        validatedData.session_id,
        validatedData.token,
        metadata
      );

      if (!validation.valid) {
        return res.status(401).json({
          success: false,
          valid: false,
          reason: validation.reason,
          expired: validation.expired,
          code: 'SESSION_INVALID',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        data: {
          session: {
            id: validation.session!.id,
            pubkey: validation.session!.pubkey,
            device_id: validation.session!.device_id,
            device_info: validation.session!.device_info,
            created_at: validation.session!.created_at,
            expires_at: validation.session!.expires_at,
            last_activity: validation.session!.last_activity,
            is_active: validation.session!.is_active,
          },
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

      console.error('Session validation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Session validation failed',
        code: 'VALIDATION_FAILED',
      });
    }
  })
);

/**
 * POST /api/unified-sessions/refresh
 * Refresh a session (extends expiration, generates new token)
 *
 * Body:
 * - session_id: Session ID
 * - token: Current session token
 *
 * Response:
 * - session: Updated session object
 * - token: New session token (store securely!)
 */
router.post(
  '/refresh',
  refreshRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = RefreshSessionSchema.parse(req.body);

      const refreshedSession = await sessionManager.refreshSession(
        validatedData.session_id,
        validatedData.token
      );

      if (!refreshedSession) {
        return res.status(401).json({
          success: false,
          error: 'Session refresh failed',
          code: 'REFRESH_FAILED',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          session: {
            id: refreshedSession.id,
            pubkey: refreshedSession.pubkey,
            device_id: refreshedSession.device_id,
            expires_at: refreshedSession.expires_at,
            last_activity: refreshedSession.last_activity,
            refresh_count: refreshedSession.refresh_count,
          },
          token: refreshedSession.token, // New token!
        },
        message: 'Session refreshed successfully',
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

      console.error('Session refresh failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Session refresh failed',
        code: 'REFRESH_FAILED',
      });
    }
  })
);

/**
 * DELETE /api/unified-sessions/revoke
 * Revoke a specific session
 *
 * Body:
 * - session_id: Session ID to revoke
 * - reason: Optional reason for revocation
 *
 * Response:
 * - success: Boolean indicating success
 * - message: Confirmation message
 */
router.delete(
  '/revoke',
  revokeRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = RevokeSessionSchema.parse(req.body);

      await sessionManager.revokeSession(validatedData.session_id);

      return res.status(200).json({
        success: true,
        data: {
          session_id: validatedData.session_id,
          revoked_at: new Date().toISOString(),
        },
        message: 'Session revoked successfully',
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

      console.error('Session revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Session revocation failed',
        code: 'REVOCATION_FAILED',
      });
    }
  })
);

/**
 * DELETE /api/unified-sessions/revoke-all
 * Revoke all sessions for a pubkey
 *
 * Query params:
 * - pubkey: NOSTR public key
 * - except: Optional session ID to keep active
 *
 * Response:
 * - revoked_count: Number of sessions revoked
 */
router.delete(
  '/revoke-all',
  revokeRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const pubkey = req.query.pubkey as string;
      const exceptSessionId = req.query.except as string | undefined;

      if (!pubkey || pubkey.length !== 64) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pubkey',
          code: 'INVALID_PUBKEY',
        });
      }

      await sessionManager.revokeAllUserSessions(pubkey, exceptSessionId);

      return res.status(200).json({
        success: true,
        data: {
          pubkey,
          except_session: exceptSessionId,
          revoked_at: new Date().toISOString(),
        },
        message: 'All sessions revoked successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Bulk session revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Bulk revocation failed',
        code: 'BULK_REVOCATION_FAILED',
      });
    }
  })
);

/**
 * DELETE /api/unified-sessions/revoke-device
 * Revoke all sessions for a specific device
 *
 * Body:
 * - pubkey: NOSTR public key
 * - device_id: Device ID to revoke
 *
 * Response:
 * - revoked_count: Number of sessions revoked
 */
router.delete(
  '/revoke-device',
  revokeRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = RevokeDeviceSchema.parse(req.body);

      const revokedCount = await sessionManager.revokeSessionsByDevice(
        validatedData.pubkey,
        validatedData.device_id
      );

      return res.status(200).json({
        success: true,
        data: {
          pubkey: validatedData.pubkey,
          device_id: validatedData.device_id,
          revoked_count: revokedCount,
          revoked_at: new Date().toISOString(),
        },
        message: `Revoked ${revokedCount} device sessions successfully`,
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

      console.error('Device revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Device revocation failed',
        code: 'DEVICE_REVOCATION_FAILED',
      });
    }
  })
);

/**
 * GET /api/unified-sessions/list
 * List all active sessions for a pubkey
 *
 * Query params:
 * - pubkey: NOSTR public key
 *
 * Response:
 * - sessions: Array of session objects
 * - total: Total number of active sessions
 */
router.get(
  '/list',
  validateSessionRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const pubkey = req.query.pubkey as string;

      if (!pubkey || pubkey.length !== 64) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pubkey',
          code: 'INVALID_PUBKEY',
        });
      }

      const sessions = await sessionManager.getUserSessions(pubkey);

      return res.status(200).json({
        success: true,
        data: {
          sessions: sessions.map(s => ({
            id: s.id,
            device_id: s.device_id,
            device_info: s.device_info,
            created_at: s.created_at,
            expires_at: s.expires_at,
            last_activity: s.last_activity,
            is_active: s.is_active,
            refresh_count: s.refresh_count,
          })),
          total: sessions.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Session listing failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Session listing failed',
        code: 'LIST_FAILED',
      });
    }
  })
);

/**
 * GET /api/unified-sessions/stats
 * Get session statistics for a pubkey
 *
 * Query params:
 * - pubkey: NOSTR public key (optional, if not provided returns global stats)
 *
 * Response:
 * - statistics: Session statistics object
 */
router.get(
  '/stats',
  validateSessionRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const pubkey = req.query.pubkey as string | undefined;

      if (pubkey && pubkey.length !== 64) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pubkey',
          code: 'INVALID_PUBKEY',
        });
      }

      const stats = await sessionManager.getSessionStats(pubkey);

      return res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Stats retrieval failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Stats retrieval failed',
        code: 'STATS_FAILED',
      });
    }
  })
);

/**
 * GET /api/unified-sessions/activities
 * Get activity log for a session
 *
 * Query params:
 * - session_id: Session ID
 * - limit: Maximum number of activities to return (default: 100)
 *
 * Response:
 * - activities: Array of activity objects
 * - total: Total number of activities returned
 */
router.get(
  '/activities',
  validateSessionRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.session_id as string;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!sessionId || !sessionId.startsWith('sess_')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid session_id',
          code: 'INVALID_SESSION_ID',
        });
      }

      const activities = await sessionManager.getSessionActivities(sessionId, limit);

      return res.status(200).json({
        success: true,
        data: {
          session_id: sessionId,
          activities,
          total: activities.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Activities retrieval failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Activities retrieval failed',
        code: 'ACTIVITIES_FAILED',
      });
    }
  })
);

/**
 * POST /api/unified-sessions/cleanup
 * Cleanup expired sessions (admin endpoint)
 *
 * Response:
 * - cleaned_count: Number of sessions cleaned up
 */
router.post(
  '/cleanup',
  revokeRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // TODO: Add admin authentication middleware here

      const cleanedCount = await sessionManager.cleanExpiredSessions();

      return res.status(200).json({
        success: true,
        data: {
          cleaned_count: cleanedCount,
          cleaned_at: new Date().toISOString(),
        },
        message: `Cleaned up ${cleanedCount} expired sessions`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Session cleanup failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
        code: 'CLEANUP_FAILED',
      });
    }
  })
);

/**
 * GET /api/unified-sessions/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Try to query sessions table
    const health = await sessionManager.healthCheck();

    return res.status(health.healthy ? 200 : 503).json({
      success: health.healthy,
      service: 'unified-session-management',
      status: health.healthy ? 'healthy' : 'unhealthy',
      message: health.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      service: 'unified-session-management',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// =====================================================
// ERROR HANDLER
// =====================================================

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unified session route error:', err);

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
});

export default router;
