import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { supabase } from '../../lib/database';
import { rateLimiter } from '../../lib/middleware/rateLimit';
import { validateRequest } from '../../lib/middleware/validation';

// 🔐 ELITE LOGIN VALIDATION SCHEMA
const loginSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🛡️ Security: Method validation
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are accepted',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 🚦 Rate limiting protection
    const rateLimitResult = await rateLimiter(req, res, 'login');
    if (!rateLimitResult.success) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        timestamp: new Date().toISOString()
      });
    }

    // 📊 Request validation
    const validation = validateRequest(req.body, loginSchema);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid request data',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const { email, password } = validation.data;

    // 🔑 Supabase authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 🚨 Enhanced error handling with security considerations
      const isInvalidCredentials = error.message.includes('Invalid login credentials');

      return res.status(401).json({
        error: 'Authentication failed',
        message: isInvalidCredentials
          ? 'Invalid email or password'
          : 'Authentication service unavailable',
        code: isInvalidCredentials ? 'INVALID_CREDENTIALS' : 'SERVICE_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // 👤 Fetch user profile data
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, name, created_at, updated_at')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    // ✅ Elite success response
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: profile?.name || null,
          emailVerified: data.user.email_confirmed_at !== null,
          lastSignIn: data.user.last_sign_in_at,
        },
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
          tokenType: data.session.token_type,
        }
      },
      timestamp: new Date().toISOString(),
      metadata: {
        loginMethod: 'email',
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during login',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-vercel-id'] || 'unknown'
    });
  }
}
