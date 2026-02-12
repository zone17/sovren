import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface ContentErrorBoundaryProps {
  children: React.ReactNode;
}

export const ContentErrorBoundary: React.FC<ContentErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="Content Management">
      {children}
    </ErrorBoundary>
  );
};

export default ContentErrorBoundary;
