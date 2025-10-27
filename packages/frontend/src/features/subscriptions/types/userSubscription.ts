/**
 * 💳 **USER SUBSCRIPTION TYPE DEFINITIONS**
 *
 * Comprehensive type definitions for user subscription management
 * Stories: US-079, US-080, US-081, US-082
 */

export interface UserSubscription {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  tier_name: string;
  tier_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';
  amount_sats: number;
  billing_interval: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  payment_method_id: string;
  last_payment_date?: string;
  next_payment_date?: string;
  benefits: string[];
  usage_stats?: {
    content_accessed: number;
    total_value_received: number;
  };
}

export interface PaymentMethod {
  id: string;
  type: 'lightning' | 'bitcoin' | 'nostr';
  name: string;
  identifier: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
  last_used?: string;
  failure_count: number;
}

export interface SubscriptionHistory {
  id: string;
  subscription_id: string;
  creator_name: string;
  tier_name: string;
  amount_sats: number;
  action: 'subscribed' | 'renewed' | 'cancelled' | 'paused' | 'resumed';
  date: string;
  payment_hash?: string;
  notes?: string;
}

export interface RenewalSettings {
  auto_renew: boolean;
  notifications: {
    seven_days_before: boolean;
    one_day_before: boolean;
    after_renewal: boolean;
  };
  failure_handling: {
    retry_failed_payments: boolean;
    notify_failures: boolean;
    max_retries: number;
  };
}
