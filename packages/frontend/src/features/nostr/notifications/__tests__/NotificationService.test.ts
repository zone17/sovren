/**
 * NotificationService Tests
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import { NotificationService, getNotificationService } from '../services/NotificationService';
import { Notification, NotificationType, NotificationPreferences } from '../types';

// Mock IndexedDB
class MockIDBDatabase {
  objectStoreNames = { contains: vi.fn(() => false) };
  close = vi.fn();
  createObjectStore = vi.fn(() => ({
    createIndex: vi.fn(),
  }));
  transaction = vi.fn(() => ({
    objectStore: vi.fn(() => ({
      add: vi.fn(() => ({ onsuccess: null, onerror: null })),
      get: vi.fn(() => ({ onsuccess: null, onerror: null, result: null })),
      put: vi.fn(() => ({ onsuccess: null, onerror: null })),
      delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
      index: vi.fn(() => ({
        openCursor: vi.fn(() => ({ onsuccess: null, onerror: null })),
      })),
    })),
  }));
}

const mockIndexedDB = {
  open: vi.fn(() => {
    const request = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: new MockIDBDatabase(),
    };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess();
    }, 0);
    return request;
  }),
};

// @ts-ignore
Object.defineProperty(globalThis, "indexedDB", { value: mockIndexedDB, writable: true, configurable: true });

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Notification API
const mockNotification = vi.fn();
Object.defineProperty(window, 'Notification', {
  value: mockNotification,
  configurable: true,
});
mockNotification.permission = 'granted';
mockNotification.requestPermission = vi.fn(() => Promise.resolve('granted'));

// Mock AudioContext
class MockAudioContext {
  createOscillator = vi.fn(() => ({
    connect: vi.fn(),
    frequency: { value: 0 },
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    connect: vi.fn(),
    gain: {
      value: 0,
      exponentialRampToValueAtTime: vi.fn(),
    },
  }));
  destination = {};
  currentTime = 0;
}

// @ts-ignore
global.AudioContext = MockAudioContext;

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    service = new NotificationService();
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = service.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should load default preferences', () => {
      const prefs = service.getPreferences();
      expect(prefs.enableMentions).toBe(true);
      expect(prefs.enableReplies).toBe(true);
      expect(prefs.playSound).toBe(true);
    });

    it('should open IndexedDB connection', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockIndexedDB.open).toHaveBeenCalledWith('sovren-notifications', 1);
    });
  });

  describe('addNotification', () => {
    it('should add a notification successfully', async () => {
      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
          name: 'Alice',
        },
        content: 'Alice mentioned you',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);

      const notifications = service.getNotifications();
      expect(notifications).toContainEqual(notification);
    });

    it('should not add duplicate notifications', async () => {
      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);
      await service.addNotification(notification);

      const notifications = service.getNotifications();
      const count = notifications.filter((n) => n.id === 'test-1').length;
      expect(count).toBe(1);
    });

    it('should not add notification if type is disabled', async () => {
      await service.updatePreferences({ enableMentions: false });

      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);

      const notifications = service.getNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('should update unread count', async () => {
      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);

      expect(service.getUnreadCount()).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);
      await service.markAsRead('test-1');

      const notifications = service.getNotifications();
      const updated = notifications.find((n) => n.id === 'test-1');
      expect(updated?.read).toBe(true);
    });

    it('should decrease unread count', async () => {
      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);
      expect(service.getUnreadCount()).toBe(1);

      await service.markAsRead('test-1');
      expect(service.getUnreadCount()).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const notifications: Notification[] = [
        {
          id: 'test-1',
          type: NotificationType.MENTION,
          event: {
            id: 'event-1',
            pubkey: 'pubkey-1',
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [],
            content: 'Test content',
            sig: 'sig',
          },
          author: { pubkey: 'pubkey-1' },
          content: 'Test 1',
          createdAt: Math.floor(Date.now() / 1000),
          read: false,
        },
        {
          id: 'test-2',
          type: NotificationType.REPLY,
          event: {
            id: 'event-2',
            pubkey: 'pubkey-2',
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [],
            content: 'Test content',
            sig: 'sig',
          },
          author: { pubkey: 'pubkey-2' },
          content: 'Test 2',
          createdAt: Math.floor(Date.now() / 1000),
          read: false,
        },
      ];

      for (const notification of notifications) {
        await service.addNotification(notification);
      }

      await service.markAllAsRead();

      expect(service.getUnreadCount()).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);
      await service.deleteNotification('test-1');

      const notifications = service.getNotifications();
      expect(notifications).toHaveLength(0);
    });
  });

  describe('Preferences', () => {
    it('should update preferences', async () => {
      const updates: Partial<NotificationPreferences> = {
        enableMentions: false,
        playSound: false,
        soundVolume: 0.3,
      };

      await service.updatePreferences(updates);

      const prefs = service.getPreferences();
      expect(prefs.enableMentions).toBe(false);
      expect(prefs.playSound).toBe(false);
      expect(prefs.soundVolume).toBe(0.3);
    });

    it('should persist preferences to localStorage', async () => {
      const updates: Partial<NotificationPreferences> = {
        enableMentions: false,
      };

      await service.updatePreferences(updates);

      const stored = localStorage.getItem('notification-preferences');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.enableMentions).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', async () => {
      const notifications: Notification[] = [
        {
          id: 'test-1',
          type: NotificationType.MENTION,
          event: {
            id: 'event-1',
            pubkey: 'pubkey-1',
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [],
            content: 'Test content',
            sig: 'sig',
          },
          author: { pubkey: 'pubkey-1' },
          content: 'Test 1',
          createdAt: Math.floor(Date.now() / 1000),
          read: false,
        },
        {
          id: 'test-2',
          type: NotificationType.MENTION,
          event: {
            id: 'event-2',
            pubkey: 'pubkey-2',
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [],
            content: 'Test content',
            sig: 'sig',
          },
          author: { pubkey: 'pubkey-2' },
          content: 'Test 2',
          createdAt: Math.floor(Date.now() / 1000),
          read: false,
        },
        {
          id: 'test-3',
          type: NotificationType.REPLY,
          event: {
            id: 'event-3',
            pubkey: 'pubkey-3',
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [],
            content: 'Test content',
            sig: 'sig',
          },
          author: { pubkey: 'pubkey-3' },
          content: 'Test 3',
          createdAt: Math.floor(Date.now() / 1000),
          read: true,
        },
      ];

      for (const notification of notifications) {
        await service.addNotification(notification);
      }

      const stats = service.getStats();
      expect(stats.total).toBe(3);
      expect(stats.unread).toBe(2);
      expect(stats.byType[NotificationType.MENTION]).toBe(2);
      expect(stats.byType[NotificationType.REPLY]).toBe(1);
    });
  });

  describe('State Subscription', () => {
    it('should notify subscribers of state changes', async () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      const notification: Notification = {
        id: 'test-1',
        type: NotificationType.MENTION,
        event: {
          id: 'event-1',
          pubkey: 'pubkey-1',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Test content',
          sig: 'sig',
        },
        author: {
          pubkey: 'pubkey-1',
        },
        content: 'Test notification',
        createdAt: Math.floor(Date.now() / 1000),
        read: false,
      };

      await service.addNotification(notification);

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should unsubscribe correctly', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      unsubscribe();

      const state = service.getState();
      expect(listener).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getNotificationService();
      const instance2 = getNotificationService();

      expect(instance1).toBe(instance2);
    });
  });
});
