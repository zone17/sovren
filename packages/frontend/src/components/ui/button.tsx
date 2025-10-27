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
        // 🔥 Primary: Modern gradient with perfect contrast
        default:
          'bg-[#0969da] text-white shadow-[0_1px_2px_rgba(9,105,218,0.12)] hover:bg-[#0860ca] hover:shadow-[0_2px_4px_rgba(9,105,218,0.16)] active:bg-[#0757ba] active:shadow-[0_1px_2px_rgba(9,105,218,0.12)] active:translate-y-[0.5px]',

        // 🔥 Destructive: Modern red with sophistication
        destructive:
          'bg-[#da3633] text-white shadow-[0_1px_2px_rgba(218,54,51,0.12)] hover:bg-[#cb2d2a] hover:shadow-[0_2px_4px_rgba(218,54,51,0.16)] active:bg-[#bc2a28] active:shadow-[0_1px_2px_rgba(218,54,51,0.12)] active:translate-y-[0.5px]',

        // 🔥 Outline: Minimal, clean, modern
        outline:
          'border border-[#d1d9e0] bg-white text-[#24292f] shadow-[0_1px_2px_rgba(31,35,40,0.04)] hover:border-[#8c959f] hover:shadow-[0_2px_4px_rgba(31,35,40,0.08)] active:border-[#656d76] active:shadow-[0_1px_2px_rgba(31,35,40,0.04)] active:translate-y-[0.5px]',

        // 🔥 Secondary: Subtle, refined
        secondary:
          'bg-[#f6f8fa] text-[#24292f] border border-[#d1d9e0] shadow-[0_1px_2px_rgba(31,35,40,0.04)] hover:bg-[#f3f4f6] hover:border-[#8c959f] hover:shadow-[0_2px_4px_rgba(31,35,40,0.08)] active:bg-[#e5e7ea] active:translate-y-[0.5px]',

        // 🔥 Ghost: Invisible until interaction
        ghost:
          'text-[#656d76] hover:bg-[#f3f4f6] hover:text-[#24292f] active:bg-[#e5e7ea] active:translate-y-[0.5px]',

        // 🔥 Link: Clean typography
        link: 'text-[#0969da] underline-offset-4 hover:underline hover:text-[#0860ca] active:text-[#0757ba]',

        // ⚡ **LIGHTNING NETWORK** - Bitcoin orange, sophisticated
        lightning:
          'bg-[#f7931a] text-white shadow-[0_1px_2px_rgba(247,147,26,0.12)] hover:bg-[#e8851a] hover:shadow-[0_2px_4px_rgba(247,147,26,0.16)] active:bg-[#d97919] active:shadow-[0_1px_2px_rgba(247,147,26,0.12)] active:translate-y-[0.5px]',

        // 🔵 **SOVEREIGN** - NOSTR purple, modern
        sovereign:
          'bg-[#6366f1] text-white shadow-[0_1px_2px_rgba(99,102,241,0.12)] hover:bg-[#5b5fd1] hover:shadow-[0_2px_4px_rgba(99,102,241,0.16)] active:bg-[#5350c1] active:shadow-[0_1px_2px_rgba(99,102,241,0.12)] active:translate-y-[0.5px]',

        // ⚫ **PREMIUM** - Elite black, minimal
        premium:
          'bg-[#1f2937] text-white shadow-[0_1px_2px_rgba(31,41,55,0.12)] hover:bg-[#111827] hover:shadow-[0_2px_4px_rgba(31,41,55,0.16)] active:bg-[#0f172a] active:shadow-[0_1px_2px_rgba(31,41,55,0.12)] active:translate-y-[0.5px]',
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
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
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
