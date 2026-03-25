import React, { useState } from 'react';
import { useCirclePosts, usePostToCircle } from '../hooks/useCircles';

interface CircleFeedProps {
  circleId: string;
  circleName?: string;
}

const CircleFeed: React.FC<CircleFeedProps> = ({ circleId, circleName }) => {
  const [page, setPage] = useState(1);
  const [postContent, setPostContent] = useState('');

  const { data, isLoading, isError } = useCirclePosts(circleId, page);
  const postMutation = usePostToCircle(circleId);

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;

  const handlePost = () => {
    if (!postContent.trim()) return;
    postMutation.mutate(postContent.trim(), {
      onSuccess: () => setPostContent(''),
    });
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load circle feed. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {circleName ? `${circleName} — Feed` : 'Circle Feed'}
      </h2>

      {/* Compose */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <textarea
          placeholder="Share something with your circle..."
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="New post content"
        />
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={!postContent.trim() || postMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {postMutation.isPending ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="h-3 w-24 bg-muted rounded mb-2" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-6">
          No posts yet. Be the first!
        </p>
      ) : (
        <ul className="space-y-3" role="list">
          {posts.map((post) => (
            <li key={post.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
                  {post.authorId.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs text-muted-foreground/60">
                  {new Date(post.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} posts total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CircleFeed;
