import React from 'react';
import type { BusinessTab } from '../types';

interface BusinessNavProps {
  activeTab: BusinessTab;
  onTabChange: (tab: BusinessTab) => void;
}

const TABS: { id: BusinessTab; label: string }[] = [
  { id: 'contracts', label: 'Contracts' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'tax', label: 'Tax' },
];

const BusinessNav: React.FC<BusinessNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="flex border-b border-border bg-card"
      role="tablist"
      aria-label="Business Manager navigation"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          className={`px-6 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset ${
            activeTab === tab.id
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-border'
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
};

export default BusinessNav;
