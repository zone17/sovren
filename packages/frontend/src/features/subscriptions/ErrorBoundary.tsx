import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface SubscriptionsErrorBoundaryProps {
  children: React.ReactNode;
}

export const SubscriptionsErrorBoundary: React.FC<SubscriptionsErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="Subscriptions">
      {children}
    </ErrorBoundary>
  );
};

export default SubscriptionsErrorBoundary;
