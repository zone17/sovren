/**
 * 💳 **SUBSCRIPTIONS FEATURE BARREL EXPORT**
 *
 * Main entry point for all subscription-related functionality
 * Story: PAY-005 - Build Subscription Management UI Components
 *
 * @module features/subscriptions
 */

// Components
export {
  SubscriptionManager,
  UserSubscriptionManager,
  SubscriptionCard,
} from './components';

export type {
  SubscriptionCardProps,
  Subscription,
  SubscriptionStatus,
  BillingInterval,
} from './components';

// Services
export { useUserSubscriptionService } from './services/useUserSubscriptionService';

// Types
export type {
  UserSubscription,
  PaymentMethod,
  SubscriptionHistory,
} from './types';
