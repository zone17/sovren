/**
 * 🎟️ **JWT GENERATION AND VALIDATION EDGE FUNCTION**
 *
 * Elite JWT token management for Sovren platform
 *
 * **Implementation for US-210: Supabase Edge Functions**
 * **Sub-task: US-210.2 - Authentication Edge Functions**
 *
 * Features:
 * - JWT token generation ✅
 * - JWT token validation ✅
 * - Refresh token management ✅
 * - Token revocation ✅
 * - Secure token storage ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

import { create, verify } from 'jwt';
import { z } from 'zod';
import type {
  AuthFunctionResponse,
  AuthSession,
  DatabaseConnection,
  JWTPayload,
} from '../_shared/types.ts';
import {
  DatabaseHelper,
  Logger,
  PerformanceHelper,
  RequestHelper,
  ResponseHelper,
  SecurityHelper,
  ValidationHelper,
  corsHeaders,
} from '../_shared/utils.ts';

// 🔧 Validation Schemas
const GenerateTokenRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  publicKey: z.string().length(64, 'Public key must be 64 characters').optional(),
  email: z.string().email('Valid email is required').optional(),
  role: z.enum(['user', 'creator', 'admin']).default('user'),
  sessionData: z
    .object({
      ip_address: z.string().optional(),
      user_agent: z.string().optional(),
    })
    .optional(),
});

const ValidateTokenRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const RevokeTokenRequestSchema = z.object({
  token: z.string().min(1, 'Token is required').optional(),
  sessionId: z.string().min(1, 'Session ID is required').optional(),
  userId: z.string().min(1, 'User ID is required').optional(),
  revokeAll: z.boolean().default(false),
});

// 🎟️ JWT Service
class JWTService {
  private db: DatabaseHelper;
  private logger: Logger;
  private jwtSecret: string;
  private issuer: string;
  private audience: string;

  constructor(db: DatabaseHelper, logger: Logger, jwtSecret: string) {
    this.db = db;
    this.logger = logger;
    this.jwtSecret = jwtSecret;
    this.issuer = 'sovren-platform';
    this.audience = 'sovren-users';
  }

  private createJWTPayload(
    userId: string,
    sessionId: string,
    options: {
      email?: string;
      role?: string;
      nostrPubkey?: string;
      expiresIn?: number;
    } = {}
  ): JWTPayload {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = options.expiresIn || 7 * 24 * 60 * 60; // 7 days default

    return {
      sub: userId,
      iat: now,
      exp: now + expiresIn,
      aud: this.audience,
      iss: this.issuer,
      jti: SecurityHelper.generateUUID(),
      session_id: sessionId,
      role: options.role || 'user',
      email: options.email,
      nostr_pubkey: options.nostrPubkey,
    };
  }

  async generateTokens(
    userId: string,
    options: {
      email?: string;
      role?: string;
      nostrPubkey?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<{ accessToken: string; refreshToken: string; session: AuthSession }> {
    this.logger.info('Generating JWT tokens', { userId, role: options.role });

    // Generate session ID
    const sessionId = SecurityHelper.generateUUID();

    // Create access token payload
    const accessPayload = this.createJWTPayload(userId, sessionId, {
      email: options.email,
      role: options.role,
      nostrPubkey: options.nostrPubkey,
      expiresIn: 60 * 60, // 1 hour
    });

    // Create refresh token payload
    const refreshPayload = this.createJWTPayload(userId, sessionId, {
      expiresIn: 30 * 24 * 60 * 60, // 30 days
    });

    // Generate tokens
    const accessToken = await create({ alg: 'HS256', typ: 'JWT' }, accessPayload, this.jwtSecret);

    const refreshToken = await create({ alg: 'HS256', typ: 'JWT' }, refreshPayload, this.jwtSecret);

    // Create session record
    const session: Partial<AuthSession> = {
      id: sessionId,
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(refreshPayload.exp * 1000).toISOString(),
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      ip_address: options.ipAddress,
      user_agent: options.userAgent,
      is_active: true,
    };

    // Store session in database
    const { error } = await this.db.insert('auth_sessions', session);
    if (error) {
      this.logger.error('Failed to store session', error);
      throw new Error('Failed to create session');
    }

    this.logger.info('JWT tokens generated successfully', {
      userId,
      sessionId,
      accessTokenExp: accessPayload.exp,
      refreshTokenExp: refreshPayload.exp,
    });

    return {
      accessToken,
      refreshToken,
      session: session as AuthSession,
    };
  }

  async validateToken(
    token: string
  ): Promise<{ valid: boolean; payload?: JWTPayload; error?: string }> {
    this.logger.info('Validating JWT token');

    try {
      const payload = (await verify(token, this.jwtSecret, 'HS256')) as JWTPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        this.logger.warn('JWT token expired', { exp: payload.exp, now });
        return { valid: false, error: 'Token expired' };
      }

      // Check issuer and audience
      if (payload.iss !== this.issuer || payload.aud !== this.audience) {
        this.logger.warn('JWT token invalid issuer/audience', {
          iss: payload.iss,
          aud: payload.aud,
        });
        return { valid: false, error: 'Invalid token issuer or audience' };
      }

      // Check if session is active
      if (payload.session_id) {
        const { data, error } = await this.db.query<AuthSession>('auth_sessions', {
          filter: { id: payload.session_id, is_active: true },
          limit: 1,
        });

        if (error || !data || data.length === 0) {
          this.logger.warn('JWT session not found or inactive', {
            sessionId: payload.session_id,
          });
          return { valid: false, error: 'Session not found or inactive' };
        }

        // Update last activity
        await this.db.update('auth_sessions', payload.session_id, {
          last_activity_at: new Date().toISOString(),
        });
      }

      this.logger.info('JWT token validated successfully', {
        userId: payload.sub,
        sessionId: payload.session_id,
      });

      return { valid: true, payload };
    } catch (error) {
      this.logger.error('JWT token validation failed', error);
      return { valid: false, error: 'Invalid token format' };
    }
  }

  async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    this.logger.info('Refreshing JWT tokens');

    try {
      const payload = (await verify(refreshToken, this.jwtSecret, 'HS256')) as JWTPayload;

      // Check if refresh token is still valid
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        this.logger.warn('Refresh token expired', { exp: payload.exp, now });
        return null;
      }

      // Check if session exists and is active
      const { data, error } = await this.db.query<AuthSession>('auth_sessions', {
        filter: { id: payload.session_id, is_active: true },
        limit: 1,
      });

      if (error || !data || data.length === 0) {
        this.logger.warn('Session not found for refresh token', {
          sessionId: payload.session_id,
        });
        return null;
      }

      const session = data[0];

      // Generate new tokens
      const newTokens = await this.generateTokens(payload.sub, {
        email: payload.email,
        role: payload.role,
        nostrPubkey: payload.nostr_pubkey,
      });

      // Deactivate old session
      await this.db.update('auth_sessions', payload.session_id, {
        is_active: false,
      });

      this.logger.info('JWT tokens refreshed successfully', {
        userId: payload.sub,
        oldSessionId: payload.session_id,
        newSessionId: newTokens.session.id,
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      return null;
    }
  }

  async revokeTokens(options: {
    token?: string;
    sessionId?: string;
    userId?: string;
    revokeAll?: boolean;
  }): Promise<boolean> {
    this.logger.info('Revoking JWT tokens', options);

    try {
      if (options.revokeAll && options.userId) {
        // Revoke all sessions for user
        const { error } = await this.db.update('auth_sessions', options.userId, {
          is_active: false,
        });

        if (error) {
          this.logger.error('Failed to revoke all sessions', error);
          return false;
        }

        this.logger.info('All sessions revoked for user', { userId: options.userId });
        return true;
      } else if (options.sessionId) {
        // Revoke specific session
        const { error } = await this.db.update('auth_sessions', options.sessionId, {
          is_active: false,
        });

        if (error) {
          this.logger.error('Failed to revoke session', error);
          return false;
        }

        this.logger.info('Session revoked', { sessionId: options.sessionId });
        return true;
      } else if (options.token) {
        // Extract session from token and revoke
        try {
          const payload = (await verify(options.token, this.jwtSecret, 'HS256')) as JWTPayload;

          if (payload.session_id) {
            return this.revokeTokens({ sessionId: payload.session_id });
          }
        } catch (error) {
          this.logger.warn('Invalid token for revocation', error);
          return false;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Token revocation failed', error);
      return false;
    }
  }
}

// 🎯 Main Edge Function Handler
export default async function handler(req: Request): Promise<Response> {
  const perf = new PerformanceHelper();
  const logger = new Logger('auth-jwt-generate');

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Parse request
    const request = await RequestHelper.parseRequest(req);
    const context = RequestHelper.createContext(request);
    logger.info('Processing JWT auth request', { method: request.method, context });

    // Initialize database and JWT service
    const dbConfig: DatabaseConnection = {
      url: globalThis.Deno?.env.get('SUPABASE_URL') || '',
      key: globalThis.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    };

    const jwtSecret =
      globalThis.Deno?.env.get('JWT_SECRET') || 'default-secret-change-in-production';
    const db = new DatabaseHelper(dbConfig, logger);
    const jwtService = new JWTService(db, logger, jwtSecret);

    // Route based on method and path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter((segment) => segment.length > 0);
    const action = pathSegments[pathSegments.length - 1] || 'generate';

    if (request.method === 'POST') {
      if (action === 'generate') {
        // Generate tokens endpoint
        const validation = ValidationHelper.validateSchema(
          GenerateTokenRequestSchema,
          request.body
        );
        if (!validation.success) {
          return ResponseHelper.validation(
            validation.errors,
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        const tokens = await jwtService.generateTokens(validation.data.userId, {
          email: validation.data.email,
          role: validation.data.role,
          nostrPubkey: validation.data.publicKey,
          ipAddress: validation.data.sessionData?.ip_address || context.ip,
          userAgent: validation.data.sessionData?.user_agent || context.userAgent,
        });

        return ResponseHelper.success<AuthFunctionResponse['data']>(
          {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            session: tokens.session,
          },
          'JWT tokens generated successfully',
          200,
          context.requestId,
          perf.getTotalExecutionTime()
        );
      } else if (action === 'validate') {
        // Validate token endpoint
        const validation = ValidationHelper.validateSchema(
          ValidateTokenRequestSchema,
          request.body
        );
        if (!validation.success) {
          return ResponseHelper.validation(
            validation.errors,
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        const result = await jwtService.validateToken(validation.data.token);

        if (!result.valid) {
          return ResponseHelper.unauthorized(
            result.error || 'Invalid token',
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        return ResponseHelper.success<AuthFunctionResponse['data']>(
          { user: { id: result.payload?.sub } },
          'Token validated successfully',
          200,
          context.requestId,
          perf.getTotalExecutionTime()
        );
      } else if (action === 'refresh') {
        // Refresh tokens endpoint
        const validation = ValidationHelper.validateSchema(RefreshTokenRequestSchema, request.body);
        if (!validation.success) {
          return ResponseHelper.validation(
            validation.errors,
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        const tokens = await jwtService.refreshTokens(validation.data.refreshToken);

        if (!tokens) {
          return ResponseHelper.unauthorized(
            'Invalid or expired refresh token',
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        return ResponseHelper.success<AuthFunctionResponse['data']>(
          {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          },
          'Tokens refreshed successfully',
          200,
          context.requestId,
          perf.getTotalExecutionTime()
        );
      } else if (action === 'revoke') {
        // Revoke tokens endpoint
        const validation = ValidationHelper.validateSchema(RevokeTokenRequestSchema, request.body);
        if (!validation.success) {
          return ResponseHelper.validation(
            validation.errors,
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        const success = await jwtService.revokeTokens(validation.data);

        if (!success) {
          return ResponseHelper.error(
            'Failed to revoke tokens',
            500,
            context.requestId,
            perf.getTotalExecutionTime()
          );
        }

        return ResponseHelper.success(
          { revoked: true },
          'Tokens revoked successfully',
          200,
          context.requestId,
          perf.getTotalExecutionTime()
        );
      } else {
        return ResponseHelper.notFound(
          `Action '${action}' not found`,
          context.requestId,
          perf.getTotalExecutionTime()
        );
      }
    }

    return ResponseHelper.methodNotAllowed(
      ['POST'],
      context.requestId,
      perf.getTotalExecutionTime()
    );
  } catch (error) {
    logger.error('JWT auth function error', error);
    return ResponseHelper.error(
      'Internal server error',
      500,
      undefined,
      perf.getTotalExecutionTime()
    );
  }
}
