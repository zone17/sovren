/**
 * 💳 **SUBSCRIPTION CARD COMPONENT**
 *
 * Reusable subscription display card for both creator and user subscription views
 *
 * Story: PAY-005 - Build Subscription Management UI Components
 *
 * Elite Engineering Standards:
 * - Full TypeScript type safety
 * - Accessible (WCAG 2.1 AA)
 * - Mobile-responsive design
 * - Proper semantic HTML
 * - Comprehensive props interface
 *
 * @module SubscriptionCard
 */

import React from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Crown,
  Shield,
  Star,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { formatSats } from '../../../shared/utils/formatSats';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';

// 🏷️ **TYPE DEFINITIONS**

/**
 * Subscription status types
 */
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';

/**
 * Billing interval types
 */
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly';

/**
 * Subscription data interface
 */
export interface Subscription {
  id: string;
  name: string;
  description?: string;
  tierName?: string;
  amount: number; // in satoshis
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  startDate: string;
  endDate: string;
  nextPaymentDate?: string;
  autoRenew: boolean;
  benefits?: string[];
  subscriberCount?: number;
  avatarUrl?: string;
}

/**
 * Component props interface
 */
export interface SubscriptionCardProps {
  /**
   * Subscription data to display
   */
  subscription: Subscription;

  /**
   * Variant determines the card layout and displayed information
   * - 'user': For end-users viewing their subscriptions
   * - 'creator': For creators viewing their subscription tiers
   */
  variant?: 'user' | 'creator';

  /**
   * Optional actions to display on the card
   */
  actions?: {
    onView?: (subscription: Subscription) => void;
    onEdit?: (subscription: Subscription) => void;
    onPause?: (subscription: Subscription) => void;
    onResume?: (subscription: Subscription) => void;
    onCancel?: (subscription: Subscription) => void;
    onDelete?: (subscription: Subscription) => void;
  };

  /**
   * Show detailed stats (creator variant only)
   */
  showStats?: boolean;

  /**
   * Custom className for styling
   */
  className?: string;

  /**
   * Disable all action buttons
   */
  disabled?: boolean;
}

// 🎨 **HELPER FUNCTIONS**

/**
 * Convert satoshis to approximate USD (assumes $30,000 per BTC)
 */
const satsToUSD = (sats: number): string => {
  return ((sats / 100000000) * 30000).toFixed(2);
};

/**
 * Get billing period label
 */
const getBillingLabel = (interval: BillingInterval): string => {
  switch (interval) {
    case 'monthly':
      return '/month';
    case 'quarterly':
      return '/3 months';
    case 'yearly':
      return '/year';
    default:
      return '';
  }
};

/**
 * Get status badge color classes
 */
const getStatusColor = (status: SubscriptionStatus): string => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'expired':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'pending':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Get status icon component
 */
const getStatusIcon = (status: SubscriptionStatus) => {
  const className = 'h-4 w-4';
  switch (status) {
    case 'active':
      return <CheckCircle className={className} aria-label="Active status" />;
    case 'paused':
      return <Clock className={className} aria-label="Paused status" />;
    case 'cancelled':
      return <XCircle className={className} aria-label="Cancelled status" />;
    case 'expired':
      return <AlertCircle className={className} aria-label="Expired status" />;
    case 'pending':
      return <Clock className={className} aria-label="Pending status" />;
    default:
      return null;
  }
};

/**
 * Get tier icon based on tier name
 */
const getTierIcon = (tierName?: string) => {
  if (!tierName) return <Shield className="h-5 w-5 text-blue-500" />;

  const lowerName = tierName.toLowerCase();
  if (lowerName.includes('premium') || lowerName.includes('elite')) {
    return <Crown className="h-5 w-5 text-yellow-500" aria-label="Premium tier" />;
  }
  if (lowerName.includes('pro')) {
    return <Star className="h-5 w-5 text-purple-500" aria-label="Pro tier" />;
  }
  return <Shield className="h-5 w-5 text-blue-500" aria-label="Basic tier" />;
};

/**
 * Calculate days until next payment
 */
const calculateDaysUntil = (dateString: string): number => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

// 📦 **SUBSCRIPTION CARD COMPONENT**

/**
 * SubscriptionCard Component
 *
 * A reusable card component for displaying subscription information
 * with optional actions and customizable layout.
 *
 * @example
 * ```tsx
 * <SubscriptionCard
 *   subscription={subscriptionData}
 *   variant="user"
 *   actions={{
 *     onView: handleView,
 *     onPause: handlePause,
 *     onCancel: handleCancel,
 *   }}
 * />
 * ```
 */
export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  variant = 'user',
  actions,
  showStats = false,
  className = '',
  disabled = false,
}) => {
  const daysUntilPayment = subscription.nextPaymentDate
    ? calculateDaysUntil(subscription.nextPaymentDate)
    : null;

  const cardClassName = `transition-all duration-200 hover:shadow-lg ${
    subscription.status === 'active' ? 'border-green-200' : 'border-gray-200'
  } ${className}`;

  return (
    <Card
      className={cardClassName}
      role="article"
      aria-label={`Subscription: ${subscription.name}`}
    >
      {/* HEADER */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar/Icon */}
            {subscription.avatarUrl ? (
              <img
                src={subscription.avatarUrl}
                alt={`${subscription.name} avatar`}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                aria-label="Subscription avatar"
              >
                {subscription.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Title and Description */}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2 truncate">
                {subscription.tierName && getTierIcon(subscription.tierName)}
                {subscription.name}
              </CardTitle>
              {subscription.description && (
                <CardDescription className="text-sm mt-1 line-clamp-2">
                  {subscription.description}
                </CardDescription>
              )}
              {subscription.tierName && (
                <CardDescription className="text-sm mt-1 font-medium">
                  {subscription.tierName}
                </CardDescription>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            className={`${getStatusColor(subscription.status)} flex items-center gap-1 flex-shrink-0 ml-2`}
          >
            {getStatusIcon(subscription.status)}
            <span className="capitalize">{subscription.status}</span>
          </Badge>
        </div>

        {/* Pricing */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-baseline gap-2">
            <Zap className="h-4 w-4 text-yellow-500" aria-hidden="true" />
            <span className="text-2xl font-bold text-gray-900">
              {formatSats(subscription.amount, { abbreviate: true, suffix: false })}
            </span>
            <span className="text-sm text-gray-600">
              {getBillingLabel(subscription.billingInterval)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">≈ ${satsToUSD(subscription.amount)} USD</p>
        </div>
      </CardHeader>

      {/* CONTENT */}
      <CardContent className="space-y-4">
        {/* Subscription Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              Start Date
            </p>
            <p className="font-medium">{new Date(subscription.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-600 flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              End Date
            </p>
            <p className="font-medium">{new Date(subscription.endDate).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Next Payment Countdown */}
        {subscription.status === 'active' && subscription.nextPaymentDate && (
          <div
            className={`p-3 rounded-lg ${
              daysUntilPayment !== null && daysUntilPayment <= 7
                ? 'bg-orange-50 border border-orange-200'
                : 'bg-blue-50 border border-blue-200'
            }`}
          >
            <p className="text-sm font-medium text-gray-700">Next Payment</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-600">
                {new Date(subscription.nextPaymentDate).toLocaleDateString()}
              </p>
              {daysUntilPayment !== null && (
                <Badge variant="outline" className="text-xs">
                  {daysUntilPayment > 0 ? `${daysUntilPayment} days` : 'Due today'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Benefits */}
        {subscription.benefits && subscription.benefits.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Benefits:</p>
            <ul className="space-y-1">
              {subscription.benefits.slice(0, 3).map((benefit, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle
                    className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{benefit}</span>
                </li>
              ))}
              {subscription.benefits.length > 3 && (
                <li className="text-xs text-gray-500 ml-6">
                  +{subscription.benefits.length - 3} more benefits
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Stats (Creator variant) */}
        {variant === 'creator' && showStats && subscription.subscriberCount !== undefined && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-600" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">Subscribers</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {subscription.subscriberCount}
              </span>
            </div>
          </div>
        )}

        {/* Auto-Renew Status */}
        {subscription.status === 'active' && (
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
            <span className="text-sm text-gray-700">Auto-renew</span>
            <Badge variant={subscription.autoRenew ? 'default' : 'secondary'}>
              {subscription.autoRenew ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        )}
      </CardContent>

      {/* FOOTER - ACTIONS */}
      {actions && (
        <CardFooter className="flex flex-wrap gap-2">
          {actions.onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onView!(subscription)}
              disabled={disabled}
              aria-label="View subscription details"
            >
              View Details
            </Button>
          )}

          {actions.onEdit && variant === 'creator' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onEdit!(subscription)}
              disabled={disabled}
              aria-label="Edit subscription"
            >
              Edit
            </Button>
          )}

          {subscription.status === 'active' && actions.onPause && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onPause!(subscription)}
              disabled={disabled}
              className="text-orange-600 hover:text-orange-700"
              aria-label="Pause subscription"
            >
              Pause
            </Button>
          )}

          {subscription.status === 'paused' && actions.onResume && (
            <Button
              variant="default"
              size="sm"
              onClick={() => actions.onResume!(subscription)}
              disabled={disabled}
              aria-label="Resume subscription"
            >
              Resume
            </Button>
          )}

          {(subscription.status === 'active' || subscription.status === 'paused') &&
            actions.onCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => actions.onCancel!(subscription)}
                disabled={disabled}
                aria-label="Cancel subscription"
              >
                Cancel
              </Button>
            )}

          {actions.onDelete && variant === 'creator' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => actions.onDelete!(subscription)}
              disabled={disabled}
              className="text-red-600 hover:text-red-700 ml-auto"
              aria-label="Delete subscription tier"
            >
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
};
