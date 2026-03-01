import React, { useState } from 'react';
import { usePlatformComparison } from '../hooks/useCrossPlatformAnalytics';
import { PLATFORM_DISPLAY } from '../types';

export const PlatformComparison: React.FC = () => {
  const [contentId, setContentId] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const { data: comparison, isLoading, isError } = usePlatformComparison(submittedId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedId(contentId.trim());
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Content Comparison</h3>
      <p className="mt-1 text-sm text-gray-500">
        See how a piece of content performs across all platforms.
      </p>

      <form className="mt-3 flex gap-2" onSubmit={handleSubmit} aria-label="Compare content">
        <input
          type="text"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Paste content ID..."
          value={contentId}
          onChange={(e) => setContentId(e.target.value)}
          aria-label="Content ID to compare"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          disabled={!contentId.trim() || isLoading}
        >
          Compare
        </button>
      </form>

      {isLoading && (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      )}

      {isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          Could not load comparison data. Check the content ID and try again.
        </p>
      )}

      {comparison && comparison.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Content performance by platform">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Platform</th>
                <th className="pb-2 pr-4 font-medium">Views</th>
                <th className="pb-2 pr-4 font-medium">Engagement</th>
                <th className="pb-2 pr-4 font-medium">Comments</th>
                <th className="pb-2 font-medium">Shares</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((item) => {
                const display = PLATFORM_DISPLAY[item.platform];
                return (
                  <tr key={item.platform} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: display?.color || '#6B7280' }}
                          aria-hidden="true"
                        />
                        <span className="font-medium">{display?.name || item.platform}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4">{item.views.toLocaleString()}</td>
                    <td className="py-2 pr-4">{item.engagement_rate.toFixed(1)}%</td>
                    <td className="py-2 pr-4">{item.comments.toLocaleString()}</td>
                    <td className="py-2">{item.shares.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comparison && comparison.length === 0 && submittedId && (
        <p className="mt-3 text-sm text-gray-500">No cross-platform data found for this content.</p>
      )}
    </div>
  );
};

export default PlatformComparison;
