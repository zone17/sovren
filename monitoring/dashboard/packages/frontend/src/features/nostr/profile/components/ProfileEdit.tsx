/**
 * ProfileEdit Component
 * Edit mode for NOSTR profiles with form validation and preview
 */

import React, { useRef } from 'react';
import type { ProfileEditProps } from '../types';

export const ProfileEdit: React.FC<ProfileEditProps> = ({
  formData,
  formErrors,
  isPublishing,
  isPreviewMode,
  onFieldChange,
  onSave,
  onCancel,
  onPreview,
  onImageUpload,
}) => {
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle image file selection
   */
  const handleImageSelect = async (field: 'picture' | 'banner', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('File must be an image');
        return;
      }
      await onImageUpload(field, file);
    }
  };

  if (isPreviewMode) {
    return (
      <div className="profile-edit profile-edit--preview bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Preview Profile</h2>
          <button
            onClick={onPreview}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="Back to edit"
          >
            Back to Edit
          </button>
        </div>

        {/* Preview rendering would go here - similar to ProfileDisplay */}
        <div className="space-y-4">
          {formData.banner && (
            <img src={formData.banner} alt="Banner preview" className="w-full h-48 object-cover rounded-lg" />
          )}
          {formData.picture && (
            <img src={formData.picture} alt="Avatar preview" className="w-32 h-32 rounded-full" />
          )}
          <h3 className="text-xl font-bold">{formData.display_name || formData.name || 'Anonymous'}</h3>
          {formData.nip05 && <p className="text-gray-600">{formData.nip05}</p>}
          {formData.about && <p className="text-gray-700 whitespace-pre-wrap">{formData.about}</p>}
          {formData.website && (
            <a href={formData.website} className="text-indigo-600 hover:underline">
              {formData.website}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="profile-edit bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
        <div className="flex gap-2">
          <button
            onClick={onPreview}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="Preview profile"
          >
            Preview
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="space-y-6"
        noValidate
      >
        {/* Banner Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Banner Image
          </label>
          {formData.banner && (
            <div className="mb-2 relative">
              <img
                src={formData.banner}
                alt="Current banner"
                className="w-full h-32 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => onFieldChange('banner', '')}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                aria-label="Remove banner"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.banner}
              onChange={(e) => onFieldChange('banner', e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              aria-label="Banner image URL"
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect('banner', e)}
              className="hidden"
              aria-label="Upload banner image file"
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Upload banner"
            >
              Upload
            </button>
          </div>
          {formErrors.banner && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.banner}
            </p>
          )}
        </div>

        {/* Avatar Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Avatar Image
          </label>
          {formData.picture && (
            <div className="mb-2 relative inline-block">
              <img
                src={formData.picture}
                alt="Current avatar"
                className="w-32 h-32 rounded-full object-cover"
              />
              <button
                type="button"
                onClick={() => onFieldChange('picture', '')}
                className="absolute top-0 right-0 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                aria-label="Remove avatar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.picture}
              onChange={(e) => onFieldChange('picture', e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              aria-label="Avatar image URL"
            />
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect('picture', e)}
              className="hidden"
              aria-label="Upload avatar image file"
            />
            <button
              type="button"
              onClick={() => pictureInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Upload avatar"
            >
              Upload
            </button>
          </div>
          {formErrors.picture && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.picture}
            </p>
          )}
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-2">
            Display Name
          </label>
          <input
            id="display_name"
            type="text"
            value={formData.display_name}
            onChange={(e) => onFieldChange('display_name', e.target.value)}
            placeholder="Your display name"
            maxLength={50}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {formErrors.display_name && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.display_name}
            </p>
          )}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Name (Username)
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder="username"
            maxLength={30}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.name}
            </p>
          )}
        </div>

        {/* About */}
        <div>
          <label htmlFor="about" className="block text-sm font-medium text-gray-700 mb-2">
            About
          </label>
          <textarea
            id="about"
            value={formData.about}
            onChange={(e) => onFieldChange('about', e.target.value)}
            placeholder="Tell people about yourself..."
            rows={4}
            maxLength={500}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          />
          <div className="mt-1 flex justify-between text-sm text-gray-500">
            <span>{formData.about.length}/500</span>
          </div>
          {formErrors.about && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.about}
            </p>
          )}
        </div>

        {/* NIP-05 */}
        <div>
          <label htmlFor="nip05" className="block text-sm font-medium text-gray-700 mb-2">
            NIP-05 Identifier
          </label>
          <input
            id="nip05"
            type="text"
            value={formData.nip05}
            onChange={(e) => onFieldChange('nip05', e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
          />
          <p className="mt-1 text-sm text-gray-500">
            Format: username@domain.com
          </p>
          {formErrors.nip05 && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.nip05}
            </p>
          )}
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => onFieldChange('website', e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {formErrors.website && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.website}
            </p>
          )}
        </div>

        {/* Lightning Address */}
        <div>
          <label htmlFor="lud16" className="block text-sm font-medium text-gray-700 mb-2">
            Lightning Address
          </label>
          <input
            id="lud16"
            type="text"
            value={formData.lud16}
            onChange={(e) => onFieldChange('lud16', e.target.value)}
            placeholder="you@getalby.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
          />
          <p className="mt-1 text-sm text-gray-500">
            For receiving Lightning Network tips
          </p>
          {formErrors.lud16 && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {formErrors.lud16}
            </p>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isPublishing}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-wait transition-colors font-medium"
            aria-label={isPublishing ? 'Saving profile' : 'Save profile'}
          >
            {isPublishing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save Profile'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPublishing}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
            aria-label="Cancel editing"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

ProfileEdit.displayName = 'ProfileEdit';
