import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface FeatureErrorBoundaryProps {
  children: React.ReactNode;
}

export function createFeatureErrorBoundary(
  featureName: string
): React.FC<FeatureErrorBoundaryProps> {
  const FeatureErrorBoundary: React.FC<FeatureErrorBoundaryProps> = ({ children }) => {
    return (
      <ErrorBoundary level="feature" featureName={featureName}>
        {children}
      </ErrorBoundary>
    );
  };

  FeatureErrorBoundary.displayName = `${featureName.replace(/\s+/g, '')}ErrorBoundary`;

  return FeatureErrorBoundary;
}
