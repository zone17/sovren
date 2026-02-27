import React from 'react';
import { Button } from '../../../components/ui/button';
import type { CreatorSearchResult } from '../types';

interface CreatorCardProps {
  creator: CreatorSearchResult;
}

export const CreatorCard: React.FC<CreatorCardProps> = ({ creator }) => {
  return (
    <article
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
      aria-label={`Creator profile: ${creator.displayName}`}
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
              className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              aria-hidden="true"
            >
              {creator.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {creator.displayName}
              </h3>
              {creator.nip05Verified && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                  title="NIP-05 Verified"
                  aria-label="NIP-05 verified creator"
                >
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">@{creator.username}</p>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{creator.bio}</p>

        {/* Categories + Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Creator tags">
          {creator.categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
            >
              {cat}
            </span>
          ))}
          {creator.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
          <span>{creator.followerCount.toLocaleString()} followers</span>
          <span aria-hidden="true">|</span>
          <span>{creator.contentCount} posts</span>
        </div>
      </div>

      {/* Footer with action */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
        <Button
          variant="default"
          size="sm"
          disabled
          title="Creator profiles coming in Sprint 1"
          aria-label={`View ${creator.displayName}'s profile — coming soon`}
        >
          Coming Soon
        </Button>
      </div>
    </article>
  );
};
