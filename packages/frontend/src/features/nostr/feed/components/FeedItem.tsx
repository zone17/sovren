/**
 * FeedItem Component
 * Individual feed event item with engagement features
 */

import React, { memo, useCallback } from 'react';
import { Heart, Repeat2, MessageCircle, Share } from 'lucide-react';
import type { FeedItemProps } from '../types';
import { formatRelativeTime, formatCount } from '../utils/contentParser';

/**
 * FeedItem Component
 */
export const FeedItem = memo<FeedItemProps>(
  ({
    feedEvent,
    currentUserPubkey: _currentUserPubkey,
    condensed = false,
    onClick,
    onProfileClick,
    onLike,
    onRepost,
    onReply,
    className = '',
  }) => {
    const { event, engagement, authorProfile, parsedContent } = feedEvent;

    // Handle profile click
    const handleProfileClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onProfileClick?.(event.pubkey);
      },
      [event.pubkey, onProfileClick]
    );

    // Handle like
    const handleLike = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onLike?.(event);
      },
      [event, onLike]
    );

    // Handle repost
    const handleRepost = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onRepost?.(event);
      },
      [event, onRepost]
    );

    // Handle reply
    const handleReply = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onReply?.(event);
      },
      [event, onReply]
    );

    // Handle card click
    const handleClick = useCallback(() => {
      onClick?.(feedEvent);
    }, [feedEvent, onClick]);

    return (
      <article
        className={`feed-item border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${className}`}
        onClick={handleClick}
        data-event-id={event.id}
        role="article"
        aria-label={`Post by ${authorProfile?.name || 'Unknown'}`}
      >
        {/* Author Section */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          <button
            onClick={handleProfileClick}
            className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
            aria-label={`View profile of ${authorProfile?.name || 'Unknown'}`}
          >
            <img
              src={
                authorProfile?.picture ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${event.pubkey}`
              }
              alt={authorProfile?.name || 'User avatar'}
              className={`rounded-full ${condensed ? 'w-8 h-8' : 'w-12 h-12'}`}
            />
          </button>

          {/* Author Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleProfileClick}
                className="font-semibold text-gray-900 dark:text-gray-100 hover:underline focus:outline-none focus:underline"
              >
                {authorProfile?.display_name || authorProfile?.name || 'Unknown'}
              </button>
              {authorProfile?.nip05 && (
                <span
                  className="text-sm text-blue-500 flex items-center gap-1"
                  title="Verified NIP-05"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`${condensed ? 'ml-11' : 'ml-15'}`}>
          {/* Text Content */}
          {parsedContent && (
            <div
              className={`text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words ${
                condensed ? 'text-sm' : 'text-base'
              }`}
            >
              {parsedContent.text}
            </div>
          )}

          {/* Images */}
          {parsedContent?.images && parsedContent.images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {parsedContent.images.slice(0, 4).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Image ${idx + 1}`}
                  className="rounded-lg w-full h-48 object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {/* Videos */}
          {parsedContent?.videos && parsedContent.videos.length > 0 && (
            <div className="mt-3">
              {parsedContent.videos.map((video, idx) => (
                <video
                  key={idx}
                  src={video}
                  controls
                  className="rounded-lg w-full max-h-96"
                  preload="metadata"
                >
                  Your browser does not support video playback.
                </video>
              ))}
            </div>
          )}

          {/* Links Preview */}
          {parsedContent?.links && parsedContent.links.length > 0 && (
            <div className="mt-3 space-y-2">
              {parsedContent.links.slice(0, 2).map((link, idx) => (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-500 hover:underline break-all"
                  onClick={e => e.stopPropagation()}
                >
                  {link}
                </a>
              ))}
            </div>
          )}

          {/* Engagement Actions */}
          {!condensed && (
            <div
              className="mt-4 flex items-center gap-6 text-gray-500 dark:text-gray-400"
              role="group"
              aria-label="Post actions"
            >
              {/* Reply Button */}
              <button
                onClick={handleReply}
                className="flex items-center gap-2 hover:text-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1"
                aria-label={`Reply to post, ${engagement.replies} replies`}
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                <span className="text-sm">{formatCount(engagement.replies)}</span>
              </button>

              {/* Repost Button */}
              <button
                onClick={handleRepost}
                className={`flex items-center gap-2 hover:text-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full p-1 ${
                  engagement.isRepostedByUser ? 'text-green-500' : ''
                }`}
                aria-label={`Repost, ${engagement.reposts} reposts`}
                aria-pressed={engagement.isRepostedByUser}
              >
                <Repeat2 className="w-5 h-5" aria-hidden="true" />
                <span className="text-sm">{formatCount(engagement.reposts)}</span>
              </button>

              {/* Like Button */}
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full p-1 ${
                  engagement.isLikedByUser ? 'text-red-500' : ''
                }`}
                aria-label={`Like post, ${engagement.reactions} likes`}
                aria-pressed={engagement.isLikedByUser}
              >
                <Heart
                  className={`w-5 h-5 ${
                    engagement.isLikedByUser ? 'fill-current' : ''
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm">{formatCount(engagement.reactions)}</span>
              </button>

              {/* Share Button */}
              <button
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-2 hover:text-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-full p-1"
                aria-label="Share post"
              >
                <Share className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }
);

FeedItem.displayName = 'FeedItem';
