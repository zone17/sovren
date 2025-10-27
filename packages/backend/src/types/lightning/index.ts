import { z } from 'zod';

/**
 * Lightning Invoice schema
 */
export const LightningInvoiceSchema = z.object({
  paymentRequest: z.string().min(1),
  paymentHash: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
  expiresAt: z.number(),
  createdAt: z.number(),
  settled: z.boolean().default(false),
  settledAt: z.number().optional(),
  preimage: z.string().optional(),
});

export type LightningInvoice = z.infer<typeof LightningInvoiceSchema>;

/**
 * Lightning Payment schema
 */
export const LightningPaymentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  paymentHash: z.string().min(1),
  paymentRequest: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
  status: z.enum(['pending', 'settled', 'failed', 'expired']),
  createdAt: z.number(),
  settledAt: z.number().optional(),
  expiresAt: z.number(),
  metadata: z.record(z.string()).optional(),
});

export type LightningPayment = z.infer<typeof LightningPaymentSchema>;

/**
 * Lightning Subscription schema
 */
export const LightningSubscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  creatorId: z.string().min(1),
  status: z.enum(['active', 'inactive', 'pending', 'expired']),
  tier: z.string().min(1),
  amount: z.number().positive(),
  interval: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.number(),
  endDate: z.number().optional(),
  nextPaymentDate: z.number(),
  lastPaymentDate: z.number().optional(),
  lastPaymentHash: z.string().optional(),
  canceledAt: z.number().optional(),
  metadata: z.record(z.string()).optional(),
});

export type LightningSubscription = z.infer<typeof LightningSubscriptionSchema>;

/**
 * Lightning Channel schema
 */
export const LightningChannelSchema = z.object({
  channelId: z.string().min(1),
  remotePubkey: z.string().min(1),
  capacity: z.number().positive(),
  localBalance: z.number().nonnegative(),
  remoteBalance: z.number().nonnegative(),
  active: z.boolean(),
  numUpdates: z.number().nonnegative(),
  private: z.boolean(),
  createdAt: z.number(),
});

export type LightningChannel = z.infer<typeof LightningChannelSchema>;

/**
 * Lightning Node Info schema
 */
export const LightningNodeInfoSchema = z.object({
  pubkey: z.string().min(1),
  alias: z.string().optional(),
  numActiveChannels: z.number().nonnegative(),
  numPendingChannels: z.number().nonnegative(),
  numInactiveChannels: z.number().nonnegative(),
  syncedToChain: z.boolean(),
  blockHeight: z.number().nonnegative(),
  totalCapacity: z.number().nonnegative(),
});

export type LightningNodeInfo = z.infer<typeof LightningNodeInfoSchema>;

/**
 * Lightning Payout schema
 */
export const LightningPayoutSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().min(1),
  amount: z.number().positive(),
  destination: z.string().min(1),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  paymentHash: z.string().optional(),
  paymentPreimage: z.string().optional(),
  fee: z.number().nonnegative(),
  createdAt: z.number(),
  processedAt: z.number().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export type LightningPayout = z.infer<typeof LightningPayoutSchema>;

/**
 * Lightning Payment Request schema for API
 */
export const CreateInvoiceRequestSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
  expirySeconds: z.number().positive().default(3600),
  metadata: z.record(z.string()).optional(),
});

export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceRequestSchema>;

/**
 * Lightning Payment Response schema for API
 */
export const PaymentResponseSchema = z.object({
  success: z.boolean(),
  paymentHash: z.string().optional(),
  error: z.string().optional(),
  preimage: z.string().optional(),
  fee: z.number().nonnegative().optional(),
});

export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
