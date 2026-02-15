/**
 * Revenue Analytics Dashboard Component (FR-005)
 *
 * Displays creator revenue metrics: total earnings, earnings by tier,
 * trend over time, subscriber count, churn rate, and lifetime value.
 * Uses mock data until backend integration is enabled.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';

// -- Types --

interface RevenueMetrics {
  totalRevenueSats: number;
  mrrSats: number;
  subscriberCount: number;
  avgPaymentSats: number;
  churnRate: number;
  avgLifetimeValueSats: number;
  revenueByTier: Array<{ tierName: string; revenueSats: number; subscribers: number }>;
  revenueByDay: Array<{ date: string; revenueSats: number; transactions: number }>;
}

type Timeframe = '7d' | '30d' | '90d';

// -- Mock Data --

function generateMockMetrics(timeframe: Timeframe): RevenueMetrics {
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const revenueByDay = Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    return {
      date: date.toISOString().split('T')[0],
      revenueSats: Math.floor(5000 + Math.random() * 15000),
      transactions: Math.floor(2 + Math.random() * 10),
    };
  });

  const totalRevenueSats = revenueByDay.reduce((sum, d) => sum + d.revenueSats, 0);

  return {
    totalRevenueSats,
    mrrSats: Math.floor(totalRevenueSats / (days / 30)),
    subscriberCount: 47,
    avgPaymentSats: 3250,
    churnRate: 0.08,
    avgLifetimeValueSats: 42000,
    revenueByTier: [
      { tierName: 'Basic', revenueSats: Math.floor(totalRevenueSats * 0.35), subscribers: 28 },
      { tierName: 'Premium', revenueSats: Math.floor(totalRevenueSats * 0.55), subscribers: 15 },
      { tierName: 'Tips', revenueSats: Math.floor(totalRevenueSats * 0.1), subscribers: 4 },
    ],
    revenueByDay,
  };
}

// -- Components --

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: { value: number; label: string };
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle, trend }) => (
  <Card>
    <CardContent className="p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      {trend && (
        <p
          className={`mt-2 text-xs font-medium ${
            trend.value >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend.value >= 0 ? '+' : ''}
          {trend.value}% {trend.label}
        </p>
      )}
    </CardContent>
  </Card>
);

interface RevenueChartProps {
  data: Array<{ date: string; revenueSats: number; transactions: number }>;
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenueSats));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue Over Time</CardTitle>
        <CardDescription>Daily revenue in satoshis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40" role="img" aria-label="Revenue bar chart">
          {data.map((day) => {
            const height = maxRevenue > 0 ? (day.revenueSats / maxRevenue) * 100 : 0;
            return (
              <div
                key={day.date}
                className="flex-1 group relative"
                title={`${day.date}: ${day.revenueSats.toLocaleString()} sats`}
              >
                <div
                  className="bg-amber-400 hover:bg-amber-500 rounded-t transition-colors min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {day.revenueSats.toLocaleString()} sats
                  <br />
                  {day.transactions} txns
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </CardContent>
    </Card>
  );
};

interface TierBreakdownProps {
  tiers: Array<{ tierName: string; revenueSats: number; subscribers: number }>;
  totalRevenue: number;
}

const TierBreakdown: React.FC<TierBreakdownProps> = ({ tiers, totalRevenue }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Revenue by Tier</CardTitle>
      <CardDescription>Breakdown of earnings across subscription tiers</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {tiers.map((tier) => {
          const percentage = totalRevenue > 0 ? (tier.revenueSats / totalRevenue) * 100 : 0;
          return (
            <div key={tier.tierName}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{tier.tierName}</span>
                <span className="text-sm text-gray-500">
                  {tier.revenueSats.toLocaleString()} sats ({tier.subscribers} subs)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-amber-400 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${tier.tierName}: ${Math.round(percentage)}% of revenue`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);

// -- Main Component --

export const RevenueAnalytics: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setMetrics(generateMockMetrics(timeframe));
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [timeframe]);

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                <div className="h-7 bg-gray-200 rounded w-32 mt-2 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Revenue Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track your earnings and subscriber metrics
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg" role="radiogroup" aria-label="Timeframe selection">
          {timeframeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeframe(opt.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                timeframe === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              role="radio"
              aria-checked={timeframe === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Revenue"
          value={`${metrics.totalRevenueSats.toLocaleString()} sats`}
          trend={{ value: 15.2, label: 'vs previous period' }}
        />
        <MetricCard
          label="Monthly Recurring"
          value={`${metrics.mrrSats.toLocaleString()} sats`}
          subtitle="MRR"
          trend={{ value: 8.1, label: 'growth' }}
        />
        <MetricCard
          label="Active Subscribers"
          value={String(metrics.subscriberCount)}
          trend={{ value: 12, label: 'vs previous period' }}
        />
        <MetricCard
          label="Churn Rate"
          value={`${(metrics.churnRate * 100).toFixed(1)}%`}
          subtitle="monthly"
          trend={{ value: -2.3, label: 'improvement' }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={metrics.revenueByDay} />
        <TierBreakdown tiers={metrics.revenueByTier} totalRevenue={metrics.totalRevenueSats} />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          label="Avg. Payment"
          value={`${metrics.avgPaymentSats.toLocaleString()} sats`}
        />
        <MetricCard
          label="Avg. Lifetime Value"
          value={`${metrics.avgLifetimeValueSats.toLocaleString()} sats`}
          subtitle="per subscriber"
        />
      </div>
    </div>
  );
};
