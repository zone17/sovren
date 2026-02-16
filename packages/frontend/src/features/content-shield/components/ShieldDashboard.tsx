import React from 'react';
import { ContentShieldErrorBoundary } from '../ErrorBoundary';
import AlertsFeed from './AlertsFeed';
import FingerprintCoverage from './FingerprintCoverage';

// Placeholder for creator ID — in production this comes from auth context
const PLACEHOLDER_CREATOR_ID = 'current-creator';

export const ShieldDashboard: React.FC = () => {
  return (
    <ContentShieldErrorBoundary>
      <div className="space-y-6 p-6 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 min-h-screen">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Shield</h1>
          <p className="text-sm text-gray-500 mt-1">
            Protect your content with cryptographic provenance and copy detection.
          </p>
        </div>

        {/* Coverage */}
        <FingerprintCoverage creatorId={PLACEHOLDER_CREATOR_ID} />

        {/* Alerts */}
        <AlertsFeed />
      </div>
    </ContentShieldErrorBoundary>
  );
};

export default ShieldDashboard;
