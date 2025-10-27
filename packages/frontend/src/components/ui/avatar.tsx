import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * 👤 Avatar Component - Modern Profile Image Display
 *
 * A sophisticated avatar component built on Radix UI primitives with
 * automatic fallback handling and consistent styling that matches our
 * elite design system standards.
 *
 * Features:
 * - Automatic fallback to initials when image fails
 * - Multiple sizes with perfect aspect ratios
 * - Loading state handling
 * - Accessibility-first design
 * - Elite visual consistency
 *
 * @example
 * ```tsx
 * <Avatar>
 *   <AvatarImage src="/profile.jpg" alt="John Doe" />
 *   <AvatarFallback>JD</AvatarFallback>
 * </Avatar>
 * ```
 */

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      // Base: Perfect circle with modern proportions
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      // Modern styling: Subtle border and shadow
      'border border-gray-200 bg-gray-50',
      // Dark mode support
      'dark:border-gray-700 dark:bg-gray-800',
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn(
      // Perfect image fit with modern proportions
      'aspect-square h-full w-full object-cover',
      // Smooth loading transition
      'transition-opacity duration-200',
      className
    )}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      // Perfect centering with modern typography
      'flex h-full w-full items-center justify-center rounded-full',
      // Elite background with subtle gradient
      'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700',
      // Modern typography - clean and readable
      'text-[13px] font-medium leading-none tracking-[-0.01em]',
      // Dark mode support
      'dark:from-gray-700 dark:to-gray-800 dark:text-gray-300',
      // Smooth appearance transition
      'transition-colors duration-200',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
