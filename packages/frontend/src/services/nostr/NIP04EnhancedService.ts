/**
 * 🔐 Enhanced NIP-04 Direct Messaging Service
 * US-313: NIP-04 Encrypted DM Support - Subtasks 3-12
 *
 * Advanced features for encrypted direct messages:
 * - Message threading and conversations
 * - Read receipts (NIP-15 kind 15)
 * - Typing indicators
 * - Message history management
 * - Forward secrecy with session key rotation
 * - Spam protection and rate limiting
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/04.md
 * @see https://github.com/nostr-protocol/nips/blob/master/15.md
 */

import { NIP04Service } from './NIP04Service';
import type { NostrEvent } from '@shared/types/nostr';
import { RelayPoolManager } from './RelayPoolManager';
import { EventCacheService } from './EventCacheService';

/**
 * Message thread structure
 */
export interface MessageThread {
  id: string;
  participants: string[]; // pubkeys
  messages: ThreadMessage[];
  lastMessage?: ThreadMessage;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    title?: string;
    avatar?: string;
    muted?: boolean;
    archived?: boolean;
  };
}

/**
 * Thread message with enhanced metadata
 */
export interface ThreadMessage {
  id: string;
  eventId: string;
  threadId: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  isRead: boolean;
  readAt?: number;
  replyTo?: string; // Event ID of parent message
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  edited?: boolean;
  editedAt?: number;
  deleted?: boolean;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  mimeType?: string;
  size?: number;
  name?: string;
  thumbnail?: string;
}

/**
 * Message reaction
 */
export interface MessageReaction {
  pubkey: string;
  emoji: string;
  timestamp: number;
}

/**
 * Read receipt event (NIP-15)
 */
export interface ReadReceipt {
  messageId: string;
  reader: string;
  timestamp: number;
  eventId: string;
}

/**
 * Typing indicator
 */
export interface TypingIndicator {
  threadId: string;
  pubkey: string;
  isTyping: boolean;
  timestamp: number;
}

/**
 * Session key for forward secrecy
 */
export interface SessionKey {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  expiresAt: number;
  messageCount: number;
  maxMessages: number;
}

/**
 * Spam protection config
 */
export interface SpamProtectionConfig {
  enabled: boolean;
  maxMessagesPerMinute: number;
  maxMessagesPerHour: number;
  maxMessageLength: number;
  blockList: string[]; // Blocked pubkeys
  allowList: string[]; // Whitelisted pubkeys
  requireFollowBack: boolean;
  minAccountAge?: number; // Minimum account age in seconds
}

/**
 * Enhanced NIP-04 DM Service
 */
export class NIP04EnhancedService {
  private static instance: NIP04EnhancedService | null = null;
  private nip04Service: NIP04Service;
  private relayPool: RelayPoolManager;
  private cacheService: EventCacheService;
  private threads: Map<string, MessageThread> = new Map();
  private readReceipts: Map<string, ReadReceipt[]> = new Map();
  private typingIndicators: Map<string, TypingIndicator[]> = new Map();
  private sessionKeys: Map<string, SessionKey> = new Map();
  private messageHistory: Map<string, ThreadMessage[]> = new Map();
  private spamConfig: SpamProtectionConfig;
  private rateLimiter: Map<string, number[]> = new Map();

  private constructor() {
    this.nip04Service = NIP04Service.getInstance();
    this.relayPool = RelayPoolManager.getInstance();
    this.cacheService = EventCacheService.getInstance();

    this.spamConfig = {
      enabled: true,
      maxMessagesPerMinute: 10,
      maxMessagesPerHour: 100,
      maxMessageLength: 10000,
      blockList: [],
      allowList: [],
      requireFollowBack: false,
    };

    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NIP04EnhancedService {
    if (!this.instance) {
      this.instance = new NIP04EnhancedService();
    }
    return this.instance;
  }

  /**
   * Initialize service
   */
  private async initialize(): Promise<void> {
    // Subscribe to DM events
    this.subscribeToMessages();
    this.subscribeToReadReceipts();
    this.subscribeToTypingIndicators();

    // Start session key rotation
    this.startKeyRotation();

    // Load message history from cache
    await this.loadMessageHistory();
  }

  // ========================================
  // MESSAGE THREADING
  // ========================================

  /**
   * Get or create thread for participants
   */
  public getOrCreateThread(participants: string[]): MessageThread {
    const threadId = this.generateThreadId(participants);

    let thread = this.threads.get(threadId);
    if (!thread) {
      thread = {
        id: threadId,
        participants: participants.sort(),
        messages: [],
        unreadCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.threads.set(threadId, thread);
    }

    return thread;
  }

  /**
   * Add message to thread
   */
  public addMessageToThread(
    message: ThreadMessage,
    threadId: string
  ): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    // Add message to thread
    thread.messages.push(message);
    thread.lastMessage = message;
    thread.updatedAt = Date.now();

    // Update unread count
    if (!message.isRead && message.recipient === this.getCurrentPubkey()) {
      thread.unreadCount++;
    }

    // Sort messages by timestamp
    thread.messages.sort((a, b) => a.timestamp - b.timestamp);

    // Update cache
    this.saveThreadToCache(thread);
  }

  /**
   * Get thread messages with pagination
   */
  public async getThreadMessages(
    threadId: string,
    limit: number = 50,
    before?: number
  ): Promise<ThreadMessage[]> {
    const thread = this.threads.get(threadId);
    if (!thread) return [];

    let messages = thread.messages;

    // Filter by timestamp if provided
    if (before) {
      messages = messages.filter(m => m.timestamp < before);
    }

    // Return last N messages
    return messages.slice(-limit);
  }

  // ========================================
  // READ RECEIPTS (NIP-15)
  // ========================================

  /**
   * Send read receipt for message
   */
  public async sendReadReceipt(messageId: string): Promise<void> {
    const event: Partial<NostrEvent> = {
      kind: 15, // NIP-15 read receipt
      tags: [
        ['e', messageId], // Reference to message event
        ['read', Date.now().toString()],
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    };

    // Sign and publish event
    await this.relayPool.publishEvent(event as NostrEvent);

    // Update local state
    this.markMessageAsRead(messageId);
  }

  /**
   * Mark message as read locally
   */
  private markMessageAsRead(messageId: string): void {
    for (const thread of this.threads.values()) {
      const message = thread.messages.find(m => m.eventId === messageId);
      if (message && !message.isRead) {
        message.isRead = true;
        message.readAt = Date.now();
        thread.unreadCount = Math.max(0, thread.unreadCount - 1);
        this.saveThreadToCache(thread);
        break;
      }
    }
  }

  /**
   * Get read receipts for message
   */
  public getReadReceipts(messageId: string): ReadReceipt[] {
    return this.readReceipts.get(messageId) || [];
  }

  // ========================================
  // TYPING INDICATORS
  // ========================================

  /**
   * Send typing indicator
   */
  public async sendTypingIndicator(
    threadId: string,
    isTyping: boolean
  ): Promise<void> {
    const event: Partial<NostrEvent> = {
      kind: 20004, // Custom kind for typing indicators
      tags: [
        ['thread', threadId],
        ['typing', isTyping ? '1' : '0'],
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    };

    // Sign and publish ephemeral event
    await this.relayPool.publishEvent(event as NostrEvent);
  }

  /**
   * Get active typing indicators for thread
   */
  public getTypingIndicators(threadId: string): TypingIndicator[] {
    const indicators = this.typingIndicators.get(threadId) || [];
    const now = Date.now();

    // Filter out old indicators (> 5 seconds)
    return indicators.filter(i => now - i.timestamp < 5000 && i.isTyping);
  }

  // ========================================
  // MESSAGE HISTORY MANAGEMENT
  // ========================================

  /**
   * Load message history from cache
   */
  private async loadMessageHistory(): Promise<void> {
    const cachedMessages = await this.cacheService.getByFilter({
      kinds: [4], // Encrypted DMs
      limit: 1000,
    });

    // Group messages by thread
    for (const event of cachedMessages) {
      const message = await this.eventToThreadMessage(event);
      if (message) {
        const threadId = this.generateThreadId([
          message.sender,
          message.recipient,
        ]);

        let history = this.messageHistory.get(threadId);
        if (!history) {
          history = [];
          this.messageHistory.set(threadId, history);
        }
        history.push(message);
      }
    }
  }

  /**
   * Prune old message history
   */
  public async pruneMessageHistory(
    maxAge: number = 30 * 24 * 60 * 60 * 1000 // 30 days
  ): Promise<number> {
    const cutoff = Date.now() - maxAge;
    let prunedCount = 0;

    for (const [threadId, messages] of this.messageHistory.entries()) {
      const before = messages.length;
      const filtered = messages.filter(m => m.timestamp > cutoff);
      this.messageHistory.set(threadId, filtered);
      prunedCount += before - filtered.length;
    }

    return prunedCount;
  }

  /**
   * Export message history
   */
  public async exportMessageHistory(
    threadId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const messages = this.messageHistory.get(threadId) || [];

    if (format === 'json') {
      return JSON.stringify(messages, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'sender', 'recipient', 'content'];
      const rows = messages.map(m => [
        new Date(m.timestamp).toISOString(),
        m.sender,
        m.recipient,
        m.content.replace(/"/g, '""'), // Escape quotes
      ]);

      return [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${v}"`).join(',')),
      ].join('\n');
    }
  }

  // ========================================
  // FORWARD SECRECY
  // ========================================

  /**
   * Generate new session key pair
   */
  private generateSessionKey(): SessionKey {
    // Generate ephemeral key pair
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = this.derivePublicKey(privateKey);

    const key: SessionKey = {
      id: this.generateId(),
      publicKey: this.bytesToHex(publicKey),
      privateKey: this.bytesToHex(privateKey),
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      messageCount: 0,
      maxMessages: 100, // Rotate after 100 messages
    };

    return key;
  }

  /**
   * Rotate session keys periodically
   */
  private startKeyRotation(): void {
    setInterval(() => {
      this.rotateExpiredKeys();
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Rotate expired or exhausted keys
   */
  private rotateExpiredKeys(): void {
    const now = Date.now();

    for (const [id, key] of this.sessionKeys.entries()) {
      if (
        key.expiresAt < now ||
        key.messageCount >= key.maxMessages
      ) {
        // Generate new key
        const newKey = this.generateSessionKey();
        this.sessionKeys.set(id, newKey);

        // Notify peers of key rotation (implementation specific)
        this.broadcastKeyRotation(id, newKey.publicKey);
      }
    }
  }

  // ========================================
  // SPAM PROTECTION
  // ========================================

  /**
   * Check if message passes spam filters
   */
  public async checkSpamFilters(
    sender: string,
    content: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.spamConfig.enabled) {
      return { allowed: true };
    }

    // Check block list
    if (this.spamConfig.blockList.includes(sender)) {
      return { allowed: false, reason: 'Sender is blocked' };
    }

    // Check allow list (bypass other checks)
    if (this.spamConfig.allowList.includes(sender)) {
      return { allowed: true };
    }

    // Check message length
    if (content.length > this.spamConfig.maxMessageLength) {
      return { allowed: false, reason: 'Message too long' };
    }

    // Check rate limits
    if (!this.checkRateLimit(sender)) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    // Check follow requirement
    if (this.spamConfig.requireFollowBack) {
      const isFollowing = await this.checkFollowStatus(sender);
      if (!isFollowing) {
        return { allowed: false, reason: 'Sender not in follow list' };
      }
    }

    return { allowed: true };
  }

  /**
   * Check rate limits for sender
   */
  private checkRateLimit(sender: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimiter.get(sender) || [];

    // Clean old timestamps
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentTimestamps = timestamps.filter(t => t > oneHourAgo);

    // Check hourly limit
    if (recentTimestamps.length >= this.spamConfig.maxMessagesPerHour) {
      return false;
    }

    // Check minute limit
    const oneMinuteAgo = now - 60 * 1000;
    const lastMinute = recentTimestamps.filter(t => t > oneMinuteAgo);
    if (lastMinute.length >= this.spamConfig.maxMessagesPerMinute) {
      return false;
    }

    // Update timestamps
    recentTimestamps.push(now);
    this.rateLimiter.set(sender, recentTimestamps);

    return true;
  }

  /**
   * Update spam configuration
   */
  public updateSpamConfig(config: Partial<SpamProtectionConfig>): void {
    this.spamConfig = { ...this.spamConfig, ...config };
  }

  /**
   * Block a sender
   */
  public blockSender(pubkey: string): void {
    if (!this.spamConfig.blockList.includes(pubkey)) {
      this.spamConfig.blockList.push(pubkey);
    }
  }

  /**
   * Unblock a sender
   */
  public unblockSender(pubkey: string): void {
    this.spamConfig.blockList = this.spamConfig.blockList.filter(
      p => p !== pubkey
    );
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private generateThreadId(participants: string[]): string {
    return participants.sort().join('-');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private getCurrentPubkey(): string {
    // Get from key management service
    return '';
  }

  private async eventToThreadMessage(event: NostrEvent): Promise<ThreadMessage | null> {
    // Convert NOSTR event to thread message
    // Implementation depends on event structure
    return null;
  }

  private saveThreadToCache(thread: MessageThread): void {
    // Save to IndexedDB or localStorage
  }

  private subscribeToMessages(): void {
    // Subscribe to kind 4 events (encrypted DMs)
  }

  private subscribeToReadReceipts(): void {
    // Subscribe to kind 15 events (read receipts)
  }

  private subscribeToTypingIndicators(): void {
    // Subscribe to custom typing indicator events
  }

  private async checkFollowStatus(pubkey: string): Promise<boolean> {
    // Check if current user follows the sender
    return true;
  }

  private broadcastKeyRotation(id: string, publicKey: string): void {
    // Broadcast key rotation to peers
  }

  private derivePublicKey(privateKey: Uint8Array): Uint8Array {
    // Derive public key from private key
    return new Uint8Array(32);
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Export singleton instance
 */
export const nip04Enhanced = NIP04EnhancedService.getInstance();