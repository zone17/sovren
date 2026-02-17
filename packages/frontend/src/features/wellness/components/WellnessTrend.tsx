import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWellnessPulseHistory } from '../hooks/useWellnessPulse';
import type { PulsePeriod, TrendDirection } from '../types';

const TREND_CONFIG: Record<TrendDirection, { label: string; color: string; bg: string }> = {
  improving: { label: 'Improving', color: 'text-green-700', bg: 'bg-green-100' },
  stable: { label: 'Stable', color: 'text-blue-700', bg: 'bg-blue-100' },
  declining: { label: 'Declining', color: 'text-red-700', bg: 'bg-red-100' },
};

interface WellnessTrendProps {
  period?: PulsePeriod;
}

export const WellnessTrend: React.FC<WellnessTrendProps> = ({ period: initialPeriod = '90d' }) => {
  const [period, setPeriod] = useState<PulsePeriod>(initialPeriod);
  const { data, isLoading, error } = useWellnessPulseHistory(period);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Failed to load wellness trend.
        </CardContent>
      </Card>
    );
  }

  if (data.entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Wellness Trend</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-gray-500">No check-ins yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Complete a wellness pulse check-in to start tracking your trend.
          </p>
        </CardContent>
      </Card>
    );
  }

  const trendConfig = TREND_CONFIG[data.trend.direction];
  const chartData = useMemo(
    () =>
      data.entries
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((entry) => ({
          date: new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: entry.composite_score,
          energy: entry.energy,
          motivation: entry.motivation,
          stress: entry.stress,
        })),
    [data.entries]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Wellness Trend</CardTitle>
          <Badge className={`${trendConfig.bg} ${trendConfig.color} text-[10px]`}>
            {trendConfig.label}
          </Badge>
        </div>
        <div className="flex gap-1">
          {(['30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-1 text-xs rounded ${
                period === p
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-pressed={period === p}
            >
              {p}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[1, 5]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={25}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                formatter={(value: number) => [value.toFixed(2), 'Score']}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>Avg: {data.trend.average_composite.toFixed(2)}</span>
          <span>
            Change: {data.trend.change_from_previous_period >= 0 ? '+' : ''}
            {data.trend.change_from_previous_period.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WellnessTrend;
