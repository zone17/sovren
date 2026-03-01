import React, { useState } from 'react';
import { usePublish, usePublishStatus } from '../hooks/useCrossPost';
import { usePlatformStatus } from '../hooks/usePlatformConnections';
import { PLATFORM_DISPLAY } from '../types';
import type { SupportedPlatform } from '@sovren/shared/types/distribution';

interface DistributionPanelProps {
  contentId: string;
}

const DistributionPanel: React.FC<DistributionPanelProps> = ({ contentId }) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<SupportedPlatform[]>([]);
  const { data: statuses } = usePlatformStatus();
  const publishMutation = usePublish();
  const { data: publishStatus } = usePublishStatus(contentId);

  const connectedPlatforms = (statuses || []).filter(
    (s) => s.connected && (s.platform as string) !== 'nostr'
  );

  const togglePlatform = (platform: SupportedPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handlePublish = () => {
    if (selectedPlatforms.length === 0) return;
    publishMutation.mutate({
      content_id: contentId,
      platforms: selectedPlatforms,
    });
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Distribute Content</h3>
      <p className="mt-1 text-sm text-gray-500">Select platforms to cross-post your content.</p>

      {connectedPlatforms.length === 0 ? (
        <p className="mt-4 text-sm text-amber-600">
          No platforms connected. Connect a platform to start publishing.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {connectedPlatforms.map((status) => {
              const display = PLATFORM_DISPLAY[status.platform];
              const isSelected = selectedPlatforms.includes(status.platform as SupportedPlatform);

              return (
                <button
                  key={status.platform}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => togglePlatform(status.platform as SupportedPlatform)}
                >
                  {display?.name || status.platform}
                </button>
              );
            })}
          </div>

          <button
            className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={handlePublish}
            disabled={selectedPlatforms.length === 0 || publishMutation.isPending}
          >
            {publishMutation.isPending
              ? 'Publishing...'
              : `Publish to ${selectedPlatforms.length} platform(s)`}
          </button>
        </>
      )}

      {/* Publish status tracker */}
      {publishStatus && publishStatus.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Publishing Status</h4>
          {publishStatus.map((entry) => {
            const display = PLATFORM_DISPLAY[entry.platform];
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <span className="font-medium">{display?.name || entry.platform}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    entry.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : entry.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : entry.status === 'queued'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {entry.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DistributionPanel;
