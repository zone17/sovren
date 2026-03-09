/**
 * NotificationEmpty Component
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import React from 'react';

export interface NotificationEmptyProps {
  message?: string;
  showCTA?: boolean;
  onCTAClick?: () => void;
  ctaText?: string;
  className?: string;
}

/**
 * Empty state component for notifications
 */
export const NotificationEmpty: React.FC<NotificationEmptyProps> = ({
  message = 'No notifications yet',
  showCTA = false,
  onCTAClick,
  ctaText = 'Get started',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="mb-4">
        <svg
          className="w-16 h-16 text-muted-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </div>

      {/* Message */}
      <p className="text-muted-foreground text-lg font-medium mb-2">{message}</p>

      <p className="text-muted-foreground text-sm mb-6">
        You'll see notifications here when you get mentions, replies, and more.
      </p>

      {/* CTA Button */}
      {showCTA && onCTAClick && (
        <button
          onClick={onCTAClick}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          type="button"
        >
          {ctaText}
        </button>
      )}
    </div>
  );
};
