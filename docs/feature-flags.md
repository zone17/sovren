# Feature Flag System Documentation

## Overview

The feature flag system provides a type-safe, file-based solution for managing feature toggles in the Sovren platform. It includes a backend API, CLI tool, and frontend integration.

## Architecture

### Components

1. **Shared Types** (`@sovren/shared/src/featureFlags.ts`)

   - Type definitions using Zod
   - Default flag values
   - Type-safe validation

2. **Backend Service** (`packages/backend/src/featureFlags/`)

   - File-based storage with locking
   - Automatic backups
   - Audit logging
   - Rate-limited admin API

3. **CLI Tool** (`packages/backend/src/featureFlags/cli.ts`)

   - List current flags
   - Update flag values
   - Manage backups

4. **Frontend Integration** (`packages/frontend/src/hooks/useFeatureFlags.ts`)
   - React hook for flag consumption
   - Type-safe flag access
   - Automatic updates

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
  // Add new flags here
});
```

### Backend API

1. **Get Flags**

   ```bash
   GET /api/feature-flags
   ```

   Returns all current flag values.

2. **Update Flags** (Admin only)

   ```bash
   POST /api/feature-flags
   Headers:
     x-admin-token: <your-admin-token>
   Body:
     {
       "flags": {
         "enablePayments": true
       }
     }
   ```

3. **Cleanup Backups** (Admin only)
   ```bash
   POST /api/feature-flags/cleanup
   Headers:
     x-admin-token: <your-admin-token>
   Body:
     {
       "maxAgeDays": 7
     }
   ```

### CLI Tool

1. **List Flags**

   ```bash
   npm run feature-flags list
   ```

2. **Update Flags**

   ```bash
   npm run feature-flags set enablePayments=true enableAIRecommendations=false
   ```

3. **Cleanup Backups**
   ```bash
   npm run feature-flags cleanup --days 7
   ```

### Frontend Usage

```typescript
import { useFeatureFlags } from '@sovren/frontend/src/hooks/useFeatureFlags';

function MyComponent() {
  const { flags, loading, error } = useFeatureFlags();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return flags.enablePayments ? <PaymentButton /> : null;
}
```

## Security

- Admin endpoints require `FEATURE_FLAG_ADMIN_TOKEN`
- Rate limiting: 100 requests per 15 minutes per IP
- File locking prevents concurrent writes
- Automatic backups with cleanup

## Backup System

- Automatic backups on every flag change
- Timestamped backup files
- Configurable retention period
- Manual cleanup via API or CLI

## Development

### Adding New Flags

1. Add flag to schema in `@sovren/shared/src/featureFlags.ts`
2. Update tests in `packages/backend/src/routes/featureFlags.test.ts`
3. Update documentation

### Testing

```bash
# Run all tests
npm run test

# Run feature flag tests only
npm run test -- -t "Feature Flags"
```

## Troubleshooting

### Common Issues

1. **Flag not updating**

   - Check admin token
   - Verify file permissions
   - Check for lock file

2. **Backup issues**

   - Verify backup directory exists
   - Check disk space
   - Review cleanup settings

3. **API errors**

   - Check rate limits
   - Verify token
   - Review server logs

4. **Linter or test failures**
   - Run `npm run lint` and `npm run test` in the affected package
   - Fix all reported issues before merging
   - Ensure all new code uses Zod for validation

## Best Practices

1. **Flag Naming**

   - Use descriptive names
   - Follow camelCase
   - Prefix with feature area

2. **Default Values**

   - Set safe defaults
   - Document in schema
   - Consider environment

3. **Testing & Validation**

   - Test both states
   - Include in CI/CD
   - Monitor usage
   - Use Zod for all dynamic data validation

4. **Maintenance**
   - Regular cleanup
   - Monitor logs
   - Review usage
