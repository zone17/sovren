/**
 * 🔐 Unified NOSTR Authentication Routes
 * US-305: Unified Authentication API
 *
 * Express routes for unified NOSTR authentication endpoints
 */

import { Router } from 'express';
import {
  generateChallenge,
  verifySignature,
  refreshToken,
  logout,
  validateToken,
  requireNostrAuth,
} from '../middleware/nostr-auth';
import { unifiedNostrAuth } from '../services/unified-nostr-auth';
import { SessionService } from '../services/session-service';

const router = Router();
const sessionService = new SessionService();

// =====================================================
// PUBLIC AUTHENTICATION ENDPOINTS
// =====================================================

/**
 * POST /api/unified-auth/challenge
 * Generate authentication challenge for a public key
 */
router.post('/challenge', generateChallenge);

/**
 * POST /api/unified-auth/verify
 * Verify signature and issue JWT token
 */
router.post('/verify', verifySignature);

/**
 * POST /api/unified-auth/refresh
 * Refresh an existing JWT token
 */
router.post('/refresh', refreshToken);

/**
 * POST /api/unified-auth/logout
 * Logout and revoke session
 */
router.post('/logout', logout);

/**
 * GET /api/unified-auth/validate
 * Validate an existing token
 */
router.get('/validate', validateToken);

// =====================================================
// PROTECTED SESSION MANAGEMENT ENDPOINTS
// =====================================================

/**
 * GET /api/unified-auth/sessions
 * List all active sessions for the authenticated user
 */
router.get('/sessions', requireNostrAuth(), async (req, res) => {
  try {
    const pubkey = req.nostr!.pubkey;

    const result = await sessionService.listUserSessions(pubkey);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch sessions',
      });
    }

    res.json({
      success: true,
      sessions: result.sessions,
    });
  } catch (error) {
    console.error('Session listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
    });
  }
});

/**
 * DELETE /api/unified-auth/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', requireNostrAuth(), async (req, res) => {
  try {
    const pubkey = req.nostr!.pubkey;
    const { sessionId } = req.params;

    const result = await sessionService.revokeSession(sessionId, pubkey);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to revoke session',
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Session revocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
    });
  }
});

/**
 * POST /api/unified-auth/sessions/revoke-all
 * Revoke all sessions except current
 */
router.post('/sessions/revoke-all', requireNostrAuth(), async (req, res) => {
  try {
    const pubkey = req.nostr!.pubkey;
    const currentSessionId = req.nostr!.sessionId;

    const result = await sessionService.revokeAllSessions(pubkey, currentSessionId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to revoke sessions',
      });
    }

    res.json({
      success: true,
      message: `Revoked ${result.revokedCount} sessions`,
      revokedCount: result.revokedCount,
    });
  } catch (error) {
    console.error('Bulk session revocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke sessions',
    });
  }
});

// =====================================================
// SECURITY & MONITORING ENDPOINTS
// =====================================================

/**
 * GET /api/unified-auth/security/events
 * Get security events for the authenticated user
 * Requires admin role for viewing other users' events
 */
router.get('/security/events', requireNostrAuth(), async (req, res) => {
  try {
    const pubkey = req.nostr!.pubkey;
    const isAdmin = req.nostr!.role === 'admin';

    const targetPubkey = isAdmin && req.query.pubkey
      ? req.query.pubkey as string
      : pubkey;

    const events = await unifiedNostrAuth.exportSecurityAuditLog({
      pubkey: targetPubkey,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
    });

    res.json({
      success: true,
      ...events,
    });
  } catch (error) {
    console.error('Security events fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security events',
    });
  }
});

/**
 * GET /api/unified-auth/security/patterns
 * Get suspicious patterns for a user (admin only)
 */
router.get(
  '/security/patterns/:pubkey',
  requireNostrAuth({ requireRole: 'admin' }),
  async (req, res) => {
    try {
      const { pubkey } = req.params;

      const patterns = await unifiedNostrAuth.getSuspiciousPatterns(pubkey);

      res.json({
        success: true,
        pubkey,
        patterns,
      });
    } catch (error) {
      console.error('Pattern detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect patterns',
      });
    }
  }
);

/**
 * GET /api/unified-auth/security/violations
 * Get rate limit violations
 */
router.get('/security/violations', requireNostrAuth(), async (req, res) => {
  try {
    const pubkey = req.nostr!.pubkey;

    const violations = await unifiedNostrAuth.getRateLimitViolations(pubkey);

    res.json({
      success: true,
      violations,
    });
  } catch (error) {
    console.error('Violations fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch violations',
    });
  }
});

// =====================================================
// STATISTICS ENDPOINTS (ADMIN ONLY)
// =====================================================

/**
 * GET /api/unified-auth/stats
 * Get authentication service statistics
 */
router.get(
  '/stats',
  requireNostrAuth({ requireRole: 'admin' }),
  async (req, res) => {
    try {
      const stats = unifiedNostrAuth.getStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Stats fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
);

/**
 * POST /api/unified-auth/cleanup
 * Trigger manual cleanup of expired data (admin only)
 */
router.post(
  '/cleanup',
  requireNostrAuth({ requireRole: 'admin' }),
  async (req, res) => {
    try {
      unifiedNostrAuth.cleanupExpiredChallenges();

      const sessionCleanup = await sessionService.cleanupExpiredSessions();

      res.json({
        success: true,
        message: 'Cleanup completed',
        cleanedSessions: sessionCleanup.cleanedCount || 0,
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({
        success: false,
        error: 'Cleanup failed',
      });
    }
  }
);

// =====================================================
// HEALTH CHECK
// =====================================================

/**
 * GET /api/unified-auth/health
 * Health check for authentication service
 */
router.get('/health', async (req, res) => {
  try {
    const stats = unifiedNostrAuth.getStats();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        activeChallenges: stats.activeChallenges,
        uniquePubkeys: stats.uniquePubkeys,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;