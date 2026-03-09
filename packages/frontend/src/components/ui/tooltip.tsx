import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * 💬 Tooltip Component - Elite Interactive Help System
 *
 * A sophisticated tooltip system built on Radix UI primitives with
 * intelligent positioning, smooth animations, and accessibility-first
 * design that exceeds industry standards for usability.
 *
 * Features:
 * - Intelligent collision detection and positioning
 * - Smooth entrance and exit animations
 * - Configurable delays for better UX
 * - Perfect keyboard navigation support
 * - Elite visual design with subtle shadows
 * - Responsive positioning for all screen sizes
 *
 * @example
 * ```tsx
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <Button variant="outline">Hover me</Button>
 *     </TooltipTrigger>
 *     <TooltipContent>
 *       <p>This is a helpful tooltip</p>
 *     </TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 * ```
 */

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      // Modern container with sophisticated styling
      'z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground px-3 py-1.5',
      // Elite typography for perfect readability
      'text-[12px] font-medium leading-relaxed',
      // Sophisticated shadow system for elegant depth
      'shadow-[0_4px_12px_rgba(0,0,0,0.15)] backdrop-blur-sm',
      // Smooth entrance and exit animations
      'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      // Intelligent directional animations based on positioning
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
