import React, { useState } from 'react';
import { useRemoveMember } from '../hooks/useCircles';
import type { CircleMember } from '@shared/types/community';

interface CircleManagementProps {
  circleId: string;
  circleName: string;
  members: CircleMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

const CircleManagement: React.FC<CircleManagementProps> = ({
  circleId,
  circleName,
  members,
  currentUserId,
  isAdmin,
}) => {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const removeMutation = useRemoveMember();

  const handleRemove = (memberId: string) => {
    removeMutation.mutate(
      { circleId, memberId },
      { onSuccess: () => setConfirmRemove(null) }
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {circleName} — Members
      </h2>

      <ul className="divide-y divide-gray-100 rounded-lg border bg-white" role="list">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
                {member.creatorId.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {member.creatorId === currentUserId ? 'You' : `Creator ${member.creatorId.slice(0, 8)}`}
                </span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    member.role === 'admin'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {member.role}
                </span>
              </div>
            </div>

            {isAdmin && member.creatorId !== currentUserId && (
              <>
                {confirmRemove === member.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removeMutation.isPending}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="rounded-md border px-3 py-1 text-xs text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(member.id)}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                    aria-label={`Remove member ${member.creatorId.slice(0, 8)}`}
                  >
                    Remove
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {members.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No members yet.</p>
      )}
    </div>
  );
};

export default CircleManagement;
