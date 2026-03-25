import React from 'react';
import { useAnalyticsOverview, useROI } from '../hooks/useDistributionAnalytics';
import { PLATFORM_DISPLAY } from '../types';

const CrossPlatformAnalytics: React.FC = () => {
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: roi, isLoading: roiLoading } = useROI();

  if (overviewLoading || roiLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 rounded bg-muted" />
            <div className="h-24 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview cards */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Cross-Platform Analytics</h3>

        {overview && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-md bg-indigo-50 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-700">
                  {overview.total_followers.toLocaleString()}
                </p>
                <p className="text-sm text-indigo-600">Total Followers</p>
              </div>
              <div className="rounded-md bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {overview.total_engagement_30d.toLocaleString()}
                </p>
                <p className="text-sm text-green-600">30-Day Impressions</p>
              </div>
            </div>

            {/* Per-platform breakdown */}
            <div className="mt-4 space-y-2">
              {overview.platforms.map((p) => {
                const display = PLATFORM_DISPLAY[p.platform];
                return (
                  <div
                    key={p.platform}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: display?.color || '#6B7280' }}
                      />
                      <span className="text-sm font-medium">{display?.name || p.platform}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{p.followers.toLocaleString()} followers</span>
                      <span className="text-muted-foreground">
                        {p.engagement_rate.toFixed(1)}% engagement
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.growth_30d > 0
                            ? 'bg-green-100 text-green-700'
                            : p.growth_30d < 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {p.growth_30d > 0 ? '+' : ''}
                        {p.growth_30d}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ROI Table */}
      {roi && roi.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h4 className="text-md font-semibold text-foreground">
            Platform ROI (Engagement per Hour)
          </h4>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Rank</th>
                  <th className="pb-2 pr-4">Platform</th>
                  <th className="pb-2 pr-4">Engagement/Hr</th>
                  <th className="pb-2 pr-4">Total 30d</th>
                  <th className="pb-2">Est. Hours</th>
                </tr>
              </thead>
              <tbody>
                {roi.map((item) => {
                  const display = PLATFORM_DISPLAY[item.platform];
                  return (
                    <tr key={item.platform} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">#{item.rank}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: display?.color || '#6B7280' }}
                          />
                          {display?.name || item.platform}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-medium text-indigo-700">
                        {item.engagement_per_hour.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{item.total_engagement_30d.toLocaleString()}</td>
                      <td className="py-2">{item.estimated_hours_30d.toFixed(1)}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossPlatformAnalytics;
