/**
 * 🔗 **SOCIAL SHARE BUTTONS COMPONENT**
 *
 * Elite React Component implementing US-135: Social Media Sharing
 * - Beautiful, responsive share buttons
 * - Platform-specific customization
 * - Analytics tracking
 * - Accessibility compliant
 * - Mobile-first design
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  MessageSquare,
  Send,
  Share2,
  Twitter,
  Users,
  Youtube,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useSocialMediaService } from '../../hooks/useSocialMediaService';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import {
  SocialPlatform,
  SocialShareRequest,
  SocialShareResponse,
} from '../../types/social-media-integration';

// =====================================================
// COMPONENT TYPES
// =====================================================

interface SocialShareButtonsProps {
  contentId: string;
  contentUrl: string;
  title: string;
  description?: string;
  imageUrl?: string;
  platforms?: SocialPlatform[];
  config?: {
    style?: 'buttons' | 'icons' | 'floating' | 'inline';
    size?: 'small' | 'medium' | 'large';
    showLabels?: boolean;
    showCount?: boolean;
    customMessages?: Record<SocialPlatform, string>;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'floating';
    analytics?: boolean;
    theme?: 'light' | 'dark' | 'auto';
  };
  className?: string;
  onShare?: (platform: SocialPlatform, response: SocialShareResponse) => void;
}

interface PlatformConfig {
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  hoverColor: string;
  textColor: string;
  gradient: string;
}

// =====================================================
// PLATFORM CONFIGURATIONS
// =====================================================

const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  [SocialPlatform.TWITTER]: {
    icon: Twitter,
    label: 'Twitter',
    color: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
    textColor: 'text-white',
    gradient: 'from-blue-400 to-blue-600',
  },
  [SocialPlatform.FACEBOOK]: {
    icon: Facebook,
    label: 'Facebook',
    color: 'bg-blue-700',
    hoverColor: 'hover:bg-blue-800',
    textColor: 'text-white',
    gradient: 'from-blue-600 to-blue-800',
  },
  [SocialPlatform.INSTAGRAM]: {
    icon: Instagram,
    label: 'Instagram',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    hoverColor: 'hover:from-purple-600 hover:to-pink-600',
    textColor: 'text-white',
    gradient: 'from-purple-400 via-pink-500 to-orange-400',
  },
  [SocialPlatform.LINKEDIN]: {
    icon: Linkedin,
    label: 'LinkedIn',
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    textColor: 'text-white',
    gradient: 'from-blue-500 to-blue-700',
  },
  [SocialPlatform.YOUTUBE]: {
    icon: Youtube,
    label: 'YouTube',
    color: 'bg-red-600',
    hoverColor: 'hover:bg-red-700',
    textColor: 'text-white',
    gradient: 'from-red-500 to-red-700',
  },
  [SocialPlatform.TIKTOK]: {
    icon: MessageSquare,
    label: 'TikTok',
    color: 'bg-black',
    hoverColor: 'hover:bg-gray-800',
    textColor: 'text-white',
    gradient: 'from-black to-gray-800',
  },
  [SocialPlatform.REDDIT]: {
    icon: MessageSquare,
    label: 'Reddit',
    color: 'bg-orange-600',
    hoverColor: 'hover:bg-orange-700',
    textColor: 'text-white',
    gradient: 'from-orange-500 to-red-600',
  },
  [SocialPlatform.DISCORD]: {
    icon: MessageSquare,
    label: 'Discord',
    color: 'bg-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
    textColor: 'text-white',
    gradient: 'from-indigo-500 to-purple-600',
  },
  [SocialPlatform.TELEGRAM]: {
    icon: Send,
    label: 'Telegram',
    color: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
    textColor: 'text-white',
    gradient: 'from-blue-400 to-blue-600',
  },
  [SocialPlatform.MASTODON]: {
    icon: Users,
    label: 'Mastodon',
    color: 'bg-purple-600',
    hoverColor: 'hover:bg-purple-700',
    textColor: 'text-white',
    gradient: 'from-purple-500 to-indigo-600',
  },
};

const DEFAULT_PLATFORMS = [
  SocialPlatform.TWITTER,
  SocialPlatform.FACEBOOK,
  SocialPlatform.LINKEDIN,
  SocialPlatform.INSTAGRAM,
];

// =====================================================
// MAIN COMPONENT
// =====================================================

export const SocialShareButtons: React.FC<SocialShareButtonsProps> = ({
  contentId,
  contentUrl,
  title,
  description,
  imageUrl,
  platforms = DEFAULT_PLATFORMS,
  config = {},
  className,
  onShare,
}) => {
  // =====================================================
  // HOOKS AND STATE
  // =====================================================

  const { shareContent, getShareAnalytics } = useSocialMediaService();
  const { track } = useAnalytics();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState<Record<SocialPlatform, boolean>>({} as any);
  const [shareStats, setShareStats] = useState<Record<SocialPlatform, number>>({} as any);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const {
    style = 'buttons',
    size = 'medium',
    showLabels = true,
    showCount = false,
    customMessages = {},
    position = 'bottom',
    analytics = true,
    theme = 'auto',
  } = config;

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const sizeClasses = useMemo(() => {
    const sizes = {
      small: {
        button: 'h-8 px-3 text-xs',
        icon: 'h-4 w-4',
        iconOnly: 'h-8 w-8',
      },
      medium: {
        button: 'h-10 px-4 text-sm',
        icon: 'h-5 w-5',
        iconOnly: 'h-10 w-10',
      },
      large: {
        button: 'h-12 px-6 text-base',
        icon: 'h-6 w-6',
        iconOnly: 'h-12 w-12',
      },
    };
    return sizes[size];
  }, [size]);

  const containerClasses = useMemo(() => {
    const positions = {
      top: 'flex-col items-center mb-4',
      bottom: 'flex-col items-center mt-4',
      left: 'flex-col items-start mr-4',
      right: 'flex-col items-end ml-4',
      floating: 'fixed right-4 top-1/2 transform -translate-y-1/2 flex-col z-50',
    };

    const styles = {
      buttons: 'flex flex-wrap gap-2',
      icons: 'flex flex-wrap gap-1',
      floating: 'flex flex-col gap-2',
      inline: 'inline-flex gap-1',
    };

    return cn(styles[style], positions[position]);
  }, [style, position]);

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const handleShare = useCallback(
    async (platform: SocialPlatform) => {
      try {
        setIsLoading((prev) => ({ ...prev, [platform]: true }));

        // Track share initiation
        if (analytics) {
          await track('social_share_initiated', {
            platform,
            contentId,
            contentUrl,
            style,
          });
        }

        // Prepare share request
        const shareRequest: SocialShareRequest = {
          contentId,
          platform,
          customMessage: customMessages[platform],
        };

        // Execute share
        const response = await shareContent(shareRequest);

        if (response.success) {
          // Update share stats
          setShareStats((prev) => ({
            ...prev,
            [platform]: (prev[platform] || 0) + 1,
          }));

          // Show success message
          toast({
            title: 'Shared successfully!',
            description: `Content shared to ${PLATFORM_CONFIGS[platform].label}`,
            variant: 'success',
          });

          // Track successful share
          if (analytics) {
            await track('social_share_completed', {
              platform,
              contentId,
              shareId: response.shareId,
              postUrl: response.postUrl,
            });
          }

          // Call onShare callback
          onShare?.(platform, response);

          // Open share URL if available
          if (response.postUrl) {
            window.open(response.postUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          throw new Error(response.error || 'Share failed');
        }
      } catch (error) {
        console.error('Share failed:', error);

        toast({
          title: 'Share failed',
          description: error instanceof Error ? error.message : 'Failed to share content',
          variant: 'destructive',
        });

        // Track share failure
        if (analytics) {
          await track('social_share_failed', {
            platform,
            contentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } finally {
        setIsLoading((prev) => ({ ...prev, [platform]: false }));
      }
    },
    [contentId, contentUrl, customMessages, analytics, track, shareContent, toast, onShare, style]
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(contentUrl);
      setCopiedToClipboard(true);

      toast({
        title: 'Link copied!',
        description: 'Content link copied to clipboard',
        variant: 'success',
      });

      // Track copy action
      if (analytics) {
        await track('content_link_copied', { contentId, contentUrl });
      }

      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  }, [contentUrl, contentId, analytics, track, toast]);

  const handleShowAnalytics = useCallback(async () => {
    if (!analytics) return;

    try {
      setShowAnalytics(true);

      // Track analytics view
      await track('social_share_analytics_viewed', { contentId });

      // TODO: Fetch and display analytics data
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }, [analytics, track, contentId]);

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const renderShareButton = useCallback(
    (platform: SocialPlatform) => {
      const platformConfig = PLATFORM_CONFIGS[platform];
      const Icon = platformConfig.icon;
      const loading = isLoading[platform];
      const shareCount = shareStats[platform];

      const buttonContent = (
        <>
          <Icon className={cn(sizeClasses.icon, loading && 'animate-pulse')} />
          {showLabels && style === 'buttons' && (
            <span className="ml-2">{platformConfig.label}</span>
          )}
          {showCount && shareCount > 0 && (
            <span className="ml-1 text-xs opacity-80">({shareCount})</span>
          )}
        </>
      );

      const baseClasses = cn(
        'inline-flex items-center justify-center',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        style === 'buttons' && 'rounded-lg font-medium',
        style === 'icons' && 'rounded-full',
        loading && 'cursor-wait'
      );

      if (style === 'buttons') {
        return (
          <motion.button
            key={platform}
            onClick={() => handleShare(platform)}
            disabled={loading}
            className={cn(
              baseClasses,
              sizeClasses.button,
              platformConfig.color,
              platformConfig.hoverColor,
              platformConfig.textColor,
              'shadow-sm hover:shadow-md',
              `focus:ring-${platformConfig.color.split('-')[1]}-500`
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {buttonContent}
          </motion.button>
        );
      }

      if (style === 'icons') {
        return (
          <motion.button
            key={platform}
            onClick={() => handleShare(platform)}
            disabled={loading}
            className={cn(
              baseClasses,
              sizeClasses.iconOnly,
              platformConfig.color,
              platformConfig.hoverColor,
              platformConfig.textColor,
              'shadow-sm hover:shadow-md'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={`Share on ${platformConfig.label}`}
            aria-label={`Share on ${platformConfig.label}`}
          >
            <Icon className={sizeClasses.icon} />
          </motion.button>
        );
      }

      return null;
    },
    [isLoading, shareStats, showLabels, showCount, style, sizeClasses, handleShare]
  );

  const renderUtilityButtons = useCallback(() => {
    return (
      <div className="flex items-center gap-2 mt-2">
        {/* Copy Link Button */}
        <motion.button
          onClick={handleCopyLink}
          className={cn(
            'inline-flex items-center justify-center',
            sizeClasses.iconOnly,
            'rounded-lg border border-gray-300',
            'bg-white hover:bg-gray-50',
            'text-gray-600 hover:text-gray-900',
            'transition-colors duration-200'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Copy link"
          aria-label="Copy link to clipboard"
        >
          {copiedToClipboard ? (
            <Check className={cn(sizeClasses.icon, 'text-green-600')} />
          ) : (
            <Copy className={sizeClasses.icon} />
          )}
        </motion.button>

        {/* Analytics Button */}
        {analytics && (
          <motion.button
            onClick={handleShowAnalytics}
            className={cn(
              'inline-flex items-center justify-center',
              sizeClasses.iconOnly,
              'rounded-lg border border-gray-300',
              'bg-white hover:bg-gray-50',
              'text-gray-600 hover:text-gray-900',
              'transition-colors duration-200'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="View analytics"
            aria-label="View share analytics"
          >
            <BarChart3 className={sizeClasses.icon} />
          </motion.button>
        )}

        {/* External Link Button */}
        <motion.a
          href={contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center justify-center',
            sizeClasses.iconOnly,
            'rounded-lg border border-gray-300',
            'bg-white hover:bg-gray-50',
            'text-gray-600 hover:text-gray-900',
            'transition-colors duration-200'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Open in new tab"
          aria-label="Open content in new tab"
        >
          <ExternalLink className={sizeClasses.icon} />
        </motion.a>
      </div>
    );
  }, [handleCopyLink, handleShowAnalytics, copiedToClipboard, analytics, contentUrl, sizeClasses]);

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <div className={cn(containerClasses, className)}>
      {/* Share Header */}
      <div className="flex items-center gap-2 mb-3">
        <Share2 className={cn(sizeClasses.icon, 'text-gray-600')} />
        <span className="text-sm font-medium text-gray-900">Share</span>
      </div>

      {/* Platform Buttons */}
      <div
        className={cn(
          style === 'buttons' && 'flex flex-wrap gap-2',
          style === 'icons' && 'flex flex-wrap gap-1',
          style === 'floating' && 'flex flex-col gap-2',
          style === 'inline' && 'inline-flex gap-1'
        )}
      >
        <AnimatePresence>{platforms.map(renderShareButton)}</AnimatePresence>
      </div>

      {/* Utility Buttons */}
      {(style === 'buttons' || style === 'icons') && renderUtilityButtons()}

      {/* Analytics Modal */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAnalytics(false)}
          >
            <motion.div
              className="bg-white rounded-lg p-6 max-w-md w-full m-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Share Analytics</h3>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {platforms.map((platform) => (
                  <div key={platform} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {React.createElement(PLATFORM_CONFIGS[platform].icon, {
                        className: 'h-4 w-4',
                      })}
                      <span className="text-sm">{PLATFORM_CONFIGS[platform].label}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {shareStats[platform] || 0} shares
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SocialShareButtons;
