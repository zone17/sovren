import React, { useState } from 'react';
import { CreatorNetworkErrorBoundary } from '../ErrorBoundary';
import CommunityNav from './CommunityNav';
import CirclesBrowser from './CirclesBrowser';
import MentorDirectory from './MentorDirectory';
import MentorshipDashboard from './MentorshipDashboard';
import MarketplaceBrowser from './MarketplaceBrowser';

type CommunityTab = 'circles' | 'mentorship' | 'collaborations' | 'marketplace';

const CreatorNetworkDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CommunityTab>('circles');

  return (
    <CreatorNetworkErrorBoundary featureName="Creator Network">
      <div className="space-y-6 p-6 bg-background min-h-screen">
        {/* Header */}
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Community
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with creators, find mentors, collaborate, and discover services.
          </p>
        </div>

        {/* Navigation */}
        <CommunityNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab panels */}
        <div role="tabpanel" id={`panel-${activeTab}`}>
          {activeTab === 'circles' && <CirclesBrowser />}

          {activeTab === 'mentorship' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MentorshipDashboard />
              <MentorDirectory />
            </div>
          )}

          {activeTab === 'collaborations' && (
            <div className="rounded-lg border border-border glass p-6">
              <p className="text-sm text-muted-foreground">
                Select a piece of content to manage collaborators and revenue splits.
              </p>
            </div>
          )}

          {activeTab === 'marketplace' && <MarketplaceBrowser />}
        </div>
      </div>
    </CreatorNetworkErrorBoundary>
  );
};

export default CreatorNetworkDashboard;
