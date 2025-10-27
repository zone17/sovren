# Epic 003: NOSTR Consolidation - User Stories

## Overview
Epic 003 focuses on consolidating all NOSTR protocol implementations into unified, shared services. This epic contains 26 user stories organized into 5 parallel work streams.

---

## Stream A: Backend NOSTR Services (5 stories)

### US-301: Consolidate NOSTR Key Management Services
**Priority**: P0 - Critical
**Size**: 8 points
**Dependencies**: None

**Description**: Unify 6+ duplicate key management implementations into a single shared service that handles all NOSTR key operations.

**Acceptance Criteria**:
- [ ] Single `NostrKeyManager` class in shared package
- [ ] Support for nsec/npub encoding (NIP-19)
- [ ] Browser extension integration (Alby, nos2x, etc.)
- [ ] Secure key storage with Web Crypto API
- [ ] Key rotation and backup mechanisms
- [ ] Hardware wallet support hooks
- [ ] 95%+ test coverage
- [ ] Migration script from old implementations

**Technical Details**:
```typescript
// packages/shared/src/nostr/core/NostrKeyManager.ts
export class NostrKeyManager {
  generateKeyPair(): NostrKeyPair;
  importPrivateKey(nsec: string): NostrKeyPair;
  exportKeys(format: 'hex' | 'npub' | 'nsec'): ExportedKeys;
  signEvent(event: UnsignedEvent): SignedEvent;
  verifySignature(event: SignedEvent): boolean;
  rotateKeys(oldKeys: NostrKeyPair): RotationResult;
  backupKeys(method: BackupMethod): BackupResult;
}
```

---

### US-305: Unify NOSTR Authentication Services
**Priority**: P0 - Critical
**Size**: 5 points
**Dependencies**: US-301

**Description**: Consolidate nostr-auth.ts and enhanced-nostr-auth.ts into a single authentication service.

**Acceptance Criteria**:
- [ ] Single authentication service for frontend and backend
- [ ] Challenge-response authentication flow
- [ ] JWT token generation with NOSTR pubkey
- [ ] Session management integration
- [ ] Rate limiting support
- [ ] Security event logging
- [ ] 95%+ test coverage

---

### US-304: Consolidate NIP-05 Verification Services
**Priority**: P1 - High
**Size**: 5 points
**Dependencies**: None

**Description**: Unify NIP-05 verification logic into a shared service accessible by both frontend and backend.

**Acceptance Criteria**:
- [ ] HTTP and DNS verification methods
- [ ] Caching of verification results
- [ ] Automatic re-verification scheduling
- [ ] Domain allowlist/blocklist support
- [ ] Verification status webhooks
- [ ] 95%+ test coverage

---

### US-311: Create Unified NOSTR Session Management
**Priority**: P1 - High
**Size**: 3 points
**Dependencies**: US-305

**Description**: Implement centralized session management for NOSTR authenticated users.

**Acceptance Criteria**:
- [ ] Session creation and validation
- [ ] Multi-device session support
- [ ] Session revocation
- [ ] Activity tracking
- [ ] Automatic session cleanup
- [ ] 95%+ test coverage

---

### US-321: Implement NOSTR Rate Limiting
**Priority**: P2 - Medium
**Size**: 3 points
**Dependencies**: US-305

**Description**: Add rate limiting to prevent abuse of NOSTR services.

**Acceptance Criteria**:
- [ ] Per-pubkey rate limits
- [ ] Event type-specific limits
- [ ] Relay-specific throttling
- [ ] Rate limit headers in responses
- [ ] Configurable limits per tier
- [ ] 90%+ test coverage

---

## Stream B: Frontend NOSTR Components (5 stories)

### US-302: Unify Relay Pool Management
**Priority**: P0 - Critical
**Size**: 8 points
**Dependencies**: None

**Description**: Create a centralized relay pool manager that handles all WebSocket connections.

**Acceptance Criteria**:
- [ ] Single `NostrRelayPool` class
- [ ] Automatic reconnection logic
- [ ] Connection state synchronization
- [ ] Relay health monitoring
- [ ] Load balancing across relays
- [ ] Failover support
- [ ] 95%+ test coverage
- [ ] React hook: `useRelayPool()`

**Technical Details**:
```typescript
// packages/shared/src/nostr/core/NostrRelayPool.ts
export class NostrRelayPool {
  connect(relayUrls: string[]): Promise<void>;
  disconnect(): void;
  publish(event: SignedEvent): Promise<PublishResult>;
  subscribe(filters: Filter[]): Subscription;
  getConnectionState(): RelayState[];
  addRelay(url: string): Promise<void>;
  removeRelay(url: string): void;
}
```

---

### US-306: Standardize Browser Extension Integration
**Priority**: P1 - High
**Size**: 5 points
**Dependencies**: US-301

**Description**: Create unified interface for all NOSTR browser extensions.

**Acceptance Criteria**:
- [ ] Support for Alby, nos2x, Flamingo
- [ ] Extension detection and capability checking
- [ ] Fallback to manual key input
- [ ] Permission request handling
- [ ] React hook: `useNostrExtension()`
- [ ] 90%+ test coverage

---

### US-314: Create Unified Profile Management
**Priority**: P1 - High
**Size**: 3 points
**Dependencies**: US-302

**Description**: Consolidate profile fetching and caching logic.

**Acceptance Criteria**:
- [ ] Profile fetching from multiple relays
- [ ] Profile caching with TTL
- [ ] Profile update broadcasting
- [ ] Avatar optimization
- [ ] React hook: `useNostrProfile(pubkey)`
- [ ] 90%+ test coverage

---

### US-317: Implement NOSTR Caching Layer
**Priority**: P2 - Medium
**Size**: 5 points
**Dependencies**: US-302, US-314

**Description**: Add intelligent caching for events and profiles.

**Acceptance Criteria**:
- [ ] IndexedDB storage for events
- [ ] LRU cache with size limits
- [ ] Cache invalidation strategies
- [ ] Offline mode support
- [ ] Cache warming on startup
- [ ] 90%+ test coverage

---

### US-319: Implement Error Handling UI
**Priority**: P2 - Medium
**Size**: 3 points
**Dependencies**: US-302

**Description**: Create user-friendly error handling for NOSTR operations.

**Acceptance Criteria**:
- [ ] Error boundary components
- [ ] Retry mechanisms with UI feedback
- [ ] Connection status indicators
- [ ] Error toast notifications
- [ ] Fallback UI states
- [ ] 85%+ test coverage

---

## Stream C: Shared Types & Utilities (6 stories)

### US-308: Comprehensive NOSTR Types
**Priority**: P0 - Critical
**Size**: 5 points
**Dependencies**: None

**Description**: Expand and consolidate all NOSTR type definitions.

**Acceptance Criteria**:
- [ ] Complete type definitions for all NIPs
- [ ] Zod schemas for runtime validation
- [ ] Type guards and predicates
- [ ] Migration from old type names
- [ ] Auto-generated documentation
- [ ] 100% type coverage

---

### US-310: NIP-19 Encoding Utilities
**Priority**: P1 - High
**Size**: 3 points
**Dependencies**: US-308

**Description**: Implement complete NIP-19 bech32 encoding/decoding.

**Acceptance Criteria**:
- [ ] npub/nsec encoding/decoding
- [ ] note/nevent encoding/decoding
- [ ] nprofile/nrelay encoding/decoding
- [ ] Error handling for invalid inputs
- [ ] 95%+ test coverage

---

### US-312: Consolidate Cryptography Operations
**Priority**: P0 - Critical
**Size**: 5 points
**Dependencies**: US-308

**Description**: Unify all NOSTR cryptographic operations.

**Acceptance Criteria**:
- [ ] Event signing and verification
- [ ] Key generation with entropy validation
- [ ] Schnorr signatures support
- [ ] Performance optimizations
- [ ] Security audit pass
- [ ] 100% test coverage

---

### US-313: NIP-04 Encrypted DM Support
**Priority**: P1 - High
**Size**: 3 points
**Dependencies**: US-312

**Description**: Implement complete NIP-04 encrypted direct messaging.

**Acceptance Criteria**:
- [ ] Message encryption/decryption
- [ ] Shared secret derivation
- [ ] Legacy format support
- [ ] Performance optimization for bulk operations
- [ ] 95%+ test coverage

---

### US-315: NIP-26 Delegated Events
**Priority**: P3 - Low
**Size**: 5 points
**Dependencies**: US-312

**Description**: Implement delegated event signing per NIP-26.

**Acceptance Criteria**:
- [ ] Delegation token creation
- [ ] Delegated signature verification
- [ ] Time-bound delegations
- [ ] Revocation support
- [ ] 90%+ test coverage

---

### US-309: Remove Hardcoded Relay URLs
**Priority**: P1 - High
**Size**: 2 points
**Dependencies**: None

**Description**: Centralize all relay configurations and remove hardcoded URLs.

**Acceptance Criteria**:
- [ ] All hardcoded URLs removed
- [ ] Central relay configuration
- [ ] Environment-based relay lists
- [ ] Default relay fallbacks
- [ ] Configuration validation
- [ ] 100% removal verified

---

## Stream D: Testing & Documentation (4 stories)

### US-318: Comprehensive Integration Tests
**Priority**: P1 - High
**Size**: 8 points
**Dependencies**: US-301, US-302, US-305

**Description**: Create full integration test suite for NOSTR services.

**Acceptance Criteria**:
- [ ] Key management flow tests
- [ ] Relay connection tests
- [ ] Event publishing tests
- [ ] Subscription tests
- [ ] Authentication flow tests
- [ ] Error scenario tests
- [ ] 95%+ code coverage

---

### US-323: NOSTR Architecture Diagrams
**Priority**: P1 - High
**Size**: 3 points
**Dependencies**: All core services

**Description**: Create comprehensive Mermaid diagrams for NOSTR architecture.

**Required Diagrams**:
- [ ] NOSTR Service Architecture (C4)
- [ ] Event Flow Sequence Diagram
- [ ] Relay Connection State Machine
- [ ] Authentication Flow Diagram
- [ ] Key Management Lifecycle
- [ ] Data Flow Diagram

---

### US-324: Developer Documentation
**Priority**: P1 - High
**Size**: 5 points
**Dependencies**: All implementation stories

**Description**: Create complete NOSTR developer guide.

**Deliverables**:
- [ ] API reference documentation
- [ ] Integration guide
- [ ] Migration guide from old code
- [ ] Best practices document
- [ ] Troubleshooting guide
- [ ] Code examples

---

### US-326: E2E Test Suite
**Priority**: P2 - Medium
**Size**: 5 points
**Dependencies**: US-318

**Description**: Playwright E2E tests for all NOSTR user flows.

**Test Scenarios**:
- [ ] User onboarding with NOSTR
- [ ] Publishing content
- [ ] Profile management
- [ ] Direct messaging
- [ ] Relay switching
- [ ] Error recovery
- [ ] 90%+ flow coverage

---

## Stream E: Monitoring & Migration (4 stories)

### US-316: NOSTR Monitoring Service
**Priority**: P2 - Medium
**Size**: 5 points
**Dependencies**: US-302

**Description**: Implement comprehensive monitoring for NOSTR operations.

**Metrics to Track**:
- [ ] Relay connection health
- [ ] Event publishing success rate
- [ ] Subscription performance
- [ ] Key operation metrics
- [ ] Error rates by type
- [ ] Prometheus metrics export
- [ ] Grafana dashboard

---

### US-320: WebSocket Connection Manager
**Priority**: P1 - High
**Size**: 5 points
**Dependencies**: US-302

**Description**: Advanced WebSocket management with reconnection strategies.

**Features**:
- [ ] Exponential backoff
- [ ] Connection pooling
- [ ] Message queuing
- [ ] Heartbeat/ping-pong
- [ ] Connection multiplexing
- [ ] 95%+ test coverage

---

### US-322: Backup and Recovery System
**Priority**: P2 - Medium
**Size**: 5 points
**Dependencies**: US-301

**Description**: Implement key backup and recovery mechanisms.

**Features**:
- [ ] Encrypted cloud backup
- [ ] Mnemonic phrase generation
- [ ] Social recovery (M of N)
- [ ] Hardware wallet backup
- [ ] Recovery verification
- [ ] 90%+ test coverage

---

### US-325: Migration Scripts
**Priority**: P1 - High
**Size**: 3 points
**Dependencies**: All implementation complete

**Description**: Scripts to migrate from old NOSTR implementations.

**Deliverables**:
- [ ] Service migration script
- [ ] Type renaming codemod
- [ ] Import path updates
- [ ] Test migration
- [ ] Rollback capability
- [ ] Migration validation

---

## Story Point Summary

**Stream A (Backend)**: 24 points
**Stream B (Frontend)**: 24 points
**Stream C (Shared)**: 21 points
**Stream D (Testing/Docs)**: 21 points
**Stream E (Monitoring)**: 18 points

**Total**: 108 story points

## Execution Order

### Phase 1 (Critical Path)
1. US-308 (Types) → US-301 (Key Management) → US-312 (Crypto)
2. US-302 (Relay Pool) in parallel

### Phase 2 (Core Services)
3. US-305 (Auth) → US-311 (Sessions)
4. US-306 (Extensions) in parallel
5. US-313 (NIP-04) in parallel

### Phase 3 (Enhancement)
6. US-304, US-314, US-316, US-317 in parallel

### Phase 4 (Testing)
7. US-318 → US-326
8. US-323, US-324 in parallel

### Phase 5 (Cleanup)
9. US-325 (Migration)
10. Remaining stories in parallel

## Success Metrics

- **Code Reduction**: 60%+ fewer lines of NOSTR code
- **Test Coverage**: 95%+ for core services, 90%+ overall
- **Performance**: <100ms event operations, <50ms crypto
- **Reliability**: 99.9% relay uptime
- **Documentation**: 100% API coverage