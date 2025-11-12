/**
 * NOSTR Feature Error Boundary
 *
 * Error boundary for NOSTR protocol features.
 * Handles relay connection failures and protocol errors.
 *
 * @module features/nostr/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary } from '../../components/FeatureErrorBoundary';

interface NostrErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * NOSTR Error Boundary Component
 */
export const NostrErrorBoundary: React.FC<NostrErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="NOSTR Protocol"
      maxRetries={3}
      autoRetry={true}
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default NostrErrorBoundary;
