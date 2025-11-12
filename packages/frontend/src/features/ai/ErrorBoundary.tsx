/**
 * AI Feature Error Boundary
 *
 * Error boundary for AI-powered features (recommendations, analytics, etc.).
 * AI features are non-critical and should fail gracefully.
 *
 * @module features/ai/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary } from '../../components/FeatureErrorBoundary';

interface AIErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * AI Error Boundary Component
 */
export const AIErrorBoundary: React.FC<AIErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="AI Features"
      maxRetries={3}
      autoRetry={true}
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default AIErrorBoundary;
