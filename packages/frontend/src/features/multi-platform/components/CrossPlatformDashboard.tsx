import React, { Suspense, lazy } from 'react';
import { useCrossPlatformOverview } from '../hooks/useCrossPlatformAnalytics';
import { PLATFORM_DISPLAY } from '../types';

const PlatformComparison = lazy(() => import('./PlatformComparison'));
const PlatformROI = lazy(() => import('./PlatformROI'));
const AudienceOverlap = lazy(() => import('./AudienceOverlap'));

const SectionSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="rounded-lg border bg-card p-6">
    <div className="animate-pulse space-y-3">
      <div className="h-5 w-48 rounded bg-muted" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-muted" />
      ))}
    </div>
  </div>
);

export const CrossPlatformDashboard: React.FC = () => {
  const { data: overview, isLoading, isError } = useCrossPlatformOverview();

  if (isLoading) return <SectionSkeleton lines={5} />;

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center"
      >
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load analytics. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Cross-Platform Overview</h2>

        {overview && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md bg-indigo-50 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-700">
                  {overview.total_followers.toLocaleString()}
                </p>
                <p className="text-xs text-indigo-600">Total Followers</p>
              </div>
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {overview.total_engagement_30d.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500">30-Day Engagement</p>
              </div>
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {overview.platforms.length}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Connected Platforms</p>
              </div>
              <div className="rounded-md bg-purple-50 p-4 text-center">
                <p className="text-2xl font-bold text-purple-700">
                  {overview.platforms.length > 0
                    ? (
                        overview.platforms.reduce(
                          (sum: number, p: { engagement_rate: number }) => sum + p.engagement_rate,
                          0
                        ) / overview.platforms.length
                      ).toFixed(1)
                    : '0.0'}
                  %
                </p>
                <p className="text-xs text-purple-600">Avg. Engagement</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {overview.platforms.map(
                (p: {
                  platform: string;
                  followers: number;
                  engagement_rate: number;
                  growth_30d: number;
                }) => {
                  const display = PLATFORM_DISPLAY[p.platform];
                  return (
                    <div
                      key={p.platform}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: display?.color || '#6B7280' }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium text-foreground">
                          {display?.name || p.platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {p.followers.toLocaleString()} followers
                        </span>
                        <span className="text-muted-foreground">
                          {p.engagement_rate.toFixed(1)}%
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.growth_30d > 0
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : p.growth_30d < 0
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-muted text-muted-foreground'
                          }`}
                          aria-label={`${p.growth_30d > 0 ? 'Up' : p.growth_30d < 0 ? 'Down' : 'Flat'} ${Math.abs(p.growth_30d)}% in 30 days`}
                        >
                          {p.growth_30d > 0 ? '+' : ''}
                          {p.growth_30d}%
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </>
        )}
      </div>

      <Suspense fallback={<SectionSkeleton lines={4} />}>
        <PlatformComparison />
      </Suspense>

      <Suspense fallback={<SectionSkeleton lines={3} />}>
        <PlatformROI />
      </Suspense>

      <Suspense fallback={<SectionSkeleton lines={2} />}>
        <AudienceOverlap />
      </Suspense>
    </div>
  );
};

export default CrossPlatformDashboard;
