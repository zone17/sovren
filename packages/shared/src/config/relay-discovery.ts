/**
 * 🌐 ELITE SERVICE: Dynamic Relay Discovery Configuration
 * US-309: Remove Hardcoded Relay URLs - Dynamic Discovery Support
 *
 * Implements NIP-65 relay list metadata and dynamic discovery
 * to avoid hardcoded relay dependencies.
 *
 * Features:
 * - NIP-65 relay list discovery
 * - User preference storage
 * - Relay health scoring
 * - Automatic fallback mechanism
 * - Performance-based selection
 */

import type { NostrEvent } from '../types/nostr';

/**
 * Relay discovery configuration
 */
export interface RelayDiscoveryConfig {
  /** Enable automatic relay discovery */
  enableAutoDiscovery: boolean;
  /** Maximum number of relays to discover */
  maxRelays: number;
  /** Minimum relay health score (0-100) */
  minHealthScore: number;
  /** Relay list refresh interval (ms) */
  refreshInterval: number;
  /** Enable user preference caching */
  enableUserPreferences: boolean;
  /** Cache duration for discovered relays (ms) */
  cacheDuration: number;
}

/**
 * Discovered relay metadata
 */
export interface DiscoveredRelay {
  url: string;
  read: boolean;
  write: boolean;
  healthScore: number;
  lastChecked: number;
  responseTime?: number;
  availability?: number;
  discoveredFrom?: string; // pubkey or relay URL
  tags?: string[]; // e.g., ['paid', 'public', 'regional']
}

/**
 * User relay preferences (NIP-65)
 */
export interface UserRelayPreferences {
  pubkey: string;
  relays: DiscoveredRelay[];
  updated: number;
  signature?: string;
}

/**
 * Default discovery configuration
 */
export const DEFAULT_DISCOVERY_CONFIG: RelayDiscoveryConfig = {
  enableAutoDiscovery: true,
  maxRelays: 20,
  minHealthScore: 60,
  refreshInterval: 3600000, // 1 hour
  enableUserPreferences: true,
  cacheDuration: 86400000, // 24 hours
};

/**
 * Relay Discovery Service
 */
export class RelayDiscoveryService {
  private static instance: RelayDiscoveryService | null = null;
  private config: RelayDiscoveryConfig;
  private discoveredRelays: Map<string, DiscoveredRelay> = new Map();
  private userPreferences: Map<string, UserRelayPreferences> = new Map();
  private lastDiscovery: number = 0;

  private constructor(config: Partial<RelayDiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<RelayDiscoveryConfig>): RelayDiscoveryService {
    if (!this.instance) {
      this.instance = new RelayDiscoveryService(config);
    }
    return this.instance;
  }

  /**
   * Discover relays from NIP-65 events
   * @param events - Kind 10002 events containing relay lists
   */
  public async discoverFromNIP65(events: NostrEvent[]): Promise<DiscoveredRelay[]> {
    const discovered: DiscoveredRelay[] = [];

    for (const event of events) {
      if ((event.kind as number) !== 10002) continue;

      // Parse relay tags
      const relayTags = event.tags.filter((tag: string[]) => tag[0] === 'r');

      for (const tag of relayTags) {
        const url = tag[1];
        const marker = tag[2]; // 'read' or 'write'

        if (!url || !this.isValidRelayUrl(url)) continue;

        const relay: DiscoveredRelay = {
          url: this.normalizeUrl(url),
          read: !marker || marker === 'read',
          write: !marker || marker === 'write',
          healthScore: 100, // Initial score
          lastChecked: Date.now(),
          discoveredFrom: event.pubkey,
        };

        discovered.push(relay);
        this.discoveredRelays.set(relay.url, relay);
      }
    }

    this.lastDiscovery = Date.now();
    return discovered;
  }

  /**
   * Get user's preferred relays
   * @param pubkey - User's public key
   */
  public async getUserRelayPreferences(pubkey: string): Promise<DiscoveredRelay[]> {
    const cached = this.userPreferences.get(pubkey);

    if (cached && Date.now() - cached.updated < this.config.cacheDuration) {
      return cached.relays;
    }

    // Return empty if no cached preferences
    // In production, this would fetch from relays
    return [];
  }

  /**
   * Store user relay preferences
   * @param pubkey - User's public key
   * @param relays - User's preferred relays
   */
  public async storeUserPreferences(
    pubkey: string,
    relays: DiscoveredRelay[]
  ): Promise<void> {
    const preferences: UserRelayPreferences = {
      pubkey,
      relays,
      updated: Date.now(),
    };

    this.userPreferences.set(pubkey, preferences);
  }

  /**
   * Get best relays based on health scores
   * @param count - Number of relays to return
   */
  public getBestRelays(count: number = 5): DiscoveredRelay[] {
    const relays = Array.from(this.discoveredRelays.values())
      .filter(relay => relay.healthScore >= this.config.minHealthScore)
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, count);

    return relays;
  }

  /**
   * Update relay health score
   * @param url - Relay URL
   * @param score - Health score (0-100)
   */
  public updateHealthScore(url: string, score: number): void {
    const relay = this.discoveredRelays.get(this.normalizeUrl(url));
    if (relay) {
      relay.healthScore = Math.max(0, Math.min(100, score));
      relay.lastChecked = Date.now();
    }
  }

  /**
   * Check if discovery refresh is needed
   */
  public needsRefresh(): boolean {
    return Date.now() - this.lastDiscovery > this.config.refreshInterval;
  }

  /**
   * Clear discovered relays cache
   */
  public clearCache(): void {
    this.discoveredRelays.clear();
    this.userPreferences.clear();
    this.lastDiscovery = 0;
  }

  /**
   * Get all discovered relays
   */
  public getDiscoveredRelays(): DiscoveredRelay[] {
    return Array.from(this.discoveredRelays.values());
  }

  /**
   * Merge discovered relays with configured relays
   * @param configuredRelays - Relays from configuration
   * @param discovered - Discovered relays
   */
  public mergeRelays(
    configuredRelays: DiscoveredRelay[],
    discovered: DiscoveredRelay[]
  ): DiscoveredRelay[] {
    const merged = new Map<string, DiscoveredRelay>();

    // Add configured relays first (higher priority)
    for (const relay of configuredRelays) {
      merged.set(relay.url, relay);
    }

    // Add discovered relays
    for (const relay of discovered) {
      if (!merged.has(relay.url)) {
        merged.set(relay.url, relay);
      }
    }

    return Array.from(merged.values());
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  private isValidRelayUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
    } catch {
      return false;
    }
  }

  private normalizeUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }
}

/**
 * Export singleton instance
 */
export const relayDiscovery = RelayDiscoveryService.getInstance();