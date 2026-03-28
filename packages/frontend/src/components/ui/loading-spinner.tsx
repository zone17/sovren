import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div role='status' className='inline-flex'>
      <div
        className={`animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary ${sizeClasses[size]} ${className}`}
      />
      <span className='sr-only'>Loading...</span>
    </div>
  );
};
