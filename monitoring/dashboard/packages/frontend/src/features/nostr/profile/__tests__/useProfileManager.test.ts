/**
 * useProfileManager Hook Tests
 * Tests for profile management business logic
 */

import { renderHook, act } from '@testing-library/react';
import { useProfileManager } from '../services/useProfileManager';
import type { NostrProfile } from '../types';

// Mock profile data
const mockProfile: NostrProfile = {
  pubkey: '1234567890abcdef',
  metadata: {
    name: 'Test User',
    about: 'Test bio',
    picture: 'https://example.com/avatar.jpg',
    banner: 'https://example.com/banner.jpg',
    nip05: 'test@example.com',
    website: 'https://example.com',
    lud16: 'test@getalby.com',
    display_name: 'Test Display Name',
  },
  nip05Valid: true,
  updatedAt: Date.now(),
};

// Mock external services
const mockEventPublisher = {
  publishEvent: jest.fn().mockResolvedValue({ id: 'event123' }),
};

const mockSubscriptionManager = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

const mockEventCache = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockNIP05Service = {
  verify: jest.fn().mockResolvedValue(true),
};

jest.mock('../../../services/nostr/EventPublisherService', () => ({
  EventPublisherService: jest.fn(() => mockEventPublisher),
}));

jest.mock('../../../services/nostr/SubscriptionManagerService', () => ({
  SubscriptionManagerService: jest.fn(() => mockSubscriptionManager),
}));

jest.mock('../../../services/nostr/EventCacheService', () => ({
  EventCacheService: jest.fn(() => mockEventCache),
}));

jest.mock('../../../services/nostr/NIP05Service', () => ({
  NIP05Service: jest.fn(() => mockNIP05Service),
}));

describe('useProfileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with null profile and loading false', () => {
      const { result } = renderHook(() => useProfileManager('testpubkey'));

      expect(result.current.profile).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isEditMode).toBe(false);
    });
  });

  describe('loadProfile', () => {
    it('loads profile from cache if available', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      expect(mockEventCache.get).toHaveBeenCalledWith('profile:testpubkey');
      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.isLoading).toBe(false);
    });

    it('fetches profile from relays if not cached', async () => {
      mockEventCache.get.mockReturnValue(null);
      mockSubscriptionManager.subscribe.mockImplementation((filters, callback) => {
        callback([
          {
            id: 'event1',
            kind: 0,
            pubkey: 'testpubkey',
            content: JSON.stringify(mockProfile.metadata),
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            sig: 'signature',
          },
        ]);
        return 'sub123';
      });

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      expect(mockSubscriptionManager.subscribe).toHaveBeenCalled();
      expect(result.current.profile?.metadata.name).toBe('Test User');
    });

    it('sets error state on fetch failure', async () => {
      mockEventCache.get.mockReturnValue(null);
      mockSubscriptionManager.subscribe.mockImplementation(() => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isLoading).toBe(false);
    });

    it('verifies NIP-05 after loading', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      expect(mockNIP05Service.verify).toHaveBeenCalledWith(
        'test@example.com',
        'testpubkey'
      );
      expect(result.current.profile?.nip05Valid).toBe(true);
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode and populates form', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
      });

      expect(result.current.isEditMode).toBe(true);
      expect(result.current.formData.name).toBe('Test User');
      expect(result.current.formData.about).toBe('Test bio');
    });

    it('exits edit mode and clears form', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
      });

      act(() => {
        result.current.exitEditMode();
      });

      expect(result.current.isEditMode).toBe(false);
      expect(result.current.formData.name).toBe('');
    });

    it('updates form field', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
      });

      act(() => {
        result.current.updateFormField('name', 'New Name');
      });

      expect(result.current.formData.name).toBe('New Name');
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('name', '');
      });

      act(() => {
        result.current.saveProfile();
      });

      expect(result.current.formErrors.name).toBeTruthy();
    });

    it('validates URL fields', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('website', 'invalid-url');
      });

      act(() => {
        result.current.saveProfile();
      });

      expect(result.current.formErrors.website).toBeTruthy();
    });

    it('validates NIP-05 format', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('nip05', 'invalid');
      });

      act(() => {
        result.current.saveProfile();
      });

      expect(result.current.formErrors.nip05).toBeTruthy();
    });

    it('validates Lightning address format', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('lud16', 'invalid');
      });

      act(() => {
        result.current.saveProfile();
      });

      expect(result.current.formErrors.lud16).toBeTruthy();
    });
  });

  describe('saveProfile', () => {
    it('publishes kind 0 event with metadata', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('name', 'Updated Name');
      });

      await act(async () => {
        await result.current.saveProfile();
      });

      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 0,
          content: expect.any(String),
        })
      );
    });

    it('updates cache after successful publish', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('name', 'Updated Name');
      });

      await act(async () => {
        await result.current.saveProfile();
      });

      expect(mockEventCache.set).toHaveBeenCalled();
    });

    it('exits edit mode after successful save', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
      });

      await act(async () => {
        await result.current.saveProfile();
      });

      expect(result.current.isEditMode).toBe(false);
    });

    it('does not save if validation fails', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
        result.current.updateFormField('name', '');
      });

      await act(async () => {
        await result.current.saveProfile();
      });

      expect(mockEventPublisher.publishEvent).not.toHaveBeenCalled();
    });

    it('handles publish errors gracefully', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);
      mockEventPublisher.publishEvent.mockRejectedValueOnce(
        new Error('Publish failed')
      );

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
      });

      await act(async () => {
        await result.current.saveProfile();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isEditMode).toBe(true);
    });
  });

  describe('Preview Mode', () => {
    it('toggles preview mode', async () => {
      mockEventCache.get.mockReturnValue(mockProfile);

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      await act(async () => {
        await result.current.loadProfile();
      });

      act(() => {
        result.current.enterEditMode();
      });

      act(() => {
        result.current.togglePreview();
      });

      expect(result.current.isPreviewMode).toBe(true);

      act(() => {
        result.current.togglePreview();
      });

      expect(result.current.isPreviewMode).toBe(false);
    });
  });

  describe('Image Upload', () => {
    it('uploads image and updates form', async () => {
      const mockFile = new File(['image'], 'avatar.jpg', { type: 'image/jpeg' });
      const mockUploadService = {
        upload: jest.fn().mockResolvedValue({ url: 'https://example.com/new-avatar.jpg' }),
      };

      const { result } = renderHook(() => useProfileManager('testpubkey'));

      act(() => {
        result.current.enterEditMode();
      });

      await act(async () => {
        await result.current.uploadImage('picture', mockFile);
      });

      // Expect form field to be updated with new URL
      expect(result.current.formData.picture).toBe('https://example.com/new-avatar.jpg');
    });
  });

  describe('Cleanup', () => {
    it('unsubscribes from events on unmount', () => {
      const { unmount } = renderHook(() => useProfileManager('testpubkey'));

      unmount();

      expect(mockSubscriptionManager.unsubscribe).toHaveBeenCalled();
    });
  });
});
