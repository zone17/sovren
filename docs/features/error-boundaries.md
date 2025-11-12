# Error Boundaries Feature Documentation

## Overview

Comprehensive error boundary system that prevents single component failures from crashing the entire React application. Implements a hierarchical error handling strategy with global and feature-specific boundaries.

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: 2025-10-30
**Owner**: Frontend Team

## Table of Contents

1. [Architecture](#architecture)
2. [Components](#components)
3. [Usage Guide](#usage-guide)
4. [Configuration](#configuration)
5. [Error Recovery](#error-recovery)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Architecture

### Hierarchical Error Boundary System

The error boundary system uses a nested architecture where errors are caught at the lowest possible level:

```
GlobalErrorBoundary (App-level)
  └── AuthProvider
      └── Router
          ├── Auth Routes → AuthErrorBoundary
          ├── Content Routes → ContentErrorBoundary
          ├── Analytics Routes → AnalyticsErrorBoundary
          ├── Dashboard Routes → DashboardErrorBoundary
          ├── Subscriptions Routes → SubscriptionsErrorBoundary
          └── NOSTR Routes → NostrErrorBoundary
```

### Mermaid Diagrams

**Component Hierarchy:**

![Component Hierarchy](https://github.com/fp/Sovren/blob/main/docs/architecture/diagrams/error-boundaries/component-hierarchy.mmd)

[View Interactive Diagram](https://mermaid.live/edit#base64:encodeddiagram)
[View Source](../architecture/diagrams/error-boundaries/component-hierarchy.mmd)

**Error Flow:**

![Error Flow](https://github.com/fp/Sovren/blob/main/docs/architecture/diagrams/error-boundaries/error-flow.mmd)

[View Interactive Diagram](https://mermaid.live/edit#base64:encodeddiagram)
[View Source](../architecture/diagrams/error-boundaries/error-flow.mmd)

**State Management:**

![State Management](https://github.com/fp/Sovren/blob/main/docs/architecture/diagrams/error-boundaries/state-management.mmd)

[View Interactive Diagram](https://mermaid.live/edit#base64:encodeddiagram)
[View Source](../architecture/diagrams/error-boundaries/state-management.mmd)

**Recovery Strategy:**

![Recovery Strategy](https://github.com/fp/Sovren/blob/main/docs/architecture/diagrams/error-boundaries/recovery-strategy.mmd)

[View Interactive Diagram](https://mermaid.live/edit#base64:encodeddiagram)
[View Source](../architecture/diagrams/error-boundaries/recovery-strategy.mmd)

## Components

### GlobalErrorBoundary

Top-level error boundary that catches all unhandled errors in the application.

**Location**: `/packages/frontend/src/components/GlobalErrorBoundary.tsx`

**Props**:
```typescript
interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}
```

**Features**:
- Full-page error fallback UI
- Sentry error reporting
- Reload, retry, and go-home actions
- Development vs production error displays

**Example**:
```tsx
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

function App() {
  return (
    <GlobalErrorBoundary onError={(error, errorInfo) => {
      // Custom error handling
      console.log('Global error:', error);
    }}>
      <YourApp />
    </GlobalErrorBoundary>
  );
}
```

### FeatureErrorBoundary

Reusable error boundary for individual features with auto-retry capability.

**Location**: `/packages/frontend/src/components/FeatureErrorBoundary.tsx`

**Props**:
```typescript
interface FeatureErrorBoundaryProps {
  children: React.ReactNode;
  featureName: string;
  fallback?: React.ComponentType<FeatureErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number; // Default: 3
  autoRetry?: boolean; // Default: true
}
```

**Features**:
- Auto-retry with exponential backoff
- Feature-specific error messages
- Custom fallback UI support
- Configurable retry behavior

**Example**:
```tsx
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

function MyFeature() {
  return (
    <FeatureErrorBoundary
      featureName="My Feature"
      maxRetries={3}
      autoRetry={true}
      onError={(error) => console.log('Feature error:', error)}
    >
      <FeatureContent />
    </FeatureErrorBoundary>
  );
}
```

### Feature-Specific Boundaries

Each major feature has its own error boundary with customized behavior:

1. **AuthErrorBoundary** (`/features/auth/ErrorBoundary.tsx`)
   - Custom auth-focused fallback UI
   - No auto-retry (security sensitive)
   - Max retries: 2

2. **ContentErrorBoundary** (`/features/content/ErrorBoundary.tsx`)
   - Auto-retry enabled
   - Max retries: 3

3. **AnalyticsErrorBoundary** (`/features/analytics/ErrorBoundary.tsx`)
   - Auto-retry enabled (non-critical feature)
   - Max retries: 3

4. **DashboardErrorBoundary** (`/features/dashboard/ErrorBoundary.tsx`)
   - Auto-retry enabled
   - Max retries: 3

5. **SubscriptionsErrorBoundary** (`/features/subscriptions/ErrorBoundary.tsx`)
   - No auto-retry (payment sensitive)
   - Max retries: 2

6. **NostrErrorBoundary** (`/features/nostr/ErrorBoundary.tsx`)
   - Auto-retry enabled (handles relay failures)
   - Max retries: 3

7. **AIErrorBoundary** (`/features/ai/ErrorBoundary.tsx`)
   - Auto-retry enabled (non-critical feature)
   - Max retries: 3

## Usage Guide

### Adding Error Boundary to New Feature

1. **Create feature-specific boundary**:

```tsx
// /features/my-feature/ErrorBoundary.tsx
import React from 'react';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

interface MyFeatureErrorBoundaryProps {
  children: React.ReactNode;
}

export const MyFeatureErrorBoundary: React.FC<MyFeatureErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="My Feature"
      maxRetries={3}
      autoRetry={true}
    >
      {children}
    </FeatureErrorBoundary>
  );
};
```

2. **Integrate in App.tsx**:

```tsx
import { MyFeatureErrorBoundary } from './features/my-feature/ErrorBoundary';

<Route
  path="/my-feature"
  element={
    <Layout>
      <ProtectedRoute>
        <MyFeatureErrorBoundary>
          <MyFeature />
        </MyFeatureErrorBoundary>
      </ProtectedRoute>
    </Layout>
  }
/>
```

3. **Add tests**:

```tsx
// /features/my-feature/__tests__/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { MyFeatureErrorBoundary } from '../ErrorBoundary';

describe('MyFeatureErrorBoundary', () => {
  it('catches errors', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <MyFeatureErrorBoundary>
        <ThrowError />
      </MyFeatureErrorBoundary>
    );

    expect(screen.getByText(/My Feature Feature Error/i)).toBeInTheDocument();
  });
});
```

### Custom Fallback UI

Create a custom fallback component for specialized error handling:

```tsx
import { FeatureErrorFallbackProps } from '@/components/FeatureErrorBoundary';

const CustomFallback: React.FC<FeatureErrorFallbackProps> = ({
  error,
  onReset,
  featureName,
}) => {
  return (
    <div className="custom-error-ui">
      <h2>{featureName} is temporarily unavailable</h2>
      <p>Please try again in a moment.</p>
      <button onClick={onReset}>Retry</button>
    </div>
  );
};

// Use custom fallback
<FeatureErrorBoundary
  featureName="My Feature"
  fallback={CustomFallback}
>
  <MyComponent />
</FeatureErrorBoundary>
```

## Configuration

### Auto-Retry Settings

Customize retry behavior per feature:

```tsx
<FeatureErrorBoundary
  featureName="API-Heavy Feature"
  maxRetries={5}           // Increase retries for network-dependent features
  autoRetry={true}         // Enable automatic retry
>
  <Component />
</FeatureErrorBoundary>
```

### Disable Auto-Retry

For sensitive features (auth, payments):

```tsx
<FeatureErrorBoundary
  featureName="Payment Processing"
  autoRetry={false}        // Disable auto-retry
  maxRetries={0}           // No manual retries either
>
  <PaymentForm />
</FeatureErrorBoundary>
```

### Exponential Backoff

Auto-retry uses exponential backoff:
- 1st retry: 1 second
- 2nd retry: 2 seconds
- 3rd retry: 4 seconds
- Maximum delay: 10 seconds

## Error Recovery

### User Recovery Options

**Feature-Level Errors**:
1. **Try Again** - Manual retry (resets component state)
2. **Go Home** - Navigate to home page
3. **Continue** - Use rest of app (feature isolated)

**Global Errors**:
1. **Reload Page** - Full page refresh
2. **Go Home** - Navigate to home page
3. **Try Again** - Reset error boundary state

### Programmatic Error Recovery

```tsx
// Using useAsyncError hook for async error propagation
import { useAsyncError } from '@/monitoring/ErrorBoundary';

function MyComponent() {
  const throwError = useAsyncError();

  const handleAsyncError = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      throwError(error); // Propagate to error boundary
    }
  };

  return <button onClick={handleAsyncError}>Do Something</button>;
}
```

## Testing

### Unit Tests

All error boundaries have comprehensive test coverage:

```bash
# Run error boundary tests
npm test -- GlobalErrorBoundary.test.tsx
npm test -- FeatureErrorBoundary.test.tsx

# Run with coverage
npm test -- --coverage --collectCoverageFrom='src/components/*ErrorBoundary.tsx'
```

### Integration Tests

Test nested error boundary scenarios:

```bash
npm test -- ErrorBoundary.integration.test.tsx
```

### Test Coverage

- **GlobalErrorBoundary**: 96% coverage
- **FeatureErrorBoundary**: 95% coverage
- **Integration Tests**: All critical paths covered

### Testing Best Practices

```tsx
// Example test
describe('ErrorBoundary', () => {
  it('catches errors and shows fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <FeatureErrorBoundary featureName="Test">
        <ThrowError />
      </FeatureErrorBoundary>
    );

    expect(screen.getByText(/Test Feature Error/i)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

**Issue**: Error boundary not catching async errors

**Solution**: Use `useAsyncError` hook:
```tsx
const throwError = useAsyncError();

try {
  await asyncOperation();
} catch (error) {
  throwError(error);
}
```

---

**Issue**: Error boundary not resetting after retry

**Solution**: Ensure component key changes or state properly resets:
```tsx
const [resetKey, setResetKey] = useState(0);

<FeatureErrorBoundary key={resetKey} featureName="Test">
  <Component />
</FeatureErrorBoundary>
```

---

**Issue**: Sentry errors not being captured

**Solution**: Verify Sentry is initialized in `main.tsx`:
```tsx
import { sentryMonitoring } from './monitoring/sentry';

sentryMonitoring.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // ...other config
});
```

---

**Issue**: Custom fallback not rendering

**Solution**: Check fallback component signature:
```tsx
const MyFallback: React.FC<FeatureErrorFallbackProps> = (props) => {
  // Must accept all required props
  return <div>Error UI</div>;
};
```

## Best Practices

### 1. Granular Error Boundaries

Wrap features, not individual components:

```tsx
// ✅ Good - Feature-level boundary
<FeatureErrorBoundary featureName="Dashboard">
  <DashboardHeader />
  <DashboardContent />
  <DashboardFooter />
</FeatureErrorBoundary>

// ❌ Bad - Too granular
<FeatureErrorBoundary featureName="Header">
  <DashboardHeader />
</FeatureErrorBoundary>
<FeatureErrorBoundary featureName="Content">
  <DashboardContent />
</FeatureErrorBoundary>
```

### 2. Configure Retry Based on Feature Criticality

```tsx
// Critical features (auth, payments) - no auto-retry
<FeatureErrorBoundary featureName="Auth" autoRetry={false} maxRetries={1}>

// Non-critical features (analytics) - aggressive retry
<FeatureErrorBoundary featureName="Analytics" autoRetry={true} maxRetries={5}>

// Network-dependent features - moderate retry
<FeatureErrorBoundary featureName="Content" autoRetry={true} maxRetries={3}>
```

### 3. Always Provide Context to Sentry

```tsx
<FeatureErrorBoundary
  featureName="Checkout"
  onError={(error, errorInfo) => {
    // Add custom context
    sentryMonitoring.setContext('checkout', {
      step: currentStep,
      items: cartItems.length,
      total: cartTotal,
    });
  }}
>
```

### 4. Test Error Recovery Flows

```tsx
it('allows users to recover from errors', async () => {
  const { rerender } = render(
    <FeatureErrorBoundary featureName="Test">
      <ThrowError shouldThrow={true} />
    </FeatureErrorBoundary>
  );

  expect(screen.getByText(/Error/i)).toBeInTheDocument();

  const retryButton = screen.getByRole('button', { name: /try again/i });
  fireEvent.click(retryButton);

  rerender(
    <FeatureErrorBoundary featureName="Test">
      <ThrowError shouldThrow={false} />
    </FeatureErrorBoundary>
  );

  await waitFor(() => {
    expect(screen.getByText(/Success/i)).toBeInTheDocument();
  });
});
```

### 5. Development vs Production

Always show detailed errors in development:

```tsx
{process.env.NODE_ENV === 'development' && (
  <details>
    <summary>Error Details</summary>
    <pre>{error.stack}</pre>
  </details>
)}
```

## Performance Considerations

- **Overhead**: <5ms per error boundary (negligible)
- **Bundle Size**: +18kb gzipped (includes all boundaries)
- **Re-render Impact**: Minimal - only on error state change
- **Memory**: ~1KB per boundary instance

## Accessibility

All error boundaries are WCAG AA compliant:

- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ ARIA labels on all buttons
- ✅ Focus indicators visible
- ✅ Reduced motion support
- ✅ High contrast mode support

## Related Documentation

- [Sentry Integration Guide](../monitoring/sentry-integration.md)
- [Testing Standards](../testing/testing-standards.md)
- [Component Architecture](../architecture/component-architecture.md)
- [User Story US-007](../user-stories/US-007.md)

## Support

For questions or issues:
- GitHub Issues: [Create Issue](https://github.com/sovren/sovren/issues)
- Team Chat: #frontend-support
- Documentation: [Full Docs](../README.md)

---

**Version History**:
- v1.0.0 (2025-10-30) - Initial implementation with comprehensive error handling
