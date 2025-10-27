/**
 * ProfileManager Component
 * Comprehensive NOSTR profile viewing and editing component
 * Implements NIP-01 metadata events (kind 0)
 */

import React from 'react';
import { useProfileManager } from '../services/useProfileManager';
import { ProfileDisplay } from './ProfileDisplay';
import { ProfileEdit } from './ProfileEdit';
import type { ProfileManagerProps } from '../types';

/**
 * Main ProfileManager component
 * Handles both view and edit modes for NOSTR profiles
 */
export const ProfileManager: React.FC<ProfileManagerProps> = ({
  pubkey,
  isOwnProfile = false,
  onProfileUpdated,
  onAction,
  showEditButton = true,
  showActionButtons = true,
  className = '',
}) => {
  const {
    profile,
    isLoading,
    error,
    isEditMode,
    isPreviewMode,
    isPublishing,
    formData,
    formErrors,
    enterEditMode,
    exitEditMode,
    updateFormField,
    saveProfile,
    togglePreview,
    uploadImage,
  } = useProfileManager(pubkey);

  /**
   * Handle save with callback
   */
  const handleSave = async () => {
    await saveProfile();
    if (profile && onProfileUpdated) {
      onProfileUpdated(profile);
    }
  };

  /**
   * Handle action callbacks
   */
  const handleAction = (action: 'follow' | 'unfollow' | 'block' | 'mute' | 'report' | 'share' | 'tip') => {
    if (onAction) {
      onAction(action, pubkey);
    }
  };

  /**
   * Render loading state
   */
  if (isLoading && !profile) {
    return (
      <div className={`profile-manager ${className}`} role="status" aria-live="polite">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          <span className="sr-only">Loading profile...</span>
          <p className="ml-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && !profile) {
    return (
      <div className={`profile-manager ${className}`} role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg
              className="w-6 h-6 text-red-600 mr-3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Profile</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render empty state (no profile found)
   */
  if (!profile) {
    return (
      <div className={`profile-manager ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Profile Found</h3>
          <p className="mt-2 text-gray-600">Public key: {pubkey}</p>
          {isOwnProfile && showEditButton && (
            <button
              onClick={enterEditMode}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Profile
            </button>
          )}
        </div>
      </div>
    );
  }

  /**
   * Render edit mode
   */
  if (isEditMode) {
    return (
      <div className={`profile-manager profile-manager--edit ${className}`}>
        <ProfileEdit
          formData={formData}
          formErrors={formErrors}
          isPublishing={isPublishing}
          isPreviewMode={isPreviewMode}
          onFieldChange={updateFormField}
          onSave={handleSave}
          onCancel={exitEditMode}
          onPreview={togglePreview}
          onImageUpload={uploadImage}
        />
      </div>
    );
  }

  /**
   * Render view mode
   */
  return (
    <div className={`profile-manager profile-manager--view ${className}`}>
      <ProfileDisplay
        profile={profile}
        isOwnProfile={isOwnProfile}
        onEdit={showEditButton && isOwnProfile ? enterEditMode : undefined}
        onFollow={showActionButtons ? () => handleAction('follow') : undefined}
        onUnfollow={showActionButtons ? () => handleAction('unfollow') : undefined}
        onBlock={showActionButtons ? () => handleAction('block') : undefined}
        onMute={showActionButtons ? () => handleAction('mute') : undefined}
        onReport={showActionButtons ? () => handleAction('report') : undefined}
        onShare={showActionButtons ? () => handleAction('share') : undefined}
        onTip={showActionButtons ? () => handleAction('tip') : undefined}
        showEditButton={showEditButton}
        showActionButtons={showActionButtons}
      />
    </div>
  );
};

ProfileManager.displayName = 'ProfileManager';
