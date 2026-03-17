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
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Repurposed Versions</h3>
        <button
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          onClick={handleGenerate}
          disabled={repurposeMutation.isPending}
        >
          {repurposeMutation.isPending ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {!repurposed || repurposed.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
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
                    <span className="text-sm font-medium text-foreground">
                      {display?.name || version.platform}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {version.format_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {version.character_count}/{version.character_limit || '?'}
                    </span>
                    {version.approved ? (
                      <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
                        Approved
                      </span>
                    ) : (
                      <button
                        className="rounded-md border border-green-300 dark:border-green-700 px-2 py-0.5 text-xs text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() => approveMutation.mutate(version.id)}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{version.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RepurposePreview;
