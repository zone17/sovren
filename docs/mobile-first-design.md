# Mobile-First Design Guidelines

## Overview

Sovren follows a strict mobile-first design approach, ensuring optimal user experience across all devices with priority given to mobile performance and usability.

## Core Principles

### 1. Progressive Enhancement

- Start with mobile designs (320px+)
- Enhance for tablet (768px+)
- Optimize for desktop (1024px+)
- Support ultra-wide screens (1440px+)

### 2. Performance First

- Target < 3s First Contentful Paint on 3G
- Lazy load non-critical resources
- Optimize images with WebP/AVIF
- Implement service workers for offline functionality

### 3. Touch-First Interaction

- Minimum touch target: 44px × 44px
- Comfortable spacing between interactive elements
- Gesture-based navigation where appropriate
- Haptic feedback for critical actions

## Breakpoint Strategy

```css
/* Mobile First Breakpoints */
/* Small mobile: 320px+ (default) */
/* Large mobile: 480px+ */
@media (min-width: 30rem) {
  /* 480px */
}

/* Tablet: 768px+ */
@media (min-width: 48rem) {
  /* 768px */
}

/* Desktop: 1024px+ */
@media (min-width: 64rem) {
  /* 1024px */
}

/* Large desktop: 1440px+ */
@media (min-width: 90rem) {
  /* 1440px */
}
```

## Typography Scale

### Mobile Typography

- Base font size: 16px (1rem)
- Line height: 1.5
- Minimum body text: 14px
- Minimum touch target text: 16px

### Responsive Typography

```css
/* Fluid typography using clamp() */
--font-size-xs: clamp(0.75rem, 0.5vw + 0.7rem, 0.875rem);
--font-size-sm: clamp(0.875rem, 0.5vw + 0.8rem, 1rem);
--font-size-base: clamp(1rem, 0.5vw + 0.9rem, 1.125rem);
--font-size-lg: clamp(1.125rem, 1vw + 1rem, 1.25rem);
--font-size-xl: clamp(1.25rem, 1.5vw + 1.1rem, 1.5rem);
--font-size-2xl: clamp(1.5rem, 2vw + 1.2rem, 2rem);
--font-size-3xl: clamp(2rem, 3vw + 1.5rem, 3rem);
```

## Spacing System

### Mobile-First Spacing

```css
/* Base spacing scale (rem) */
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
--space-10: 2.5rem; /* 40px */
--space-12: 3rem; /* 48px */
--space-16: 4rem; /* 64px */
--space-20: 5rem; /* 80px */
```

## Component Guidelines

### Navigation

- **Mobile**: Bottom navigation bar (5 items max)
- **Tablet**: Side navigation or top navigation
- **Desktop**: Full sidebar or top navigation

### Content Layout

- **Mobile**: Single column, full-width
- **Tablet**: Two-column where appropriate
- **Desktop**: Multi-column with sidebar

### Forms

- **Mobile**: Stacked form fields, large inputs
- **Tablet**: Optimized field sizing
- **Desktop**: Inline forms where appropriate

### Cards and Lists

- **Mobile**: Full-width cards, minimal padding
- **Tablet**: Grid layout (2-3 columns)
- **Desktop**: Flexible grid (3-4 columns)

## Accessibility Standards

### Touch Accessibility

- Minimum 44px touch targets
- Clear focus indicators
- Adequate contrast ratios (4.5:1 minimum)
- Screen reader optimization

### Keyboard Navigation

- Tab order follows visual flow
- Skip links for main content
- Keyboard shortcuts for power users

## Performance Budgets

### Mobile Performance Targets

- **First Contentful Paint**: < 2s
- **Largest Contentful Paint**: < 3s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### Resource Budgets

- **JavaScript**: < 200KB gzipped
- **CSS**: < 50KB gzipped
- **Images**: WebP/AVIF with fallbacks
- **Fonts**: < 100KB total

## Dark Mode Support

### Color Schemes

```css
/* Light mode (default) */
:root {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --color-primary: #3b82f6;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0a0a0a;
    --color-foreground: #fafafa;
    --color-primary: #60a5fa;
  }
}
```

## Testing Strategy

### Device Testing

- iPhone SE (320px width)
- iPhone 12/13/14 (390px width)
- iPad (768px width)
- Desktop (1024px+ width)

### Performance Testing

- Lighthouse CI in GitHub Actions
- Real device testing on slow networks
- Battery impact assessment

## Implementation Checklist

### Mobile-First CSS

- [ ] Use mobile-first media queries
- [ ] Implement fluid typography
- [ ] Optimize touch targets
- [ ] Test on actual devices

### Performance

- [ ] Implement lazy loading
- [ ] Optimize images
- [ ] Minimize JavaScript bundles
- [ ] Use service workers

### Accessibility

- [ ] Test with screen readers
- [ ] Verify keyboard navigation
- [ ] Check color contrast
- [ ] Validate touch accessibility

### Progressive Enhancement

- [ ] Works without JavaScript
- [ ] Graceful degradation
- [ ] Offline functionality
- [ ] Print styles

## Tools and Testing

### Development Tools

- Chrome DevTools Device Mode
- Firefox Responsive Design Mode
- Safari Web Inspector

### Testing Tools

- Lighthouse
- WebPageTest
- BrowserStack for real device testing
- WAVE accessibility checker

### Monitoring

- Core Web Vitals monitoring
- Real User Monitoring (RUM)
- Performance budgets in CI/CD

---

_Last updated: 2024-05-29_
_Next review: Monthly or when significant design changes are made_
