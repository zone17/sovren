# Epic 003: NOSTR Service Consolidation - Story Breakdown

## Overview

This document contains the complete decomposition of Epic 003 into 26 granular 1-point user stories. Each story represents 2-4 hours of work and can be developed independently or in parallel where dependencies allow.

## Story Index

| ID     | Story Title                                    | Phase | Stream | Points |
| ------ | ---------------------------------------------- | ----- | ------ | ------ |
| NS-001 | Create Core NOSTR Service Structure            | 1     | A      | 1      |
| NS-002 | Implement Event Creation Logic                 | 1     | A      | 1      |
| NS-003 | Add Event Validation and Verification          | 1     | A      | 1      |
| NS-004 | Build Relay Connection Pool                    | 1     | A      | 1      |
| NS-005 | Implement Relay Auto-Reconnection              | 1     | A      | 1      |
| NS-006 | Create Subscription Management System          | 1     | A      | 1      |
| NS-007 | Add Cryptographic Operations                   | 1     | A      | 1      |
| NS-008 | Implement NIP-07 Browser Extension Support     | 1     | A      | 1      |
| NS-009 | Define Adapter Interfaces                      | 2     | B/C    | 1      |
| NS-010 | Create Browser Adapter Base                    | 2     | B      | 1      |
| NS-011 | Implement React Hooks for NOSTR                | 2     | B      | 1      |
| NS-012 | Add Browser Storage Integration                | 2     | B      | 1      |
| NS-013 | Create Node.js Adapter Base                    | 2     | C      | 1      |
| NS-014 | Implement Server-Side Event Emitter            | 2     | C      | 1      |
| NS-015 | Add Feature Flag for Frontend Migration        | 3     | D      | 1      |
| NS-016 | Migrate Frontend Event Publishing              | 3     | D      | 1      |
| NS-017 | Update Frontend Subscription Handling          | 3     | D      | 1      |
| NS-018 | Integrate Frontend Components with New Service | 3     | D      | 1      |
| NS-019 | Add Feature Flag for Backend Migration         | 4     | E      | 1      |
| NS-020 | Migrate Backend Event Publishing               | 4     | E      | 1      |
| NS-021 | Update Backend API Endpoints                   | 4     | E      | 1      |
| NS-022 | Migrate Backend Webhook Integration            | 4     | E      | 1      |
| NS-023 | Remove Old Frontend Implementation             | 5     | D      | 1      |
| NS-024 | Remove Old Backend Implementation              | 5     | E      | 1      |
| NS-025 | Create Architecture Documentation              | 5     | A      | 1      |
| NS-026 | Performance Validation and Benchmarking        | 5     | A      | 1      |

---

## Phase 1: Core Service Extraction (Stories NS-001 to NS-008)

### NS-001: Create Core NOSTR Service Structure

**As a** developer
**I want** to establish the foundational structure for the shared NOSTR service
**So that** all core functionality has a well-organized home

#### Acceptance Criteria

- [ ] **Given** the shared package exists
      **When** I create the NOSTR service structure
      **Then** the following directories and files should exist: - `packages/shared/src/services/nostr/core/` - `packages/shared/src/services/nostr/adapters/` - `packages/shared/src/services/nostr/types/` - `packages/shared/src/services/nostr/index.ts`

- [ ] **Given** the core service structure is created
      **When** I add base interfaces
      **Then** TypeScript interfaces for INostrService, IRelayManager, IEventManager should be defined

- [ ] **Given** the type definitions exist
      **When** I export them from index.ts
      **Then** other packages can import types from '@sovren/shared/nostr'

#### Technical Implementation

**Files to Create**:

```typescript
// packages/shared/src/services/nostr/types/base.ts
export interface INostrService {
  events: IEventManager;
  relays: IRelayManager;
  subscriptions: ISubscriptionManager;
  crypto: ICryptoManager;
}

// packages/shared/src/services/nostr/core/index.ts
export class NostrService implements INostrService {
  constructor(config: NostrConfig) {}
}

// packages/shared/src/services/nostr/index.ts
export * from './core';
export * from './types';
export * from './adapters';
```

#### Dependencies

- **Blocked by**: None (can start immediately)
- **Blocks**: NS-002, NS-003, NS-004, NS-005, NS-006, NS-007

#### Testing Requirements

- Unit tests for service initialization
- Type checking for all interfaces
- Export validation tests

---

### NS-002: Implement Event Creation Logic

**As a** developer
**I want** to create NOSTR events with proper formatting
**So that** events comply with NIP-01 specifications

#### Acceptance Criteria

- [ ] **Given** event parameters (kind, content, tags)
      **When** I call createEvent()
      **Then** a properly formatted unsigned event is returned with: - Correct timestamp - Proper tag structure - Valid kind number

- [ ] **Given** different event kinds (0, 1, 3, 4, 30023)
      **When** I create events of each kind
      **Then** each event follows its NIP-specific format

- [ ] **Given** invalid event parameters
      **When** I attempt to create an event
      **Then** appropriate validation errors are thrown

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/events.ts`

```typescript
export class EventManager implements IEventManager {
  createEvent(params: EventParams): UnsignedEvent {
    // Validate kind
    if (!VALID_KINDS.includes(params.kind)) {
      throw new NostrError('Invalid event kind');
    }

    return {
      kind: params.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: params.tags || [],
      content: params.content,
      pubkey: '', // Will be set during signing
    };
  }

  serializeEvent(event: Event): string {
    return JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
  }
}
```

#### Dependencies

- **Blocked by**: NS-001
- **Blocks**: NS-003, NS-007

#### Testing Requirements

- Unit tests for each event kind
- Validation error tests
- Serialization tests
- NIP-01 compliance tests

---

### NS-003: Add Event Validation and Verification

**As a** developer
**I want** to validate and verify NOSTR events
**So that** only valid events are processed

#### Acceptance Criteria

- [ ] **Given** a signed event
      **When** I call validateEvent()
      **Then** the event ID hash is verified against content

- [ ] **Given** an event with signature
      **When** I call verifySignature()
      **Then** the signature is cryptographically verified

- [ ] **Given** an invalid or tampered event
      **When** validation is performed
      **Then** specific validation errors are returned

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/events.ts`

```typescript
export class EventManager {
  // ... existing code ...

  validateEvent(event: Event): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!event.id) errors.push('Missing event ID');
    if (!event.pubkey) errors.push('Missing public key');
    if (!event.sig) errors.push('Missing signature');

    // Verify ID hash
    const calculatedId = this.calculateEventId(event);
    if (event.id !== calculatedId) {
      errors.push('Event ID mismatch');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private calculateEventId(event: Event): string {
    const serialized = this.serializeEvent(event);
    return sha256(serialized);
  }
}
```

#### Dependencies

- **Blocked by**: NS-002
- **Blocks**: NS-016, NS-020

#### Testing Requirements

- Valid event verification tests
- Invalid event detection tests
- Tampered event detection tests
- Performance tests for batch validation

---

### NS-004: Build Relay Connection Pool

**As a** developer
**I want** to manage multiple relay connections efficiently
**So that** events can be published to multiple relays simultaneously

#### Acceptance Criteria

- [ ] **Given** a list of relay URLs
      **When** I call connectToRelays()
      **Then** WebSocket connections are established to all relays

- [ ] **Given** connected relays
      **When** I call publishToRelays()
      **Then** the event is sent to all connected relays

- [ ] **Given** relay connection limits
      **When** managing connections
      **Then** connection pool respects max connection limits

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/relays.ts`

```typescript
export class RelayManager implements IRelayManager {
  private relays: Map<string, RelayConnection> = new Map();
  private maxConnections = 10;

  async connectToRelay(url: string): Promise<RelayConnection> {
    if (this.relays.size >= this.maxConnections) {
      throw new NostrError('Max relay connections reached');
    }

    const connection = new RelayConnection(url);
    await connection.connect();
    this.relays.set(url, connection);

    return connection;
  }

  async publishToRelays(event: Event, relayUrls?: string[]): Promise<PublishResult[]> {
    const targetRelays = relayUrls
      ? this.getRelaysByUrls(relayUrls)
      : Array.from(this.relays.values());

    const results = await Promise.allSettled(targetRelays.map((relay) => relay.publish(event)));

    return this.processPublishResults(results);
  }
}
```

#### Dependencies

- **Blocked by**: NS-001
- **Blocks**: NS-005, NS-016, NS-020

#### Testing Requirements

- Connection establishment tests
- Multi-relay publishing tests
- Connection limit tests
- Error handling tests

---

### NS-005: Implement Relay Auto-Reconnection

**As a** developer
**I want** automatic reconnection to relays with exponential backoff
**So that** temporary network issues don't break NOSTR functionality

#### Acceptance Criteria

- [ ] **Given** a relay connection drops
      **When** disconnection is detected
      **Then** automatic reconnection is attempted with exponential backoff

- [ ] **Given** multiple reconnection failures
      **When** max retries is reached
      **Then** the relay is marked as unavailable

- [ ] **Given** a successful reconnection
      **When** connection is restored
      **Then** pending subscriptions are re-established

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/relays.ts`

```typescript
export class RelayConnection {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;

  private async handleDisconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.markAsUnavailable();
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    await this.wait(delay);

    try {
      await this.connect();
      this.reconnectAttempts = 0;
      await this.restoreSubscriptions();
    } catch (error) {
      await this.handleDisconnection();
    }
  }

  private async restoreSubscriptions(): Promise<void> {
    for (const [id, filters] of this.activeSubscriptions) {
      await this.subscribe(id, filters);
    }
  }
}
```

#### Dependencies

- **Blocked by**: NS-004
- **Blocks**: NS-018, NS-022

#### Testing Requirements

- Disconnection detection tests
- Exponential backoff timing tests
- Subscription restoration tests
- Max retry behavior tests

---

### NS-006: Create Subscription Management System

**As a** developer
**I want** to manage NOSTR event subscriptions
**So that** I can receive real-time events from relays

#### Acceptance Criteria

- [ ] **Given** subscription filters
      **When** I call subscribe()
      **Then** a subscription is created with unique ID

- [ ] **Given** an active subscription
      **When** events match the filters
      **Then** events are delivered to the subscription handler

- [ ] **Given** multiple subscriptions
      **When** unsubscribe() is called
      **Then** only the specified subscription is removed

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/subscriptions.ts`

```typescript
export class SubscriptionManager implements ISubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();

  subscribe(filters: Filter[], onEvent: EventHandler, relays?: string[]): string {
    const subId = this.generateSubscriptionId();

    const subscription = new Subscription({
      id: subId,
      filters,
      onEvent,
      relays: relays || this.getDefaultRelays(),
    });

    this.subscriptions.set(subId, subscription);
    subscription.start();

    return subId;
  }

  unsubscribe(subId: string): void {
    const subscription = this.subscriptions.get(subId);
    if (subscription) {
      subscription.stop();
      this.subscriptions.delete(subId);
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### Dependencies

- **Blocked by**: NS-001
- **Blocks**: NS-011, NS-017, NS-021

#### Testing Requirements

- Subscription creation tests
- Filter matching tests
- Event delivery tests
- Cleanup tests

---

### NS-007: Add Cryptographic Operations

**As a** developer
**I want** cryptographic functions for NOSTR
**So that** I can sign events and manage keys

#### Acceptance Criteria

- [ ] **Given** a private key and unsigned event
      **When** I call signEvent()
      **Then** the event is signed with schnorr signature

- [ ] **Given** no private key
      **When** I call generateKeyPair()
      **Then** a valid secp256k1 key pair is generated

- [ ] **Given** encrypted content (NIP-04)
      **When** I call decrypt()
      **Then** the content is decrypted correctly

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/crypto.ts`

```typescript
import { schnorr } from '@noble/secp256k1';
import * as secp from '@noble/secp256k1';

export class CryptoManager implements ICryptoManager {
  async signEvent(event: UnsignedEvent, privateKey: string): Promise<Event> {
    const eventWithPubkey = {
      ...event,
      pubkey: this.getPublicKey(privateKey),
    };

    const id = await this.calculateEventId(eventWithPubkey);
    const sig = await schnorr.sign(id, privateKey);

    return {
      ...eventWithPubkey,
      id,
      sig: this.bytesToHex(sig),
    };
  }

  generateKeyPair(): KeyPair {
    const privateKey = secp.utils.randomPrivateKey();
    const publicKey = secp.getPublicKey(privateKey);

    return {
      privateKey: this.bytesToHex(privateKey),
      publicKey: this.bytesToHex(publicKey),
    };
  }

  async encryptDM(
    content: string,
    recipientPubkey: string,
    senderPrivkey: string
  ): Promise<string> {
    // NIP-04 encryption implementation
    const sharedSecret = secp.getSharedSecret(senderPrivkey, recipientPubkey);
    // ... encryption logic
    return encryptedContent;
  }
}
```

#### Dependencies

- **Blocked by**: NS-002
- **Blocks**: NS-008, NS-016, NS-020

#### Testing Requirements

- Signature generation tests
- Signature verification tests
- Key generation tests
- NIP-04 encryption/decryption tests

---

### NS-008: Implement NIP-07 Browser Extension Support

**As a** developer
**I want** to integrate with browser NOSTR extensions
**So that** users can sign events without exposing private keys

#### Acceptance Criteria

- [ ] **Given** a browser with NOSTR extension
      **When** I call detectExtension()
      **Then** the extension availability is detected

- [ ] **Given** an unsigned event and extension present
      **When** I call signEventWithExtension()
      **Then** the extension prompts user and returns signed event

- [ ] **Given** no extension available
      **When** extension methods are called
      **Then** appropriate fallback behavior is triggered

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/core/nip07.ts`

```typescript
export class NIP07Manager {
  private extension: any = null;

  async detectExtension(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Check for window.nostr
    if ('nostr' in window) {
      this.extension = (window as any).nostr;
      return true;
    }

    // Wait for extension to load
    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        if ('nostr' in window) {
          this.extension = (window as any).nostr;
          clearInterval(interval);
          resolve(true);
        } else if (++attempts > 10) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }

  async signEventWithExtension(event: UnsignedEvent): Promise<Event> {
    if (!this.extension) {
      throw new NostrError('No NOSTR extension detected');
    }

    return await this.extension.signEvent(event);
  }

  async getPublicKeyFromExtension(): Promise<string> {
    if (!this.extension) {
      throw new NostrError('No NOSTR extension detected');
    }

    return await this.extension.getPublicKey();
  }
}
```

#### Dependencies

- **Blocked by**: NS-007
- **Blocks**: NS-010, NS-011

#### Testing Requirements

- Extension detection tests
- Signing flow tests
- Fallback behavior tests
- Error handling tests

---

## Phase 2: Adapter Implementation (Stories NS-009 to NS-014)

### NS-009: Define Adapter Interfaces

**As a** developer
**I want** clear adapter interfaces
**So that** platform-specific implementations follow consistent patterns

#### Acceptance Criteria

- [ ] **Given** the need for platform adapters
      **When** I define interfaces
      **Then** INostrAdapter interface covers all platform-specific needs

- [ ] **Given** different platforms (browser, node)
      **When** implementing adapters
      **Then** they all implement the same INostrAdapter interface

- [ ] **Given** adapter configuration needs
      **When** defining types
      **Then** platform-specific config types are defined

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/adapters/types.ts`

```typescript
export interface INostrAdapter {
  // Core functionality
  events: IEventManager;
  relays: IRelayManager;
  subscriptions: ISubscriptionManager;
  crypto: ICryptoManager;

  // Platform-specific
  initialize(config: AdapterConfig): Promise<void>;
  cleanup(): Promise<void>;

  // Storage (browser: localStorage, node: file/db)
  storage?: IStorageAdapter;

  // Extension support (browser only)
  extension?: INIP07Manager;
}

export interface AdapterConfig {
  platform: 'browser' | 'node';
  relays: string[];
  options?: PlatformOptions;
}

export interface IStorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
}
```

#### Dependencies

- **Blocked by**: NS-001
- **Blocks**: NS-010, NS-013

#### Testing Requirements

- Interface completeness tests
- Type checking tests
- Mock implementation tests

---

### NS-010: Create Browser Adapter Base

**As a** developer
**I want** a browser-specific NOSTR adapter
**So that** frontend can use NOSTR with browser-specific features

#### Acceptance Criteria

- [ ] **Given** browser environment
      **When** BrowserAdapter is initialized
      **Then** it uses localStorage for persistence

- [ ] **Given** WebSocket support in browser
      **When** connecting to relays
      **Then** browser WebSocket API is used

- [ ] **Given** NIP-07 extension availability
      **When** adapter initializes
      **Then** extension support is automatically detected

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/adapters/browser.ts`

```typescript
export class BrowserNostrAdapter implements INostrAdapter {
  private service: NostrService;
  private storageAdapter: BrowserStorageAdapter;
  private nip07Manager: NIP07Manager;

  constructor() {
    this.storageAdapter = new BrowserStorageAdapter();
    this.nip07Manager = new NIP07Manager();
  }

  async initialize(config: AdapterConfig): Promise<void> {
    // Initialize core service
    this.service = new NostrService({
      ...config,
      storage: this.storageAdapter,
      websocket: window.WebSocket,
    });

    // Detect browser extension
    const hasExtension = await this.nip07Manager.detectExtension();
    if (hasExtension) {
      this.service.setSigningStrategy(this.nip07Manager);
    }

    // Load saved relays from localStorage
    const savedRelays = await this.storageAdapter.get('nostr_relays');
    if (savedRelays) {
      await this.service.relays.connectToRelays(savedRelays);
    }
  }

  // Expose core functionality
  get events() {
    return this.service.events;
  }
  get relays() {
    return this.service.relays;
  }
  get subscriptions() {
    return this.service.subscriptions;
  }
  get crypto() {
    return this.service.crypto;
  }
}
```

#### Dependencies

- **Blocked by**: NS-008, NS-009
- **Blocks**: NS-011, NS-012

#### Testing Requirements

- Browser environment detection tests
- localStorage integration tests
- WebSocket usage tests
- Extension integration tests

---

### NS-011: Implement React Hooks for NOSTR

**As a** developer
**I want** React hooks for NOSTR functionality
**So that** React components can easily use NOSTR

#### Acceptance Criteria

- [ ] **Given** React component
      **When** using useNostrEvents hook
      **Then** events are fetched and state is managed

- [ ] **Given** useNostrPublish hook
      **When** publishing events
      **Then** loading and error states are handled

- [ ] **Given** subscription filters change
      **When** using useNostrSubscription
      **Then** subscription is updated automatically

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/adapters/browser/hooks.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

export function useNostrEvents(filters: Filter[]) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const adapter = getBrowserAdapter();
    let subscriptionId: string;

    const subscribe = async () => {
      try {
        setLoading(true);
        subscriptionId = adapter.subscriptions.subscribe(filters, (event) =>
          setEvents((prev) => [...prev, event])
        );
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    subscribe();

    return () => {
      if (subscriptionId) {
        adapter.subscriptions.unsubscribe(subscriptionId);
      }
    };
  }, [JSON.stringify(filters)]);

  return { events, loading, error };
}

export function useNostrPublish() {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const publish = useCallback(async (eventParams: EventParams) => {
    const adapter = getBrowserAdapter();
    setPublishing(true);
    setError(null);

    try {
      const event = await adapter.events.createEvent(eventParams);
      const signedEvent = await adapter.crypto.signEvent(event);
      await adapter.relays.publishToRelays(signedEvent);
      return signedEvent;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setPublishing(false);
    }
  }, []);

  return { publish, publishing, error };
}
```

#### Dependencies

- **Blocked by**: NS-010
- **Blocks**: NS-016, NS-017, NS-018

#### Testing Requirements

- Hook lifecycle tests
- State management tests
- Re-render optimization tests
- Error handling tests

---

### NS-012: Add Browser Storage Integration

**As a** developer
**I want** persistent storage for NOSTR data in browser
**So that** user preferences and relay lists persist

#### Acceptance Criteria

- [ ] **Given** relay list changes
      **When** relays are added/removed
      **Then** changes are persisted to localStorage

- [ ] **Given** user preferences
      **When** settings are changed
      **Then** they persist across sessions

- [ ] **Given** storage quota limits
      **When** storage is full
      **Then** old data is pruned intelligently

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/adapters/browser/storage.ts`

```typescript
export class BrowserStorageAdapter implements IStorageAdapter {
  private prefix = 'nostr_';
  private maxSize = 5 * 1024 * 1024; // 5MB limit

  async get(key: string): Promise<any> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage read error:', error);
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const serialized = JSON.stringify(value);

    // Check storage size
    if (serialized.length > this.maxSize) {
      throw new NostrError('Storage item too large');
    }

    // Check available space
    const available = this.getAvailableSpace();
    if (serialized.length > available) {
      await this.pruneOldData(serialized.length);
    }

    localStorage.setItem(this.prefix + key, serialized);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  private async pruneOldData(requiredSpace: number): Promise<void> {
    const items = this.getAllNostrItems();
    items.sort((a, b) => a.timestamp - b.timestamp);

    let freed = 0;
    for (const item of items) {
      if (freed >= requiredSpace) break;
      freed += item.size;
      await this.remove(item.key);
    }
  }
}
```

#### Dependencies

- **Blocked by**: NS-010
- **Blocks**: NS-015, NS-016

#### Testing Requirements

- localStorage read/write tests
- Storage quota handling tests
- Data pruning tests
- Error recovery tests

---

### NS-013: Create Node.js Adapter Base

**As a** developer
**I want** a Node.js-specific NOSTR adapter
**So that** backend can use NOSTR with server-specific features

#### Acceptance Criteria

- [ ] **Given** Node.js environment
      **When** NodeAdapter is initialized
      **Then** it uses file system or database for persistence

- [ ] **Given** WebSocket needs in Node
      **When** connecting to relays
      **Then** ws library is used

- [ ] **Given** multiple worker processes
      **When** adapter runs
      **Then** it handles concurrent access safely

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/adapters/node.ts`

```typescript
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class NodeNostrAdapter implements INostrAdapter {
  private service: NostrService;
  private storageAdapter: NodeStorageAdapter;
  private eventEmitter: EventEmitter;

  constructor(storageConfig?: NodeStorageConfig) {
    this.storageAdapter = new NodeStorageAdapter(storageConfig);
    this.eventEmitter = new EventEmitter();
  }

  async initialize(config: AdapterConfig): Promise<void> {
    // Initialize core service with Node-specific implementations
    this.service = new NostrService({
      ...config,
      storage: this.storageAdapter,
      websocket: WebSocket as any,
    });

    // Load saved configuration
    const savedConfig = await this.storageAdapter.get('config');
    if (savedConfig?.relays) {
      await this.service.relays.connectToRelays(savedConfig.relays);
    }

    // Setup process cleanup handlers
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async cleanup(): Promise<void> {
    await this.service.relays.disconnectAll();
    await this.storageAdapter.flush();
  }

  // Event emitter for server-side subscriptions
  subscribeToEvents(filters: Filter[]): EventEmitter {
    const subscription = this.service.subscriptions.subscribe(filters, (event) =>
      this.eventEmitter.emit('event', event)
    );

    this.eventEmitter.once('removeAllListeners', () => {
      this.service.subscriptions.unsubscribe(subscription);
    });

    return this.eventEmitter;
  }
}
```

#### Dependencies

- **Blocked by**: NS-009
- **Blocks**: NS-014, NS-019, NS-020

#### Testing Requirements

- Node environment detection tests
- File system storage tests
- WebSocket (ws) integration tests
- Process cleanup tests

---

### NS-014: Implement Server-Side Event Emitter

**As a** developer
**I want** event emitter pattern for server-side NOSTR
**So that** backend services can handle events asynchronously

#### Acceptance Criteria

- [ ] **Given** NOSTR events received
      **When** subscribed via event emitter
      **Then** events are emitted to all listeners

- [ ] **Given** multiple subscribers
      **When** events arrive
      **Then** all subscribers receive events

- [ ] **Given** subscriber disconnection
      **When** listener is removed
      **Then** subscription is cleaned up

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/adapters/node/emitter.ts`

```typescript
export class NostrEventEmitter extends EventEmitter {
  private subscriptions: Map<string, string> = new Map();
  private adapter: NodeNostrAdapter;

  constructor(adapter: NodeNostrAdapter) {
    super();
    this.adapter = adapter;
    this.setMaxListeners(100);
  }

  subscribeToFilters(eventType: string, filters: Filter[], handler: (event: Event) => void): void {
    // Create subscription if not exists
    if (!this.subscriptions.has(eventType)) {
      const subId = this.adapter.subscriptions.subscribe(filters, (event) =>
        this.emit(eventType, event)
      );
      this.subscriptions.set(eventType, subId);
    }

    // Add handler
    this.on(eventType, handler);
  }

  unsubscribeFromFilters(eventType: string, handler?: Function): void {
    if (handler) {
      this.off(eventType, handler);
    } else {
      this.removeAllListeners(eventType);
    }

    // Clean up subscription if no listeners
    if (this.listenerCount(eventType) === 0) {
      const subId = this.subscriptions.get(eventType);
      if (subId) {
        this.adapter.subscriptions.unsubscribe(subId);
        this.subscriptions.delete(eventType);
      }
    }
  }

  async publishEvent(eventParams: EventParams): Promise<PublishResult> {
    const event = await this.adapter.events.createAndSign(eventParams);
    const results = await this.adapter.relays.publishToRelays(event);

    // Emit publication result
    this.emit('published', { event, results });

    return results;
  }
}
```

#### Dependencies

- **Blocked by**: NS-013
- **Blocks**: NS-020, NS-021, NS-022

#### Testing Requirements

- Event emission tests
- Multiple listener tests
- Cleanup tests
- Memory leak tests

---

## Phase 3: Frontend Migration (Stories NS-015 to NS-018)

### NS-015: Add Feature Flag for Frontend Migration

**As a** developer
**I want** a feature flag to toggle between old and new NOSTR implementation
**So that** we can safely migrate and rollback if needed

#### Acceptance Criteria

- [ ] **Given** feature flag configuration
      **When** flag is enabled
      **Then** new shared NOSTR service is used

- [ ] **Given** feature flag disabled
      **When** NOSTR operations occur
      **Then** old implementation is used

- [ ] **Given** runtime flag toggle
      **When** flag value changes
      **Then** implementation switches without restart

#### Technical Implementation

**File**: `packages/frontend/src/services/nostr/migration.ts`

```typescript
export class NostrServiceMigration {
  private useNewImplementation: boolean;
  private oldService: OldNostrService;
  private newAdapter: BrowserNostrAdapter;

  constructor() {
    this.useNewImplementation = getFeatureFlag('use_new_nostr_service');
    this.oldService = new OldNostrService();
    this.newAdapter = new BrowserNostrAdapter();

    // Listen for feature flag changes
    onFeatureFlagChange('use_new_nostr_service', (value) => {
      this.useNewImplementation = value;
      this.handleMigrationToggle();
    });
  }

  async initialize(): Promise<void> {
    if (this.useNewImplementation) {
      await this.newAdapter.initialize({
        platform: 'browser',
        relays: getDefaultRelays(),
      });
    } else {
      await this.oldService.initialize();
    }
  }

  get events() {
    return this.useNewImplementation ? this.newAdapter.events : this.oldService.events;
  }

  private handleMigrationToggle(): void {
    // Gracefully switch implementations
    if (this.useNewImplementation) {
      this.migrateActiveSubscriptions();
    }
  }
}
```

#### Dependencies

- **Blocked by**: NS-012
- **Blocks**: NS-016, NS-017, NS-018

#### Testing Requirements

- Feature flag toggle tests
- Implementation switching tests
- State preservation tests
- Rollback tests

---

### NS-016: Migrate Frontend Event Publishing

**As a** developer
**I want** to migrate frontend event publishing to the new service
**So that** all event creation uses the shared implementation

#### Acceptance Criteria

- [ ] **Given** existing event publishing code
      **When** migration is complete
      **Then** all components use new shared service

- [ ] **Given** different event types (posts, profiles, etc.)
      **When** published via new service
      **Then** events are correctly formatted and signed

- [ ] **Given** publishing errors
      **When** using new service
      **Then** errors are handled consistently

#### Technical Implementation

**File**: `packages/frontend/src/components/PostComposer.tsx`

```typescript
// Before migration:
// import { publishEvent } from '../services/nostr/events';

// After migration:
import { useNostrPublish } from '@sovren/shared/nostr/adapters/browser/hooks';

export function PostComposer() {
  const { publish, publishing, error } = useNostrPublish();

  const handleSubmit = async (content: string) => {
    try {
      const event = await publish({
        kind: 1, // Text note
        content,
        tags: []
      });

      console.log('Published event:', event.id);
      // Handle success
    } catch (err) {
      console.error('Publishing failed:', err);
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* UI components */}
      {publishing && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
    </form>
  );
}
```

#### Dependencies

- **Blocked by**: NS-015
- **Blocks**: NS-023

#### Testing Requirements

- Component integration tests
- Event publishing tests
- Error handling tests
- UI state management tests

---

### NS-017: Update Frontend Subscription Handling

**As a** developer
**I want** to migrate frontend subscriptions to the new service
**So that** real-time event streaming uses the shared implementation

#### Acceptance Criteria

- [ ] **Given** existing subscription code
      **When** migrated to new service
      **Then** all event streams work correctly

- [ ] **Given** filter changes
      **When** subscription updates
      **Then** new events match updated filters

- [ ] **Given** component unmounting
      **When** cleanup occurs
      **Then** subscriptions are properly closed

#### Technical Implementation

**File**: `packages/frontend/src/components/Feed.tsx`

```typescript
import { useNostrSubscription } from '@sovren/shared/nostr/adapters/browser/hooks';

export function Feed({ pubkey }: { pubkey?: string }) {
  const filters = useMemo(() => {
    const baseFilter: Filter = {
      kinds: [1], // Text notes
      limit: 50
    };

    if (pubkey) {
      baseFilter.authors = [pubkey];
    }

    return [baseFilter];
  }, [pubkey]);

  const { events, loading, error } = useNostrSubscription(filters);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="feed">
      {events.map(event => (
        <FeedItem key={event.id} event={event} />
      ))}
    </div>
  );
}
```

#### Dependencies

- **Blocked by**: NS-015
- **Blocks**: NS-023

#### Testing Requirements

- Subscription lifecycle tests
- Filter update tests
- Event delivery tests
- Component cleanup tests

---

### NS-018: Integrate Frontend Components with New Service

**As a** developer
**I want** all frontend components using the new NOSTR service
**So that** the migration is complete for the frontend

#### Acceptance Criteria

- [ ] **Given** all NOSTR-using components
      **When** migration is complete
      **Then** no component imports old service

- [ ] **Given** user interactions
      **When** using migrated components
      **Then** all NOSTR functionality works

- [ ] **Given** performance requirements
      **When** using new service
      **Then** performance is equal or better

#### Technical Implementation

**File**: `packages/frontend/src/App.tsx`

```typescript
import { NostrProvider } from '@sovren/shared/nostr/adapters/browser/provider';

export function App() {
  return (
    <NostrProvider
      config={{
        relays: [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.nostr.band'
        ],
        options: {
          autoConnect: true,
          enableNIP07: true
        }
      }}
    >
      <Router>
        {/* Application routes */}
      </Router>
    </NostrProvider>
  );
}

// Update all components to use context
export function SomeComponent() {
  const nostr = useNostr();

  // Use nostr.events, nostr.relays, etc.
}
```

#### Dependencies

- **Blocked by**: NS-016, NS-017
- **Blocks**: NS-023

#### Testing Requirements

- Full app integration tests
- E2E tests for all NOSTR features
- Performance benchmarks
- Migration validation tests

---

## Phase 4: Backend Migration (Stories NS-019 to NS-022)

### NS-019: Add Feature Flag for Backend Migration

**As a** developer
**I want** a feature flag for backend NOSTR migration
**So that** we can safely switch implementations in production

#### Acceptance Criteria

- [ ] **Given** backend feature flag
      **When** enabled
      **Then** new shared NOSTR service is used

- [ ] **Given** flag disabled
      **When** NOSTR operations occur
      **Then** old backend implementation is used

- [ ] **Given** production environment
      **When** flag toggles
      **Then** switch happens without downtime

#### Technical Implementation

**File**: `packages/backend/src/services/nostr/migration.ts`

```typescript
export class BackendNostrMigration {
  private useNewImplementation: boolean;
  private oldService: OldBackendNostrService;
  private newAdapter: NodeNostrAdapter;

  constructor() {
    this.useNewImplementation = process.env.USE_NEW_NOSTR === 'true';
    this.oldService = new OldBackendNostrService();
    this.newAdapter = new NodeNostrAdapter({
      storage: 'redis', // or 'filesystem'
      storageConfig: {
        redis: getRedisClient(),
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.useNewImplementation) {
      await this.newAdapter.initialize({
        platform: 'node',
        relays: getBackendRelays(),
      });

      // Setup monitoring
      this.newAdapter.on('error', (err) => {
        logger.error('NOSTR adapter error:', err);
        metrics.increment('nostr.errors');
      });
    } else {
      await this.oldService.initialize();
    }
  }

  getService(): INostrService {
    return this.useNewImplementation ? this.newAdapter : this.oldService;
  }
}
```

#### Dependencies

- **Blocked by**: NS-014
- **Blocks**: NS-020, NS-021, NS-022

#### Testing Requirements

- Feature flag tests
- Service switching tests
- Error handling tests
- Performance comparison tests

---

### NS-020: Migrate Backend Event Publishing

**As a** developer
**I want** backend event publishing using the new service
**So that** server-side NOSTR operations use shared implementation

#### Acceptance Criteria

- [ ] **Given** backend API endpoints
      **When** publishing NOSTR events
      **Then** new shared service is used

- [ ] **Given** webhook events
      **When** triggering NOSTR publishes
      **Then** events are published via new service

- [ ] **Given** batch publishing
      **When** multiple events published
      **Then** efficient relay usage is maintained

#### Technical Implementation

**File**: `packages/backend/src/controllers/nostr.controller.ts`

```typescript
export class NostrController {
  private nostrService: NodeNostrAdapter;

  constructor() {
    this.nostrService = getNostrAdapter(); // Returns migrated service
  }

  async publishNote(req: Request, res: Response) {
    try {
      const { content, tags } = req.body;
      const { userId } = req.user;

      // Get user's NOSTR keys
      const keys = await getUserNostrKeys(userId);

      // Create and sign event
      const event = await this.nostrService.events.createEvent({
        kind: 1,
        content,
        tags: tags || [],
      });

      const signedEvent = await this.nostrService.crypto.signEvent(event, keys.privateKey);

      // Publish to relays
      const results = await this.nostrService.relays.publishToRelays(signedEvent);

      res.json({
        success: true,
        eventId: signedEvent.id,
        relayResults: results,
      });
    } catch (error) {
      logger.error('Failed to publish NOSTR event:', error);
      res.status(500).json({ error: 'Publishing failed' });
    }
  }

  async batchPublish(events: EventParams[]): Promise<PublishResult[]> {
    const signedEvents = await Promise.all(
      events.map(async (params) => {
        const event = await this.nostrService.events.createEvent(params);
        return this.nostrService.crypto.signEvent(event, privateKey);
      })
    );

    return this.nostrService.relays.publishBatch(signedEvents);
  }
}
```

#### Dependencies

- **Blocked by**: NS-019
- **Blocks**: NS-024

#### Testing Requirements

- API endpoint tests
- Batch publishing tests
- Error handling tests
- Relay fallback tests

---

### NS-021: Update Backend API Endpoints

**As a** developer
**I want** all backend API endpoints using new NOSTR service
**So that** backend migration covers all endpoints

#### Acceptance Criteria

- [ ] **Given** all NOSTR-related endpoints
      **When** migration complete
      **Then** all use new shared service

- [ ] **Given** API responses
      **When** using new service
      **Then** response format remains consistent

- [ ] **Given** error scenarios
      **When** NOSTR operations fail
      **Then** appropriate HTTP errors returned

#### Technical Implementation

**File**: `packages/backend/src/routes/nostr.routes.ts`

```typescript
export function setupNostrRoutes(app: Express) {
  const nostrService = getNostrAdapter();

  // Get user's NOSTR profile
  app.get('/api/nostr/profile/:pubkey', async (req, res) => {
    try {
      const { pubkey } = req.params;

      const profileEvent = await nostrService.events.fetchOne({
        kinds: [0], // Profile metadata
        authors: [pubkey],
        limit: 1,
      });

      if (!profileEvent) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const profile = JSON.parse(profileEvent.content);
      res.json({ pubkey, profile });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  // Subscribe to events via SSE
  app.get('/api/nostr/subscribe', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const filters = JSON.parse(req.query.filters as string);
    const emitter = nostrService.subscribeToEvents(filters);

    emitter.on('event', (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      emitter.removeAllListeners();
    });
  });
}
```

#### Dependencies

- **Blocked by**: NS-019
- **Blocks**: NS-024

#### Testing Requirements

- Endpoint response tests
- SSE streaming tests
- Error response tests
- Rate limiting tests

---

### NS-022: Migrate Backend Webhook Integration

**As a** developer
**I want** webhook handlers using new NOSTR service
**So that** external events trigger NOSTR publishes correctly

#### Acceptance Criteria

- [ ] **Given** incoming webhooks
      **When** triggering NOSTR events
      **Then** new service handles publishing

- [ ] **Given** webhook retries
      **When** NOSTR publishing fails
      **Then** appropriate retry logic executes

- [ ] **Given** webhook verification
      **When** validating webhook signatures
      **Then** security is maintained

#### Technical Implementation

**File**: `packages/backend/src/webhooks/handlers.ts`

```typescript
export class WebhookHandlers {
  private nostrService: NodeNostrAdapter;
  private eventEmitter: NostrEventEmitter;

  constructor() {
    this.nostrService = getNostrAdapter();
    this.eventEmitter = new NostrEventEmitter(this.nostrService);
  }

  async handlePaymentWebhook(payload: PaymentWebhook) {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload)) {
        throw new Error('Invalid webhook signature');
      }

      // Create NOSTR event for payment
      const event = await this.eventEmitter.publishEvent({
        kind: 9735, // Zap receipt
        content: JSON.stringify({
          amount: payload.amount,
          currency: payload.currency,
          timestamp: payload.timestamp,
        }),
        tags: [
          ['p', payload.recipientPubkey],
          ['e', payload.invoiceId],
          ['amount', payload.amount.toString()],
        ],
      });

      logger.info('Payment webhook processed', { eventId: event.id });

      return { success: true, eventId: event.id };
    } catch (error) {
      logger.error('Webhook processing failed:', error);

      // Queue for retry
      await this.queueForRetry(payload);
      throw error;
    }
  }

  private async queueForRetry(payload: any): Promise<void> {
    await redisClient.rpush(
      'webhook:retry:queue',
      JSON.stringify({
        payload,
        attempts: 0,
        nextRetry: Date.now() + 60000, // 1 minute
      })
    );
  }
}
```

#### Dependencies

- **Blocked by**: NS-019
- **Blocks**: NS-024

#### Testing Requirements

- Webhook handling tests
- Signature verification tests
- Retry logic tests
- Queue processing tests

---

## Phase 5: Cleanup & Optimization (Stories NS-023 to NS-026)

### NS-023: Remove Old Frontend Implementation

**As a** developer
**I want** to remove the old frontend NOSTR implementation
**So that** only the shared service remains

#### Acceptance Criteria

- [ ] **Given** successful migration
      **When** old code is removed
      **Then** no references to old service remain

- [ ] **Given** file deletion
      **When** removing old files
      **Then** build still succeeds

- [ ] **Given** import statements
      **When** checking codebase
      **Then** no imports of deleted files exist

#### Technical Implementation

**Files to Remove**:

```bash
# Remove old frontend NOSTR service
rm -rf packages/frontend/src/services/nostr/

# Remove old types if duplicated
rm -rf packages/frontend/src/types/nostr/

# Update imports in all files
find packages/frontend -name "*.ts*" -exec grep -l "from.*services/nostr" {} \;
# Update these files to use @sovren/shared/nostr
```

**Update package.json**:

```json
{
  "dependencies": {
    // Remove any NOSTR-specific dependencies now in shared
    // Keep only frontend-specific deps
  }
}
```

#### Dependencies

- **Blocked by**: NS-016, NS-017, NS-018
- **Blocks**: NS-025

#### Testing Requirements

- Build verification tests
- Import checking tests
- Dead code elimination tests
- Bundle size reduction tests

---

### NS-024: Remove Old Backend Implementation

**As a** developer
**I want** to remove the old backend NOSTR implementation
**So that** code duplication is eliminated

#### Acceptance Criteria

- [ ] **Given** successful backend migration
      **When** old code is removed
      **Then** backend continues to function

- [ ] **Given** old service files
      **When** deleted
      **Then** no broken imports remain

- [ ] **Given** cleanup complete
      **When** running tests
      **Then** all tests pass

#### Technical Implementation

**Files to Remove**:

```bash
# Remove old backend NOSTR service
rm -rf packages/backend/src/services/nostr/

# Remove old utilities
rm -rf packages/backend/src/utils/nostr/

# Check for references
find packages/backend -name "*.ts" -exec grep -l "from.*services/nostr" {} \;
# Update to use shared service
```

**Update dependencies**:

```json
{
  "dependencies": {
    "@sovren/shared": "workspace:*"
    // Remove duplicate NOSTR libraries
  }
}
```

#### Dependencies

- **Blocked by**: NS-020, NS-021, NS-022
- **Blocks**: NS-025

#### Testing Requirements

- Backend startup tests
- API endpoint tests
- Import verification tests
- Memory usage tests

---

### NS-025: Create Architecture Documentation

**As a** developer
**I want** comprehensive documentation of the new architecture
**So that** future developers understand the implementation

#### Acceptance Criteria

- [ ] **Given** new architecture
      **When** documentation created
      **Then** all components are documented

- [ ] **Given** diagrams needed
      **When** creating docs
      **Then** Mermaid diagrams illustrate flows

- [ ] **Given** migration complete
      **When** documenting
      **Then** migration guide is included

#### Technical Implementation

**File**: `docs/architecture/nostr-service.md`

```markdown
# NOSTR Service Architecture

## Overview

The NOSTR service is implemented as a shared service with platform-specific adapters.

## Architecture Diagram

\`\`\`mermaid
graph TB
subgraph "Shared Package"
Core[Core NOSTR Service]
Events[Event Manager]
Relays[Relay Manager]
Subs[Subscription Manager]
Crypto[Crypto Manager]

        Core --> Events
        Core --> Relays
        Core --> Subs
        Core --> Crypto
    end

    subgraph "Adapters"
        BrowserAdapter[Browser Adapter]
        NodeAdapter[Node.js Adapter]

        BrowserAdapter --> Core
        NodeAdapter --> Core
    end

    subgraph "Frontend"
        ReactHooks[React Hooks]
        Components[React Components]

        ReactHooks --> BrowserAdapter
        Components --> ReactHooks
    end

    subgraph "Backend"
        API[API Controllers]
        Webhooks[Webhook Handlers]

        API --> NodeAdapter
        Webhooks --> NodeAdapter
    end

\`\`\`

## Component Descriptions

### Core Service

- **Location**: `packages/shared/src/services/nostr/core/`
- **Purpose**: Platform-agnostic NOSTR protocol implementation
- **Components**:
  - Event Manager: Event creation, validation, serialization
  - Relay Manager: Connection pooling, publishing, reconnection
  - Subscription Manager: Filter-based subscriptions
  - Crypto Manager: Signing, key generation, encryption

### Adapters

Platform-specific implementations that wrap the core service.

#### Browser Adapter

- React hooks for component integration
- localStorage for persistence
- NIP-07 browser extension support

#### Node.js Adapter

- EventEmitter for async handling
- Redis/filesystem storage
- Process lifecycle management

## Migration Guide

### Frontend Migration

1. Install shared package
2. Replace imports
3. Update React components
4. Test functionality
5. Remove old implementation

### Backend Migration

1. Install shared package
2. Update service initialization
3. Migrate API endpoints
4. Update webhook handlers
5. Remove old implementation

## Best Practices

- Always use adapters, never import core directly
- Handle relay disconnections gracefully
- Implement proper cleanup in components
- Use feature flags for gradual rollout
```

#### Dependencies

- **Blocked by**: NS-023, NS-024
- **Blocks**: None

#### Testing Requirements

- Documentation build tests
- Diagram generation tests
- Link validation tests
- Code example tests

---

### NS-026: Performance Validation and Benchmarking

**As a** developer
**I want** to validate performance of the new implementation
**So that** we ensure no performance regression

#### Acceptance Criteria

- [ ] **Given** performance benchmarks
      **When** comparing old vs new
      **Then** new implementation is equal or faster

- [ ] **Given** memory usage
      **When** measured
      **Then** memory footprint is equal or smaller

- [ ] **Given** relay connections
      **When** stress tested
      **Then** connection pooling handles load

#### Technical Implementation

**File**: `packages/shared/src/services/nostr/__tests__/benchmarks.ts`

```typescript
describe('NOSTR Service Performance', () => {
  let oldService: OldNostrService;
  let newService: NostrService;

  beforeAll(async () => {
    oldService = new OldNostrService();
    newService = new NostrService(config);
    await Promise.all([oldService.initialize(), newService.initialize()]);
  });

  describe('Event Creation', () => {
    it('should match or exceed old implementation speed', async () => {
      const iterations = 10000;

      // Benchmark old implementation
      const oldStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await oldService.createEvent({ kind: 1, content: 'test' });
      }
      const oldTime = performance.now() - oldStart;

      // Benchmark new implementation
      const newStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await newService.events.createEvent({ kind: 1, content: 'test' });
      }
      const newTime = performance.now() - newStart;

      expect(newTime).toBeLessThanOrEqual(oldTime * 1.1); // Allow 10% variance
      console.log(`Event creation: Old=${oldTime}ms, New=${newTime}ms`);
    });
  });

  describe('Relay Publishing', () => {
    it('should handle concurrent publishes efficiently', async () => {
      const events = Array(100)
        .fill(null)
        .map(() => createTestEvent());

      const start = performance.now();
      await Promise.all(events.map((event) => newService.relays.publishToRelays(event)));
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in 5s
      console.log(`Published 100 events in ${duration}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with subscriptions', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy many subscriptions
      for (let i = 0; i < 1000; i++) {
        const sub = newService.subscriptions.subscribe([{ kinds: [1] }], () => {});
        await new Promise((resolve) => setTimeout(resolve, 10));
        newService.subscriptions.unsubscribe(sub);
      }

      // Force garbage collection if available
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
      console.log(`Memory growth: ${memoryGrowth / 1024 / 1024}MB`);
    });
  });
});
```

**Create benchmark report**:

```typescript
// scripts/benchmark-nostr.ts
async function runBenchmarks() {
  const results = {
    timestamp: new Date().toISOString(),
    eventCreation: await benchmarkEventCreation(),
    relayPublishing: await benchmarkRelayPublishing(),
    subscriptions: await benchmarkSubscriptions(),
    memory: await benchmarkMemory(),
    bundleSize: await checkBundleSize(),
  };

  // Generate report
  fs.writeFileSync('docs/nostr-consolidation-benchmark.json', JSON.stringify(results, null, 2));

  // Check for regressions
  const hasRegression =
    results.eventCreation.regression ||
    results.relayPublishing.regression ||
    results.memory.regression ||
    results.bundleSize.regression;

  if (hasRegression) {
    console.error('Performance regression detected!');
    process.exit(1);
  }

  console.log('All benchmarks passed successfully');
}
```

#### Dependencies

- **Blocked by**: NS-023, NS-024
- **Blocks**: None (Final story)

#### Testing Requirements

- Performance benchmark suite
- Memory leak detection
- Load testing
- Bundle size analysis

---

## Success Metrics

Upon completion of all stories:

1. **Code Reduction**: ~750 lines eliminated (target: 15% reduction)
2. **Test Coverage**: 95%+ for core NOSTR service
3. **Performance**: No regression in any metric
4. **Bundle Size**: < 10KB increase in frontend bundle
5. **Memory Usage**: Equal or better than before
6. **Zero Downtime**: Migration completed without service interruption
7. **NIP Compliance**: All NIPs still properly supported

## Risk Mitigation

- **Feature Flags**: Enable gradual rollout and instant rollback
- **Parallel Running**: Old and new implementations coexist during migration
- **Comprehensive Testing**: Each story includes thorough test requirements
- **Monitoring**: Add metrics and logging at each phase
- **Documentation**: Complete architecture and migration guides
