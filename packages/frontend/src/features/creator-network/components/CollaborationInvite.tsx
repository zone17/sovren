import React, { useState } from 'react';
import {
  useCollaborators,
  useInviteCollaborators,
  useUpdateRevenueSplit,
} from '../hooks/useCollaboration';
import RevenueSplitEditor from './RevenueSplitEditor';
import type { RevenueSplitEntry } from '../types/community';

interface CollaborationInviteProps {
  contentId: string;
  contentTitle?: string;
}

const CollaborationInvite: React.FC<CollaborationInviteProps> = ({ contentId, contentTitle }) => {
  const [splits, setSplits] = useState<RevenueSplitEntry[]>([]);
  const [mode, setMode] = useState<'view' | 'invite' | 'edit-splits'>('view');

  const { data: collaborators = [], isLoading } = useCollaborators(contentId);
  const inviteMutation = useInviteCollaborators(contentId);
  const updateSplitMutation = useUpdateRevenueSplit(contentId);

  const totalBps = splits.reduce((s, e) => s + e.splitBps, 0);

  const handleInvite = () => {
    if (totalBps !== 10000) return;
    inviteMutation.mutate(
      splits.map((s) => ({ creatorId: s.creatorId, revenueSplitBps: s.splitBps })),
      {
        onSuccess: () => {
          setMode('view');
          setSplits([]);
        },
      }
    );
  };

  const handleUpdateSplits = () => {
    if (totalBps !== 10000) return;
    updateSplitMutation.mutate(
      splits.map((s) => ({ creatorId: s.creatorId, revenueSplitBps: s.splitBps })),
      {
        onSuccess: () => {
          setMode('view');
          setSplits([]);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {contentTitle ? `Collaborators — ${contentTitle}` : 'Collaborators'}
        </h3>
        <div className="flex gap-2">
          {collaborators.length > 0 && mode === 'view' && (
            <button
              onClick={() => {
                setSplits(
                  collaborators.map((c) => ({
                    creatorId: c.creatorId,
                    splitBps: c.revenueSplitBps,
                  }))
                );
                setMode('edit-splits');
              }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Edit splits
            </button>
          )}
          {mode === 'view' && (
            <button
              onClick={() => setMode('invite')}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700"
            >
              Invite co-authors
            </button>
          )}
        </div>
      </div>

      {/* Existing collaborators */}
      {mode === 'view' && collaborators.length > 0 && (
        <ul className="divide-y divide-border" role="list">
          {collaborators.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground truncate max-w-[180px]">{c.creatorId}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-foreground">
                  {(c.revenueSplitBps / 100).toFixed(2)}%
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    c.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : c.status === 'declined'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {c.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Invite form */}
      {mode === 'invite' && (
        <div className="space-y-4">
          <RevenueSplitEditor entries={splits} onChange={setSplits} previewSats={10000} />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setMode('view');
                setSplits([]);
              }}
              className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleInvite}
              disabled={
                totalBps !== 10000 || splits.some((s) => !s.creatorId) || inviteMutation.isPending
              }
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Inviting...' : 'Send Invites'}
            </button>
          </div>
        </div>
      )}

      {/* Edit splits */}
      {mode === 'edit-splits' && (
        <div className="space-y-4">
          <RevenueSplitEditor entries={splits} onChange={setSplits} previewSats={10000} />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setMode('view');
                setSplits([]);
              }}
              className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateSplits}
              disabled={totalBps !== 10000 || updateSplitMutation.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateSplitMutation.isPending ? 'Saving...' : 'Save Splits'}
            </button>
          </div>
        </div>
      )}

      {mode === 'view' && collaborators.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No collaborators yet. Invite co-authors to split revenue.
        </p>
      )}
    </div>
  );
};

export default CollaborationInvite;
