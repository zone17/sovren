import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface AnalyticsErrorBoundaryProps {
  children: React.ReactNode;
}

export const AnalyticsErrorBoundary: React.FC<AnalyticsErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="Analytics">
      {children}
    </ErrorBoundary>
  );
};

export default AnalyticsErrorBoundary;
