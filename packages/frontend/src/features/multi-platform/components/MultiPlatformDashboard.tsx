import React from 'react';
import { DistributionErrorBoundary } from '../ErrorBoundary';
import CrossPlatformAnalytics from './CrossPlatformAnalytics';
import PlatformConnector from './PlatformConnector';
import UnifiedInbox from './UnifiedInbox';

export const MultiPlatformDashboard: React.FC = () => {
  return (
    <DistributionErrorBoundary>
      <div className="space-y-6 p-6 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 min-h-screen">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Platform Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect, publish, and manage your content across all platforms from one place.
          </p>
        </div>

        {/* Platform connections + Analytics overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PlatformConnector />
          <div className="lg:col-span-2">
            <CrossPlatformAnalytics />
          </div>
        </div>

        {/* Unified Inbox */}
        <UnifiedInbox />
      </div>
    </DistributionErrorBoundary>
  );
};

export default MultiPlatformDashboard;
