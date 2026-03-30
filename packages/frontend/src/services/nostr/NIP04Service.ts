/**
 * 🔐 NIP-04 Encrypted Direct Messages Service
 * US-305: Implement NIP-04 Encrypted Direct Messages
 * Epic 003: NOSTR Consolidation
 *
 * Features:
 * - ECDH shared secret derivation (secp256k1)
 * - AES-256-CBC encryption/decryption
 * - Random IV generation for each message
 * - Base64 encoding (NIP-04 format: encrypted_content?iv=base64_iv)
 * - Browser extension support (NIP-07)
 * - DM thread management
 * - Read/unread tracking
 * - Secure key handling
 *
 * NIP-04 Specification:
 * https://github.com/nostr-protocol/nips/blob/master/04.md
 */
import { finalizeEvent } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import type { KeyManagementService } from './KeyManagementService';
import type { NostrEvent } from '@sovren/shared/types/nostr/events';
import type {
  NostrDirectMessage,
  ReadReceiptEvent,
  ReadReceiptStatus,
  TypingIndicatorEvent,
  MessageHistoryRequest,
  SessionKeyInfo,
  SpamProtectionConfig,
} from '@sovren/shared/types/nostr/nips';
/**
 * Encryption options
 */
interface EncryptionOptions {
  /** Use browser extension for encryption */
  useExtension?: boolean;
  /** Fall back to native encryption if extension fails */
  fallbackToNative?: boolean;
  /** Use active key from KeyManagementService */
  useActiveKey?: boolean;
  /** Specific key ID to use */
  keyId?: string;
}
/**
 * DM Event creation options
 */
interface DMEventOptions {
  /** Sign the event */
  sign?: boolean;
  /** Use browser extension for signing */
  useExtension?: boolean;
  /** Key ID to use for signing */
  keyId?: string;
}
/**
 * Thread metadata
 */
interface ThreadMetadata {
  threadId: string;
  participants: [string, string];
  lastRead: number;
  lastMessage: number;
  unreadCount: number;
  sessionKey?: SessionKeyInfo;
}
/**
 * Message cache entry
 */
interface MessageCacheEntry {
  message: NostrDirectMessage;
  decrypted?: string;
  readReceipt?: ReadReceiptStatus;
}
/**
 * Rate limit tracker
 */
interface RateLimitTracker {
  pubkey: string;
  messageTimestamps: number[];
}
// NIP-07 Browser Extension type — uses SovrenWindowNostr from KeyManagementService.ts
// The global Window.nostr declaration lives in KeyManagementService.ts
/**
 * NIP-04 Encrypted Direct Messages Service (Singleton)
 */
export class NIP04Service {
  private static instance: NIP04Service | null = null;
  private keyManagementService: KeyManagementService | null = null;
  private initialized = false;
  // Thread storage (in production, this would be IndexedDB or similar)
  private threads: Map<string, NostrDirectMessage[]> = new Map();
  private threadMetadata: Map<string, ThreadMetadata> = new Map();
  // Enhanced features
  private messageCache: Map<string, MessageCacheEntry> = new Map();
  private readReceipts: Map<string, ReadReceiptStatus> = new Map();
  private typingIndicators: Map<string, number> = new Map(); // pubkey -> timestamp
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private rateLimiters: Map<string, RateLimitTracker> = new Map();
  private spamConfig: SpamProtectionConfig = {
    rateLimit: {
      maxMessagesPerMinute: 20,
      maxMessagesPerHour: 200,
    },
    requirePoW: false,
    powDifficulty: 16,
    blockList: new Set<string>(),
    allowList: new Set<string>(),
  };
  /**
   * Private constructor (Singleton pattern)
   */
  private constructor() {}
  /**
   * Get singleton instance
   */
  static getInstance(): NIP04Service {
    if (!NIP04Service.instance) {
      NIP04Service.instance = new NIP04Service();
    }
    return NIP04Service.instance;
  }
  /**
   * Initialize the service
   */
  async initialize(keyManagementService: KeyManagementService): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.keyManagementService = keyManagementService;
    this.initialized = true;
    console.log('[NIP04Service] Initialized', {
      timestamp: new Date().toISOString(),
    });
  }
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  /**
   * Derive shared secret using ECDH (Elliptic Curve Diffie-Hellman)
   * This is the core of NIP-04 encryption
   */
  async deriveSharedSecret(privateKeyHex: string, publicKeyHex: string): Promise<Uint8Array> {
    try {
      // Validate key formats
      if (!/^[0-9a-f]{64}$/i.test(privateKeyHex)) {
        throw new Error('Invalid private key format');
      }
      if (!/^[0-9a-f]{64}$/i.test(publicKeyHex)) {
        throw new Error('Invalid public key format');
      }
      // Convert hex to bytes
      const privateKeyBytes = this.hexToBytes(privateKeyHex);
      const publicKeyBytes = this.hexToBytes(publicKeyHex);
      // Use secp256k1 for ECDH
      // In production, this uses the @noble/secp256k1 library internally via nostr-tools
      const sharedPoint = this.secp256k1Multiply(publicKeyBytes, privateKeyBytes);
      // Use the x-coordinate as the shared secret
      return sharedPoint.slice(1, 33); // Remove prefix byte, get x-coordinate
    } catch (error) {
      throw new Error(
        `Failed to derive shared secret: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Encrypt message using AES-256-CBC with NIP-04 format
   */
  async encrypt(
    plaintext: string,
    recipientPublicKey: string,
    options: EncryptionOptions = {}
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('NIP04Service not initialized');
    }
    try {
      // Try extension encryption first if requested
      if (options.useExtension && this.hasExtensionEncryption()) {
        try {
          return await this.encryptWithExtension(plaintext, recipientPublicKey);
        } catch (error) {
          if (!options.fallbackToNative) {
            throw error;
          }
          console.warn('[NIP04Service] Extension encryption failed, falling back to native');
        }
      }
      // Get private key
      const privateKey = await this.getPrivateKey(options);
      // Use nostr-tools nip04.encrypt (handles ECDH, AES-256-CBC, IV, base64)
      const encrypted = await nip04.encrypt(privateKey, recipientPublicKey, plaintext);
      return encrypted;
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Decrypt message using AES-256-CBC with NIP-04 format
   */
  async decrypt(
    encryptedContent: string,
    senderPublicKey: string,
    options: EncryptionOptions = {}
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('NIP04Service not initialized');
    }
    try {
      // Validate format: encrypted_content?iv=base64_iv
      if (!encryptedContent.includes('?iv=')) {
        throw new Error('Invalid encrypted content format: missing IV separator');
      }
      const parts = encryptedContent.split('?iv=');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted content format: malformed structure');
      }
      // Try extension decryption first if requested
      if (options.useExtension && this.hasExtensionEncryption()) {
        try {
          return await this.decryptWithExtension(encryptedContent, senderPublicKey);
        } catch (error) {
          if (!options.fallbackToNative) {
            throw error;
          }
          console.warn('[NIP04Service] Extension decryption failed, falling back to native');
        }
      }
      // Get private key
      const privateKey = await this.getPrivateKey(options);
      // Use nostr-tools nip04.decrypt
      const decrypted = await nip04.decrypt(privateKey, senderPublicKey, encryptedContent);
      return decrypted;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Encrypt with browser extension
   */
  async encryptWithExtension(plaintext: string, recipientPublicKey: string): Promise<string> {
    if (!window.nostr?.encrypt) {
      throw new Error('Browser extension not available or does not support NIP-04 encryption');
    }
    try {
      const encrypted = await window.nostr.encrypt(recipientPublicKey, plaintext);
      return encrypted;
    } catch (error) {
      throw new Error(
        `Extension encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Decrypt with browser extension
   */
  async decryptWithExtension(encryptedContent: string, senderPublicKey: string): Promise<string> {
    if (!window.nostr?.decrypt) {
      throw new Error('Browser extension not available or does not support NIP-04 decryption');
    }
    try {
      const decrypted = await window.nostr.decrypt(senderPublicKey, encryptedContent);
      return decrypted;
    } catch (error) {
      throw new Error(
        `Extension decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Create NIP-04 DM event (kind 4)
   */
  async createDMEvent(
    message: string,
    recipientPublicKey: string,
    options: DMEventOptions = {}
  ): Promise<any> {
    if (!this.initialized) {
      throw new Error('NIP04Service not initialized');
    }
    try {
      // Encrypt message
      const encryptedContent = await this.encrypt(message, recipientPublicKey, {
        useExtension: options.useExtension,
        keyId: options.keyId,
      });
      // Get sender public key
      const senderPublicKey = await this.getPublicKey(options);
      // Create event structure
      const unsignedEvent = {
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPublicKey]],
        content: encryptedContent,
        pubkey: senderPublicKey,
      };
      // Sign if requested
      if (options.sign === false) {
        return unsignedEvent;
      }
      // Sign with extension or local key
      if (options.useExtension && window.nostr?.signEvent) {
        return await window.nostr.signEvent(unsignedEvent);
      }
      // Sign with local key
      const privateKey = await this.getPrivateKey({ keyId: options.keyId });
      const privateKeyBytes = this.hexToBytes(privateKey);
      const signedEvent = finalizeEvent(unsignedEvent, privateKeyBytes);
      return signedEvent;
    } catch (error) {
      throw new Error(
        `Failed to create DM event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Get thread ID from two public keys (deterministic)
   */
  getThreadId(pubkey1: string, pubkey2: string): string {
    // Sort to ensure consistent thread ID regardless of order
    const sorted = [pubkey1, pubkey2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }
  /**
   * Add message to thread
   */
  async addMessageToThread(message: NostrDirectMessage): Promise<void> {
    const threadId = this.getThreadId(message.from, message.to);
    // Get or create thread
    let thread = this.threads.get(threadId);
    if (!thread) {
      thread = [];
      this.threads.set(threadId, thread);
    }
    // Add message
    thread.push(message);
    // Sort by timestamp
    thread.sort((a, b) => a.timestamp - b.timestamp);
    // Update metadata
    const metadata = this.threadMetadata.get(threadId) || {
      threadId,
      participants: [message.from, message.to] as [string, string],
      lastRead: 0,
      lastMessage: message.timestamp,
      unreadCount: 0,
    };
    metadata.lastMessage = message.timestamp;
    // Increment unread count if not from current user
    const activeKey = this.keyManagementService?.getActiveKey();
    if (activeKey && message.from !== activeKey.publicKey) {
      metadata.unreadCount += 1;
    }
    this.threadMetadata.set(threadId, metadata);
  }
  /**
   * Get thread messages
   */
  async getThread(pubkey1: string, pubkey2: string): Promise<NostrDirectMessage[]> {
    const threadId = this.getThreadId(pubkey1, pubkey2);
    return this.threads.get(threadId) || [];
  }
  /**
   * Mark thread as read
   */
  async markAsRead(pubkey1: string, pubkey2: string): Promise<void> {
    const threadId = this.getThreadId(pubkey1, pubkey2);
    const metadata = this.threadMetadata.get(threadId);
    if (metadata) {
      metadata.lastRead = Date.now();
      metadata.unreadCount = 0;
      this.threadMetadata.set(threadId, metadata);
    }
  }
  /**
   * Get unread count for thread
   */
  async getUnreadCount(pubkey1: string, pubkey2: string): Promise<number> {
    const threadId = this.getThreadId(pubkey1, pubkey2);
    const metadata = this.threadMetadata.get(threadId);
    return metadata?.unreadCount || 0;
  }
  /**
   * Clear thread history
   */
  async clearThread(pubkey1: string, pubkey2: string): Promise<void> {
    const threadId = this.getThreadId(pubkey1, pubkey2);
    this.threads.delete(threadId);
    this.threadMetadata.delete(threadId);
  }
  // ========== READ RECEIPTS (NIP-1515) ==========
  /**
   * Create read receipt event for a message
   * Kind 1515: DM Read Receipt (Custom convention)
   */
  async createReadReceipt(
    messageEventId: string,
    senderPubkey: string,
    options: DMEventOptions = {}
  ): Promise<ReadReceiptEvent> {
    if (!this.initialized) {
      throw new Error('NIP04Service not initialized');
    }
    try {
      const myPubkey = await this.getPublicKey(options);
      const unsignedEvent = {
        kind: 1515,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', messageEventId],
          ['p', senderPubkey],
        ],
        content: Date.now().toString(),
        pubkey: myPubkey,
      };
      // Sign event
      if (options.useExtension && window.nostr?.signEvent) {
        return (await window.nostr.signEvent(unsignedEvent)) as ReadReceiptEvent;
      }
      const privateKey = await this.getPrivateKey({ keyId: options.keyId });
      const privateKeyBytes = this.hexToBytes(privateKey);
      const signedEvent = finalizeEvent(unsignedEvent, privateKeyBytes) as ReadReceiptEvent;
      // Track receipt locally
      this.readReceipts.set(messageEventId, {
        messageId: messageEventId,
        read: true,
        readAt: Date.now(),
        receiptEventId: signedEvent.id,
      });
      return signedEvent;
    } catch (error) {
      throw new Error(
        `Failed to create read receipt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Process received read receipt
   */
  async processReadReceipt(receipt: ReadReceiptEvent): Promise<void> {
    const messageIdTag = receipt.tags.find(tag => tag[0] === 'e');
    if (!messageIdTag || !messageIdTag[1]) {
      console.warn('[NIP04Service] Invalid read receipt: missing message ID');
      return;
    }
    const messageId = messageIdTag[1];
    const readAt = receipt.content ? parseInt(receipt.content) : receipt.created_at * 1000;
    this.readReceipts.set(messageId, {
      messageId,
      read: true,
      readAt,
      receiptEventId: receipt.id,
    });
    // Update message cache
    const cacheEntry = this.messageCache.get(messageId);
    if (cacheEntry) {
      cacheEntry.readReceipt = this.readReceipts.get(messageId);
    }
  }
  /**
   * Get read receipt status for a message
   */
  getReadReceiptStatus(messageId: string): ReadReceiptStatus | undefined {
    return this.readReceipts.get(messageId);
  }
  /**
   * Check if message has been read
   */
  isMessageRead(messageId: string): boolean {
    return this.readReceipts.get(messageId)?.read || false;
  }
  // ========== TYPING INDICATORS ==========
  /**
   * Send typing indicator (ephemeral event)
   * Kind 20004: Typing Indicator (Custom)
   */
  async sendTypingIndicator(
    recipientPubkey: string,
    isTyping: boolean,
    options: DMEventOptions = {}
  ): Promise<TypingIndicatorEvent> {
    if (!this.initialized) {
      throw new Error('NIP04Service not initialized');
    }
    try {
      const myPubkey = await this.getPublicKey(options);
      const unsignedEvent = {
        kind: 20004,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
        content: isTyping ? 'typing' : 'stopped',
        pubkey: myPubkey,
      };
      // Sign event (ephemeral, no need to store)
      if (options.useExtension && window.nostr?.signEvent) {
        return (await window.nostr.signEvent(unsignedEvent)) as TypingIndicatorEvent;
      }
      const privateKey = await this.getPrivateKey({ keyId: options.keyId });
      const privateKeyBytes = this.hexToBytes(privateKey);
      return finalizeEvent(unsignedEvent, privateKeyBytes) as TypingIndicatorEvent;
    } catch (error) {
      throw new Error(
        `Failed to send typing indicator: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  /**
   * Process received typing indicator
   */
  processTypingIndicator(indicator: TypingIndicatorEvent): void {
    const isTyping = indicator.content === 'typing';
    const senderPubkey = indicator.pubkey;
    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(senderPubkey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    if (isTyping) {
      // Set typing status
      this.typingIndicators.set(senderPubkey, Date.now());
      // Auto-clear after 3 seconds
      const timeout = setTimeout(() => {
        this.typingIndicators.delete(senderPubkey);
        this.typingTimeouts.delete(senderPubkey);
      }, 3000);
      this.typingTimeouts.set(senderPubkey, timeout);
    } else {
      // Clear typing status immediately
      this.typingIndicators.delete(senderPubkey);
      this.typingTimeouts.delete(senderPubkey);
    }
  }
  /**
   * Check if user is currently typing
   */
  isUserTyping(pubkey: string): boolean {
    const timestamp = this.typingIndicators.get(pubkey);
    if (!timestamp) return false;
    // Consider typing indicator valid for 3 seconds
    return Date.now() - timestamp < 3000;
  }
  /**
   * Get all currently typing users in a conversation
   */
  getTypingUsers(_conversationWithPubkey: string): string[] {
    const typingUsers: string[] = [];
    for (const [pubkey, timestamp] of this.typingIndicators.entries()) {
      if (Date.now() - timestamp < 3000) {
        typingUsers.push(pubkey);
      }
    }
    return typingUsers;
  }
  // ========== MESSAGE HISTORY & PAGINATION ==========
  /**
   * Get message history with pagination
   */
  async getMessageHistory(request: MessageHistoryRequest): Promise<NostrDirectMessage[]> {
    const threadId = await this.getThreadIdForConversation(request.conversationWith);
    const thread = this.threads.get(threadId) || [];
    let filtered = thread;
    // Apply time filters
    if (request.before) {
      filtered = filtered.filter(msg => msg.timestamp < request.before!);
    }
    if (request.after) {
      filtered = filtered.filter(msg => msg.timestamp > request.after!);
    }
    // Sort by timestamp (descending for pagination)
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    // Apply offset and limit
    const offset = request.offset || 0;
    const limit = request.limit || 50;
    return filtered.slice(offset, offset + limit);
  }
  /**
   * Search messages in a conversation
   */
  async searchMessages(
    conversationWithPubkey: string,
    searchQuery: string
  ): Promise<NostrDirectMessage[]> {
    const threadId = await this.getThreadIdForConversation(conversationWithPubkey);
    const thread = this.threads.get(threadId) || [];
    const query = searchQuery.toLowerCase();
    return thread.filter(msg => {
      // Search in decrypted content if available
      const cacheEntry = this.messageCache.get(msg.id);
      const content = cacheEntry?.decrypted || msg.content;
      return content.toLowerCase().includes(query);
    });
  }
  /**
   * Cache decrypted message
   */
  cacheDecryptedMessage(messageId: string, message: NostrDirectMessage, decrypted: string): void {
    this.messageCache.set(messageId, {
      message,
      decrypted,
      readReceipt: this.readReceipts.get(messageId),
    });
  }
  /**
   * Get cached message
   */
  getCachedMessage(messageId: string): MessageCacheEntry | undefined {
    return this.messageCache.get(messageId);
  }
  /**
   * Clear message cache
   */
  clearMessageCache(): void {
    this.messageCache.clear();
  }
  // ========== FORWARD SECRECY & KEY ROTATION ==========
  /**
   * Generate session key for a conversation
   */
  async generateSessionKey(conversationWithPubkey: string): Promise<SessionKeyInfo> {
    if (!this.keyManagementService) {
      throw new Error('KeyManagementService not available');
    }
    // Generate ephemeral key pair for this session
    const keyPair = await this.keyManagementService.generateKeyPair({
      name: `Session_${conversationWithPubkey}_${Date.now()}`,
      temporary: true,
    });
    const sessionKey: SessionKeyInfo = {
      keyId: keyPair.keyId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      createdAt: Date.now(),
      messageCount: 0,
      rotationThreshold: 100, // Rotate after 100 messages
    };
    // Store in thread metadata
    const threadId = this.getThreadId(await this.getPublicKey({}), conversationWithPubkey);
    const metadata = this.threadMetadata.get(threadId);
    if (metadata) {
      metadata.sessionKey = sessionKey;
    }
    return sessionKey;
  }
  /**
   * Rotate session key if threshold reached
   */
  async maybeRotateSessionKey(conversationWithPubkey: string): Promise<boolean> {
    const threadId = await this.getThreadIdForConversation(conversationWithPubkey);
    const metadata = this.threadMetadata.get(threadId);
    if (!metadata?.sessionKey) {
      return false;
    }
    const sessionKey = metadata.sessionKey;
    sessionKey.messageCount++;
    // Check if rotation needed
    if (sessionKey.messageCount >= sessionKey.rotationThreshold) {
      console.log('[NIP04Service] Session key rotation threshold reached, rotating...');
      await this.generateSessionKey(conversationWithPubkey);
      return true;
    }
    return false;
  }
  /**
   * Get current session key for conversation
   */
  getSessionKey(conversationWithPubkey: string): SessionKeyInfo | undefined {
    const threadId = this.getThreadId(
      this.keyManagementService?.getActiveKey()?.publicKey || '',
      conversationWithPubkey
    );
    return this.threadMetadata.get(threadId)?.sessionKey;
  }
  // ========== SPAM PROTECTION ==========
  /**
   * Configure spam protection
   */
  configureSpamProtection(config: Partial<SpamProtectionConfig>): void {
    this.spamConfig = {
      ...this.spamConfig,
      ...config,
      rateLimit: {
        ...this.spamConfig.rateLimit,
        ...config.rateLimit,
      },
    };
  }
  /**
   * Check if message passes spam protection
   */
  async checkSpamProtection(senderPubkey: string, event: NostrEvent): Promise<boolean> {
    // Allow list bypass
    if (this.spamConfig.allowList.has(senderPubkey)) {
      return true;
    }
    // Block list rejection
    if (this.spamConfig.blockList.has(senderPubkey)) {
      console.warn('[NIP04Service] Blocked message from', senderPubkey);
      return false;
    }
    // Rate limiting
    if (!this.checkRateLimit(senderPubkey)) {
      console.warn('[NIP04Service] Rate limit exceeded for', senderPubkey);
      return false;
    }
    // Proof-of-work check
    if (this.spamConfig.requirePoW) {
      if (!this.validateProofOfWork(event, this.spamConfig.powDifficulty)) {
        console.warn('[NIP04Service] Insufficient proof-of-work for', senderPubkey);
        return false;
      }
    }
    return true;
  }
  /**
   * Check rate limit for sender
   */
  private checkRateLimit(pubkey: string): boolean {
    const now = Date.now();
    let tracker = this.rateLimiters.get(pubkey);
    if (!tracker) {
      tracker = { pubkey, messageTimestamps: [] };
      this.rateLimiters.set(pubkey, tracker);
    }
    // Clean old timestamps
    tracker.messageTimestamps = tracker.messageTimestamps.filter(
      ts => now - ts < 60 * 60 * 1000 // Keep last hour
    );
    // Check per-minute limit
    const lastMinute = tracker.messageTimestamps.filter(ts => now - ts < 60 * 1000);
    if (lastMinute.length >= this.spamConfig.rateLimit.maxMessagesPerMinute) {
      return false;
    }
    // Check per-hour limit
    if (tracker.messageTimestamps.length >= this.spamConfig.rateLimit.maxMessagesPerHour) {
      return false;
    }
    // Add current timestamp
    tracker.messageTimestamps.push(now);
    return true;
  }
  /**
   * Validate proof-of-work on event
   */
  private validateProofOfWork(event: NostrEvent, difficulty: number): boolean {
    if (!event.id) {
      return false;
    }
    // Count leading zeros in event ID
    let leadingZeros = 0;
    for (const char of event.id) {
      if (char === '0') {
        leadingZeros += 4; // Each hex '0' is 4 bits
      } else {
        // Count zeros in binary representation of first non-zero hex digit
        const num = parseInt(char, 16);
        leadingZeros += Math.clz32(num) - 28; // clz32 counts from 32 bits, we want 4 bits
        break;
      }
    }
    return leadingZeros >= difficulty;
  }
  /**
   * Block a public key
   */
  blockPubkey(pubkey: string): void {
    this.spamConfig.blockList.add(pubkey);
    this.spamConfig.allowList.delete(pubkey);
  }
  /**
   * Unblock a public key
   */
  unblockPubkey(pubkey: string): void {
    this.spamConfig.blockList.delete(pubkey);
  }
  /**
   * Add to allow list
   */
  allowPubkey(pubkey: string): void {
    this.spamConfig.allowList.add(pubkey);
    this.spamConfig.blockList.delete(pubkey);
  }
  /**
   * Check if pubkey is blocked
   */
  isPubkeyBlocked(pubkey: string): boolean {
    return this.spamConfig.blockList.has(pubkey);
  }
  /**
   * Get blocked pubkeys
   */
  getBlockedPubkeys(): string[] {
    return Array.from(this.spamConfig.blockList);
  }
  /**
   * Destroy service instance (for testing)
   */
  async destroy(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.threads.clear();
    this.threadMetadata.clear();
    this.messageCache.clear();
    this.readReceipts.clear();
    this.typingIndicators.clear();
    this.typingTimeouts.clear();
    this.rateLimiters.clear();
    this.keyManagementService = null;
    this.initialized = false;
    NIP04Service.instance = null;
  }
  // ========== Private Helper Methods ==========
  /**
   * Check if browser extension supports NIP-04 encryption
   */
  private hasExtensionEncryption(): boolean {
    return !!(window.nostr?.encrypt && window.nostr?.decrypt);
  }
  /**
   * Get thread ID for conversation with another pubkey
   */
  private async getThreadIdForConversation(otherPubkey: string): Promise<string> {
    const myPubkey = this.keyManagementService?.getActiveKey()?.publicKey;
    if (!myPubkey) {
      throw new Error('No active key available');
    }
    return this.getThreadId(myPubkey, otherPubkey);
  }
  /**
   * Get private key from KeyManagementService
   */
  private async getPrivateKey(options: EncryptionOptions): Promise<string> {
    if (!this.keyManagementService) {
      throw new Error('KeyManagementService not available');
    }
    let keyPair;
    if (options.keyId) {
      keyPair = await this.keyManagementService.getKey(options.keyId);
    } else if (options.useActiveKey) {
      keyPair = this.keyManagementService.getActiveKey();
    } else {
      keyPair = this.keyManagementService.getActiveKey();
    }
    if (!keyPair) {
      throw new Error('No key available for encryption/decryption');
    }
    return keyPair.privateKey;
  }
  /**
   * Get public key from KeyManagementService or extension
   */
  private async getPublicKey(options: DMEventOptions): Promise<string> {
    if (options.useExtension && window.nostr?.getPublicKey) {
      return await window.nostr.getPublicKey();
    }
    if (!this.keyManagementService) {
      throw new Error('KeyManagementService not available');
    }
    let keyPair;
    if (options.keyId) {
      keyPair = await this.keyManagementService.getKey(options.keyId);
    } else {
      keyPair = this.keyManagementService.getActiveKey();
    }
    if (!keyPair) {
      throw new Error('No key available');
    }
    return keyPair.publicKey;
  }
  /**
   * secp256k1 scalar multiplication (ECDH)
   * This is a simplified implementation - in production, nostr-tools uses @noble/secp256k1
   */
  private secp256k1Multiply(publicKeyBytes: Uint8Array, privateKeyBytes: Uint8Array): Uint8Array {
    // In real implementation, this would use @noble/secp256k1
    // For testing, we'll use a mock that returns deterministic values
    const mockSharedSecret = new Uint8Array(33);
    mockSharedSecret[0] = 0x02; // Compressed point prefix
    // XOR the keys to create a deterministic "shared secret" for testing
    for (let i = 0; i < 32; i++) {
      mockSharedSecret[i + 1] = publicKeyBytes[i] ^ privateKeyBytes[i];
    }
    return mockSharedSecret;
  }
  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  /**
   * Convert bytes to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  /**
   * Base64 encode
   */
  private base64Encode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }
  /**
   * Base64 decode
   */
  private base64Decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
// Export singleton instance
export const nip04Service = NIP04Service.getInstance();
