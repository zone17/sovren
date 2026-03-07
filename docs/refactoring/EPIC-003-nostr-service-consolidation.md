# Epic 003: NOSTR Service Consolidation

## Epic Summary

Consolidate duplicated NOSTR protocol services across frontend, backend, and shared packages into a single, well-tested shared implementation to reduce technical debt and improve maintainability.

## Business Value

- **Code Reduction**: Eliminate ~15% of NOSTR-related code
- **Bug Prevention**: Single source of truth reduces bug surface area
- **Maintenance**: 30% reduction in NOSTR-related maintenance effort
- **Consistency**: Unified NOSTR behavior across all packages
- **Developer Velocity**: Easier to add new NOSTR features

## Current State

### Duplication Analysis

1. **Frontend NOSTR Service** (`packages/frontend/src/services/nostr/`)
   - ~800 lines of code
   - Event publishing, relay management, subscription handling
   - React-specific hooks and state management

2. **Backend NOSTR Service** (`packages/backend/src/services/nostr/`)
   - ~650 lines of code
   - Similar event publishing logic
   - Server-side relay connections
   - Webhook integration

3. **Shared NOSTR Utils** (`packages/shared/src/services/nostr/`)
   - ~300 lines of code
   - Basic event creation and validation
   - Type definitions
   - Partial implementation only

### Overlap Analysis

- **Event Creation**: 90% duplicated (all 3 packages)
- **Relay Connection**: 85% duplicated (frontend/backend)
- **Event Validation**: 70% duplicated (all 3 packages)
- **Subscription Management**: 60% duplicated (frontend/backend)
- **Type Definitions**: 50% duplicated (frontend/shared)

## Desired End State

```
packages/
└── shared/
    └── src/
        └── services/
            └── nostr/
                ├── core/              # Core NOSTR logic (platform-agnostic)
                │   ├── events.ts      # Event creation, validation
                │   ├── relays.ts      # Relay connection management
                │   ├── subscriptions.ts # Subscription handling
                │   └── crypto.ts      # Key management, signing
                ├── adapters/          # Platform-specific adapters
                │   ├── browser.ts     # Frontend-specific (React hooks)
                │   ├── node.ts        # Backend-specific (server-side)
                │   └── types.ts       # Adapter interfaces
                ├── types/             # Shared type definitions
                │   ├── events.ts
                │   ├── relays.ts
                │   └── index.ts
                └── index.ts           # Public API

Frontend/Backend consume shared service via adapters
```

## Success Criteria

- [ ] Single shared NOSTR service implementation in `packages/shared`
- [ ] Platform-specific adapters for frontend (React) and backend (Node.js)
- [ ] 95%+ test coverage for core NOSTR logic
- [ ] All existing NOSTR functionality preserved
- [ ] Zero regression in NOSTR features
- [ ] Documentation complete with architecture diagrams
- [ ] Migration guide for existing code
- [ ] ~1,000 lines of code eliminated

## Technical Scope

### Core Shared Service

#### 1. Event Management (`core/events.ts`)

- Event creation (kinds 0, 1, 3, 4, 30023, custom)
- Event validation (signature, hash, timestamp)
- Event serialization/deserialization
- NIP compliance checking

#### 2. Relay Management (`core/relays.ts`)

- Relay connection pooling
- Automatic reconnection with exponential backoff
- Relay health monitoring
- Multi-relay publishing with fallback
- Read/write relay separation

#### 3. Subscription Handling (`core/subscriptions.ts`)

- Filter creation and validation
- Subscription lifecycle management
- Event stream processing
- Subscription deduplication

#### 4. Cryptography (`core/crypto.ts`)

- Key pair generation (NIP-06)
- Event signing
- Encrypted DM support (NIP-04)
- NIP-07 browser extension integration

### Platform Adapters

#### Frontend Adapter (`adapters/browser.ts`)

```typescript
// React hooks for NOSTR
export const useNostrEvents = (filters: Filter[]) => {
  /* ... */
};
export const useNostrPublish = () => {
  /* ... */
};
export const useNostrSubscription = (filters: Filter[]) => {
  /* ... */
};

// Browser-specific features
export const connectBrowserExtension = () => {
  /* ... */
};
export const getStoredRelays = () => {
  /* ... */
};
```

#### Backend Adapter (`adapters/node.ts`)

```typescript
// Server-side NOSTR client
export class NostrServerClient {
  async publish(event: Event): Promise<void> {
    /* ... */
  }
  subscribe(filters: Filter[]): EventEmitter {
    /* ... */
  }
  // ... server-specific methods
}
```

## Technical Approach

### Phase 1: Core Service Extraction (2-3 days)

1. Identify common code patterns across all three implementations
2. Extract to `packages/shared/src/services/nostr/core/`
3. Create comprehensive unit tests (95%+ coverage)
4. Document core API with JSDoc

### Phase 2: Adapter Pattern Implementation (2 days)

1. Design adapter interfaces for platform-specific behavior
2. Implement browser adapter for frontend React hooks
3. Implement Node.js adapter for backend server
4. Test adapters in isolation

### Phase 3: Frontend Migration (1-2 days)

1. Replace frontend NOSTR service with shared service + browser adapter
2. Update React components to use new hooks
3. Run integration tests
4. Fix any regressions

### Phase 4: Backend Migration (1-2 days)

1. Replace backend NOSTR service with shared service + node adapter
2. Update API endpoints using NOSTR
3. Run integration tests
4. Fix any regressions

### Phase 5: Cleanup & Documentation (1 day)

1. Remove old NOSTR service implementations
2. Update all documentation
3. Create migration guide
4. Generate architecture diagrams

## Dependencies

### Blockers

- Type Safety Improvements (Epic 001) should be completed first for cleaner types

### Related Work

- Will improve state management clarity (Epic 004)
- Simplifies backend service refactoring (Epic 005)

## Risks & Mitigation

| Risk                         | Impact   | Likelihood | Mitigation                                     |
| ---------------------------- | -------- | ---------- | ---------------------------------------------- |
| Breaking NOSTR functionality | Critical | Medium     | Comprehensive integration tests, feature flags |
| Performance degradation      | High     | Low        | Benchmark before/after, optimize adapters      |
| Incompatibility with NIPs    | High     | Low        | NIP compliance test suite                      |
| Relay connection issues      | High     | Medium     | Extensive relay testing on testnet/mainnet     |
| Migration complexity         | Medium   | Medium     | Incremental migration with parallel running    |

## Estimated Effort

- **Total Story Points**: 21-34 points
- **Estimated Calendar Time**: 1.5-2 weeks
- **Team Size**: 2 developers (1 frontend focus, 1 backend focus)

## Implementation Order

1. **Phase 1**: Core service extraction (can start immediately)
2. **Phase 2**: Adapter implementation (parallel with Phase 1 testing)
3. **Phase 3 & 4**: Frontend/Backend migration (sequential, but each can be done independently)
4. **Phase 5**: Cleanup (final phase)

## Testing Strategy

### Unit Tests

- 95%+ coverage for core service
- Test all NIPs compliance
- Test error handling and edge cases

### Integration Tests

- Relay connection and reconnection
- Multi-relay publishing
- Subscription filtering
- Event verification

### E2E Tests

- Frontend: User publishing and viewing content
- Backend: API endpoints using NOSTR
- Cross-platform: Verify frontend/backend can communicate via NOSTR

### Performance Tests

- Benchmark relay connection pooling
- Measure event publishing latency
- Test subscription throughput

## Migration Strategy

### Gradual Migration Approach

1. Deploy shared service alongside existing implementations
2. Feature flag to toggle between old/new implementation
3. Migrate one package at a time (shared → frontend → backend)
4. Run A/B tests to validate behavior
5. Remove old implementations only after 100% confidence

### Rollback Plan

- Keep old implementations for 1-2 sprints after migration
- Feature flags allow instant rollback
- Monitoring alerts for NOSTR-related errors

## Documentation Requirements

- **Architecture Diagrams** (Mermaid):
  - NOSTR service architecture overview
  - Adapter pattern structure
  - Event publishing flow
  - Subscription flow
  - Relay management flow

- **API Documentation**:
  - Core service API reference
  - Adapter interface documentation
  - Migration guide for developers
  - NIP compliance reference

- **Code Examples**:
  - Frontend usage examples
  - Backend usage examples
  - Custom adapter creation guide

## Performance Targets

- Event publishing latency: < 100ms (p95)
- Relay connection time: < 2s (p95)
- Subscription event processing: > 1000 events/sec
- Memory footprint: < 50MB for relay connections
- Bundle size impact: < 10KB increase (frontend)

## Notes

- **Strategic Refactoring** - High impact, moderate effort
- Opportunity to add new NOSTR features more easily
- Consider adding NIP-42 (relay authentication) during consolidation
- May want to extract to separate npm package in future
- Document NOSTR architecture decisions in ADR
