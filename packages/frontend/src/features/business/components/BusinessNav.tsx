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
      className="flex border-b border-gray-200 bg-white"
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
              : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
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
