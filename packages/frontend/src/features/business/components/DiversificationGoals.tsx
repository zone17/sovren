import React, { useState, useEffect } from 'react';
import { useDiversificationGoals, useUpdateDiversificationGoals } from '../hooks/useRevenue';
import type { RevenueSource } from '@shared/types/finance';

const REVENUE_SOURCES: RevenueSource[] = [
  'subscriptions',
  'tips',
  'sponsorships',
  'services',
  'affiliate',
  'marketplace',
  'other',
];

const SOURCE_LABELS: Record<RevenueSource, string> = {
  subscriptions: 'Subscriptions',
  tips: 'Tips',
  sponsorships: 'Sponsorships',
  services: 'Services',
  affiliate: 'Affiliate',
  marketplace: 'Marketplace',
  other: 'Other',
};

type Distribution = Record<RevenueSource, number>;

const DEFAULT_DISTRIBUTION: Distribution = {
  subscriptions: 0,
  tips: 0,
  sponsorships: 0,
  services: 0,
  affiliate: 0,
  marketplace: 0,
  other: 0,
};

const DiversificationGoals: React.FC = () => {
  const { data: goals, isLoading } = useDiversificationGoals();
  const updateMutation = useUpdateDiversificationGoals();

  const [distribution, setDistribution] = useState<Distribution>(DEFAULT_DISTRIBUTION);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (goals?.targetDistribution) {
      setDistribution({ ...DEFAULT_DISTRIBUTION, ...(goals.targetDistribution as Distribution) });
      setDirty(false);
    }
  }, [goals]);

  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);
  const isValid = Math.abs(total - 100) < 0.01;

  const updateSource = (source: RevenueSource, value: number) => {
    setDistribution((prev) => ({ ...prev, [source]: Math.max(0, Math.min(100, value)) }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!isValid) return;
    updateMutation.mutate(distribution as Record<string, number>, {
      onSuccess: () => setDirty(false),
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-48 rounded bg-gray-200" />
        {REVENUE_SOURCES.slice(0, 4).map((s) => (
          <div key={s} className="h-8 rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Diversification Goals</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          Set target percentages for each revenue source. Total must equal 100%.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        aria-label="Revenue diversification goals"
      >
        <fieldset className="space-y-3">
          <legend className="sr-only">Target revenue distribution by source</legend>
          {REVENUE_SOURCES.map((source) => (
            <div key={source} className="flex items-center gap-3">
              <label
                htmlFor={`goal-${source}`}
                className="w-28 flex-shrink-0 text-sm capitalize text-gray-700"
              >
                {SOURCE_LABELS[source]}
              </label>
              <input
                id={`goal-${source}`}
                type="range"
                min="0"
                max="100"
                step="1"
                className="flex-1 accent-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                value={distribution[source]}
                onChange={(e) => updateSource(source, Number(e.target.value))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={distribution[source]}
                aria-valuetext={`${distribution[source]}%`}
              />
              <input
                type="number"
                min="0"
                max="100"
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={distribution[source]}
                onChange={(e) => updateSource(source, Number(e.target.value))}
                aria-label={`${SOURCE_LABELS[source]} target percentage`}
              />
              <span className="text-sm text-gray-500 w-4">%</span>
            </div>
          ))}
        </fieldset>

        {/* Total indicator */}
        <div
          className={`mt-3 flex items-center justify-between rounded-md px-3 py-2 text-sm ${
            isValid
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
          aria-live="polite"
          role="status"
        >
          <span>Total: {total.toFixed(0)}%</span>
          {!isValid && <span className="text-xs">Must equal 100%</span>}
          {isValid && <span className="text-xs">Valid distribution</span>}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            disabled={!isValid || !dirty || updateMutation.isPending}
            aria-busy={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Goals'}
          </button>
        </div>

        {updateMutation.isError && (
          <p className="text-sm text-red-600 mt-2" role="alert">
            Failed to save goals. Please try again.
          </p>
        )}
        {updateMutation.isSuccess && !dirty && (
          <p className="text-sm text-green-600 mt-2" role="status">
            Goals saved successfully.
          </p>
        )}
      </form>
    </div>
  );
};

export default DiversificationGoals;
