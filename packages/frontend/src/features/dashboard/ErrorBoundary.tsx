import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
}

export const DashboardErrorBoundary: React.FC<DashboardErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="Dashboard">
      {children}
    </ErrorBoundary>
  );
};

export default DashboardErrorBoundary;
