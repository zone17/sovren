/**
 * 🏷️ **SUBSCRIPTION TYPES BARREL EXPORT**
 *
 * Centralized exports for all subscription-related TypeScript types
 * Story: PAY-005 - Build Subscription Management UI Components
 *
 * @module features/subscriptions/types
 */

// Re-export from userSubscription.ts
export type {
  UserSubscription,
  PaymentMethod,
  SubscriptionHistory,
} from './userSubscription';

// Re-export from SubscriptionCard component
export type {
  Subscription,
  SubscriptionStatus,
  BillingInterval,
} from '../components/SubscriptionCard';
