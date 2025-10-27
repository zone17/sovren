# US-320 & US-323 Quick Reference

**Epic 003 Wave 5** - Custom Sovren NIPs + Migration Scripts
**Status**: ✅ Complete

---

## Custom Event Kinds (US-320)

| Kind | Name | Purpose |
|------|------|---------|
| **30078** | Creator Profile Extended | Enhanced creator metadata |
| **30079** | Content Monetization | Paywall & pricing settings |
| **30080** | Analytics Event | View/engagement tracking |
| **30081** | Subscription Management | Tier & subscriber management |
| **30082** | Content Recommendations | AI-powered discovery |

---

## Quick Start - Using Custom NIPs

### Import Service

```typescript
import { SovrenNIPService, createSovrenNIPService } from '@/services/nostr';
import { CreatorCategory, SocialPlatform } from '@shared/types/nostr';

const sovrenNIP = createSovrenNIPService(
  publisher,
  keyManager,
  relayPool,
  cache
);
```

### Publish Creator Profile (Kind 30078)

```typescript
const result = await sovrenNIP.publishCreatorProfile({
  displayName: 'Alice',
  bio: 'Bitcoin educator',
  categories: [CreatorCategory.TECHNOLOGY],
  lightningAddress: 'alice@getalby.com',
  links: [],
  paymentMethods: [{
    type: 'lightning',
    address: 'alice@getalby.com',
    preferred: true,
    enabled: true
  }],
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
  version: '1.0.0'
});
```

### Fetch Monetization Settings (Kind 30079)

```typescript
const result = await sovrenNIP.fetchMonetizationSettings('content-123');

if (result.success) {
  const { pricingTiers, paywall } = result.data;
  // Show pricing or paywall
}
```

### Track Analytics (Kind 30080)

```typescript
await sovrenNIP.trackAnalyticsEvent('analytics-123', {
  eventType: AnalyticsEventType.VIEW,
  contentId: 'article-123',
  viewCount: 1,
  uniqueViewers: 1,
  periodStart: Math.floor(Date.now() / 1000),
  periodEnd: Math.floor(Date.now() / 1000),
  granularity: 'hourly',
  version: '1.0.0'
});
```

---

## Quick Start - Migration (US-323)

### Pre-Migration

```bash
# 1. Test dry-run
npm run migrate:all:dry-run

# 2. Review output (check counts)
```

### Migration

```bash
# 3. Run actual migration
npm run migrate:all

# 4. Validate results
npm run migrate:validate
```

### Post-Migration

```bash
# 5. If issues, rollback
npm run migrate:rollback

# 6. Check strict validation
npm run migrate:validate:strict
```

---

## Migration Commands

| Command | Purpose |
|---------|---------|
| `npm run migrate:keys` | Migrate keys to encrypted storage |
| `npm run migrate:events` | Migrate events to cache |
| `npm run migrate:subscriptions` | Migrate subscriptions |
| `npm run migrate:all` | Run all migrations |
| `npm run migrate:all:dry-run` | Test all migrations |
| `npm run migrate:validate` | Validate migration |
| `npm run migrate:rollback` | Rollback migration |

---

## File Locations

### Custom NIPs

- **Types**: `/packages/shared/src/types/nostr/sovren-nips.ts`
- **Service**: `/packages/frontend/src/services/nostr/SovrenNIPService.ts`
- **Tests**: `/packages/frontend/src/services/nostr/__tests__/SovrenNIPService.test.ts`

### Migration Scripts

- **Keys**: `/scripts/nostr-migration/migrate-keys.ts`
- **Events**: `/scripts/nostr-migration/migrate-events.ts`
- **Subscriptions**: `/scripts/nostr-migration/migrate-subscriptions.ts`
- **Validation**: `/scripts/nostr-migration/validate-migration.ts`
- **Rollback**: `/scripts/nostr-migration/rollback-migration.ts`

### Documentation

- **NIP Spec**: `/docs/nostr/sovren-nips-specification.md`
- **Migration Guide**: `/docs/nostr/migration-guide.md`
- **Completion Summary**: `/US-320-323-IMPLEMENTATION-COMPLETE.md`

---

## Key Concepts

### Custom NIPs Design

- **Range**: 30078-30082 (parameterized replaceable)
- **Standard**: NIP-33 compliant
- **Validation**: Zod schemas for all types
- **Backward Compatible**: Works with standard NOSTR clients

### Migration Safety

- **Dry-Run**: Test before actual migration
- **Backups**: Automatic timestamped backups
- **Validation**: Checksums and count verification
- **Rollback**: Complete recovery capability
- **Encryption**: AES-256-GCM for keys

---

## Common Issues

### "No public key available"

```typescript
// Ensure user is authenticated
await keyManager.getPublicKey(); // Should return pubkey
```

### "Migration timeout"

```bash
# Run migrations separately
npm run migrate:keys
npm run migrate:events
npm run migrate:subscriptions
```

### "Password forgotten"

```bash
# Rollback and re-migrate with new password
npm run migrate:rollback
npm run migrate:keys  # Enter new password
```

---

## Testing

### Run SovrenNIP Tests

```bash
npm test SovrenNIPService.test.ts
```

### Coverage

```bash
npm run test:coverage
```

---

## Support

- **Documentation**: See `/docs/nostr/` directory
- **Issues**: GitHub Issues
- **Questions**: See migration guide FAQ section

---

**Quick Reference Version**: 1.0.0
**Last Updated**: 2025-10-26
