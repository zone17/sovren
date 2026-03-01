import React from 'react';
import { useRepurpose, useRepurposed, useApproveRepurposed } from '../hooks/useCrossPost';
import { PLATFORM_DISPLAY } from '../types';

interface RepurposePreviewProps {
  contentId: string;
}

const RepurposePreview: React.FC<RepurposePreviewProps> = ({ contentId }) => {
  const { data: repurposed, isLoading } = useRepurposed(contentId);
  const repurposeMutation = useRepurpose();
  const approveMutation = useApproveRepurposed();

  const handleGenerate = () => {
    repurposeMutation.mutate({
      content_id: contentId,
      platforms: ['twitter', 'mastodon', 'bluesky', 'youtube'],
    } as any);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="h-20 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Repurposed Versions</h3>
        <button
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          onClick={handleGenerate}
          disabled={repurposeMutation.isPending}
        >
          {repurposeMutation.isPending ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {!repurposed || repurposed.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No repurposed versions yet. Click Generate to create platform-optimized versions.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {repurposed.map((version) => {
            const display = PLATFORM_DISPLAY[version.platform];

            return (
              <div key={version.id} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: display?.color || '#6B7280' }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {display?.name || version.platform}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {version.format_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {version.character_count}/{version.character_limit || '?'}
                    </span>
                    {version.approved ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Approved
                      </span>
                    ) : (
                      <button
                        className="rounded-md border border-green-300 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50"
                        onClick={() => approveMutation.mutate(version.id)}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{version.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RepurposePreview;
