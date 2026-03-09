import React, { useRef, useState } from 'react';
import { useTaxSummary } from '../hooks/useTax';
import { taxApi } from '../services/taxApi';
import type { QuarterlyTaxSummary } from '@shared/types/finance';
import { formatSats } from '../../../shared/utils/formatSats';

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
function formatUsd(usd: number): string {
  return usdFormatter.format(usd);
}

const TaxSummary: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const { data: summaries, isLoading } = useTaxSummary(selectedYear);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportingRef = useRef(false);

  const handleExport = async (format: 'csv' | 'json') => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExportError(null);
    setExporting(true);
    try {
      const blob = await taxApi.exportTaxBlob(format, selectedYear);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `tax-report-${selectedYear}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExporting(false);
      exportingRef.current = false;
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls — always visible so users can interact during loading */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="text-sm font-semibold text-foreground">Quarterly Tax Summary</h4>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            onClick={() => void handleExport('csv')}
            disabled={exporting || isLoading}
            aria-label="Export tax data as CSV"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            onClick={() => void handleExport('json')}
            disabled={exporting || isLoading}
            aria-label="Export tax data as JSON"
          >
            Export JSON
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded bg-muted" />
        </div>
      ) : !summaries || summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tax data available for {selectedYear}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-border rounded-lg border border-border overflow-hidden"
            aria-label={`Tax summary for ${selectedYear}`}
          >
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Quarter
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Income (sats)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Income (USD)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Expenses (sats)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Expenses (USD)
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Net (USD)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {summaries.map((summary: QuarterlyTaxSummary) => (
                <tr key={`${summary.year}-${summary.quarter}`} className="hover:bg-accent">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {summary.quarter}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">
                    {formatSats(summary.totalIncomeSats, { abbreviate: true, suffix: false })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">
                    {formatUsd(summary.totalIncomeUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">
                    {formatSats(summary.totalExpensesSats, { abbreviate: true, suffix: false })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">
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
