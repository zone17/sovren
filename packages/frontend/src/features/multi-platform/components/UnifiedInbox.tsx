import React, { useState } from 'react';
import { useInboxMessages, useReplyToMessage, useBatchAction } from '../hooks/useInbox';
import { PLATFORM_DISPLAY } from '../types';
import type { InboxPlatformFilter, InboxStatusFilter } from '../types';

const UnifiedInbox: React.FC = () => {
  const [platformFilter, setPlatformFilter] = useState<InboxPlatformFilter>('all');
  const [statusFilter, setStatusFilter] = useState<InboxStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useInboxMessages({
    platform: platformFilter,
    status: statusFilter,
    page,
    limit: 20,
  });

  const replyMutation = useReplyToMessage();
  const batchMutation = useBatchAction();

  const messages = data?.messages || [];
  const pagination = data?.pagination;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // #290: Clear selection only after server confirms success
  const handleBatchAction = (action: 'mark_read' | 'mark_unread' | 'archive') => {
    if (selectedIds.length === 0) return;
    batchMutation.mutate(
      { message_ids: selectedIds, action },
      { onSuccess: () => setSelectedIds([]) }
    );
  };

  const handleReply = (messageId: string) => {
    if (!replyText.trim()) return;
    replyMutation.mutate(
      { messageId, data: { content: replyText } },
      {
        onSuccess: () => {
          setReplyingTo(null);
          setReplyText('');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="h-16 rounded bg-gray-100" />
          <div className="h-16 rounded bg-gray-100" />
          <div className="h-16 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Unified Inbox</h3>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          value={platformFilter}
          onChange={(e) => {
            setPlatformFilter(e.target.value as InboxPlatformFilter);
            setPage(1);
          }}
        >
          <option value="all">All Platforms</option>
          <option value="mastodon">Mastodon</option>
          <option value="bluesky">Bluesky</option>
          <option value="twitter">X (Twitter)</option>
          <option value="youtube">YouTube</option>
          <option value="nostr">NOSTR</option>
        </select>

        <select
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as InboxStatusFilter);
            setPage(1);
          }}
        >
          <option value="all">All Messages</option>
          <option value="unread">Unread</option>
          <option value="archived">Archived</option>
        </select>

        {selectedIds.length > 0 && (
          <div className="flex gap-1">
            <button
              className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => handleBatchAction('mark_read')}
            >
              Mark Read
            </button>
            <button
              className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => handleBatchAction('archive')}
            >
              Archive
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mt-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages to display.</p>
        ) : (
          messages.map((msg) => {
            const display = PLATFORM_DISPLAY[msg.platform];
            return (
              <div
                key={msg.id}
                className={`rounded-md border p-3 ${!msg.is_read ? 'bg-blue-50/50 border-blue-200' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(msg.id)}
                    onChange={() => toggleSelect(msg.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: display?.color || '#6B7280' }}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {msg.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{msg.content}</p>

                    {replyingTo === msg.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <button
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                          onClick={() => handleReply(msg.id)}
                          disabled={replyMutation.isPending}
                        >
                          Send
                        </button>
                        <button
                          className="rounded-md border px-3 py-1.5 text-sm text-gray-600"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="mt-1 text-xs text-indigo-600 hover:underline"
                        onClick={() => setReplyingTo(msg.id)}
                      >
                        Reply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} messages)
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrev}
            >
              Previous
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedInbox;
