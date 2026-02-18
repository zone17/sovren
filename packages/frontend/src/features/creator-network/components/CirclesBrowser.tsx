import React, { useState } from 'react';
import { useCircles, useSuggestedCircles, useJoinCircle, useCreateCircle } from '../hooks/useCircles';
import type { CircleWithMemberCount } from '../types/community';

const CirclesBrowser: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [niche, setNiche] = useState('');
  const [maxMembers, setMaxMembers] = useState(20);

  const { data: myCircles = [], isLoading: loadingMine } = useCircles();
  const { data: suggested = [], isLoading: loadingSuggested } = useSuggestedCircles();
  const joinMutation = useJoinCircle();
  const createMutation = useCreateCircle();

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate(
      { name: name.trim(), description: description.trim() || undefined, niche: niche.trim() || undefined, maxMembers },
      {
        onSuccess: () => {
          setShowCreate(false);
          setName('');
          setDescription('');
          setNiche('');
          setMaxMembers(20);
        },
      }
    );
  };

  const isLoading = loadingMine || loadingSuggested;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-white p-4">
            <div className="h-4 w-32 rounded bg-gray-200 mb-2" />
            <div className="h-3 w-48 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Creator Circles</h2>
          <p className="text-sm text-gray-500">Join or create peer communities by niche</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Create Circle
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-900">New Circle</h3>
          <input
            type="text"
            placeholder="Circle name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            aria-label="Circle name"
          />
          <input
            type="text"
            placeholder="Niche (e.g. indie music, photography)"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            aria-label="Circle niche"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none resize-none"
            aria-label="Circle description"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">
              Max members:
              <input
                type="number"
                min={5}
                max={20}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="ml-2 w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                aria-label="Maximum members"
              />
            </label>
            <span className="text-xs text-gray-400">(5–20)</span>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* My Circles */}
      {myCircles.length > 0 && (
        <section aria-label="My circles">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">My Circles</h3>
          <CircleList circles={myCircles} onJoin={null} />
        </section>
      )}

      {/* Suggested */}
      {suggested.length > 0 && (
        <section aria-label="Suggested circles">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Suggested for You</h3>
          <CircleList
            circles={suggested}
            onJoin={(id) => joinMutation.mutate(id)}
            joiningId={joinMutation.isPending ? (joinMutation.variables as string) : undefined}
          />
        </section>
      )}

      {myCircles.length === 0 && suggested.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          No circles yet. Create one to get started!
        </p>
      )}
    </div>
  );
};

interface CircleListProps {
  circles: CircleWithMemberCount[];
  onJoin: ((id: string) => void) | null;
  joiningId?: string;
}

const CircleList: React.FC<CircleListProps> = ({ circles, onJoin, joiningId }) => (
  <ul className="space-y-3" role="list">
    {circles.map((circle) => (
      <li key={circle.id} className="rounded-lg border bg-white p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{circle.name}</span>
            {circle.niche && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                {circle.niche}
              </span>
            )}
          </div>
          {circle.description && (
            <p className="mt-1 text-sm text-gray-500 truncate">{circle.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {circle.memberCount}/{circle.maxMembers} members
          </p>
        </div>
        {onJoin && (
          <button
            onClick={() => onJoin(circle.id)}
            disabled={circle.memberCount >= circle.maxMembers || joiningId === circle.id}
            className="shrink-0 rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Join ${circle.name}`}
          >
            {circle.memberCount >= circle.maxMembers ? 'Full' : joiningId === circle.id ? 'Joining...' : 'Join'}
          </button>
        )}
      </li>
    ))}
  </ul>
);

export default CirclesBrowser;
