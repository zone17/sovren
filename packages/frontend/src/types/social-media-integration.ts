/**
 * 🌐 **FRONTEND SOCIAL MEDIA INTEGRATION TYPES**
 *
 * Re-exports and extends backend types for frontend use
 */

// Re-export all types from backend
export * from '../../../backend/src/types/social-media-integration';

// Additional frontend-specific types can be added here if needed
export interface SocialMediaComponentProps {
  className?: string;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

export interface SocialShareButtonsProps extends SocialMediaComponentProps {
  contentId: string;
  contentUrl: string;
  title: string;
  description?: string;
  imageUrl?: string;
}
