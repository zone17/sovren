/**
 * 📱 **MOBILE-FIRST RESPONSIVE LAYOUT SYSTEM**
 *
 * US-083: Mobile-first responsive layout with breakpoint management
 * Features: Adaptive layouts, mobile-optimized containers, responsive grids
 *
 * Architecture: CSS Grid and Flexbox with mobile-first approach
 * Testing: Cross-device layout validation with automated breakpoint tests
 */

import React, { ReactNode, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import MobileNavigation from '../ui/MobileNavigation';

interface ResponsiveLayoutProps {
  children: ReactNode;
  /** Layout variant for different page types */
  variant?: 'default' | 'full-width' | 'centered' | 'sidebar' | 'hero';
  /** Show mobile navigation */
  showMobileNav?: boolean;
  /** Custom container class */
  containerClass?: string;
  /** Navigation breadcrumbs for mobile */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Notification count for mobile nav */
  notificationCount?: number;
  className?: string;
}

interface ResponsiveContainerProps {
  children: ReactNode;
  /** Container size constraint */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Padding variant */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Center content horizontally */
  centered?: boolean;
  className?: string;
}

interface ResponsiveGridProps {
  children: ReactNode;
  /** Grid layout pattern */
  pattern?: 'auto' | 'equal' | 'sidebar' | 'masonry' | 'hero';
  /** Minimum column width */
  minColumnWidth?: string;
  /** Grid gap size */
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  /** Responsive behavior */
  responsive?: boolean;
  className?: string;
}

interface ResponsiveStackProps {
  children: ReactNode;
  /** Stack direction on different breakpoints */
  direction?: {
    mobile?: 'vertical' | 'horizontal';
    tablet?: 'vertical' | 'horizontal';
    desktop?: 'vertical' | 'horizontal';
  };
  /** Stack spacing */
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Alignment */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Distribution */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  className?: string;
}

// 📱 **Utility: Breakpoint Detection Hook**
const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};

// 📱 **Utility: Responsive Class Generator**
const getResponsiveClasses = (mobile?: string, tablet?: string, desktop?: string) => {
  return cn(mobile, tablet && `md:${tablet}`, desktop && `lg:${desktop}`);
};

/**
 * **US-083.1: Main Responsive Layout Component**
 *
 * Features:
 * - Mobile-first responsive design
 * - Adaptive layout variants
 * - Integrated mobile navigation
 * - Safe area support
 */
export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  variant = 'default',
  showMobileNav = true,
  containerClass,
  breadcrumbs,
  notificationCount = 0,
  className,
}) => {
  const breakpoint = useBreakpoint();

  const layoutClasses = {
    default: 'min-h-screen bg-muted',
    'full-width': 'min-h-screen bg-muted w-full',
    centered: 'min-h-screen bg-muted flex items-center justify-center',
    sidebar: 'min-h-screen bg-muted lg:grid lg:grid-cols-[250px_1fr]',
    hero: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100',
  };

  return (
    <div className={cn(layoutClasses[variant], className)}>
      {/* Mobile Navigation */}
      {showMobileNav && (
        <MobileNavigation breadcrumbs={breadcrumbs} notificationCount={notificationCount} />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1',
          showMobileNav && 'md:pt-0', // Account for mobile nav on mobile
          containerClass
        )}
      >
        {children}
      </main>
    </div>
  );
};

/**
 * **US-083.2: Responsive Container Component**
 *
 * Features:
 * - Fluid container with max-width constraints
 * - Mobile-optimized padding
 * - Responsive breakpoint behavior
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  size = 'lg',
  padding = 'md',
  centered = true,
  className,
}) => {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-none w-full',
  };

  const paddingClasses = {
    none: '',
    sm: 'px-4 py-2 md:px-6 md:py-4',
    md: 'px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8',
    lg: 'px-6 py-6 md:px-12 md:py-10 lg:px-16 lg:py-12',
  };

  return (
    <div
      className={cn(
        'w-full',
        sizeClasses[size],
        paddingClasses[padding],
        centered && 'mx-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * **US-083.3: Responsive Grid System**
 *
 * Features:
 * - CSS Grid with auto-fit columns
 * - Responsive breakpoint behavior
 * - Multiple grid patterns
 * - Mobile-first approach
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  pattern = 'auto',
  minColumnWidth = '280px',
  gap = 'md',
  responsive = true,
  className,
}) => {
  const gapClasses = {
    sm: 'gap-2 md:gap-4',
    md: 'gap-4 md:gap-6',
    lg: 'gap-6 md:gap-8',
    xl: 'gap-8 md:gap-12',
  };

  const getGridClasses = () => {
    switch (pattern) {
      case 'auto':
        return `grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(${minColumnWidth},1fr))]`;
      case 'equal':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      case 'sidebar':
        return 'grid grid-cols-1 lg:grid-cols-[300px_1fr]';
      case 'hero':
        return 'grid grid-cols-1 lg:grid-cols-2 items-center';
      case 'masonry':
        return 'columns-1 md:columns-2 lg:columns-3 xl:columns-4';
      default:
        return 'grid';
    }
  };

  return (
    <div
      className={cn(getGridClasses(), gapClasses[gap], responsive && 'w-full', className)}
      style={
        pattern === 'auto' && !responsive
          ? { gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))` }
          : undefined
      }
    >
      {children}
    </div>
  );
};

/**
 * **US-083.4: Responsive Stack Component**
 *
 * Features:
 * - Flexible stack layouts
 * - Breakpoint-specific directions
 * - Spacing and alignment control
 */
export const ResponsiveStack: React.FC<ResponsiveStackProps> = ({
  children,
  direction = { mobile: 'vertical', tablet: 'vertical', desktop: 'horizontal' },
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  className,
}) => {
  const spacingClasses = {
    xs: 'space-y-1 md:space-y-2 md:space-x-2',
    sm: 'space-y-2 md:space-y-3 md:space-x-3',
    md: 'space-y-4 md:space-y-6 md:space-x-6',
    lg: 'space-y-6 md:space-y-8 md:space-x-8',
    xl: 'space-y-8 md:space-y-12 md:space-x-12',
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  const getDirectionClasses = () => {
    const mobile = direction.mobile === 'horizontal' ? 'flex-row' : 'flex-col';
    const tablet = direction.tablet === 'horizontal' ? 'md:flex-row' : 'md:flex-col';
    const desktop = direction.desktop === 'horizontal' ? 'lg:flex-row' : 'lg:flex-col';

    return cn(mobile, tablet, desktop);
  };

  return (
    <div
      className={cn(
        'flex',
        getDirectionClasses(),
        alignClasses[align],
        justifyClasses[justify],
        spacingClasses[spacing],
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * **US-083.5: Mobile-Optimized Section Component**
 *
 * Features:
 * - Responsive section spacing
 * - Mobile-first design
 * - Content width optimization
 */
interface ResponsiveSectionProps {
  children: ReactNode;
  /** Section background */
  background?: 'none' | 'white' | 'gray' | 'blue' | 'gradient';
  /** Section spacing */
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
  /** Content width constraint */
  width?: 'full' | 'contained' | 'narrow';
  className?: string;
}

export const ResponsiveSection: React.FC<ResponsiveSectionProps> = ({
  children,
  background = 'none',
  spacing = 'lg',
  width = 'contained',
  className,
}) => {
  const backgroundClasses = {
    none: '',
    white: 'bg-background',
    gray: 'bg-muted',
    blue: 'bg-blue-50',
    gradient: 'bg-gradient-to-r from-blue-50 to-indigo-50',
  };

  const spacingClasses = {
    sm: 'py-8 md:py-12',
    md: 'py-12 md:py-16',
    lg: 'py-16 md:py-20',
    xl: 'py-20 md:py-24',
  };

  const widthClasses = {
    full: 'w-full',
    contained: 'max-w-7xl mx-auto px-4 md:px-8',
    narrow: 'max-w-4xl mx-auto px-4 md:px-8',
  };

  return (
    <section className={cn(backgroundClasses[background], spacingClasses[spacing], className)}>
      <div className={widthClasses[width]}>{children}</div>
    </section>
  );
};

/**
 * **US-083.6: Responsive Card Grid**
 *
 * Features:
 * - Responsive card layouts
 * - Auto-sizing columns
 * - Mobile-optimized spacing
 */
interface ResponsiveCardGridProps {
  children: ReactNode;
  /** Card minimum width */
  cardMinWidth?: string;
  /** Grid gap */
  gap?: 'sm' | 'md' | 'lg';
  /** Maximum columns on largest screens */
  maxColumns?: number;
  className?: string;
}

export const ResponsiveCardGrid: React.FC<ResponsiveCardGridProps> = ({
  children,
  cardMinWidth = '320px',
  gap = 'md',
  maxColumns = 4,
  className,
}) => {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  return (
    <div
      className={cn('grid', gapClasses[gap], className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${cardMinWidth}, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * **US-083.7: Responsive Media Component**
 *
 * Features:
 * - Responsive image/video containers
 * - Aspect ratio preservation
 * - Mobile-optimized loading
 */
interface ResponsiveMediaProps {
  /** Media source URL */
  src: string;
  /** Alternative text */
  alt: string;
  /** Aspect ratio */
  aspectRatio?: '1:1' | '4:3' | '16:9' | '21:9';
  /** Media type */
  type?: 'image' | 'video';
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  /** Object fit behavior */
  objectFit?: 'cover' | 'contain' | 'fill';
  className?: string;
}

export const ResponsiveMedia: React.FC<ResponsiveMediaProps> = ({
  src,
  alt,
  aspectRatio = '16:9',
  type = 'image',
  loading = 'lazy',
  objectFit = 'cover',
  className,
}) => {
  const aspectRatioClasses = {
    '1:1': 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '16:9': 'aspect-video',
    '21:9': 'aspect-[21/9]',
  };

  const objectFitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
  };

  return (
    <div className={cn('overflow-hidden rounded-lg', aspectRatioClasses[aspectRatio], className)}>
      {type === 'image' ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={cn('w-full h-full', objectFitClasses[objectFit])}
        />
      ) : (
        <video
          src={src}
          className={cn('w-full h-full', objectFitClasses[objectFit])}
          controls
          preload="metadata"
        >
          <track kind="captions" srcLang="en" label="English" />
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
};

// 📱 **Export Hook for External Use**
export { useBreakpoint };

// 📱 **Default Export with All Components**
export default {
  ResponsiveLayout,
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveStack,
  ResponsiveSection,
  ResponsiveCardGrid,
  ResponsiveMedia,
  useBreakpoint,
};
