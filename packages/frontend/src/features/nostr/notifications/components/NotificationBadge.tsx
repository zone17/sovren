/**
 * NotificationBadge Component
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import React from 'react';

export interface NotificationBadgeProps {
  count: number;
  max?: number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
  dot?: boolean;
  className?: string;
}

/**
 * Badge component to display unread notification count
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  max = 99,
  variant = 'danger',
  size = 'md',
  showZero = false,
  dot = false,
  className = '',
}) => {
  // Don't render if count is 0 and showZero is false
  if (count === 0 && !showZero) {
    return null;
  }

  // Display count or max+ if exceeds max
  const displayCount = count > max ? `${max}+` : count.toString();

  // Variant styles
  const variantStyles = {
    default: 'bg-gray-500 text-white',
    primary: 'bg-blue-500 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-red-500 text-white',
  };

  // Size styles
  const sizeStyles = {
    sm: dot ? 'w-2 h-2' : 'min-w-[16px] h-4 text-xs px-1',
    md: dot ? 'w-2.5 h-2.5' : 'min-w-[20px] h-5 text-sm px-1.5',
    lg: dot ? 'w-3 h-3' : 'min-w-[24px] h-6 text-base px-2',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full font-medium
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      aria-label={`${count} unread notifications`}
      role="status"
    >
      {!dot && displayCount}
    </span>
  );
};
