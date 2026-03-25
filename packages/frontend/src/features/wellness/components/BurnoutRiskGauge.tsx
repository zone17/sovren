import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBurnoutScore } from '../hooks/useBurnoutScore';
import type { BurnoutFactor, BurnoutLevel } from '../types';

const LEVEL_CONFIG: Record<BurnoutLevel, { color: string; bg: string; label: string }> = {
  low: { color: 'text-green-700', bg: 'bg-green-100', label: 'Low' },
  moderate: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Moderate' },
  high: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'High' },
  critical: { color: 'text-red-700', bg: 'bg-red-100', label: 'Critical' },
};

function gaugeStrokeColor(level: BurnoutLevel): string {
  switch (level) {
    case 'low':
      return '#22c55e';
    case 'moderate':
      return '#eab308';
    case 'high':
      return '#f97316';
    case 'critical':
      return '#ef4444';
  }
}

const FACTOR_LABELS: Record<string, string> = {
  work_hours_trend: 'Work Hours',
  posting_frequency: 'Posting Frequency',
  engagement_drop: 'Engagement Drop',
  hour_regularity: 'Schedule Regularity',
  rest_day_deficit: 'Rest Day Deficit',
};

interface RiskFactorBreakdownProps {
  factors: Record<string, BurnoutFactor>;
}

const RiskFactorBreakdown: React.FC<RiskFactorBreakdownProps> = ({ factors }) => (
  <div className="space-y-3 mt-4 pt-4 border-t">
    <h4 className="text-sm font-medium text-foreground">Risk Factors</h4>
    {Object.entries(factors).map(([key, factor]) => (
      <div key={key}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{FACTOR_LABELS[key] ?? key}</span>
          <span className="text-xs text-muted-foreground">{(factor.value * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${factor.value * 100}%`,
              backgroundColor:
                factor.value > 0.6 ? '#ef4444' : factor.value > 0.3 ? '#eab308' : '#22c55e',
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{factor.detail}</p>
      </div>
    ))}
  </div>
);

export const BurnoutRiskGauge: React.FC = () => {
  const { data, isLoading, error } = useBurnoutScore();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Burnout Risk</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Skeleton className="h-32 w-32 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Burnout Risk</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Failed to load burnout risk score.
        </CardContent>
      </Card>
    );
  }

  if (!data?.baseline_ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Burnout Risk</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <div className="text-3xl font-bold text-muted-foreground/40 mb-2">--</div>
          <p className="text-sm text-muted-foreground">
            Building your baseline... {data?.baseline_days_remaining ?? 14} days remaining
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            We need 14 days of activity data to calculate your risk score.
          </p>
        </CardContent>
      </Card>
    );
  }

  const score = data.score ?? 0;
  const config = LEVEL_CONFIG[data.level];
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Burnout Risk</CardTitle>
      </CardHeader>
      <CardContent>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
          aria-expanded={expanded}
          aria-label={`Burnout score ${score}, level ${data.level}. Click to ${expanded ? 'hide' : 'show'} risk factors.`}
        >
          {/* Gauge */}
          <div className="flex flex-col items-center">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              className="transform -rotate-90"
              role="img"
              aria-label={`Burnout risk gauge showing ${score} out of 100`}
            >
              <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke={gaugeStrokeColor(data.level)}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="relative -mt-[82px] flex flex-col items-center mb-6">
              <span className={`text-3xl font-bold ${config.color}`} role="status">
                {score}
              </span>
              <Badge className={`${config.bg} ${config.color} text-[10px] mt-1`}>
                {config.label}
              </Badge>
            </div>
          </div>

          {/* Top recommendation */}
          {data.recommendations.length > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2 px-2">
              {data.recommendations[0]}
            </p>
          )}
        </button>

        {expanded && <RiskFactorBreakdown factors={data.factors as any} />}
      </CardContent>
    </Card>
  );
};

export default BurnoutRiskGauge;
