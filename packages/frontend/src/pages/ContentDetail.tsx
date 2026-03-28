import DOMPurify from 'dompurify';
import { Link, useParams } from 'react-router-dom';
import { CommentList } from '../features/comments/components/CommentList';
import { useAuth } from '../features/auth/services/AuthContext';
import { useContentItem } from '../queries/content/useContentItem';
import { Spinner } from '../components/ui/spinner';

export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  if (!id) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground font-display">Content Not Found</h1>
        <p className="text-muted-foreground mt-2">
          The content you are looking for does not exist.
        </p>
        <Link
          to="/discover"
          className="inline-block mt-6 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
        >
          Browse content
        </Link>
      </div>
    );
  }

  const { data: content, isLoading, error } = useContentItem(id);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center justify-center" role="status" aria-label="Loading content">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-muted-foreground">Loading content...</p>
      </div>
    );
  }

  if (error || !content) {
    const is404 = error?.message === 'Content not found';
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground font-display">
          {is404 ? 'Content Not Found' : 'Something Went Wrong'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {is404
            ? 'The content you are looking for does not exist or has been removed.'
            : 'We could not load this content. Please try again later.'}
        </p>
        <Link
          to="/discover"
          className="inline-block mt-6 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
        >
          Browse content
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Content header */}
      <article>
        {content.coverImage && (
          <img
            src={content.coverImage}
            alt={content.title}
            className="w-full h-64 sm:h-80 object-cover rounded-xl mb-6"
          />
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-display mb-4">
          {content.title}
        </h1>

        {/* Author and metadata */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
          {content.creator?.picture ? (
            <img
              src={content.creator.picture}
              alt={content.creator.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-400">
              {(content.creator?.name || content.creatorName || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {content.creator?.name || content.creatorName}
            </p>
            {content.publishedAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(content.publishedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>

        {/* Media (video/audio) */}
        {content.mediaUrl && content.type === 'video' && (
          <div className="mb-6 rounded-xl overflow-hidden bg-black">
            <video src={content.mediaUrl} controls className="w-full" />
          </div>
        )}
        {content.mediaUrl && content.type === 'audio' && (
          <div className="mb-6">
            <audio src={content.mediaUrl} controls className="w-full" />
          </div>
        )}

        {/* Body content */}
        <div
          className="prose prose-invert prose-purple max-w-none mb-8 text-white/80 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.content) }}
        />

        {/* Tags */}
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {content.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-medium rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Comments */}
      <section className="mt-8 pt-8 border-t border-white/5">
        <h2 className="text-xl font-semibold text-foreground font-display mb-6">Comments</h2>
        <CommentList contentId={id} currentUserId={user?.id} />
      </section>
    </div>
  );
}
