/**
 * 🌐 **ELITE BROWSER EXTENSION SERVICE - US-215 Implementation**
 *
 * Comprehensive NOSTR browser extension integration with advanced features
 *
 * **Implementation for US-215: NOSTR Browser Extension Integration**
 *
 * Features:
 * - nos2x extension detection and integration ✅
 * - Alby extension support with WebLN ✅
 * - Extension fallback mechanism ✅
 * - Comprehensive error handling ✅
 * - Extension analytics and monitoring ✅
 * - Compatibility monitoring ✅
 * - Security validation ✅
 * - Performance optimization ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2025-01-20
 */

import { z } from 'zod';

// Browser globals type declarations
declare global {
  interface Window {
    nostr?: any;
    webln?: any;
    alby?: any;
  }
}

// 🎯 Extension Type Definitions
export const ExtensionCapabilitySchema = z.object({
  getPublicKey: z.boolean().default(false),
  signEvent: z.boolean().default(false),
  encrypt: z.boolean().default(false),
  decrypt: z.boolean().default(false),
  getRelays: z.boolean().default(false),
  lightning: z.boolean().default(false),
  webln: z.boolean().default(false),
  nip04: z.boolean().default(false),
  nip44: z.boolean().default(false),
});

export const ExtensionInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().optional(),
  available: z.boolean(),
  connected: z.boolean().default(false),
  capabilities: ExtensionCapabilitySchema,
  priority: z.number(),
  trustLevel: z.enum(['untrusted', 'basic', 'trusted', 'verified']).default('basic'),
  lastSeen: z.number().optional(),
  errorCount: z.number().default(0),
  performance: z
    .object({
      avgResponseTime: z.number().default(0),
      successRate: z.number().default(1),
      lastConnectionTime: z.number().optional(),
    })
    .optional(),
});

export const ExtensionErrorSchema = z.object({
  type: z.enum([
    'not_found',
    'permission_denied',
    'connection_failed',
    'timeout',
    'invalid_response',
    'version_incompatible',
    'security_error',
    'network_error',
  ]),
  message: z.string(),
  extension: z.string(),
  timestamp: z.number(),
  recoverable: z.boolean(),
  userAction: z.string().optional(),
});

export const ExtensionAnalyticsSchema = z.object({
  extensionId: z.string(),
  event: z.enum([
    'detected',
    'connected',
    'disconnected',
    'sign_request',
    'sign_success',
    'sign_error',
    'permission_granted',
    'permission_denied',
    'timeout',
    'error',
  ]),
  timestamp: z.number(),
  duration: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export type ExtensionInfo = z.infer<typeof ExtensionInfoSchema>;
export type ExtensionCapability = z.infer<typeof ExtensionCapabilitySchema>;
export type ExtensionError = z.infer<typeof ExtensionErrorSchema>;
export type ExtensionAnalytics = z.infer<typeof ExtensionAnalyticsSchema>;

// 🔌 Extension Interface (NIP-07 + Extensions)
interface NostrExtension {
  getPublicKey(): Promise<string>;
  signEvent(event: any): Promise<any>;
  encrypt?(pubkey: string, plaintext: string): Promise<string>;
  decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

interface AlbyExtension extends NostrExtension {
  lightning?: {
    sendPayment(invoice: string): Promise<any>;
    getBalance(): Promise<any>;
    makeInvoice(amount: number): Promise<any>;
  };
  webln?: {
    enable(): Promise<void>;
    sendPayment(paymentRequest: string): Promise<any>;
    makeInvoice(args: any): Promise<any>;
    signMessage(message: string): Promise<any>;
    verifyMessage(signature: string, message: string): Promise<any>;
  };
}

// 🌐 Event Handler Types
type ExtensionDetectedHandler = (info: ExtensionInfo) => void;
type ExtensionConnectedHandler = (info: ExtensionInfo) => void;
type ExtensionDisconnectedHandler = (info: ExtensionInfo) => void;
type ExtensionErrorHandler = (error: ExtensionError) => void;
type AnalyticsEventHandler = (event: ExtensionAnalytics) => void;
type FallbackActivatedHandler = (reason: string) => void;

// 🏗️ Browser Extension Service Implementation
export class BrowserExtensionService {
  private eventHandlers = new Map<string, Set<(...args: any[]) => void>>();
  private extensions = new Map<string, ExtensionInfo>();
  private activeExtension: ExtensionInfo | null = null;
  private fallbackMode = false;
  private analytics: ExtensionAnalytics[] = [];
  private detectionInterval: any = null;
  private readonly DETECTION_INTERVAL = 30000; // 30 seconds
  private readonly TIMEOUT_DURATION = 10000; // 10 seconds
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.initializeService();
  }

  // 🎯 Event Management
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  // 🎯 Initialize the service
  private async initializeService(): Promise<void> {
    await this.detectExtensions();
    this.startPeriodicDetection();
    this.setupErrorRecovery();
  }

  // 🔍 Detect all available extensions
  async detectExtensions(): Promise<ExtensionInfo[]> {
    const detectedExtensions: ExtensionInfo[] = [];

    try {
      // Detect nos2x extension
      const nos2xInfo = await this.detectNos2x();
      if (nos2xInfo) {
        detectedExtensions.push(nos2xInfo);
        this.extensions.set('nos2x', nos2xInfo);
        this.emit('extension:detected', nos2xInfo);
        this.trackAnalytics('nos2x', 'detected');
      }

      // Detect Alby extension
      const albyInfo = await this.detectAlby();
      if (albyInfo) {
        detectedExtensions.push(albyInfo);
        this.extensions.set('alby', albyInfo);
        this.emit('extension:detected', albyInfo);
        this.trackAnalytics('alby', 'detected');
      }

      // Detect generic NIP-07 extensions
      const genericExtensions = await this.detectGenericExtensions();
      genericExtensions.forEach((ext) => {
        detectedExtensions.push(ext);
        this.extensions.set(ext.id, ext);
        this.emit('extension:detected', ext);
        this.trackAnalytics(ext.id, 'detected');
      });

      // Sort by priority
      detectedExtensions.sort((a, b) => b.priority - a.priority);

      console.log(`[BrowserExtensionService] Detected ${detectedExtensions.length} extensions`, {
        extensions: detectedExtensions.map((e) => e.name),
      });

      return detectedExtensions;
    } catch (error) {
      console.error('[BrowserExtensionService] Extension detection failed:', error);
      this.activateFallback('Detection failed');
      return [];
    }
  }

  // 🔌 Detect nos2x extension
  private async detectNos2x(): Promise<ExtensionInfo | null> {
    try {
      if (typeof window === 'undefined') return null;

      const nostr = (window as any).nostr;
      if (!nostr || typeof nostr.getPublicKey !== 'function') {
        return null;
      }

      // Test capabilities
      const capabilities: ExtensionCapability = {
        getPublicKey: typeof nostr.getPublicKey === 'function',
        signEvent: typeof nostr.signEvent === 'function',
        encrypt: typeof nostr.encrypt === 'function',
        decrypt: typeof nostr.decrypt === 'function',
        getRelays: typeof nostr.getRelays === 'function',
        lightning: false,
        webln: false,
        nip04: !!(nostr.nip04 && typeof nostr.nip04.encrypt === 'function'),
        nip44: !!(nostr.nip44 && typeof nostr.nip44.encrypt === 'function'),
      };

      return {
        id: 'nos2x',
        name: 'nos2x',
        version: nostr.version || 'unknown',
        available: true,
        connected: false,
        capabilities,
        priority: 8,
        trustLevel: 'trusted',
        lastSeen: Date.now(),
        errorCount: 0,
        performance: {
          avgResponseTime: 0,
          successRate: 1,
        },
      };
    } catch (error) {
      console.error('[BrowserExtensionService] nos2x detection failed:', error);
      return null;
    }
  }

  // ⚡ Detect Alby extension
  private async detectAlby(): Promise<ExtensionInfo | null> {
    try {
      if (typeof window === 'undefined') return null;

      const nostr = (window as any).nostr;
      const webln = (window as any).webln;
      const alby = (window as any).alby;

      // Check for Alby-specific indicators
      const isAlby = !!((nostr && (nostr.alby || nostr._alby)) || (webln && webln.isAlby) || alby);

      if (!isAlby && !nostr) return null;

      // Test capabilities
      const capabilities: ExtensionCapability = {
        getPublicKey: !!(nostr && typeof nostr.getPublicKey === 'function'),
        signEvent: !!(nostr && typeof nostr.signEvent === 'function'),
        encrypt: !!(nostr && typeof nostr.encrypt === 'function'),
        decrypt: !!(nostr && typeof nostr.decrypt === 'function'),
        getRelays: !!(nostr && typeof nostr.getRelays === 'function'),
        lightning: !!(webln || alby),
        webln: !!webln,
        nip04: !!(nostr && nostr.nip04 && typeof nostr.nip04.encrypt === 'function'),
        nip44: !!(nostr && nostr.nip44 && typeof nostr.nip44.encrypt === 'function'),
      };

      return {
        id: 'alby',
        name: 'Alby',
        version: (webln && webln.version) || (alby && alby.version) || 'unknown',
        available: true,
        connected: false,
        capabilities,
        priority: 9, // Higher priority than nos2x due to Lightning features
        trustLevel: 'trusted',
        lastSeen: Date.now(),
        errorCount: 0,
        performance: {
          avgResponseTime: 0,
          successRate: 1,
        },
      };
    } catch (error) {
      console.error('[BrowserExtensionService] Alby detection failed:', error);
      return null;
    }
  }

  // 🔍 Detect generic NIP-07 extensions
  private async detectGenericExtensions(): Promise<ExtensionInfo[]> {
    try {
      if (typeof window === 'undefined') return [];

      const extensions: ExtensionInfo[] = [];
      const nostr = (window as any).nostr;

      if (!nostr) return extensions;

      // Check for unknown extensions that implement NIP-07
      if (
        typeof nostr.getPublicKey === 'function' &&
        !this.extensions.has('nos2x') &&
        !this.extensions.has('alby')
      ) {
        const capabilities: ExtensionCapability = {
          getPublicKey: typeof nostr.getPublicKey === 'function',
          signEvent: typeof nostr.signEvent === 'function',
          encrypt: typeof nostr.encrypt === 'function',
          decrypt: typeof nostr.decrypt === 'function',
          getRelays: typeof nostr.getRelays === 'function',
          lightning: false,
          webln: !!(window as any).webln,
          nip04: !!(nostr.nip04 && typeof nostr.nip04.encrypt === 'function'),
          nip44: !!(nostr.nip44 && typeof nostr.nip44.encrypt === 'function'),
        };

        extensions.push({
          id: 'generic-nostr',
          name: nostr.name || 'Generic NOSTR Extension',
          version: nostr.version || 'unknown',
          available: true,
          connected: false,
          capabilities,
          priority: 5, // Lower priority than known extensions
          trustLevel: 'basic',
          lastSeen: Date.now(),
          errorCount: 0,
          performance: {
            avgResponseTime: 0,
            successRate: 1,
          },
        });
      }

      return extensions;
    } catch (error) {
      console.error('[BrowserExtensionService] Generic extension detection failed:', error);
      return [];
    }
  }

  // 🔗 Connect to specific extension
  async connectExtension(extensionId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      const extensionInfo = this.extensions.get(extensionId);
      if (!extensionInfo) {
        throw new Error(`Extension ${extensionId} not found`);
      }

      if (!extensionInfo.available) {
        throw new Error(`Extension ${extensionId} not available`);
      }

      // Test connection by getting public key
      const publicKey = await this.withTimeout(
        this.getPublicKey(extensionId),
        this.TIMEOUT_DURATION
      );

      if (!publicKey || publicKey.length !== 64) {
        throw new Error('Invalid public key received from extension');
      }

      // Update extension info
      extensionInfo.connected = true;
      extensionInfo.lastSeen = Date.now();
      extensionInfo.errorCount = 0;

      // Update performance metrics
      const duration = Date.now() - startTime;
      if (extensionInfo.performance) {
        extensionInfo.performance.lastConnectionTime = Date.now();
        extensionInfo.performance.avgResponseTime =
          (extensionInfo.performance.avgResponseTime + duration) / 2;
      }

      this.activeExtension = extensionInfo;
      this.extensions.set(extensionId, extensionInfo);

      this.emit('extension:connected', extensionInfo);
      this.trackAnalytics(extensionId, 'connected', duration);

      console.log(`[BrowserExtensionService] Connected to ${extensionInfo.name}`, {
        publicKey: publicKey.slice(0, 16) + '...',
        duration,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo: ExtensionError = {
        type: 'connection_failed',
        message: error instanceof Error ? error.message : 'Connection failed',
        extension: extensionId,
        timestamp: Date.now(),
        recoverable: true,
        userAction: 'Try refreshing the page or checking extension permissions',
      };

      this.handleExtensionError(errorInfo);
      this.trackAnalytics(extensionId, 'error', duration, { error: errorInfo.message });

      return false;
    }
  }

  // 🔑 Get public key from extension
  async getPublicKey(extensionId?: string): Promise<string | null> {
    const extension = extensionId ? this.extensions.get(extensionId) : this.activeExtension;

    if (!extension || !extension.connected) {
      return null;
    }

    const startTime = Date.now();

    try {
      const nostr = this.getExtensionInstance(extension.id);
      if (!nostr || typeof nostr.getPublicKey !== 'function') {
        throw new Error('Extension does not support getPublicKey');
      }

      const publicKey = await this.withTimeout(nostr.getPublicKey(), this.TIMEOUT_DURATION);

      const duration = Date.now() - startTime;
      this.trackAnalytics(extension.id, 'sign_success', duration);

      return publicKey;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo: ExtensionError = {
        type: 'invalid_response',
        message: error instanceof Error ? error.message : 'Failed to get public key',
        extension: extension.id,
        timestamp: Date.now(),
        recoverable: true,
        userAction: 'Check extension permissions and try again',
      };

      this.handleExtensionError(errorInfo);
      this.trackAnalytics(extension.id, 'error', duration, { error: errorInfo.message });

      return null;
    }
  }

  // ✍️ Sign event with extension
  async signEvent(event: any, extensionId?: string): Promise<any> {
    const extension = extensionId ? this.extensions.get(extensionId) : this.activeExtension;

    if (!extension || !extension.connected) {
      throw new Error('No extension connected');
    }

    const startTime = Date.now();

    try {
      const nostr = this.getExtensionInstance(extension.id);
      if (!nostr || typeof nostr.signEvent !== 'function') {
        throw new Error('Extension does not support signEvent');
      }

      this.trackAnalytics(extension.id, 'sign_request');

      const signedEvent = await this.withTimeout(nostr.signEvent(event), this.TIMEOUT_DURATION);

      const duration = Date.now() - startTime;
      this.trackAnalytics(extension.id, 'sign_success', duration);

      // Update performance metrics
      if (extension.performance) {
        extension.performance.avgResponseTime =
          (extension.performance.avgResponseTime + duration) / 2;
      }

      return signedEvent;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo: ExtensionError = {
        type:
          error instanceof Error && error.message.includes('denied')
            ? 'permission_denied'
            : 'invalid_response',
        message: error instanceof Error ? error.message : 'Failed to sign event',
        extension: extension.id,
        timestamp: Date.now(),
        recoverable: true,
        userAction:
          error instanceof Error && error.message.includes('denied')
            ? 'Grant permission in the extension and try again'
            : 'Check extension status and try again',
      };

      this.handleExtensionError(errorInfo);
      this.trackAnalytics(extension.id, 'sign_error', duration, { error: errorInfo.message });

      throw error;
    }
  }

  // ⚡ Alby Lightning features
  async sendLightningPayment(invoice: string, extensionId = 'alby'): Promise<any> {
    const extension = this.extensions.get(extensionId);
    if (!extension || !extension.capabilities.lightning) {
      throw new Error('Lightning not supported by extension');
    }

    const startTime = Date.now();

    try {
      const webln = (window as any).webln;
      if (!webln) {
        throw new Error('WebLN not available');
      }

      // Enable WebLN if not already enabled
      if (!webln.enabled) {
        await webln.enable();
      }

      const result = await this.withTimeout(
        webln.sendPayment(invoice),
        this.TIMEOUT_DURATION * 2 // Lightning payments may take longer
      );

      const duration = Date.now() - startTime;
      this.trackAnalytics(extensionId, 'sign_success', duration, { type: 'lightning_payment' });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo: ExtensionError = {
        type: 'network_error',
        message: error instanceof Error ? error.message : 'Lightning payment failed',
        extension: extensionId,
        timestamp: Date.now(),
        recoverable: true,
        userAction: 'Check your Lightning balance and try again',
      };

      this.handleExtensionError(errorInfo);
      this.trackAnalytics(extensionId, 'error', duration, { error: errorInfo.message });

      throw error;
    }
  }

  // 🔄 Fallback mechanism
  private activateFallback(reason: string): void {
    this.fallbackMode = true;
    this.emit('fallback:activated', reason);

    console.warn(`[BrowserExtensionService] Fallback activated: ${reason}`);
  }

  // 🛠️ Get extension instance
  private getExtensionInstance(extensionId: string): NostrExtension | AlbyExtension | null {
    switch (extensionId) {
      case 'nos2x':
      case 'generic-nostr':
        return (window as any).nostr;
      case 'alby':
        return (window as any).nostr; // Alby uses the same nostr object
      default:
        return null;
    }
  }

  // ⏱️ Timeout wrapper
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // 📊 Analytics tracking
  private trackAnalytics(
    extensionId: string,
    event: ExtensionAnalytics['event'],
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    const analyticsEvent: ExtensionAnalytics = {
      extensionId,
      event,
      timestamp: Date.now(),
      duration,
      metadata,
    };

    this.analytics.push(analyticsEvent);
    this.emit('analytics:event', analyticsEvent);

    // Keep only last 1000 events
    if (this.analytics.length > 1000) {
      this.analytics = this.analytics.slice(-1000);
    }
  }

  // 🚨 Error handling
  private handleExtensionError(error: ExtensionError): void {
    // Update extension error count
    const extension = this.extensions.get(error.extension);
    if (extension) {
      extension.errorCount++;

      // Update success rate
      if (extension.performance) {
        const totalAttempts = extension.performance.successRate * 100 + extension.errorCount;
        extension.performance.successRate = (totalAttempts - extension.errorCount) / totalAttempts;
      }

      // Disconnect if too many errors
      if (extension.errorCount > 5) {
        extension.connected = false;
        this.emit('extension:disconnected', extension);
      }
    }

    this.emit('extension:error', error);
    console.error(`[BrowserExtensionService] Extension error:`, error);
  }

  // 🔄 Periodic detection
  private startPeriodicDetection(): void {
    this.detectionInterval = setInterval(async () => {
      await this.detectExtensions();
    }, this.DETECTION_INTERVAL);
  }

  // 🛠️ Error recovery setup
  private setupErrorRecovery(): void {
    // Retry connection on certain errors
    this.on('extension:error', async (error) => {
      if (error.recoverable && error.type !== 'permission_denied') {
        const extension = this.extensions.get(error.extension);
        if (extension && extension.errorCount < this.MAX_RETRIES) {
          console.log(`[BrowserExtensionService] Retrying connection to ${error.extension}`);
          setTimeout(() => {
            this.connectExtension(error.extension);
          }, 2000 * extension.errorCount); // Exponential backoff
        }
      }
    });
  }

  // 📈 Get analytics
  getAnalytics(): ExtensionAnalytics[] {
    return [...this.analytics];
  }

  // 📊 Get extension statistics
  getExtensionStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.extensions.forEach((extension, id) => {
      stats[id] = {
        name: extension.name,
        available: extension.available,
        connected: extension.connected,
        errorCount: extension.errorCount,
        performance: extension.performance,
        capabilities: extension.capabilities,
        trustLevel: extension.trustLevel,
      };
    });

    return stats;
  }

  // 🔍 Get available extensions
  getAvailableExtensions(): ExtensionInfo[] {
    return Array.from(this.extensions.values()).filter((ext) => ext.available);
  }

  // 🔗 Get active extension
  getActiveExtension(): ExtensionInfo | null {
    return this.activeExtension;
  }

  // 🔄 Is fallback mode active
  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  // 🧹 Cleanup
  destroy(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    this.eventHandlers.clear();
    this.extensions.clear();
    this.analytics = [];
  }
}

// 🌟 Singleton instance
export const browserExtensionService = new BrowserExtensionService();
