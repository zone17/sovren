import React, { useState } from 'react';
import { useTaxSummary } from '../hooks/useTax';
import { taxApi } from '../services/taxApi';
import type { QuarterlyTaxSummary } from '../types';
import { formatSats } from '../../../shared/utils/formatSats';
import apiClient from '@/services/api/apiClient';

function formatUsd(usd: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd);
}

const TaxSummary: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const { data: summaries, isLoading } = useTaxSummary(selectedYear);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'json') => {
    setExportError(null);
    setExporting(true);
    try {
      const url = taxApi.getExportUrl(format, selectedYear);
      const token = apiClient.getToken();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `tax-report-${selectedYear}.${format}`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
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
            onClick={() => void handleExport('csv')}
            disabled={exporting}
            aria-label="Export tax data as CSV"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            onClick={() => void handleExport('json')}
            disabled={exporting}
            aria-label="Export tax data as JSON"
          >
            Export JSON
          </button>
        </div>
      </div>

      {!summaries || summaries.length === 0 ? (
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
              {summaries.map((summary: QuarterlyTaxSummary) => (
                <tr key={`${summary.year}-${summary.quarter}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{summary.quarter}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatSats(summary.totalIncomeSats, { abbreviate: true, suffix: false })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatUsd(summary.totalIncomeUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatSats(summary.totalExpensesSats, { abbreviate: true, suffix: false })}
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

      {exportError && (
        <p className="text-sm text-red-600" role="alert">
          {exportError}
        </p>
      )}
    </div>
  );
};

export default TaxSummary;
