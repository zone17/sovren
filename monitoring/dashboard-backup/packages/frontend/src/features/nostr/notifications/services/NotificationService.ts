/**
 * NotificationService - Core service for managing NOSTR notifications
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import type { Event as NostrEvent, Filter } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import {
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationFilter,
  NotificationStats,
  NotificationServiceState,
  DesktopNotificationOptions,
  NotificationStorageSchema,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../types';

/**
 * IndexedDB configuration
 */
const DB_NAME = 'sovren-notifications';
const DB_VERSION = 1;
const STORE_NAME = 'notifications';
const PREFERENCES_KEY = 'notification-preferences';

/**
 * Notification retention period (30 days)
 */
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * NotificationService class
 * Handles notification subscription, storage, and management
 */
export class NotificationService {
  private db: IDBDatabase | null = null;
  private preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
  private listeners: Set<(state: NotificationServiceState) => void> = new Set();
  private state: NotificationServiceState = {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    lastFetchedAt: null,
    subscribed: false,
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      await this.openDatabase();
      await this.loadPreferences();
      await this.loadNotifications();
      await this.cleanupOldNotifications();
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
      this.updateState({ error: error as Error });
    }
  }

  /**
   * Open IndexedDB connection
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('read', 'read', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('authorPubkey', 'authorPubkey', { unique: false });
          store.createIndex('type_read', ['type', 'read'], { unique: false });
        }
      };
    });
  }

  /**
   * Load user preferences from localStorage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        this.preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }

  /**
   * Save user preferences to localStorage
   */
  private async savePreferences(): Promise<void> {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  /**
   * Load notifications from IndexedDB
   */
  private async loadNotifications(): Promise<void> {
    if (!this.db) return;

    this.updateState({ loading: true });

    try {
      const notifications = await this.queryNotifications({
        limit: 1000,
      });

      const unreadCount = notifications.filter((n) => !n.read).length;

      this.updateState({
        notifications,
        unreadCount,
        loading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      this.updateState({ error: error as Error, loading: false });
    }
  }

  /**
   * Query notifications from IndexedDB
   */
  private async queryNotifications(filter: NotificationFilter = {}): Promise<Notification[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Newest first

      const notifications: Notification[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && (!filter.limit || notifications.length < filter.limit)) {
          const stored: NotificationStorageSchema = cursor.value;

          // Apply filters
          if (filter.types && !filter.types.includes(stored.type)) {
            cursor.continue();
            return;
          }
          if (filter.read !== undefined && stored.read !== filter.read) {
            cursor.continue();
            return;
          }
          if (filter.startDate && stored.createdAt < filter.startDate) {
            cursor.continue();
            return;
          }
          if (filter.endDate && stored.createdAt > filter.endDate) {
            cursor.continue();
            return;
          }
          if (filter.authorPubkey && stored.authorPubkey !== filter.authorPubkey) {
            cursor.continue();
            return;
          }

          // Convert storage schema to notification
          const notification: Notification = {
            id: stored.id,
            type: stored.type,
            event: JSON.parse(stored.eventJson),
            author: {
              pubkey: stored.authorPubkey,
            },
            content: stored.content,
            createdAt: stored.createdAt,
            read: stored.read,
            url: stored.url,
            metadata: stored.metadataJson ? JSON.parse(stored.metadataJson) : undefined,
          };

          notifications.push(notification);
          cursor.continue();
        } else {
          resolve(notifications);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add a notification to the database
   */
  public async addNotification(notification: Notification): Promise<void> {
    if (!this.db) return;

    // Check if notification type is enabled
    if (!this.isNotificationTypeEnabled(notification.type)) {
      return;
    }

    // Check for duplicates
    const exists = await this.notificationExists(notification.id);
    if (exists) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const stored: NotificationStorageSchema = {
        id: notification.id,
        type: notification.type,
        eventId: notification.event.id,
        eventJson: JSON.stringify(notification.event),
        authorPubkey: notification.author.pubkey,
        content: notification.content,
        createdAt: notification.createdAt,
        read: notification.read,
        url: notification.url,
        metadataJson: notification.metadata ? JSON.stringify(notification.metadata) : undefined,
      };

      const request = store.add(stored);

      request.onsuccess = () => {
        // Update state
        const notifications = [notification, ...this.state.notifications];
        const unreadCount = notification.read ? this.state.unreadCount : this.state.unreadCount + 1;

        this.updateState({ notifications, unreadCount });

        // Trigger notifications
        this.handleNewNotification(notification);

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if notification exists
   */
  private async notificationExists(id: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(notificationId);

      request.onsuccess = () => {
        const stored: NotificationStorageSchema | undefined = request.result;
        if (!stored) {
          reject(new Error('Notification not found'));
          return;
        }

        if (stored.read) {
          resolve(); // Already read
          return;
        }

        stored.read = true;
        const updateRequest = store.put(stored);

        updateRequest.onsuccess = () => {
          // Update state
          const notifications = this.state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          );
          const unreadCount = Math.max(0, this.state.unreadCount - 1);

          this.updateState({ notifications, unreadCount });
          resolve();
        };

        updateRequest.onerror = () => reject(updateRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark all notifications as read
   */
  public async markAllAsRead(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('read');
      const request = index.openCursor(IDBKeyRange.only(false));

      const updates: IDBRequest[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const stored: NotificationStorageSchema = cursor.value;
          stored.read = true;
          updates.push(store.put(stored));
          cursor.continue();
        } else {
          // Wait for all updates to complete
          Promise.all(updates.map((r) => new Promise((res) => (r.onsuccess = () => res(undefined)))))
            .then(() => {
              // Update state
              const notifications = this.state.notifications.map((n) => ({ ...n, read: true }));
              this.updateState({ notifications, unreadCount: 0 });
              resolve();
            })
            .catch(reject);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(notificationId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(notificationId);

      request.onsuccess = () => {
        const notification = this.state.notifications.find((n) => n.id === notificationId);
        const notifications = this.state.notifications.filter((n) => n.id !== notificationId);
        const unreadCount =
          notification && !notification.read
            ? Math.max(0, this.state.unreadCount - 1)
            : this.state.unreadCount;

        this.updateState({ notifications, unreadCount });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up old notifications (older than retention period)
   */
  public async cleanupOldNotifications(): Promise<void> {
    if (!this.db) return;

    const cutoffDate = Math.floor((Date.now() - RETENTION_MS) / 1000);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

      const deletions: IDBRequest[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          deletions.push(store.delete(cursor.primaryKey));
          cursor.continue();
        } else {
          Promise.all(deletions.map((r) => new Promise((res) => (r.onsuccess = () => res(undefined)))))
            .then(() => {
              // Reload notifications
              this.loadNotifications().then(resolve).catch(reject);
            })
            .catch(reject);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get notification statistics
   */
  public getStats(): NotificationStats {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);
    const weekStart = now - 7 * 86400;

    const byType: Record<NotificationType, number> = {
      [NotificationType.MENTION]: 0,
      [NotificationType.REPLY]: 0,
      [NotificationType.REACTION]: 0,
      [NotificationType.REPOST]: 0,
      [NotificationType.DM]: 0,
      [NotificationType.FOLLOW]: 0,
      [NotificationType.ZAP]: 0,
    };

    let todayCount = 0;
    let weekCount = 0;

    this.state.notifications.forEach((n) => {
      byType[n.type]++;
      if (n.createdAt >= todayStart) todayCount++;
      if (n.createdAt >= weekStart) weekCount++;
    });

    return {
      total: this.state.notifications.length,
      unread: this.state.unreadCount,
      byType,
      todayCount,
      weekCount,
    };
  }

  /**
   * Update user preferences
   */
  public async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...prefs };
    await this.savePreferences();
  }

  /**
   * Get current preferences
   */
  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationTypeEnabled(type: NotificationType): boolean {
    switch (type) {
      case NotificationType.MENTION:
        return this.preferences.enableMentions;
      case NotificationType.REPLY:
        return this.preferences.enableReplies;
      case NotificationType.REACTION:
        return this.preferences.enableReactions;
      case NotificationType.REPOST:
        return this.preferences.enableReposts;
      case NotificationType.DM:
        return this.preferences.enableDMs;
      case NotificationType.FOLLOW:
        return this.preferences.enableFollows;
      case NotificationType.ZAP:
        return this.preferences.enableZaps;
      default:
        return true;
    }
  }

  /**
   * Handle new notification (trigger sounds, desktop notifications, etc.)
   */
  private handleNewNotification(notification: Notification): void {
    // Play sound if enabled
    if (this.preferences.playSound) {
      this.playNotificationSound(notification.type);
    }

    // Show desktop notification if enabled
    if (this.preferences.showDesktopNotifications) {
      this.showDesktopNotification(notification);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationType): void {
    try {
      // Use Web Audio API for better control
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different notification types
      const frequencies: Record<NotificationType, number> = {
        [NotificationType.DM]: 800,
        [NotificationType.MENTION]: 600,
        [NotificationType.REPLY]: 500,
        [NotificationType.ZAP]: 700,
        [NotificationType.REACTION]: 400,
        [NotificationType.REPOST]: 400,
        [NotificationType.FOLLOW]: 400,
      };

      oscillator.frequency.value = frequencies[type] || 500;
      oscillator.type = 'sine';

      gainNode.gain.value = this.preferences.soundVolume;
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  /**
   * Show desktop notification
   */
  private async showDesktopNotification(notification: Notification): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    // Request permission if not granted
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    const options: DesktopNotificationOptions = {
      title: this.getNotificationTitle(notification),
      body: notification.content,
      icon: notification.author.avatar || '/logo.png',
      tag: notification.id,
      requireInteraction: notification.type === NotificationType.DM,
      data: notification,
    };

    const desktopNotification = new Notification(options.title, options);

    desktopNotification.onclick = () => {
      window.focus();
      if (notification.url) {
        window.location.href = notification.url;
      }
      desktopNotification.close();
    };
  }

  /**
   * Get notification title
   */
  private getNotificationTitle(notification: Notification): string {
    const authorName = notification.author.name || 'Someone';

    switch (notification.type) {
      case NotificationType.MENTION:
        return `${authorName} mentioned you`;
      case NotificationType.REPLY:
        return `${authorName} replied to you`;
      case NotificationType.REACTION:
        return `${authorName} reacted to your post`;
      case NotificationType.REPOST:
        return `${authorName} reposted your post`;
      case NotificationType.DM:
        return `New message from ${authorName}`;
      case NotificationType.FOLLOW:
        return `${authorName} followed you`;
      case NotificationType.ZAP:
        return `${authorName} zapped you`;
      default:
        return 'New notification';
    }
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(listener: (state: NotificationServiceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Emit current state immediately
    return () => this.listeners.delete(listener);
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<NotificationServiceState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Get current state
   */
  public getState(): NotificationServiceState {
    return { ...this.state };
  }

  /**
   * Get all notifications
   */
  public getNotifications(): Notification[] {
    return [...this.state.notifications];
  }

  /**
   * Get unread count
   */
  public getUnreadCount(): number {
    return this.state.unreadCount;
  }

  /**
   * Dispose service and close database
   */
  public async dispose(): Promise<void> {
    this.listeners.clear();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null;

/**
 * Get the singleton NotificationService instance
 */
export const getNotificationService = (): NotificationService => {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
};
