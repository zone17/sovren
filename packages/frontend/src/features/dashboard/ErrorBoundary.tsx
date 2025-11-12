/**
 * Dashboard Feature Error Boundary
 *
 * Error boundary for monitoring and creator dashboard features.
 * Provides graceful degradation for dashboard failures.
 *
 * @module features/dashboard/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary } from '../../components/FeatureErrorBoundary';

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Dashboard Error Boundary Component
 */
export const DashboardErrorBoundary: React.FC<DashboardErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="Dashboard"
      maxRetries={3}
      autoRetry={true}
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default DashboardErrorBoundary;
