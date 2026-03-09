import React from 'react';
import type { InboxFilters, SentimentFilter, PriorityFilter } from '../types/inbox';
import type { InboxPlatformFilter, InboxStatusFilter } from '../types';

interface InboxFilterBarProps {
  filters: Pick<InboxFilters, 'platform' | 'sentiment' | 'priority' | 'status'>;
  onChange: (updates: Partial<InboxFilters>) => void;
}

const PLATFORM_OPTIONS: Array<{ value: InboxPlatformFilter; label: string }> = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'mastodon', label: 'Mastodon' },
  { value: 'nostr', label: 'NOSTR' },
];

const SENTIMENT_OPTIONS: Array<{ value: SentimentFilter; label: string }> = [
  { value: 'all', label: 'All Sentiments' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
];

const PRIORITY_OPTIONS: Array<{ value: PriorityFilter; label: string }> = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
];

const STATUS_OPTIONS: Array<{ value: InboxStatusFilter; label: string }> = [
  { value: 'all', label: 'All Messages' },
  { value: 'unread', label: 'Unread' },
  { value: 'archived', label: 'Archived' },
];

const selectClass =
  'rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export const InboxFilterBar: React.FC<InboxFilterBarProps> = ({ filters, onChange }) => {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Inbox message filters"
    >
      <select
        className={selectClass}
        value={filters.platform}
        onChange={(e) => onChange({ platform: e.target.value as InboxPlatformFilter })}
        aria-label="Filter by platform"
      >
        {PLATFORM_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.sentiment}
        onChange={(e) => onChange({ sentiment: e.target.value as SentimentFilter })}
        aria-label="Filter by sentiment"
      >
        {SENTIMENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.priority}
        onChange={(e) => onChange({ priority: e.target.value as PriorityFilter })}
        aria-label="Filter by priority"
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value as InboxStatusFilter })}
        aria-label="Filter by read status"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default InboxFilterBar;
