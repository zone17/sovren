import React, { useState } from 'react';
import { useCreateListing } from '../hooks/useMarketplace';
import { SERVICE_TYPE_LABELS } from '../types/community';
import type { ServiceType } from '@shared/types/community';

interface ServiceListingFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ServiceListingForm: React.FC<ServiceListingFormProps> = ({ onSuccess, onCancel }) => {
  const [serviceType, setServiceType] = useState<ServiceType>('editing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceSats, setPriceSats] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState('');

  const createMutation = useCreateListing();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(priceSats, 10);
    if (!title.trim() || isNaN(price) || price <= 0) return;

    const urls = portfolioUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    createMutation.mutate(
      {
        serviceType,
        title: title.trim(),
        description: description.trim() || undefined,
        priceSats: price,
        portfolioUrls: urls,
      },
      { onSuccess }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create service listing">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="serviceType">
          Service type
        </label>
        <select
          id="serviceType"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Professional video editing (up to 10 min)"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe what you offer, turnaround time, etc."
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="priceSats">
          Price (sats)
        </label>
        <input
          id="priceSats"
          type="number"
          min={1}
          value={priceSats}
          onChange={(e) => setPriceSats(e.target.value)}
          placeholder="e.g. 50000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="portfolioUrls">
          Portfolio URLs (one per line)
        </label>
        <textarea
          id="portfolioUrls"
          value={portfolioUrls}
          onChange={(e) => setPortfolioUrls(e.target.value)}
          rows={2}
          placeholder="https://example.com/portfolio"
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!title.trim() || !priceSats || createMutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Listing'}
        </button>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          Failed to create listing. Please try again.
        </p>
      )}
    </form>
  );
};

export default ServiceListingForm;
