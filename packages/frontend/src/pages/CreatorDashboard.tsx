import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { apiClient } from '../services/api/apiClient';

/* ────────────────────────────────────────────────────────
   CREATOR DASHBOARD — "Crystalline Depth" Design
   Glass morphism panels, choreographed entrance,
   progressive information density, purple glow accents.
   ──────────────────────────────────────────────────────── */

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  content_type: string;
  status: string;
  tags: string[];
  view_count: number;
  like_count: number;
  comment_count: number;
  price_sats: number;
  is_monetized: boolean;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// Format large numbers compactly
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// Content type icon (SVG, no emoji)
function ContentTypeIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 text-white/40';
  switch (type) {
    case 'article':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      );
    case 'image':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z"
          />
        </svg>
      );
    case 'video':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
          />
        </svg>
      );
    case 'audio':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      );
  }
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    draft: 'bg-white/5 text-white/40 border-white/10',
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    archived: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${styles[status] || styles.draft}`}
    >
      {status}
    </span>
  );
}

const CreatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    try {
      setIsLoading(true);
      const result =
        await apiClient.get<ApiEnvelope<{ items: ContentItem[]; total: number }>>(
          '/api/v1/content'
        );
      if (result.success && result.data) {
        setContentItems(result.data.items);
      } else {
        setContentItems([]);
      }
      setError(null);
    } catch {
      setContentItems([]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Delete this content?')) return;
    try {
      await apiClient.delete<ApiEnvelope<null>>(`/api/v1/content/${id}`);
      setContentItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore
    }
  };

  // Computed stats
  const totalViews = contentItems.reduce((sum, item) => sum + (item.view_count || 0), 0);
  const totalLikes = contentItems.reduce((sum, item) => sum + (item.like_count || 0), 0);
  const publishedCount = contentItems.filter((item) => item.status === 'published').length;
  const totalEarnings = contentItems.reduce((sum, item) => sum + (item.price_sats || 0), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-sm text-white/30">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your creative empire at a glance</p>
        </div>
        <Link
          to="/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all duration-200 shadow-[0_4px_16px_rgba(139,92,246,0.3)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.4)] no-underline"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create
        </Link>
      </div>

      {/* Stats Grid — choreographed entrance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 reveal-stagger">
        {/* Published */}
        <div className="glass-hover rounded-2xl p-5 group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Published
            </p>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
                />
              </svg>
            </div>
          </div>
          <p
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {publishedCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{contentItems.length} total pieces</p>
        </div>

        {/* Views */}
        <div className="glass-hover rounded-2xl p-5 group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Views
            </p>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
          <p
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {formatCompact(totalViews)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{totalLikes} likes</p>
        </div>

        {/* Earnings */}
        <div className="glass-hover rounded-2xl p-5 group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Earnings
            </p>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
            </div>
          </div>
          <p
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {formatCompact(totalEarnings)}
          </p>
          <p className="text-xs text-amber-400/60 mt-1">sats</p>
        </div>

        {/* NOSTR Status */}
        <div className="glass-hover rounded-2xl p-5 group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Identity
            </p>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                />
              </svg>
            </div>
          </div>
          <p
            className="text-lg font-semibold text-emerald-400"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {user?.nostr_pubkey ? 'Connected' : 'Not connected'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
            {user?.nostr_pubkey ? `${user.nostr_pubkey.slice(0, 12)}...` : 'Set up NOSTR'}
          </p>
        </div>
      </div>

      {/* Content List */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2
            className="text-base font-semibold text-foreground"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Your Content
          </h2>
          <span className="text-xs text-muted-foreground">{contentItems.length} items</span>
        </div>

        {contentItems.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-purple-400/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
                />
              </svg>
            </div>
            <h3
              className="text-lg font-medium text-foreground mb-2"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              No content yet
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Start creating to see your dashboard come alive.
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all duration-200 shadow-[0_4px_16px_rgba(139,92,246,0.3)] no-underline"
            >
              Create Your First Content
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {contentItems.map((item) => (
              <div
                key={item.id}
                className="px-6 py-4 hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer group"
                onClick={() => navigate(`/post/${item.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <ContentTypeIcon type={item.content_type} />
                      <h3 className="text-sm font-medium text-foreground truncate group-hover:text-purple-400 transition-colors">
                        {item.title}
                      </h3>
                      <StatusBadge status={item.status} />
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate mb-1.5 ml-6">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground ml-6">
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      <span>{item.view_count} views</span>
                      <span>{item.like_count} likes</span>
                      {item.is_monetized && (
                        <span className="text-amber-400/60">{item.price_sats} sats</span>
                      )}
                      {item.tags?.length > 0 && (
                        <div className="flex gap-1">
                          {item.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="bg-white/5 text-white/30 px-1.5 py-0.5 rounded text-[10px]"
                            >
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 2 && (
                            <span className="text-white/20 text-[10px]">
                              +{item.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${item.id}`);
                      }}
                      className="px-3 py-1.5 text-xs text-purple-400 hover:text-purple-300 border border-purple-500/20 rounded-lg hover:bg-purple-500/10 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(item.id);
                      }}
                      className="p-1.5 text-white/20 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                      title="Delete"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="glass rounded-xl border border-red-500/20 px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default CreatorDashboard;
