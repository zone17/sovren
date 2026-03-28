import React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps {
  /**
   * Size of the spinner
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /**
   * CSS class for the spinner
   */
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
    xl: 'h-12 w-12 border-4',
  };

  return (
    <div role="status" className="inline-flex">
      <div
        className={cn(
          'animate-spin rounded-full border-t-transparent border-primary',
          sizeClasses[size],
          className
        )}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
};
