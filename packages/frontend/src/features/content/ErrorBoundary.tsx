/**
 * Content Feature Error Boundary
 *
 * Error boundary for content management and CMS features.
 * Allows users to continue using the app even if content features fail.
 *
 * @module features/content/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary } from '../../components/FeatureErrorBoundary';

interface ContentErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Content Error Boundary Component
 */
export const ContentErrorBoundary: React.FC<ContentErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="Content Management"
      maxRetries={3}
      autoRetry={true}
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default ContentErrorBoundary;
