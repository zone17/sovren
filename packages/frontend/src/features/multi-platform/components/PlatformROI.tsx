import React from 'react';
import { usePlatformROI } from '../hooks/useCrossPlatformAnalytics';
import { PLATFORM_DISPLAY } from '../types';

export const PlatformROI: React.FC = () => {
  const { data: roi, isLoading, isError } = usePlatformROI();

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center"
      >
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load ROI data.</p>
      </div>
    );
  }

  if (!roi || roi.length === 0) return null;

  const maxEngagement = Math.max(...roi.map((r) => r.engagement_per_hour), 1);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground">Platform ROI</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Engagement per hour invested, ranked by efficiency.
      </p>

      <div className="mt-4 space-y-3" aria-label="Platform ROI ranking">
        {roi.map((item) => {
          const display = PLATFORM_DISPLAY[item.platform];
          const barWidth = (item.engagement_per_hour / maxEngagement) * 100;

          return (
            <div key={item.platform} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs font-medium text-muted-foreground/60">
                    #{item.rank}
                  </span>
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: display?.color || '#6B7280' }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-foreground">
                    {display?.name || item.platform}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span className="font-semibold text-indigo-700">
                    {item.engagement_per_hour.toLocaleString()} eng/hr
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {item.estimated_hours_30d.toFixed(1)}h / 30d
                  </span>
                </div>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(barWidth)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${display?.name || item.platform} ROI bar`}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: display?.color || '#6366F1',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlatformROI;
