# Feature Flags Implementation Guide

## Overview

Feature flags are implemented as a comprehensive system that allows safe deployment and testing of new features. The implementation consists of:

1. **Shared Type Definitions** (`packages/shared/src/featureFlags.ts`)
2. **Frontend Hook** (`packages/frontend/src/hooks/useFeatureFlags.ts`)
3. **Environment Configuration** (`.env` files)

## Architecture

```
packages/
├── shared/src/featureFlags.ts       # Type definitions & validation
└── frontend/
    ├── src/hooks/useFeatureFlags.ts # React hook for flag consumption
    └── .env                         # Environment configuration
```

## Type Safety & Validation

- All feature flag types are defined in TypeScript and validated at runtime using Zod.
- All API endpoints and CLI commands validate input using Zod schemas.
- This ensures strict type safety and prevents invalid flag values from being set.

## Code Quality: Linting, Formatting, and Tests

- All code must pass ESLint (with Prettier) and all tests before merging.
- Run `npm run lint` and `npm run test` in the root or backend package.
- Linting and type-checking are enforced in CI.

## Usage

### Defining Flags

Add new flags in `@sovren/shared/src/featureFlags.ts`:

```typescript
export const featureFlagSchema = z.object({
  enablePayments: z.boolean().default(false),
  enableAIRecommendations: z.boolean().default(false),
  enableNostrIntegration: z.boolean().default(true),
  enableExperimentalUI: z.boolean().default(false),
  // Add new flags here
});
```

### Environment Configuration

Configure flags in your environment files:

```env
# .env.local (development)
VITE_FEATURE_FLAGS_ENABLED=true
VITE_ENABLE_PAYMENTS=false
VITE_ENABLE_AI_RECOMMENDATIONS=false
VITE_ENABLE_NOSTR_INTEGRATION=true
VITE_ENABLE_EXPERIMENTAL_UI=true
```

### Frontend Usage

```typescript
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

function MyComponent() {
  const flags = useFeatureFlags();

  return (
    <>
      {flags.enablePayments && <PaymentButton />}
      {flags.enableAIRecommendations && <AIRecommendations />}
      {flags.enableNostrIntegration && <NostrLogin />}
      {flags.enableExperimentalUI && <ExperimentalFeatures />}
    </>
  );
}
```

## Development

### Adding New Flags

1. Add flag to schema in `@sovren/shared/src/featureFlags.ts`
2. Update tests in `packages/shared/src/featureFlags.test.ts`
3. Add environment variable to `.env.example`
4. Update documentation in this file

### Testing

```bash
# Run all tests
npm test

# Run feature flag tests only
npm test -- packages/shared/src/featureFlags.test.ts
```

## Best Practices

1. **Flag Naming**
   - Use descriptive names (enablePayments, enableAIRecommendations)
   - Follow camelCase convention
   - Prefix with feature area for complex systems

2. **Default Values**
   - Set safe defaults (usually false for new features)
   - Document purpose in schema comments
   - Consider impact on different environments

3. **Testing & Validation**
   - Test both enabled and disabled states
   - Include comprehensive unit tests
   - Use TypeScript for type safety

4. **Environment Management**
   - Use different values for development vs production
   - Document required environment variables
   - Provide sensible defaults
