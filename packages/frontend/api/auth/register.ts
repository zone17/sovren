import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { supabase } from '../../lib/database';
import { rateLimiter } from '../../lib/middleware/rateLimit';
import { emailSchema, nameSchema, passwordSchema, validateRequest } from '../../lib/middleware/validation';

// 🔐 ELITE REGISTRATION VALIDATION SCHEMA
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

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
    // 🚦 Rate limiting protection (stricter for registration)
    const rateLimitResult = await rateLimiter(req, res, 'register');
    if (!rateLimitResult.success) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many registration attempts. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        timestamp: new Date().toISOString()
      });
    }

    // 📊 Request validation with enhanced security
    const validation = validateRequest(req.body, registerSchema, {
      maxFieldLength: 1000,
      allowedFields: ['email', 'password', 'confirmPassword', 'name'],
      sanitize: true,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid registration data',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const { email, password, name } = validation.data!;

    // 👀 Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
        code: 'USER_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    // 🔑 Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          registration_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          registration_user_agent: req.headers['user-agent'],
        }
      }
    });

    if (error) {
      console.error('Registration error:', error);

      // 🚨 Enhanced error handling
      if (error.message.includes('User already registered')) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists',
          code: 'USER_EXISTS',
          timestamp: new Date().toISOString()
        });
      }

      if (error.message.includes('Password should be at least')) {
        return res.status(400).json({
          error: 'Password validation failed',
          message: 'Password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          timestamp: new Date().toISOString()
        });
      }

      return res.status(500).json({
        error: 'Registration failed',
        message: 'Unable to create account at this time',
        code: 'REGISTRATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // 👤 Create user profile in database
    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email!,
          name: name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue - user created in auth but profile creation failed
        // This can be handled by a background job or user update later
      }
    }

    // ✅ Elite success response
    const response: any = {
      success: true,
      message: data.user?.email_confirmed_at
        ? 'Registration successful'
        : 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          name: name,
          emailVerified: !!data.user?.email_confirmed_at,
          createdAt: data.user?.created_at,
        },
        requiresEmailVerification: !data.user?.email_confirmed_at,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        registrationMethod: 'email',
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    };

    // 📧 Email verification required
    if (!data.user?.email_confirmed_at) {
      response.data.session = null;
      return res.status(201).json(response);
    }

    // 🎉 Auto-login if email verified
    if (data.session) {
      response.data.session = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        tokenType: data.session.token_type,
      };
    }

    return res.status(201).json(response);

  } catch (error) {
    console.error('Registration error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during registration',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-vercel-id'] || 'unknown'
    });
  }
}
