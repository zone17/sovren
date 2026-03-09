import React, { useState } from 'react';
import { useMentors, useRequestMentorship } from '../hooks/useMentorship';
import { AUDIENCE_SIZE_LABELS } from '../types/community';

const MentorDirectory: React.FC = () => {
  const [nicheFilter, setNicheFilter] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [goals, setGoals] = useState('');

  const { data: mentors = [], isLoading } = useMentors({
    niche: nicheFilter || undefined,
    audienceSizeRange: audienceFilter || undefined,
  });

  const requestMutation = useRequestMentorship();

  const handleRequest = (mentorId: string) => {
    const goalList = goals
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean);

    requestMutation.mutate(
      { mentorId, goals: goalList },
      {
        onSuccess: () => {
          setRequestingId(null);
          setGoals('');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Mentor Directory</h2>
        <p className="text-sm text-muted-foreground">
          Find experienced creators to guide your growth
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by niche..."
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="Filter by niche"
        />
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="Filter by audience size"
        >
          <option value="">Any audience size</option>
          {Object.entries(AUDIENCE_SIZE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Mentor list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="h-4 w-40 bg-muted rounded mb-2" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : mentors.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No mentors match your filters. Try broadening your search.
        </p>
      ) : (
        <ul className="space-y-4" role="list">
          {mentors.map((mentor) => (
            <li key={mentor.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-semibold text-purple-700">
                      {mentor.niche.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{mentor.niche}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {AUDIENCE_SIZE_LABELS[mentor.audienceSizeRange] ?? mentor.audienceSizeRange}
                    </span>
                  </div>
                  {mentor.bio && <p className="mt-2 text-sm text-muted-foreground">{mentor.bio}</p>}
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Mentees: up to {mentor.maxMentees}
                  </p>
                </div>

                {requestingId === mentor.id ? (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <textarea
                      placeholder="Your goals (one per line)"
                      value={goals}
                      onChange={(e) => setGoals(e.target.value)}
                      rows={3}
                      className="rounded-md border border-border px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:outline-none"
                      aria-label="Mentorship goals"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequest(mentor.creatorId)}
                        disabled={requestMutation.isPending}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {requestMutation.isPending ? 'Sending...' : 'Send Request'}
                      </button>
                      <button
                        onClick={() => {
                          setRequestingId(null);
                          setGoals('');
                        }}
                        className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRequestingId(mentor.id)}
                    className="shrink-0 rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
                    aria-label={`Request mentorship from ${mentor.niche} mentor`}
                  >
                    Request
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MentorDirectory;
