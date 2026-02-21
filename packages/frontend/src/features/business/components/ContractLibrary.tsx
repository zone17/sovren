import React, { useState } from 'react';
import { useContractTemplates, useContracts } from '../hooks/useContracts';
import type { ContractCategory } from '@shared/types/finance';

interface ContractLibraryProps {
  onSelectTemplate: (id: string) => void;
}

const CATEGORY_LABELS: Record<ContractCategory, string> = {
  sponsorship: 'Sponsorship',
  licensing: 'Licensing',
  freelance: 'Freelance',
  collaboration: 'Collaboration',
  general: 'General',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  expired: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-700',
};

const ContractLibrary: React.FC<ContractLibraryProps> = ({ onSelectTemplate }) => {
  const [categoryFilter, setCategoryFilter] = useState<ContractCategory | 'all'>('all');

  const { data: templates, isLoading: templatesLoading } = useContractTemplates();
  const { data: contracts, isLoading: contractsLoading } = useContracts();

  const filteredTemplates =
    templates?.filter((t) => categoryFilter === 'all' || t.category === categoryFilter) ?? [];

  if (templatesLoading || contractsLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-24 rounded bg-gray-100" />
        <div className="h-24 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Templates */}
      <section aria-labelledby="templates-heading">
        <div className="flex items-center justify-between">
          <h3 id="templates-heading" className="text-base font-semibold text-gray-900">
            Contract Templates
          </h3>
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ContractCategory | 'all')}
            aria-label="Filter templates by category"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {filteredTemplates.map((template) => (
            <li key={template.id}>
              <button
                className="w-full rounded-lg border border-gray-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                onClick={() => onSelectTemplate(template.id)}
                aria-label={`Use template: ${template.name}`}
              >
                <span className="block text-sm font-medium text-gray-900">{template.name}</span>
                <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                  {CATEGORY_LABELS[template.category]}
                </span>
                {template.redFlags.length > 0 && (
                  <span className="mt-1 ml-1 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                    {template.redFlags.length} flags
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {filteredTemplates.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">No templates found for selected category.</p>
        )}
      </section>

      {/* My Contracts */}
      <section aria-labelledby="contracts-heading">
        <h3 id="contracts-heading" className="text-base font-semibold text-gray-900">
          My Contracts
        </h3>

        {contracts && contracts.length > 0 ? (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white" role="list">
            {contracts.map((contract) => (
              <li key={contract.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">{contract.counterparty}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {new Date(contract.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[contract.status] ?? STATUS_STYLES.draft}`}
                >
                  {contract.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No contracts yet. Start from a template above.</p>
        )}
      </section>
    </div>
  );
};

export default ContractLibrary;
