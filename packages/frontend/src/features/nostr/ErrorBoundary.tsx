import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface NostrErrorBoundaryProps {
  children: React.ReactNode;
}

export const NostrErrorBoundary: React.FC<NostrErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="NOSTR Protocol">
      {children}
    </ErrorBoundary>
  );
};

export default NostrErrorBoundary;
