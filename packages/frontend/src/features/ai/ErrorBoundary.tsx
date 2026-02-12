import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface AIErrorBoundaryProps {
  children: React.ReactNode;
}

export const AIErrorBoundary: React.FC<AIErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="AI Features">
      {children}
    </ErrorBoundary>
  );
};

export default AIErrorBoundary;
