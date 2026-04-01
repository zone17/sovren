/**
 * 🌐 ELITE SERVICE: NIP-65 Relay List Metadata
 * US-319: NIP-65 Relay List Implementation
 *
 * Implements NIP-65 for publishing and reading user relay preferences.
 * Allows users to advertise their preferred read/write relays.
 *
 * Features:
 * - Publish relay list (kind 10002 events)
 * - Fetch user relay preferences
 * - Parse relay list events
 * - Update relay preferences
 * - Merge with default relays
 * - Cache relay lists for performance
 *
 * NIP-65 Spec: https://github.com/nostr-protocol/nips/blob/master/65.md
 *
 * @example
 * ```typescript
 * const service = NIP65Service.getInstance();
 *
 * // Publish relay list
 * await service.publishRelayList([
 *   { url: 'wss://relay.damus.io', read: true, write: true },
 *   { url: 'wss://nos.lol', read: true, write: false },
 * ]);
 *
 * // Fetch user's relay list
 * const relayList = await service.fetchRelayList(publicKey);
 *
 * // Update specific relay
 * await service.updateRelayPreferences([
 *   { url: 'wss://new-relay.com', read: true, write: true }
 * ]);
 * ```
 */

import { finalizeEvent } from 'nostr-tools/pure';
import type {
  NostrEvent,
  UnsignedNostrEvent,
  RelayMetadata,
  RelayListEvent,
  ParsedRelayList,
  RelayPreferenceUpdate,
  NostrFilter,
} from '@shared/types/nostr/index';
import { RelayConfig } from '@shared/config/relay-config';
import { KeyManagementService } from './KeyManagementService';
import { RelayPoolManager } from './RelayPoolManager';

/**
 * Relay list cache entry
 */
interface RelayListCacheEntry {
  relayList: ParsedRelayList;
  timestamp: number;
}

/**
 * Relay list options
 */
export interface RelayListOptions {
  /** Include default relays if user has none */
  includeDefaults?: boolean;
  /** Cache duration in milliseconds */
  cacheDuration?: number;
  /** Timeout for fetching */
  timeout?: number;
}

/**
 * NIP-65 Relay List Metadata Service
 */
export class NIP65Service {
  private static instance: NIP65Service;
  private keyManagement: KeyManagementService;
  private relayPool: RelayPoolManager;
  private cache: Map<string, RelayListCacheEntry> = new Map();
  private readonly DEFAULT_CACHE_DURATION = 3600000; // 1 hour

  private constructor() {
    this.keyManagement = KeyManagementService.getInstance();
    this.relayPool = RelayPoolManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NIP65Service {
    if (!NIP65Service.instance) {
      NIP65Service.instance = new NIP65Service();
    }
    return NIP65Service.instance;
  }

  /**
   * Publish relay list to NOSTR network
   *
   * @param relays - Array of relay metadata with read/write capabilities
   * @param privateKey - Optional private key (uses KeyManagement if not provided)
   * @returns Published event
   *
   * @example
   * ```typescript
   * await service.publishRelayList([
   *   { url: 'wss://relay.damus.io', read: true, write: true },
   *   { url: 'wss://nos.lol', read: true, write: false },
   * ]);
   * ```
   */
  public async publishRelayList(
    relays: RelayMetadata[],
    privateKey?: string
  ): Promise<RelayListEvent> {
    // Validate relays
    this.validateRelayList(relays);

    // Normalize relay URLs
    const normalizedRelays = relays.map(relay => ({
      ...relay,
      url: this.normalizeRelayUrl(relay.url),
    }));

    // Build relay list tags
    const tags = this.buildRelayTags(normalizedRelays);

    // Create event template
    const eventTemplate: Omit<UnsignedNostrEvent, 'pubkey' | 'created_at'> = {
      kind: 10002,
      content: '',
      tags,
    };

    // Get private key from active key pair
    const activeKey = this.keyManagement.getActiveKey();
    const privKeyInput = privateKey || activeKey?.privateKey;
    if (!privKeyInput) {
      throw new Error('No private key available');
    }

    // Convert hex string to Uint8Array if needed
    const privKeyBytes =
      typeof privKeyInput === 'string'
        ? new Uint8Array(privKeyInput.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
        : privKeyInput;

    // Sign and publish
    const pubkey = activeKey?.publicKey;
    if (!pubkey) {
      throw new Error('No public key available');
    }

    const unsignedEvent: UnsignedNostrEvent = {
      ...eventTemplate,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
    };

    const signedEvent = finalizeEvent(unsignedEvent, privKeyBytes) as RelayListEvent;

    // Publish to network
    await this.relayPool.publishEvent(signedEvent);

    // Update cache
    const publicKey = signedEvent.pubkey;
    this.updateCache(publicKey, this.parseRelayList(signedEvent));

    return signedEvent;
  }

  /**
   * Fetch relay list for a public key
   *
   * @param publicKey - User's public key
   * @param options - Fetch options
   * @returns Parsed relay list
   *
   * @example
   * ```typescript
   * const relayList = await service.fetchRelayList(
   *   'pubkey-hex',
   *   { includeDefaults: true }
   * );
   * console.log('Read relays:', relayList.readRelays);
   * console.log('Write relays:', relayList.writeRelays);
   * ```
   */
  public async fetchRelayList(
    publicKey: string,
    options: RelayListOptions = {}
  ): Promise<ParsedRelayList | null> {
    const {
      includeDefaults = true,
      cacheDuration = this.DEFAULT_CACHE_DURATION,
      timeout = 10000,
    } = options;

    // Check cache
    const cached = this.getFromCache(publicKey, cacheDuration);
    if (cached) {
      return cached;
    }

    // Build filter for relay list events (kind 10002)
    const filter: NostrFilter = {
      kinds: [10002],
      authors: [publicKey],
      limit: 1,
    };

    // Query relays
    try {
      const events = await this.queryRelays(filter, timeout);

      if (events.length === 0) {
        // No relay list found
        if (includeDefaults) {
          return this.createDefaultRelayList();
        }
        return null;
      }

      // Get most recent event
      const latestEvent = events.reduce((latest, event) =>
        event.created_at > latest.created_at ? event : latest
      );

      // Parse and cache
      const relayList = this.parseRelayList(latestEvent as RelayListEvent);
      this.updateCache(publicKey, relayList);

      return relayList;
    } catch (error) {
      console.error('Error fetching relay list:', error);

      if (includeDefaults) {
        return this.createDefaultRelayList();
      }
      return null;
    }
  }

  /**
   * Parse relay list event into structured data
   *
   * @param event - Relay list event (kind 10002)
   * @returns Parsed relay list
   *
   * @example
   * ```typescript
   * const parsed = service.parseRelayList(event);
   * console.log('All relays:', parsed.relays);
   * ```
   */
  public parseRelayList(event: RelayListEvent): ParsedRelayList {
    const relays: RelayMetadata[] = [];
    const readRelays: string[] = [];
    const writeRelays: string[] = [];

    // Process relay tags
    for (const tag of event.tags) {
      if (tag[0] !== 'r' || tag.length < 2) {
        continue;
      }

      const url = this.normalizeRelayUrl(tag[1]);
      const marker = tag[2];

      let read = true;
      let write = true;

      if (marker === 'read') {
        write = false;
      } else if (marker === 'write') {
        read = false;
      }

      relays.push({ url, read, write });

      if (read) {
        readRelays.push(url);
      }
      if (write) {
        writeRelays.push(url);
      }
    }

    return {
      relays,
      readRelays,
      writeRelays,
      publishedAt: event.created_at,
      eventId: event.id,
    };
  }

  /**
   * Update relay preferences
   *
   * @param changes - Array of preference updates
   * @param privateKey - Optional private key
   * @returns Updated relay list event
   *
   * @example
   * ```typescript
   * await service.updateRelayPreferences([
   *   { url: 'wss://new-relay.com', read: true, write: true },
   *   { url: 'wss://old-relay.com', remove: true },
   * ]);
   * ```
   */
  public async updateRelayPreferences(
    changes: RelayPreferenceUpdate[],
    privateKey?: string
  ): Promise<RelayListEvent> {
    // Get current relay list
    const activeKey = this.keyManagement.getActiveKey();
    if (!activeKey) {
      throw new Error('No active key available');
    }
    const publicKey = activeKey.publicKey;
    const currentList = await this.fetchRelayList(publicKey, {
      includeDefaults: false,
    });

    // Build updated relay list
    const relaysMap = new Map<string, RelayMetadata>();

    // Add current relays
    if (currentList) {
      for (const relay of currentList.relays) {
        relaysMap.set(relay.url, relay);
      }
    }

    // Apply changes
    for (const change of changes) {
      const url = this.normalizeRelayUrl(change.url);

      if (change.remove) {
        relaysMap.delete(url);
      } else {
        const existing = relaysMap.get(url) || {
          url,
          read: false,
          write: false,
        };
        relaysMap.set(url, {
          url,
          read: change.read !== undefined ? change.read : existing.read,
          write: change.write !== undefined ? change.write : existing.write,
        });
      }
    }

    // Publish updated list
    const updatedRelays = Array.from(relaysMap.values());
    return this.publishRelayList(updatedRelays, privateKey);
  }

  /**
   * Get read relays for a user
   *
   * @param publicKey - User's public key
   * @returns Array of read relay URLs
   */
  public async getReadRelays(publicKey: string): Promise<string[]> {
    const relayList = await this.fetchRelayList(publicKey);
    return relayList?.readRelays || RelayConfig.getReadRelays();
  }

  /**
   * Get write relays for a user
   *
   * @param publicKey - User's public key
   * @returns Array of write relay URLs
   */
  public async getWriteRelays(publicKey: string): Promise<string[]> {
    const relayList = await this.fetchRelayList(publicKey);
    return relayList?.writeRelays || RelayConfig.getWriteRelays();
  }

  /**
   * Clear cache for a public key
   */
  public clearCache(publicKey?: string): void {
    if (publicKey) {
      this.cache.delete(publicKey);
    } else {
      this.cache.clear();
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Build relay tags from metadata
   */
  private buildRelayTags(
    relays: RelayMetadata[]
  ): Array<['r', string] | ['r', string, 'read'] | ['r', string, 'write']> {
    return relays.map(relay => {
      if (relay.read && relay.write) {
        return ['r', relay.url];
      } else if (relay.read) {
        return ['r', relay.url, 'read'];
      } else {
        return ['r', relay.url, 'write'];
      }
    });
  }

  /**
   * Normalize relay URL
   */
  private normalizeRelayUrl(url: string): string {
    // Remove trailing slash
    let normalized = url.trim().replace(/\/$/, '');

    // Ensure wss:// protocol
    if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
      normalized = `wss://${normalized}`;
    }

    return normalized;
  }

  /**
   * Validate relay list
   */
  private validateRelayList(relays: RelayMetadata[]): void {
    if (!Array.isArray(relays)) {
      throw new Error('Relays must be an array');
    }

    if (relays.length === 0) {
      throw new Error('Relay list cannot be empty');
    }

    for (const relay of relays) {
      if (!relay.url) {
        throw new Error('Relay URL is required');
      }

      if (typeof relay.read !== 'boolean' || typeof relay.write !== 'boolean') {
        throw new Error('Relay read and write must be boolean');
      }

      if (!relay.read && !relay.write) {
        throw new Error('Relay must support at least read or write');
      }
    }
  }

  /**
   * Query relays for events
   */
  private async queryRelays(filter: NostrFilter, timeout: number): Promise<NostrEvent[]> {
    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      const timer = setTimeout(() => {
        resolve(events);
      }, timeout);

      try {
        const subId = this.relayPool.subscribe([filter], event => {
          events.push(event);
        });

        // Cleanup after timeout
        setTimeout(() => {
          this.relayPool.unsubscribe(subId);
          clearTimeout(timer);
          resolve(events);
        }, timeout);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Get from cache
   */
  private getFromCache(publicKey: string, maxAge: number): ParsedRelayList | null {
    const cached = this.cache.get(publicKey);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > maxAge) {
      this.cache.delete(publicKey);
      return null;
    }

    return cached.relayList;
  }

  /**
   * Update cache
   */
  private updateCache(publicKey: string, relayList: ParsedRelayList): void {
    this.cache.set(publicKey, {
      relayList,
      timestamp: Date.now(),
    });
  }

  /**
   * Create default relay list from centralized configuration
   */
  private createDefaultRelayList(): ParsedRelayList {
    const defaultRelays = RelayConfig.getRelays();
    return {
      relays: defaultRelays,
      readRelays: RelayConfig.getReadRelays(),
      writeRelays: RelayConfig.getWriteRelays(),
      publishedAt: 0,
      eventId: '',
    };
  }

  /**
   * Get default relays from centralized configuration
   */
  public static getDefaultRelays(): RelayMetadata[] {
    return RelayConfig.getRelays();
  }
}

/**
 * Export singleton instance
 */
export const nip65Service = NIP65Service.getInstance();
