import React from 'react';

type CommunityTab = 'circles' | 'mentorship' | 'collaborations' | 'marketplace';

interface CommunityNavProps {
  activeTab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
}

const TABS: Array<{ id: CommunityTab; label: string }> = [
  { id: 'circles', label: 'Circles' },
  { id: 'mentorship', label: 'Mentorship' },
  { id: 'collaborations', label: 'Collaborations' },
  { id: 'marketplace', label: 'Marketplace' },
];

const CommunityNav: React.FC<CommunityNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav aria-label="Community sections" className="border-b border-border">
      <div className="flex space-x-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            onClick={() => onTabChange(id)}
            className={[
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              activeTab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default CommunityNav;
