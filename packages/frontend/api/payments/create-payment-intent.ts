import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { z } from 'zod';
import { config } from '../../lib/config/environment';
import { supabase } from '../../lib/database';
import { rateLimiter } from '../../lib/middleware/rateLimit';
import { amountSchema, validateRequest } from '../../lib/middleware/validation';

// 🔐 STRIPE CLIENT INITIALIZATION
const stripe = new Stripe(config.payments.stripeSecretKey!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// 🔐 AUTHENTICATION MIDDLEWARE
async function authenticateUser(req: VercelRequest): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return { user };
  } catch (error) {
    return { user: null, error: 'Authentication failed' };
  }
}

// 💳 PAYMENT INTENT VALIDATION SCHEMA
const createPaymentIntentSchema = z.object({
  amount: amountSchema,
  currency: z.enum(['usd', 'eur', 'gbp']).default('usd'),
  productId: z.string().uuid('Invalid product ID').optional(),
  metadata: z.record(z.string()).optional(),
  description: z.string().max(500, 'Description too long').optional(),
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

  // 🔧 Feature flag check
  if (!config.features.enablePayments) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Payment processing is currently disabled',
      timestamp: new Date().toISOString()
    });
  }

  // 🔑 Stripe configuration check
  if (!config.payments.isConfigured) {
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Payment processing is not properly configured',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 🚦 Rate limiting protection
    const rateLimitResult = await rateLimiter(req, res, 'payments');
    if (!rateLimitResult.success) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many payment requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        timestamp: new Date().toISOString()
      });
    }

    // 🔐 Authentication required
    const auth = await authenticateUser(req);
    if (auth.error) {
      return res.status(401).json({
        error: 'Authentication required',
        message: auth.error,
        timestamp: new Date().toISOString()
      });
    }

    const currentUser = auth.user;

    // 📊 Request validation
    const validation = validateRequest(req.body, createPaymentIntentSchema, {
      maxFieldLength: 1000,
      allowedFields: ['amount', 'currency', 'productId', 'metadata', 'description'],
      sanitize: true,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid payment data',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const { amount, currency = 'usd', productId, metadata, description } = validation.data!;

    // 💰 Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // 📋 Prepare payment intent metadata
    const paymentMetadata: Stripe.MetadataParam = {
      userId: currentUser.id,
      userEmail: currentUser.email,
      ...(productId && { productId }),
      ...(metadata && metadata),
      createdAt: new Date().toISOString(),
    };

    // 💳 Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: paymentMetadata,
      description: description || `Payment for ${currentUser.email}`,
      receipt_email: currentUser.email,
    });

    // 🗄️ Store payment record in database
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        id: paymentIntent.id,
        user_id: currentUser.id,
        amount: amount,
        currency: currency.toLowerCase(),
        status: paymentIntent.status,
        product_id: productId || null,
        stripe_payment_intent_id: paymentIntent.id,
        metadata: paymentMetadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Payment record creation error:', dbError);
      // Continue - payment intent created but record not stored
      // This can be handled by webhook or background job
    }

    // ✅ Elite success response
    return res.status(201).json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: currency,
        status: paymentIntent.status,
        metadata: {
          productId,
          description,
        }
      },
      timestamp: new Date().toISOString(),
      metadata: {
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    });

  } catch (error) {
    console.error('Payment intent creation error:', error);

    // 🚨 Enhanced Stripe error handling
    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({
        error: 'Payment processing error',
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during payment processing',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-vercel-id'] || 'unknown'
    });
  }
}
