/**
 * Type definitions for NOSTR Profile Management
 * Implements NIP-01 metadata events (kind 0)
 */

/**
 * NOSTR Profile Metadata (Kind 0 Event Content)
 * Based on NIP-01 specification
 */
export interface NostrProfileMetadata {
  /** Display name */
  name?: string;
  /** Bio/description */
  about?: string;
  /** Avatar image URL */
  picture?: string;
  /** Banner/header image URL */
  banner?: string;
  /** NIP-05 identifier (user@domain.com) */
  nip05?: string;
  /** Personal website URL */
  website?: string;
  /** Lightning address (LNURL or Lightning address) */
  lud16?: string;
  /** Alternative display name */
  display_name?: string;
  /** Additional metadata fields */
  [key: string]: string | undefined;
}

/**
 * Profile data with additional metadata
 */
export interface NostrProfile {
  /** Public key (hex format) */
  pubkey: string;
  /** Profile metadata */
  metadata: NostrProfileMetadata;
  /** NIP-05 verification status */
  nip05Valid?: boolean;
  /** Timestamp of last update */
  updatedAt?: number;
  /** Follower count (optional) */
  followerCount?: number;
  /** Following count (optional) */
  followingCount?: number;
}

/**
 * Profile edit form state
 */
export interface ProfileFormData {
  name: string;
  about: string;
  picture: string;
  banner: string;
  nip05: string;
  website: string;
  lud16: string;
  display_name: string;
}

/**
 * Profile form validation errors
 */
export interface ProfileFormErrors {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
  display_name?: string;
}

/**
 * Profile manager state
 */
export interface ProfileManagerState {
  /** Current profile data */
  profile: NostrProfile | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Edit mode active */
  isEditMode: boolean;
  /** Preview mode active */
  isPreviewMode: boolean;
  /** Publishing state */
  isPublishing: boolean;
  /** Form data */
  formData: ProfileFormData;
  /** Form validation errors */
  formErrors: ProfileFormErrors;
}

/**
 * Profile action types
 */
export type ProfileAction =
  | 'view'
  | 'edit'
  | 'follow'
  | 'unfollow'
  | 'block'
  | 'mute'
  | 'report'
  | 'share'
  | 'tip';

/**
 * Profile manager props
 */
export interface ProfileManagerProps {
  /** Public key of profile to display */
  pubkey: string;
  /** Whether this is the current user's profile */
  isOwnProfile?: boolean;
  /** Callback when profile is updated */
  onProfileUpdated?: (profile: NostrProfile) => void;
  /** Callback when action is triggered */
  onAction?: (action: ProfileAction, pubkey: string) => void;
  /** Show edit button */
  showEditButton?: boolean;
  /** Show action buttons */
  showActionButtons?: boolean;
  /** Custom CSS class */
  className?: string;
}

/**
 * Profile display mode props
 */
export interface ProfileDisplayProps {
  profile: NostrProfile;
  isOwnProfile: boolean;
  onEdit?: () => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onBlock?: () => void;
  onMute?: () => void;
  onReport?: () => void;
  onShare?: () => void;
  onTip?: () => void;
  showEditButton?: boolean;
  showActionButtons?: boolean;
}

/**
 * Profile edit mode props
 */
export interface ProfileEditProps {
  formData: ProfileFormData;
  formErrors: ProfileFormErrors;
  isPublishing: boolean;
  isPreviewMode: boolean;
  onFieldChange: (field: keyof ProfileFormData, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onPreview: () => void;
  onImageUpload: (field: 'picture' | 'banner', file: File) => Promise<void>;
}

/**
 * Image upload result
 */
export interface ImageUploadResult {
  url: string;
  error?: string;
}

/**
 * NIP-19 profile encoding (nprofile)
 */
export interface NIP19ProfileData {
  pubkey: string;
  relays?: string[];
}
