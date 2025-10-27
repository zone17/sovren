/**
 * ProfileManager Component Tests
 * Comprehensive test coverage following TDD approach
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileManager } from '../components/ProfileManager';
import type { NostrProfile, ProfileAction } from '../types';

// Mock the custom hook
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
  followerCount: 100,
  followingCount: 50,
};

// Mock dependencies
jest.mock('../services/useProfileManager', () => ({
  useProfileManager: jest.fn(() => ({
    profile: mockProfile,
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
    loadProfile: jest.fn(),
    enterEditMode: jest.fn(),
    exitEditMode: jest.fn(),
    updateFormField: jest.fn(),
    saveProfile: jest.fn(),
    togglePreview: jest.fn(),
    uploadImage: jest.fn(),
  })),
}));

describe('ProfileManager', () => {
  const defaultProps = {
    pubkey: '1234567890abcdef',
    isOwnProfile: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - View Mode', () => {
    it('renders loading state initially', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: null,
        isLoading: true,
        error: null,
        isEditMode: false,
      });

      render(<ProfileManager {...defaultProps} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('renders error state on fetch failure', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: null,
        isLoading: false,
        error: 'Failed to load profile',
        isEditMode: false,
      });

      render(<ProfileManager {...defaultProps} />);
      expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
    });

    it('renders profile data in view mode', () => {
      render(<ProfileManager {...defaultProps} />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Test bio')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('displays avatar image', () => {
      render(<ProfileManager {...defaultProps} />);

      const avatar = screen.getByAltText(/avatar/i);
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('displays banner image', () => {
      render(<ProfileManager {...defaultProps} />);

      const banner = screen.getByAltText(/banner/i);
      expect(banner).toHaveAttribute('src', 'https://example.com/banner.jpg');
    });

    it('shows NIP-05 verification badge when verified', () => {
      render(<ProfileManager {...defaultProps} />);

      expect(screen.getByTitle(/verified/i)).toBeInTheDocument();
    });

    it('does not show verification badge when not verified', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: { ...mockProfile, nip05Valid: false },
        isLoading: false,
        error: null,
        isEditMode: false,
      });

      render(<ProfileManager {...defaultProps} />);

      expect(screen.queryByTitle(/verified/i)).not.toBeInTheDocument();
    });

    it('displays follower and following counts', () => {
      render(<ProfileManager {...defaultProps} />);

      expect(screen.getByText(/100/)).toBeInTheDocument(); // Followers
      expect(screen.getByText(/50/)).toBeInTheDocument(); // Following
    });

    it('shows edit button for own profile', () => {
      render(<ProfileManager {...defaultProps} isOwnProfile showEditButton />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('does not show edit button for other profiles', () => {
      render(<ProfileManager {...defaultProps} isOwnProfile={false} showEditButton />);

      expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
    });
  });

  describe('Interactions - View Mode', () => {
    it('handles edit button click', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      const mockEnterEditMode = jest.fn();
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isLoading: false,
        error: null,
        isEditMode: false,
        enterEditMode: mockEnterEditMode,
      });

      render(<ProfileManager {...defaultProps} isOwnProfile showEditButton />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(mockEnterEditMode).toHaveBeenCalled();
    });

    it('handles follow button click', () => {
      const mockOnAction = jest.fn();
      render(
        <ProfileManager
          {...defaultProps}
          showActionButtons
          onAction={mockOnAction}
        />
      );

      const followButton = screen.getByRole('button', { name: /follow/i });
      fireEvent.click(followButton);

      expect(mockOnAction).toHaveBeenCalledWith('follow', defaultProps.pubkey);
    });

    it('handles share button click', () => {
      const mockOnAction = jest.fn();
      render(
        <ProfileManager
          {...defaultProps}
          showActionButtons
          onAction={mockOnAction}
        />
      );

      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);

      expect(mockOnAction).toHaveBeenCalledWith('share', defaultProps.pubkey);
    });

    it('handles lightning tip button click', () => {
      const mockOnAction = jest.fn();
      render(
        <ProfileManager
          {...defaultProps}
          showActionButtons
          onAction={mockOnAction}
        />
      );

      const tipButton = screen.getByRole('button', { name: /tip/i });
      fireEvent.click(tipButton);

      expect(mockOnAction).toHaveBeenCalledWith('tip', defaultProps.pubkey);
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isLoading: false,
        error: null,
        isEditMode: true,
        isPreviewMode: false,
        isPublishing: false,
        formData: {
          name: 'Test User',
          about: 'Test bio',
          picture: 'https://example.com/avatar.jpg',
          banner: 'https://example.com/banner.jpg',
          nip05: 'test@example.com',
          website: 'https://example.com',
          lud16: 'test@getalby.com',
          display_name: 'Test Display Name',
        },
        formErrors: {},
        updateFormField: jest.fn(),
        saveProfile: jest.fn(),
        exitEditMode: jest.fn(),
        togglePreview: jest.fn(),
      });
    });

    it('renders edit form when in edit mode', () => {
      render(<ProfileManager {...defaultProps} isOwnProfile />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/about/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/picture/i)).toBeInTheDocument();
    });

    it('populates form with current profile data', () => {
      render(<ProfileManager {...defaultProps} isOwnProfile />);

      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test bio')).toBeInTheDocument();
    });

    it('handles form field changes', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      const mockUpdateFormField = jest.fn();
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: { name: 'Test User' },
        updateFormField: mockUpdateFormField,
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      expect(mockUpdateFormField).toHaveBeenCalledWith('name', 'New Name');
    });

    it('displays validation errors', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: { name: '' },
        formErrors: { name: 'Name is required' },
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('handles save button click', async () => {
      const { useProfileManager } = require('../services/useProfileManager');
      const mockSaveProfile = jest.fn().mockResolvedValue(true);
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: { name: 'Updated Name' },
        formErrors: {},
        saveProfile: mockSaveProfile,
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveProfile).toHaveBeenCalled();
      });
    });

    it('handles cancel button click', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      const mockExitEditMode = jest.fn();
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: {},
        exitEditMode: mockExitEditMode,
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockExitEditMode).toHaveBeenCalled();
    });

    it('handles preview button click', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      const mockTogglePreview = jest.fn();
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: {},
        togglePreview: mockTogglePreview,
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      expect(mockTogglePreview).toHaveBeenCalled();
    });

    it('disables save button while publishing', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        isPublishing: true,
        formData: {},
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for avatar', () => {
      render(<ProfileManager {...defaultProps} />);

      const avatar = screen.getByAltText(/avatar/i);
      expect(avatar).toHaveAttribute('alt');
    });

    it('has proper ARIA labels for action buttons', () => {
      render(<ProfileManager {...defaultProps} showActionButtons />);

      expect(screen.getByRole('button', { name: /follow/i })).toHaveAccessibleName();
      expect(screen.getByRole('button', { name: /share/i })).toHaveAccessibleName();
    });

    it('is keyboard navigable in view mode', () => {
      render(<ProfileManager {...defaultProps} showActionButtons />);

      const followButton = screen.getByRole('button', { name: /follow/i });
      followButton.focus();
      expect(followButton).toHaveFocus();
    });

    it('is keyboard navigable in edit mode', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: {},
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      const nameInput = screen.getByLabelText(/name/i);
      nameInput.focus();
      expect(nameInput).toHaveFocus();
    });

    it('has proper form labels', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: {},
      });

      render(<ProfileManager {...defaultProps} isOwnProfile />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/about/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing profile data gracefully', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: {
          pubkey: '1234567890abcdef',
          metadata: {},
        },
        isLoading: false,
        error: null,
      });

      render(<ProfileManager {...defaultProps} />);

      // Should render without crashing
      expect(screen.getByText(/1234567890abcdef/)).toBeInTheDocument();
    });

    it('handles invalid image URLs', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: {
          ...mockProfile,
          metadata: { ...mockProfile.metadata, picture: 'invalid-url' },
        },
        isLoading: false,
      });

      render(<ProfileManager {...defaultProps} />);

      const avatar = screen.getByAltText(/avatar/i);
      expect(avatar).toBeInTheDocument();
    });

    it('handles empty NIP-05', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: {
          ...mockProfile,
          metadata: { ...mockProfile.metadata, nip05: undefined },
        },
        isLoading: false,
      });

      render(<ProfileManager {...defaultProps} />);

      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });

    it('handles missing Lightning address', () => {
      const { useProfileManager } = require('../services/useProfileManager');
      useProfileManager.mockReturnValue({
        profile: {
          ...mockProfile,
          metadata: { ...mockProfile.metadata, lud16: undefined },
        },
        isLoading: false,
      });

      render(<ProfileManager {...defaultProps} showActionButtons />);

      const tipButton = screen.queryByRole('button', { name: /tip/i });
      expect(tipButton).toBeDisabled();
    });

    it('calls onProfileUpdated after successful save', async () => {
      const { useProfileManager } = require('../services/useProfileManager');
      const mockSaveProfile = jest.fn().mockResolvedValue(true);
      const mockOnProfileUpdated = jest.fn();

      useProfileManager.mockReturnValue({
        profile: mockProfile,
        isEditMode: true,
        formData: {},
        saveProfile: mockSaveProfile,
      });

      render(
        <ProfileManager
          {...defaultProps}
          isOwnProfile
          onProfileUpdated={mockOnProfileUpdated}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnProfileUpdated).toHaveBeenCalled();
      });
    });
  });

  describe('Responsive Design', () => {
    it('applies mobile layout on small screens', () => {
      // Mock window.matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 640px)',
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(<ProfileManager {...defaultProps} />);

      // Check for mobile-specific classes or layout
      expect(container.querySelector('.profile-manager')).toBeInTheDocument();
    });
  });
});
