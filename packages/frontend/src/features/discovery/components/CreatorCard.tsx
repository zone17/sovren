import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import type { CreatorSearchResult } from '../types';

interface CreatorCardProps {
  creator: CreatorSearchResult;
}

export const CreatorCard = ({ creator }: CreatorCardProps) => {
  return (
    <article
      className="glass-hover rounded-xl overflow-hidden transition-all duration-150"
      aria-label={`Creator profile: ${creator.displayName || creator.username || 'Unknown'}`}
    >
      {/* Header with avatar and name */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {creator.avatarUrl ? (
            <img
              src={creator.avatarUrl}
              alt=""
              loading="lazy"
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              aria-hidden="true"
            >
              {(creator.displayName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground truncate">
                {creator.displayName || creator.username || 'Anonymous'}
              </h3>
              {creator.nip05Verified && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300"
                  title="NIP-05 Verified"
                  aria-label="NIP-05 verified creator"
                >
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{creator.username}</p>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{creator.bio}</p>

        {/* Categories + Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Creator tags">
          {creator.categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300"
            >
              {cat}
            </span>
          ))}
          {creator.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-card text-muted-foreground border border-border"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{creator.followerCount.toLocaleString()} followers</span>
          <span aria-hidden="true">|</span>
          <span>{creator.contentCount} posts</span>
        </div>
      </div>

      {/* Footer with action */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-end">
        <Link to={`/creator/${creator.id}`}>
          <Button
            variant="outline"
            size="sm"
            aria-label={`View ${creator.displayName || creator.username || 'creator'}'s profile`}
          >
            View Profile
          </Button>
        </Link>
      </div>
    </article>
  );
};
