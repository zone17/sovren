# Epic 003: NOSTR Consolidation Strategy

## Executive Summary

Epic 003 focuses on consolidating all NOSTR protocol implementations into unified, shared services. The current codebase has significant duplication with 177+ files containing NOSTR-related code, multiple key management services, scattered relay configurations, and inconsistent NIP implementations.

## Current State Analysis

### 🔴 Critical Issues Identified

#### 1. **Duplicated Key Management Services**
- **Frontend**: `NOSTRKeyManagementService.ts`, `NOSTRSigningService.ts`, `NOSTRSessionService.ts`, `NOSTRAccountProtectionService.ts`
- **Shared**: `NostrKeyManagementService.ts`, `NostrSecureKeyStorage.ts`
- **Components**: Multiple key management components (`NOSTRKeyManager.tsx`, `NostrKeyManagement.tsx`)
- **Impact**: 6+ duplicate implementations, inconsistent security practices

#### 2. **Multiple NOSTR Service Implementations**
- `packages/frontend/lib/services/nostrService.ts` - 600+ lines
- `packages/backend/src/services/nostr-auth.ts` - Auth-specific
- `packages/backend/src/services/enhanced-nostr-auth.ts` - Enhanced version
- **Impact**: 3+ different NOSTR service patterns

#### 3. **Hardcoded Relay URLs**
```typescript
// Found in multiple locations:
- backend/src/utils/env-validation.ts: 'wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social'
- backend/src/routes/nip05.ts: 'wss://relay.sovren.app', 'wss://relay.damus.io'
- frontend/lib/config/environment.ts: 'wss://relay.damus.io', 'wss://relay.nostr.info'
```

#### 4. **Inconsistent NIP Implementations**
- NIP-05 verification in backend only
- NIP-04 encryption partially implemented
- NIP-19 encoding scattered across services
- NIP-26 delegated events not implemented

#### 5. **No Unified Relay Management**
- Each service manages its own SimplePool
- No connection state synchronization
- No failover or retry logic

## Consolidation Strategy

### Phase 1: Create Shared NOSTR Core (Days 1-2)

#### US-301-308: Core Infrastructure
```
packages/shared/src/nostr/
├── core/
│   ├── NostrService.ts           # Main service singleton
│   ├── NostrKeyManager.ts        # Unified key management
│   ├── NostrRelayPool.ts         # Centralized relay management
│   ├── NostrEventBuilder.ts      # Event creation/signing
│   └── NostrSubscriptionManager.ts # Subscription handling
├── nips/
│   ├── NIP01Service.ts           # Basic protocol
│   ├── NIP04Service.ts           # Encrypted DMs
│   ├── NIP05Service.ts           # Verification
│   ├── NIP19Service.ts           # Bech32 encoding
│   └── NIP26Service.ts           # Delegated events
├── types/
│   ├── index.ts                  # All NOSTR types
│   ├── events.ts                 # Event types
│   ├── keys.ts                   # Key-related types
│   └── relays.ts                 # Relay types
└── utils/
    ├── crypto.ts                  # Cryptographic utilities
    ├── validation.ts              # Event/key validation
    └── encoding.ts                # Encoding utilities
```

### Phase 2: Backend Consolidation (Days 2-3)

#### US-309-315: Backend Services
```typescript
// packages/backend/src/services/nostr/
export class UnifiedNostrService {
  private keyManager: NostrKeyManager;
  private relayPool: NostrRelayPool;
  private nip05: NIP05Service;

  // Single source of truth for all NOSTR operations
  async authenticate(event: NostrEvent): Promise<AuthResult>;
  async verifyNIP05(identifier: string): Promise<NIP05Result>;
  async publishEvent(event: UnsignedEvent): Promise<PublishedEvent>;
  async subscribeToEvents(filters: Filter[]): Promise<Subscription>;
}
```

### Phase 3: Frontend Consolidation (Days 3-4)

#### US-316-322: Frontend Unification
```typescript
// packages/frontend/src/hooks/useNostr.ts
export const useNostr = () => {
  const nostr = useContext(NostrContext);

  return {
    // Unified API for all components
    connect: nostr.connect,
    disconnect: nostr.disconnect,
    signEvent: nostr.signEvent,
    publishEvent: nostr.publishEvent,
    subscribe: nostr.subscribe,
    getProfile: nostr.getProfile,
    verifyNIP05: nostr.verifyNIP05,
  };
};
```

### Phase 4: Testing & Migration (Days 4-5)

#### US-323-326: Quality Assurance
- Comprehensive integration tests
- E2E tests for all NOSTR flows
- Migration scripts for existing data
- Performance benchmarks

## Implementation Streams

### Stream A: Backend NOSTR Services (backend-api-builder)
- **US-301**: Core NOSTR service architecture
- **US-305**: Unified authentication service
- **US-304**: NIP-05 verification consolidation
- **US-311**: Session management unification
- **US-321**: Rate limiting implementation

### Stream B: Frontend NOSTR Components (elite-frontend-dev)
- **US-302**: Relay pool UI components
- **US-306**: Browser extension integration
- **US-314**: Profile management UI
- **US-317**: Caching and optimization
- **US-319**: Error handling UI

### Stream C: Shared Types & Utilities (backend-api-builder)
- **US-308**: Comprehensive type definitions
- **US-310**: NIP-19 encoding utilities
- **US-312**: Cryptography operations
- **US-313**: NIP-04 encryption
- **US-315**: NIP-26 delegation

### Stream D: Testing & Documentation (test-automation-engineer + technical-docs-writer)
- **US-318**: Integration test suite
- **US-323**: Mermaid architecture diagrams
- **US-324**: Developer documentation
- **US-326**: E2E test suite

### Stream E: Monitoring & Migration (backend-api-builder)
- **US-316**: Monitoring service
- **US-320**: WebSocket manager
- **US-322**: Backup system
- **US-325**: Migration scripts

## Success Metrics

### Technical Metrics
- **Code Reduction**: 60%+ reduction in NOSTR-related code
- **Test Coverage**: 95%+ for all NOSTR services
- **Performance**: <100ms event publishing, <50ms signature verification
- **Reliability**: 99.9% relay connection uptime

### Quality Gates
- ✅ Zero duplicate NOSTR implementations
- ✅ All hardcoded values removed
- ✅ Full NIP compliance (01, 04, 05, 19, 26)
- ✅ Unified relay pool with failover
- ✅ Comprehensive test coverage
- ✅ Complete documentation with diagrams

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation**: Feature flags for gradual rollout, maintain backward compatibility layer

### Risk 2: Performance Degradation
**Mitigation**: Benchmark before/after, implement caching, optimize WebSocket handling

### Risk 3: Security Vulnerabilities
**Mitigation**: Security audit all crypto operations, use proven libraries, implement rate limiting

## Dependencies

### External Libraries
- `nostr-tools`: Core NOSTR protocol implementation
- `@noble/curves`: Cryptographic operations
- `@scure/base`: Encoding utilities

### Internal Dependencies
- Shared types package must be updated first
- Database schema for NOSTR data
- Environment configuration updates

## Rollout Strategy

### Day 1-2: Core Infrastructure
- Create shared NOSTR services
- Implement comprehensive types
- Set up relay configuration

### Day 2-3: Backend Integration
- Replace scattered implementations
- Unify authentication flow
- Consolidate NIP-05 verification

### Day 3-4: Frontend Migration
- Update all components to use hooks
- Remove duplicate services
- Implement unified state management

### Day 4-5: Testing & Documentation
- Run comprehensive test suite
- Generate architecture diagrams
- Complete developer documentation
- Execute migration scripts

## Expected Outcomes

1. **Single Source of Truth**: One NOSTR service for entire application
2. **Improved Maintainability**: 60% less code to maintain
3. **Better Performance**: Optimized relay connections and caching
4. **Enhanced Security**: Centralized key management with proper encryption
5. **Full NIP Compliance**: Support for all required NIPs
6. **Developer Experience**: Clear APIs, comprehensive docs, easy testing

## Next Steps

1. ✅ Complete analysis and strategy document
2. 🔄 Create parallel work streams for agents
3. ⏳ Begin implementation with US-301 (Core NOSTR Service)
4. ⏳ Coordinate agent assignments
5. ⏳ Set up monitoring dashboard

---

**Epic Owner**: Project Orchestration Agent
**Status**: Ready for Implementation
**Timeline**: 5 Days (Phase 2, Days 6-10)
**Total Stories**: 26