# Epic 003: NOSTR Service Consolidation - Quick Reference Guide

## Story Lookup Table

| Story ID | Title                                          | Files Modified                                                                                       | Est. Time | Dependencies           |
| -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- | ---------------------- |
| NS-001   | Create Core NOSTR Service Structure            | `packages/shared/src/services/nostr/**/*.ts`                                                         | 2h        | None                   |
| NS-002   | Implement Event Creation Logic                 | `packages/shared/src/services/nostr/core/events.ts`                                                  | 3h        | NS-001                 |
| NS-003   | Add Event Validation and Verification          | `packages/shared/src/services/nostr/core/events.ts`                                                  | 3h        | NS-002                 |
| NS-004   | Build Relay Connection Pool                    | `packages/shared/src/services/nostr/core/relays.ts`                                                  | 4h        | NS-001                 |
| NS-005   | Implement Relay Auto-Reconnection              | `packages/shared/src/services/nostr/core/relays.ts`                                                  | 3h        | NS-004                 |
| NS-006   | Create Subscription Management System          | `packages/shared/src/services/nostr/core/subscriptions.ts`                                           | 4h        | NS-001                 |
| NS-007   | Add Cryptographic Operations                   | `packages/shared/src/services/nostr/core/crypto.ts`                                                  | 4h        | NS-002                 |
| NS-008   | Implement NIP-07 Browser Extension Support     | `packages/shared/src/services/nostr/core/nip07.ts`                                                   | 2h        | NS-007                 |
| NS-009   | Define Adapter Interfaces                      | `packages/shared/src/services/nostr/adapters/types.ts`                                               | 2h        | NS-001                 |
| NS-010   | Create Browser Adapter Base                    | `packages/shared/src/services/nostr/adapters/browser.ts`                                             | 3h        | NS-008, NS-009         |
| NS-011   | Implement React Hooks for NOSTR                | `packages/shared/src/services/nostr/adapters/browser/hooks.ts`                                       | 4h        | NS-010                 |
| NS-012   | Add Browser Storage Integration                | `packages/shared/src/services/nostr/adapters/browser/storage.ts`                                     | 3h        | NS-010                 |
| NS-013   | Create Node.js Adapter Base                    | `packages/shared/src/services/nostr/adapters/node.ts`                                                | 3h        | NS-009                 |
| NS-014   | Implement Server-Side Event Emitter            | `packages/shared/src/services/nostr/adapters/node/emitter.ts`                                        | 3h        | NS-013                 |
| NS-015   | Add Feature Flag for Frontend Migration        | `packages/frontend/src/services/nostr/migration.ts`                                                  | 2h        | NS-012                 |
| NS-016   | Migrate Frontend Event Publishing              | `packages/frontend/src/components/PostComposer.tsx`, `packages/frontend/src/components/Profile*.tsx` | 3h        | NS-015                 |
| NS-017   | Update Frontend Subscription Handling          | `packages/frontend/src/components/Feed.tsx`, `packages/frontend/src/pages/*.tsx`                     | 3h        | NS-015                 |
| NS-018   | Integrate Frontend Components with New Service | `packages/frontend/src/App.tsx`, `packages/frontend/src/components/**/*.tsx`                         | 4h        | NS-016, NS-017         |
| NS-019   | Add Feature Flag for Backend Migration         | `packages/backend/src/services/nostr/migration.ts`                                                   | 2h        | NS-014                 |
| NS-020   | Migrate Backend Event Publishing               | `packages/backend/src/controllers/nostr.controller.ts`                                               | 3h        | NS-019                 |
| NS-021   | Update Backend API Endpoints                   | `packages/backend/src/routes/nostr.routes.ts`                                                        | 3h        | NS-019                 |
| NS-022   | Migrate Backend Webhook Integration            | `packages/backend/src/webhooks/handlers.ts`                                                          | 4h        | NS-019                 |
| NS-023   | Remove Old Frontend Implementation             | `packages/frontend/src/services/nostr/**` (delete)                                                   | 2h        | NS-016, NS-017, NS-018 |
| NS-024   | Remove Old Backend Implementation              | `packages/backend/src/services/nostr/**` (delete)                                                    | 2h        | NS-020, NS-021, NS-022 |
| NS-025   | Create Architecture Documentation              | `docs/architecture/nostr-service.md`                                                                 | 3h        | NS-023, NS-024         |
| NS-026   | Performance Validation and Benchmarking        | `packages/shared/src/services/nostr/__tests__/benchmarks.ts`                                         | 4h        | NS-023, NS-024         |

## Files to Create

### Core Service Files

```
packages/shared/src/services/nostr/
├── core/
│   ├── events.ts          # NS-002, NS-003
│   ├── relays.ts          # NS-004, NS-005
│   ├── subscriptions.ts   # NS-006
│   ├── crypto.ts          # NS-007
│   ├── nip07.ts           # NS-008
│   └── index.ts
├── adapters/
│   ├── types.ts           # NS-009
│   ├── browser.ts         # NS-010
│   ├── browser/
│   │   ├── hooks.ts       # NS-011
│   │   └── storage.ts     # NS-012
│   ├── node.ts            # NS-013
│   └── node/
│       └── emitter.ts     # NS-014
├── types/
│   ├── base.ts
│   ├── events.ts
│   ├── relays.ts
│   └── index.ts
└── index.ts
```

### Migration Files

```
packages/frontend/src/services/nostr/
└── migration.ts           # NS-015

packages/backend/src/services/nostr/
└── migration.ts           # NS-019
```

### Documentation Files

```
docs/architecture/
└── nostr-service.md       # NS-025

packages/shared/src/services/nostr/__tests__/
└── benchmarks.ts          # NS-026
```

## Files to Modify

### Frontend (Sprint 2)

- `packages/frontend/src/components/PostComposer.tsx`
- `packages/frontend/src/components/Feed.tsx`
- `packages/frontend/src/components/Profile*.tsx`
- `packages/frontend/src/pages/Home.tsx`
- `packages/frontend/src/pages/Profile.tsx`
- `packages/frontend/src/App.tsx`
- All components using NOSTR functionality

### Backend (Sprint 2)

- `packages/backend/src/controllers/nostr.controller.ts`
- `packages/backend/src/routes/nostr.routes.ts`
- `packages/backend/src/webhooks/handlers.ts`
- `packages/backend/src/services/**/*.ts` (any using NOSTR)

### Shared

- `packages/shared/package.json` (add dependencies)
- `packages/shared/tsconfig.json` (if needed)

## Files to Delete

### Frontend Cleanup (NS-023)

```bash
rm -rf packages/frontend/src/services/nostr/
rm -rf packages/frontend/src/types/nostr/
```

### Backend Cleanup (NS-024)

```bash
rm -rf packages/backend/src/services/nostr/
rm -rf packages/backend/src/utils/nostr/
```

## Common NOSTR Patterns

### Creating and Publishing an Event

```typescript
// Using new shared service
import { useNostrPublish } from '@sovren/shared/nostr/adapters/browser/hooks';

function Component() {
  const { publish, publishing, error } = useNostrPublish();

  const handlePublish = async () => {
    const event = await publish({
      kind: 1,
      content: 'Hello NOSTR!',
      tags: [],
    });
  };
}
```

### Subscribing to Events

```typescript
// Using new shared service
import { useNostrSubscription } from '@sovren/shared/nostr/adapters/browser/hooks';

function Feed() {
  const { events, loading } = useNostrSubscription([
    { kinds: [1], limit: 50 }
  ]);

  return <div>{events.map(e => <Post event={e} />)}</div>;
}
```

### Backend Event Publishing

```typescript
// Using new shared service
import { getNostrAdapter } from '@sovren/shared/nostr';

async function publishFromServer(content: string) {
  const adapter = getNostrAdapter();

  const event = await adapter.events.createEvent({
    kind: 1,
    content,
  });

  const signed = await adapter.crypto.signEvent(event, privateKey);
  await adapter.relays.publishToRelays(signed);
}
```

## Testing Checklist

### Unit Tests (Per Story)

- [ ] All public methods tested
- [ ] Edge cases covered
- [ ] Error handling validated
- [ ] Type safety verified

### Integration Tests (Per Phase)

- [ ] Relay connections work
- [ ] Event publishing succeeds
- [ ] Subscriptions deliver events
- [ ] Extension integration works

### E2E Tests (Migration Stories)

- [ ] User can create posts
- [ ] User can view feed
- [ ] Real-time updates work
- [ ] Error states handled

### Performance Tests (NS-026)

- [ ] Benchmarks pass
- [ ] No memory leaks
- [ ] Bundle size acceptable
- [ ] API latency unchanged

## NIP Compliance Checklist

### Core NIPs (Must Support)

- [ ] **NIP-01**: Basic protocol (events, subscriptions)
- [ ] **NIP-04**: Encrypted Direct Messages
- [ ] **NIP-06**: Key derivation
- [ ] **NIP-07**: Browser extension integration
- [ ] **NIP-19**: bech32-encoded entities

### Optional NIPs (Nice to Have)

- [ ] **NIP-42**: Relay authentication
- [ ] **NIP-65**: Relay list metadata

## Migration Commands

### Installing Shared Package

```bash
# Frontend
cd packages/frontend
npm install @sovren/shared@workspace:*

# Backend
cd packages/backend
npm install @sovren/shared@workspace:*
```

### Find Files to Update

```bash
# Find all NOSTR imports in frontend
find packages/frontend -name "*.ts*" \
  -exec grep -l "from.*services/nostr" {} \;

# Find all NOSTR imports in backend
find packages/backend -name "*.ts" \
  -exec grep -l "from.*services/nostr" {} \;
```

### Update Imports

```bash
# Replace old imports with new (example)
find packages/frontend/src -name "*.tsx" -type f \
  -exec sed -i '' \
  's|from.*services/nostr|from "@sovren/shared/nostr"|g' {} \;
```

### Verify No Old Imports Remain

```bash
# Should return empty
grep -r "from.*services/nostr" packages/frontend/src
grep -r "from.*services/nostr" packages/backend/src
```

## Feature Flag Configuration

### Frontend Flag

```typescript
// packages/shared/src/featureFlags.ts
export const FEATURE_FLAGS = {
  USE_NEW_NOSTR_SERVICE: {
    defaultValue: false,
    description: 'Use consolidated NOSTR service',
    rolloutPercentage: 0, // Gradually increase
  },
};
```

### Backend Environment Variable

```bash
# .env
USE_NEW_NOSTR=false  # Toggle for migration
```

### Rollout Strategy

1. Start at 0% (disabled)
2. Enable for internal testing (10%)
3. Gradual rollout (25% → 50% → 75%)
4. Full rollout (100%)
5. Remove flag after 2 weeks stable

## Debugging Helpers

### Enable Debug Logging

```typescript
// packages/shared/src/services/nostr/core/index.ts
const DEBUG = process.env.NOSTR_DEBUG === 'true';

function log(...args: any[]) {
  if (DEBUG) console.log('[NOSTR]', ...args);
}
```

### Monitor Relay Connections

```typescript
// Check relay health
const adapter = getNostrAdapter();
const health = await adapter.relays.getHealthStatus();
console.log('Relay health:', health);
```

### Check Event Validation

```typescript
// Validate event before publishing
const result = adapter.events.validateEvent(event);
if (!result.valid) {
  console.error('Invalid event:', result.errors);
}
```

## Performance Targets

| Metric               | Target        | How to Measure         |
| -------------------- | ------------- | ---------------------- |
| Event Creation       | < 1ms         | Benchmark suite        |
| Relay Publishing     | < 100ms (p95) | Performance monitoring |
| Subscription Latency | < 50ms        | Real-time tracking     |
| Memory Footprint     | < 50MB        | Heap snapshots         |
| Bundle Size Impact   | < 10KB        | Webpack analyzer       |

## Code Review Checklist

### For Each Story PR

- [ ] Acceptance criteria met
- [ ] Tests passing (unit + integration)
- [ ] No TypeScript errors
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] No breaking changes

### For Migration PRs (NS-015 to NS-022)

- [ ] Feature flag implemented
- [ ] Old code still works when flag off
- [ ] New code works when flag on
- [ ] Rollback tested
- [ ] Monitoring added
- [ ] Error handling comprehensive

### For Cleanup PRs (NS-023, NS-024)

- [ ] All imports updated
- [ ] No dead code remains
- [ ] Build succeeds
- [ ] Tests still pass
- [ ] Bundle size checked
- [ ] Documentation reflects removal

## Quick Commands

### Run Tests for NOSTR Service

```bash
npm test -- packages/shared/src/services/nostr
```

### Run Benchmarks

```bash
npm run benchmark:nostr
```

### Check Bundle Size

```bash
cd packages/frontend
npm run build
npm run analyze
```

### Generate Coverage Report

```bash
npm test -- --coverage packages/shared/src/services/nostr
```

### Find TODOs/FIXMEs

```bash
grep -r "TODO\|FIXME" packages/shared/src/services/nostr
```

## Dependencies to Install

### Shared Package

```json
{
  "dependencies": {
    "@noble/secp256k1": "^2.0.0",
    "websocket": "^1.0.34"
  },
  "devDependencies": {
    "@types/websocket": "^1.0.5"
  }
}
```

### Frontend (if needed)

```json
{
  "dependencies": {
    "@sovren/shared": "workspace:*"
  }
}
```

### Backend (if needed)

```json
{
  "dependencies": {
    "@sovren/shared": "workspace:*",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.8"
  }
}
```

## Troubleshooting Guide

### Issue: WebSocket connections failing

**Solution**: Check relay URLs, verify network connectivity

```typescript
await adapter.relays.testConnection('wss://relay.damus.io');
```

### Issue: Events not signing

**Solution**: Verify private key format, check NIP-07 extension

```typescript
const hasExtension = await adapter.extension?.detectExtension();
```

### Issue: Subscriptions not receiving events

**Solution**: Check filter syntax, verify relay subscriptions

```typescript
const activeSubscriptions = adapter.subscriptions.getActive();
console.log('Active subs:', activeSubscriptions);
```

### Issue: Memory leaks

**Solution**: Ensure subscriptions are cleaned up

```typescript
useEffect(() => {
  const sub = subscribe(...);
  return () => unsubscribe(sub); // Important!
}, []);
```

### Issue: Bundle size increased

**Solution**: Check for duplicate dependencies, tree-shaking

```bash
npm run build -- --analyze
npx webpack-bundle-analyzer dist/stats.json
```

## Success Indicators

- ✅ All 26 stories merged
- ✅ 95%+ test coverage achieved
- ✅ Zero NOSTR-related production errors
- ✅ Feature flags can be removed
- ✅ ~750 lines of code eliminated
- ✅ Performance benchmarks passing
- ✅ Documentation complete
