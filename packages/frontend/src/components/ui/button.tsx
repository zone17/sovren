import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../lib/utils';

// 🎨 **MODERN BUTTON SYSTEM** - Stripe/Linear/Vercel standards
export const buttonVariants = cva(
  // Base: Modern typography, minimal radius, refined proportions
  'inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-[13px] font-medium leading-none tracking-[-0.01em] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: Uses design token --primary
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:bg-primary/80 active:translate-y-[0.5px]',

        // Destructive: Uses design token --destructive
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md active:bg-destructive/80 active:translate-y-[0.5px]',

        // Outline: Uses design tokens --border, --background, --foreground
        outline:
          'border border-input bg-background text-foreground shadow-sm hover:border-muted-foreground/50 hover:shadow-md active:border-muted-foreground active:translate-y-[0.5px]',

        // Secondary: Uses design tokens --secondary
        secondary:
          'bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-secondary/80 hover:border-muted-foreground/50 hover:shadow-md active:bg-secondary/60 active:translate-y-[0.5px]',

        // Ghost: Uses design tokens
        ghost:
          'text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80 active:translate-y-[0.5px]',

        // Link: Uses design token --primary
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary/90 active:text-primary/80',

        // Lightning: Bitcoin orange
        lightning:
          'bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow-md active:bg-amber-700 active:translate-y-[0.5px]',

        // Sovereign: NOSTR purple, uses --primary (indigo/purple)
        sovereign:
          'bg-indigo-500 text-white shadow-sm hover:bg-indigo-600 hover:shadow-md active:bg-indigo-700 active:translate-y-[0.5px]',

        // Premium: Elite dark
        premium:
          'bg-gray-800 text-white shadow-sm hover:bg-gray-900 hover:shadow-md active:bg-gray-950 active:translate-y-[0.5px]',
      },
      size: {
        // Modern proportions: not too tall, perfect padding
        sm: 'h-7 px-3 text-[12px]',
        default: 'h-8 px-4 text-[13px]',
        lg: 'h-9 px-6 text-[14px]',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Loading state with modern spinner */
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-60" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
