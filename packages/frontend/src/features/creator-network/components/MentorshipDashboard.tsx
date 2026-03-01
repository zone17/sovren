import React, { useRef, useState } from 'react';
import {
  useMyMentorships,
  useRespondToMentorship,
  useRegisterMentor,
} from '../hooks/useMentorship';
import { AUDIENCE_SIZE_LABELS } from '../types/community';
import type { Mentorship } from '@shared/types/community';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  declined: 'bg-red-100 text-red-700',
};

const MentorshipDashboard: React.FC = () => {
  const [showRegister, setShowRegister] = useState(false);
  const [niche, setNiche] = useState('');
  const [audienceSizeRange, setAudienceSizeRange] = useState<
    '0-1k' | '1k-10k' | '10k-100k' | '100k+'
  >('0-1k');
  const [bio, setBio] = useState('');
  const [maxMentees, setMaxMentees] = useState(3);
  const [pendingRespondId, setPendingRespondId] = useState<string | null>(null);
  const respondInFlightRef = useRef(false);

  const { data: mentorships = [], isLoading } = useMyMentorships();
  const respondMutation = useRespondToMentorship();
  const registerMutation = useRegisterMentor();

  const handleRespond = (id: string, accept: boolean) => {
    if (respondInFlightRef.current) return;
    respondInFlightRef.current = true;
    setPendingRespondId(id);
    respondMutation.mutate(
      { id, accept },
      {
        onSettled: () => {
          respondInFlightRef.current = false;
          setPendingRespondId(null);
        },
      }
    );
  };

  const pending = mentorships.filter((m) => m.status === 'pending');
  const active = mentorships.filter((m) => m.status === 'active');
  const past = mentorships.filter((m) => m.status === 'completed' || m.status === 'declined');

  const handleRegister = () => {
    if (!niche.trim()) return;
    registerMutation.mutate(
      {
        niche: niche.trim(),
        audienceSizeRange,
        bio: bio.trim() || undefined,
        maxMentees,
      },
      { onSuccess: () => setShowRegister(false) }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-white p-4 h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">My Mentorships</h2>
          <p className="text-sm text-gray-500">Manage your mentoring relationships</p>
        </div>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="rounded-md border border-indigo-300 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
        >
          Become a Mentor
        </button>
      </div>

      {/* Register as mentor */}
      {showRegister && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-purple-900">Register as Mentor</h3>
          <input
            type="text"
            placeholder="Your niche (e.g. travel vlogging)"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            aria-label="Mentor niche"
          />
          <select
            value={audienceSizeRange}
            onChange={(e) => setAudienceSizeRange(e.target.value as typeof audienceSizeRange)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            aria-label="Your audience size"
          >
            {Object.entries(AUDIENCE_SIZE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Short bio / why you'd be a great mentor"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            aria-label="Mentor bio"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">
              Max mentees:
              <input
                type="number"
                min={1}
                max={10}
                value={maxMentees}
                onChange={(e) => setMaxMentees(Number(e.target.value))}
                className="ml-2 w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRegister(false)}
              className="rounded-md border px-3 py-1.5 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleRegister}
              disabled={!niche.trim() || registerMutation.isPending}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {registerMutation.isPending ? 'Registering...' : 'Register'}
            </button>
          </div>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <MentorshipSection
          title="Pending Requests"
          mentorships={pending}
          onRespond={handleRespond}
          pendingRespondId={pendingRespondId}
        />
      )}

      {/* Active */}
      {active.length > 0 && <MentorshipSection title="Active Mentorships" mentorships={active} />}

      {/* Past */}
      {past.length > 0 && <MentorshipSection title="Past" mentorships={past} />}

      {mentorships.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          No mentorships yet. Browse the directory to find a mentor.
        </p>
      )}
    </div>
  );
};

interface MentorshipSectionProps {
  title: string;
  mentorships: Mentorship[];
  onRespond?: (id: string, accept: boolean) => void;
  pendingRespondId?: string | null;
}

const MentorshipSection: React.FC<MentorshipSectionProps> = ({
  title,
  mentorships,
  onRespond,
  pendingRespondId,
}) => (
  <section aria-label={title}>
    <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
    <ul className="space-y-3" role="list">
      {mentorships.map((m) => (
        <li key={m.id} className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {m.niche && <p className="text-sm font-medium text-gray-900">{m.niche}</p>}
              {m.goals.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {m.goals.map((goal: string, i: number) => (
                    <li key={i} className="text-xs text-gray-500">
                      • {goal}
                    </li>
                  ))}
                </ul>
              )}
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_STYLES[m.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {m.status}
              </span>
            </div>

            {onRespond && m.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => onRespond(m.id, true)}
                  disabled={pendingRespondId != null}
                  aria-busy={pendingRespondId === m.id}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingRespondId === m.id ? 'Processing...' : 'Accept'}
                </button>
                <button
                  onClick={() => onRespond(m.id, false)}
                  disabled={pendingRespondId != null}
                  aria-busy={pendingRespondId === m.id}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingRespondId === m.id ? 'Processing...' : 'Decline'}
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  </section>
);

export default MentorshipDashboard;
