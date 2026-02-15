import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import type { DiscoveryCreator } from '../types';

interface CreatorCardProps {
  creator: DiscoveryCreator;
}

export const CreatorCard: React.FC<CreatorCardProps> = ({ creator }) => {
  const navigate = useNavigate();
  const lowestTier = creator.subscription_tiers[0];

  const handleViewProfile = () => {
    navigate(`/creator/${creator.id}`);
  };

  return (
    <article
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
      aria-label={`Creator profile: ${creator.display_name}`}
    >
      {/* Header with avatar and name */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            aria-hidden="true"
          >
            {creator.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {creator.display_name}
              </h3>
              {creator.nip05_verified && (
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

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Creator tags">
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
          <span>{creator.stats.follower_count.toLocaleString()} followers</span>
          <span aria-hidden="true">|</span>
          <span>{creator.stats.post_count} posts</span>
          <span aria-hidden="true">|</span>
          <span>{creator.stats.total_supporters} supporters</span>
        </div>

        {/* Featured content */}
        {creator.featured_content_title && (
          <div className="mt-3 px-3 py-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium">Featured</p>
            <p className="text-sm text-gray-800 truncate">{creator.featured_content_title}</p>
          </div>
        )}
      </div>

      {/* Footer with tier and action */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        {lowestTier && (
          <div>
            <p className="text-xs text-gray-500">From</p>
            <p className="text-sm font-semibold text-gray-900">
              {lowestTier.price_sats.toLocaleString()} sats/mo
            </p>
          </div>
        )}
        <Button
          onClick={handleViewProfile}
          variant="default"
          size="sm"
          aria-label={`View ${creator.display_name}'s profile`}
        >
          View Profile
        </Button>
      </div>
    </article>
  );
};
