import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useRevenueBreakdown, useRevenueRisk } from '../hooks/useRevenue';
import type { RevenueBreakdownEntry } from '../types';
import { formatSats } from '../../../shared/utils/formatSats';

const SOURCE_COLORS: Record<string, string> = {
  subscriptions: '#6366F1',
  tips: '#8B5CF6',
  sponsorships: '#EC4899',
  services: '#F59E0B',
  affiliate: '#10B981',
  marketplace: '#3B82F6',
  other: '#6B7280',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: RevenueBreakdownEntry }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-sm">
      <p className="font-medium capitalize text-gray-900">{entry.source}</p>
      <p className="text-gray-600">{formatSats(entry.amountSats, { abbreviate: true })}</p>
      <p className="text-gray-500">{entry.percentage.toFixed(1)}%</p>
    </div>
  );
};

const RevenueMix: React.FC = () => {
  const { data: breakdown, isLoading: breakdownLoading } = useRevenueBreakdown();
  const { data: risk } = useRevenueRisk();

  if (breakdownLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="h-48 rounded-full bg-gray-100 mx-auto w-48" />
      </div>
    );
  }

  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">No revenue data yet.</p>
        <p className="text-xs text-gray-400 mt-1">
          Revenue entries will appear here once recorded.
        </p>
      </div>
    );
  }

  const totalSats = breakdown.reduce((sum, e) => sum + e.amountSats, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Revenue Mix</h4>
        <span className="text-sm text-gray-500">Total: {formatSats(totalSats, { abbreviate: true })}</span>
      </div>

      {/* Concentration risk warning */}
      {risk?.warning && (
        <div
          className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2"
          role="alert"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-orange-800">
            Concentration Risk: {risk.dominantSource} accounts for{' '}
            {risk.concentration.toFixed(0)}% of revenue.
          </p>
          <p className="text-xs text-orange-600 mt-0.5">
            Diversify to reduce dependency on a single source.
          </p>
        </div>
      )}

      {/* Donut chart */}
      <div
        role="img"
        aria-label={`Revenue mix donut chart. ${breakdown.map((e) => `${e.source}: ${e.percentage.toFixed(1)}%`).join(', ')}`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={breakdown}
              dataKey="amountSats"
              nameKey="source"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
            >
              {breakdown.map((entry) => (
                <Cell
                  key={entry.source}
                  fill={SOURCE_COLORS[entry.source] ?? SOURCE_COLORS.other}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-xs capitalize text-gray-700">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Source breakdown list */}
      <ul className="space-y-1.5" role="list" aria-label="Revenue breakdown by source">
        {breakdown.map((entry) => (
          <li key={entry.source} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: SOURCE_COLORS[entry.source] ?? SOURCE_COLORS.other }}
                aria-hidden="true"
              />
              <span className="text-sm capitalize text-gray-700">{entry.source}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{formatSats(entry.amountSats, { abbreviate: true })}</span>
              <span className="font-medium text-gray-900 w-12 text-right">
                {entry.percentage.toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RevenueMix;
