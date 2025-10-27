/**
 * ProfileDisplay Component
 * View mode for NOSTR profiles with all metadata and actions
 */

import React from 'react';
import type { ProfileDisplayProps } from '../types';

export const ProfileDisplay: React.FC<ProfileDisplayProps> = ({
  profile,
  isOwnProfile,
  onEdit,
  onFollow,
  onUnfollow,
  onBlock,
  onMute,
  onReport,
  onShare,
  onTip,
  showEditButton,
  showActionButtons,
}) => {
  const { metadata, nip05Valid, followerCount, followingCount } = profile;
  const hasLightningAddress = Boolean(metadata.lud16);

  return (
    <div className="profile-display bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Banner Image */}
      {metadata.banner && (
        <div className="profile-banner relative h-48 md:h-64 bg-gradient-to-r from-indigo-500 to-purple-600">
          <img
            src={metadata.banner}
            alt="Profile banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Profile Header */}
      <div className="profile-header relative px-4 md:px-6 pb-6">
        {/* Avatar */}
        <div className="flex items-end justify-between -mt-16 mb-4">
          <div className="profile-avatar relative">
            {metadata.picture ? (
              <img
                src={metadata.picture}
                alt="Profile avatar"
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-gray-200"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.pubkey}`;
                }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                {(metadata.name || metadata.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            {showEditButton && isOwnProfile && onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                aria-label="Edit profile"
              >
                Edit
              </button>
            )}

            {showActionButtons && !isOwnProfile && (
              <>
                {onFollow && (
                  <button
                    onClick={onFollow}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    aria-label="Follow user"
                  >
                    Follow
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={onShare}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    aria-label="Share profile"
                  >
                    Share
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="profile-info">
          {/* Name and Display Name */}
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              {metadata.display_name || metadata.name || 'Anonymous'}
              {nip05Valid && (
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-label="Verified"
                  title="Verified NIP-05"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </h1>
            {metadata.name && metadata.display_name && metadata.name !== metadata.display_name && (
              <p className="text-gray-600">@{metadata.name}</p>
            )}
          </div>

          {/* NIP-05 Identifier */}
          {metadata.nip05 && (
            <div className="flex items-center gap-2 text-gray-600 mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                />
              </svg>
              <span className="font-mono text-sm">{metadata.nip05}</span>
            </div>
          )}

          {/* Bio/About */}
          {metadata.about && (
            <p className="text-gray-700 mb-4 whitespace-pre-wrap">{metadata.about}</p>
          )}

          {/* Website */}
          {metadata.website && (
            <a
              href={metadata.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              {metadata.website.replace(/^https?:\/\//, '')}
            </a>
          )}

          {/* Stats */}
          {(followerCount !== undefined || followingCount !== undefined) && (
            <div className="flex gap-6 mb-4 text-sm">
              {followerCount !== undefined && (
                <div>
                  <span className="font-bold text-gray-900">{followerCount}</span>
                  <span className="text-gray-600 ml-1">Followers</span>
                </div>
              )}
              {followingCount !== undefined && (
                <div>
                  <span className="font-bold text-gray-900">{followingCount}</span>
                  <span className="text-gray-600 ml-1">Following</span>
                </div>
              )}
            </div>
          )}

          {/* Lightning Tip Button */}
          {showActionButtons && hasLightningAddress && onTip && (
            <button
              onClick={onTip}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium mb-4"
              aria-label="Send Lightning tip"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              Tip
            </button>
          )}

          {/* Disabled tip button if no Lightning address */}
          {showActionButtons && !hasLightningAddress && onTip && (
            <button
              disabled
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed mb-4"
              aria-label="Tip unavailable"
              title="No Lightning address configured"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              Tip
            </button>
          )}
        </div>

        {/* Additional Actions */}
        {showActionButtons && !isOwnProfile && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            {onBlock && (
              <button
                onClick={onBlock}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Block user"
              >
                Block
              </button>
            )}
            {onMute && (
              <button
                onClick={onMute}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Mute user"
              >
                Mute
              </button>
            )}
            {onReport && (
              <button
                onClick={onReport}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Report user"
              >
                Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

ProfileDisplay.displayName = 'ProfileDisplay';
