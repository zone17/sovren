import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { config } from '../../lib/config/environment';
import { supabase } from '../../lib/database';

// 🔐 STRIPE CLIENT INITIALIZATION
const stripe = new Stripe(config.payments.stripeSecretKey!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🛡️ Security: Method validation
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are accepted',
    });
  }

  // 🔧 Feature flag check
  if (!config.features.enablePayments || !config.payments.isConfigured) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Payment processing is not available',
    });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = config.payments.stripeWebhookSecret;

  if (!sig || !webhookSecret) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Missing Stripe signature or webhook secret',
    });
  }

  let event: Stripe.Event;

  try {
    // 🔐 Verify webhook signature
    event = stripe.webhooks.constructEvent(
      JSON.stringify(req.body),
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({
      error: 'Webhook verification failed',
      message: err.message,
    });
  }

  try {
    // 📊 Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCancellation(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.requires_action':
        await handlePaymentRequiresAction(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      eventType: event.type,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: 'An error occurred while processing the webhook',
    });
  }
}

// 🎉 Handle successful payment
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing successful payment:', paymentIntent.id);

  try {
    // 🔄 Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stripe_data: paymentIntent,
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('Failed to update payment status:', updateError);
      return;
    }

    // 🎁 Process successful payment (e.g., grant access, send confirmation)
    const userId = paymentIntent.metadata?.userId;
    if (userId) {
      await processSuccessfulPayment(userId, paymentIntent);
    }

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// ❌ Handle failed payment
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing failed payment:', paymentIntent.id);

  try {
    // 🔄 Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        updated_at: new Date().toISOString(),
        stripe_data: paymentIntent,
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('Failed to update payment status:', updateError);
      return;
    }

    // 📧 Send failure notification
    const userId = paymentIntent.metadata?.userId;
    if (userId) {
      await sendPaymentFailureNotification(userId, paymentIntent);
    }

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// 🚫 Handle payment cancellation
async function handlePaymentCancellation(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing canceled payment:', paymentIntent.id);

  try {
    // 🔄 Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
        stripe_data: paymentIntent,
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('Failed to update payment status:', updateError);
    }

  } catch (error) {
    console.error('Error handling payment cancellation:', error);
  }
}

// ⚠️ Handle payment requiring action
async function handlePaymentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment requiring action:', paymentIntent.id);

  try {
    // 🔄 Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'requires_action',
        updated_at: new Date().toISOString(),
        stripe_data: paymentIntent,
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('Failed to update payment status:', updateError);
    }

  } catch (error) {
    console.error('Error handling payment requires action:', error);
  }
}

// 🎁 Process successful payment (business logic)
async function processSuccessfulPayment(userId: string, paymentIntent: Stripe.PaymentIntent) {
  try {
    const productId = paymentIntent.metadata?.productId;

    if (productId) {
      // 🎯 Grant product access
      await supabase
        .from('user_purchases')
        .insert({
          user_id: userId,
          product_id: productId,
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency,
          purchased_at: new Date().toISOString(),
        });

      // 📧 Send purchase confirmation
      await sendPurchaseConfirmation(userId, productId, paymentIntent);
    }

    console.log(`Successfully processed payment for user ${userId}`);

  } catch (error) {
    console.error('Error in payment processing business logic:', error);
  }
}

// 📧 Send purchase confirmation (placeholder)
async function sendPurchaseConfirmation(userId: string, productId: string, paymentIntent: Stripe.PaymentIntent) {
  console.log(`Sending purchase confirmation to user ${userId} for product ${productId}`);
  // Implementation would depend on your email service
}

// 📧 Send payment failure notification (placeholder)
async function sendPaymentFailureNotification(userId: string, paymentIntent: Stripe.PaymentIntent) {
  console.log(`Sending payment failure notification to user ${userId}`);
  // Implementation would depend on your email service
}
