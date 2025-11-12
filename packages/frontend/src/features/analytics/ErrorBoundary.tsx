/**
 * Analytics Feature Error Boundary
 *
 * Error boundary for analytics and dashboard features.
 * Analytics errors should not prevent content creation/viewing.
 *
 * @module features/analytics/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary } from '../../components/FeatureErrorBoundary';

interface AnalyticsErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Analytics Error Boundary Component
 */
export const AnalyticsErrorBoundary: React.FC<AnalyticsErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="Analytics"
      maxRetries={3}
      autoRetry={true}
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default AnalyticsErrorBoundary;
