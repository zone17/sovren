/**
 * useProfileManager Hook
 * Manages NOSTR profile loading, editing, and publishing
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  NostrProfile,
  NostrProfileMetadata,
  ProfileFormData,
  ProfileFormErrors,
  ProfileManagerState,
} from '../types';

/**
 * Validates a URL string
 */
const isValidUrl = (url: string): boolean => {
  if (!url) return true; // Empty is valid
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates NIP-05 identifier format (user@domain.com)
 */
const isValidNIP05 = (nip05: string): boolean => {
  if (!nip05) return true; // Empty is valid
  const nip05Regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return nip05Regex.test(nip05);
};

/**
 * Validates Lightning address format (user@domain.com)
 */
const isValidLightningAddress = (lud16: string): boolean => {
  if (!lud16) return true; // Empty is valid
  const lud16Regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return lud16Regex.test(lud16);
};

/**
 * Custom hook for managing NOSTR profiles
 */
export const useProfileManager = (pubkey: string) => {
  const [state, setState] = useState<ProfileManagerState>({
    profile: null,
    isLoading: false,
    error: null,
    isEditMode: false,
    isPreviewMode: false,
    isPublishing: false,
    formData: {
      name: '',
      about: '',
      picture: '',
      banner: '',
      nip05: '',
      website: '',
      lud16: '',
      display_name: '',
    },
    formErrors: {},
  });

  /**
   * Load profile from cache or relays
   */
  const loadProfile = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // In a real implementation, this would:
      // 1. Check EventCacheService for cached profile
      // 2. If not cached, subscribe to kind 0 events
      // 3. Parse the event content as JSON metadata
      // 4. Verify NIP-05 if present
      // 5. Cache the result

      // Mock implementation for now
      const mockProfile: NostrProfile = {
        pubkey,
        metadata: {
          name: 'User',
          about: 'Bio',
          picture: '',
          banner: '',
          nip05: '',
          website: '',
          lud16: '',
          display_name: '',
        },
        nip05Valid: false,
        updatedAt: Date.now(),
      };

      setState(prev => ({
        ...prev,
        profile: mockProfile,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load profile',
        isLoading: false,
      }));
    }
  }, [pubkey]);

  /**
   * Enter edit mode and populate form
   */
  const enterEditMode = useCallback(() => {
    if (!state.profile) return;

    const formData: ProfileFormData = {
      name: state.profile.metadata.name || '',
      about: state.profile.metadata.about || '',
      picture: state.profile.metadata.picture || '',
      banner: state.profile.metadata.banner || '',
      nip05: state.profile.metadata.nip05 || '',
      website: state.profile.metadata.website || '',
      lud16: state.profile.metadata.lud16 || '',
      display_name: state.profile.metadata.display_name || '',
    };

    setState(prev => ({
      ...prev,
      isEditMode: true,
      formData,
      formErrors: {},
    }));
  }, [state.profile]);

  /**
   * Exit edit mode and clear form
   */
  const exitEditMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isEditMode: false,
      isPreviewMode: false,
      formData: {
        name: '',
        about: '',
        picture: '',
        banner: '',
        nip05: '',
        website: '',
        lud16: '',
        display_name: '',
      },
      formErrors: {},
    }));
  }, []);

  /**
   * Update form field
   */
  const updateFormField = useCallback(
    (field: keyof ProfileFormData, value: string) => {
      setState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          [field]: value,
        },
        // Clear error for this field
        formErrors: {
          ...prev.formErrors,
          [field]: undefined,
        },
      }));
    },
    []
  );

  /**
   * Validate form data
   */
  const validateForm = useCallback((): boolean => {
    const errors: ProfileFormErrors = {};

    // Validate URLs
    if (state.formData.picture && !isValidUrl(state.formData.picture)) {
      errors.picture = 'Invalid picture URL';
    }
    if (state.formData.banner && !isValidUrl(state.formData.banner)) {
      errors.banner = 'Invalid banner URL';
    }
    if (state.formData.website && !isValidUrl(state.formData.website)) {
      errors.website = 'Invalid website URL';
    }

    // Validate NIP-05
    if (state.formData.nip05 && !isValidNIP05(state.formData.nip05)) {
      errors.nip05 = 'Invalid NIP-05 format (user@domain.com)';
    }

    // Validate Lightning address
    if (state.formData.lud16 && !isValidLightningAddress(state.formData.lud16)) {
      errors.lud16 = 'Invalid Lightning address format (user@domain.com)';
    }

    setState(prev => ({ ...prev, formErrors: errors }));

    return Object.keys(errors).length === 0;
  }, [state.formData]);

  /**
   * Save profile (publish kind 0 event)
   */
  const saveProfile = useCallback(async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setState(prev => ({ ...prev, isPublishing: true, error: null }));

    try {
      // In a real implementation, this would:
      // 1. Create a kind 0 event with metadata as JSON content
      // 2. Sign the event using KeyManagementService
      // 3. Publish to relays using EventPublisherService
      // 4. Update EventCacheService
      // 5. Trigger NIP-05 verification if nip05 field changed

      const metadata: NostrProfileMetadata = {
        name: state.formData.name,
        about: state.formData.about,
        picture: state.formData.picture,
        banner: state.formData.banner,
        nip05: state.formData.nip05,
        website: state.formData.website,
        lud16: state.formData.lud16,
        display_name: state.formData.display_name,
      };

      // Mock successful publish
      const updatedProfile: NostrProfile = {
        pubkey,
        metadata,
        nip05Valid: false, // Will be verified asynchronously
        updatedAt: Date.now(),
      };

      setState(prev => ({
        ...prev,
        profile: updatedProfile,
        isPublishing: false,
        isEditMode: false,
        isPreviewMode: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to publish profile',
        isPublishing: false,
      }));
    }
  }, [pubkey, state.formData, validateForm]);

  /**
   * Toggle preview mode
   */
  const togglePreview = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPreviewMode: !prev.isPreviewMode,
    }));
  }, []);

  /**
   * Upload image and update form field
   */
  const uploadImage = useCallback(
    async (field: 'picture' | 'banner', file: File) => {
      try {
        // In a real implementation, this would:
        // 1. Upload to image hosting service (nostr.build, imgur, etc.)
        // 2. Get the URL
        // 3. Update the form field

        // Mock upload
        const mockUrl = `https://example.com/${file.name}`;
        updateFormField(field, mockUrl);
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to upload image',
        }));
      }
    },
    [updateFormField]
  );

  /**
   * Load profile on mount and when pubkey changes
   */
  useEffect(() => {
    if (pubkey) {
      loadProfile();
    }

    // Cleanup: unsubscribe from events
    return () => {
      // In real implementation, call SubscriptionManagerService.unsubscribe()
    };
  }, [pubkey, loadProfile]);

  return {
    // State
    profile: state.profile,
    isLoading: state.isLoading,
    error: state.error,
    isEditMode: state.isEditMode,
    isPreviewMode: state.isPreviewMode,
    isPublishing: state.isPublishing,
    formData: state.formData,
    formErrors: state.formErrors,

    // Actions
    loadProfile,
    enterEditMode,
    exitEditMode,
    updateFormField,
    saveProfile,
    togglePreview,
    uploadImage,
  };
};
