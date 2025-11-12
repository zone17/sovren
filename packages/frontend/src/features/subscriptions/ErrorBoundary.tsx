/**
 * Subscriptions Feature Error Boundary
 *
 * Error boundary for subscription and payment features.
 * Critical feature that requires careful error handling.
 *
 * @module features/subscriptions/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary } from '../../components/FeatureErrorBoundary';

interface SubscriptionsErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Subscriptions Error Boundary Component
 */
export const SubscriptionsErrorBoundary: React.FC<SubscriptionsErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="Subscriptions"
      maxRetries={2}
      autoRetry={false} // Don't auto-retry payment features
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default SubscriptionsErrorBoundary;
