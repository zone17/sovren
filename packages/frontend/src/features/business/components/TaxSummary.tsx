import React, { useState } from 'react';
import { useTaxSummary, useExportTax } from '../hooks/useTax';
import type { QuarterlyTaxSummary } from '../types';

function formatSats(sats: number): string {
  if (sats >= 1_000_000) return (sats / 1_000_000).toFixed(2) + 'M';
  if (sats >= 1_000) return (sats / 1_000).toFixed(1) + 'K';
  return String(sats);
}

function formatUsd(usd: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd);
}

const TaxSummary: React.FC = () => {
  const { data: summaries, isLoading } = useTaxSummary();
  const exportMutation = useExportTax();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const years = Array.from(
    new Set(summaries?.map((s) => s.year) ?? [new Date().getFullYear()])
  ).sort((a, b) => b - a);

  const filtered = summaries?.filter((s) => s.year === selectedYear) ?? [];

  const handleExport = (format: 'csv' | 'json') => {
    exportMutation.mutate(
      { format, year: selectedYear },
      {
        onSuccess: (res) => {
          window.open(res.data.downloadUrl, '_blank');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 rounded bg-gray-200" />
        <div className="h-48 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="text-sm font-semibold text-gray-900">Quarterly Tax Summary</h4>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="Select tax year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            onClick={() => handleExport('csv')}
            disabled={exportMutation.isPending}
            aria-label="Export tax data as CSV"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            onClick={() => handleExport('json')}
            disabled={exportMutation.isPending}
            aria-label="Export tax data as JSON"
          >
            Export JSON
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No tax data available for {selectedYear}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden"
            aria-label={`Tax summary for ${selectedYear}`}
          >
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Quarter
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Income (sats)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Income (USD)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Expenses (sats)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Expenses (USD)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Net (USD)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((summary: QuarterlyTaxSummary) => (
                <tr key={`${summary.year}-${summary.quarter}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {summary.quarter}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatSats(summary.totalIncomeSats)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatUsd(summary.totalIncomeUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatSats(summary.totalExpensesSats)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatUsd(summary.totalExpensesUsd)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-medium ${
                      summary.netUsd >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatUsd(summary.netUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exportMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          Export failed. Please try again.
        </p>
      )}
    </div>
  );
};

export default TaxSummary;
