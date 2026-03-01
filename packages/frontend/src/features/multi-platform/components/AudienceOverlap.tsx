import React from 'react';
import { useCrossPlatformOverview } from '../hooks/useCrossPlatformAnalytics';
import { PLATFORM_DISPLAY } from '../types';

/**
 * AudienceOverlap — Estimated audience overlap visualization.
 *
 * Uses total follower counts from the overview to estimate cross-platform
 * overlap via a simple heuristic model. Platform data comes from the
 * already-loaded overview to avoid an extra API call.
 */
export const AudienceOverlap: React.FC = () => {
  const { data: overview, isLoading } = useCrossPlatformOverview();

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="h-32 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!overview || overview.platforms.length < 2) return null;

  const platforms = overview.platforms;
  const total = overview.total_followers;

  // Heuristic: estimated unique reach ~70-80% of total (accounts for overlap)
  const estimatedUnique = Math.round(total * 0.75);
  const estimatedOverlap = total - estimatedUnique;
  const overlapPct = total > 0 ? ((estimatedOverlap / total) * 100).toFixed(0) : '0';

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Audience Overlap Estimate</h3>
      <p className="mt-1 text-sm text-gray-500">
        Estimated unique reach vs. cross-platform duplication based on follower distribution.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-indigo-50 p-3">
          <p className="text-xl font-bold text-indigo-700">{estimatedUnique.toLocaleString()}</p>
          <p className="text-xs text-indigo-600">Est. Unique Reach</p>
        </div>
        <div className="rounded-md bg-amber-50 p-3">
          <p className="text-xl font-bold text-amber-700">{overlapPct}%</p>
          <p className="text-xs text-amber-600">Est. Overlap</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xl font-bold text-gray-700">{total.toLocaleString()}</p>
          <p className="text-xs text-gray-600">Combined Followers</p>
        </div>
      </div>

      {/* Platform share bars */}
      <div className="mt-4 space-y-2" aria-label="Follower distribution by platform">
        {platforms.map((p: { platform: string; followers: number }) => {
          const display = PLATFORM_DISPLAY[p.platform];
          const pct = total > 0 ? (p.followers / total) * 100 : 0;
          return (
            <div key={p.platform} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: display?.color || '#6B7280' }}
                    aria-hidden="true"
                  />
                  <span className="text-gray-600">{display?.name || p.platform}</span>
                </div>
                <span className="text-gray-400">{pct.toFixed(1)}%</span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${display?.name || p.platform} share`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: display?.color || '#6366F1' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Overlap is estimated. Actual unique reach requires cross-platform identity matching.
      </p>
    </div>
  );
};

export default AudienceOverlap;
