/**
 * NotificationService Tests
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import { NotificationService, getNotificationService } from '../services/NotificationService';
import { Notification, NotificationType, NotificationPreferences } from '../types';

// In-memory store shared across mock DB operations so get() can look up what add() stored
const mockDbStore: Map<string, any> = new Map();

/** Create a request that fires onsuccess asynchronously (microtask) with the given result. */
function makeAsyncRequest(result: unknown = undefined) {
  const req: any = { result, error: null };
  let _onsuccess: any = null;
  let _onerror: any = null;
  Object.defineProperty(req, 'onsuccess', {
    set(fn: any) {
      _onsuccess = fn;
      // Fire via queueMicrotask so Promises inside the service resolve properly
      if (fn) queueMicrotask(() => fn({ target: req }));
    },
    get() {
      return _onsuccess;
    },
    configurable: true,
  });
  Object.defineProperty(req, 'onerror', {
    set(fn: any) {
      _onerror = fn;
    },
    get() {
      return _onerror;
    },
    configurable: true,
  });
  return req;
}

/** Create a cursor request that fires onsuccess with null (empty store). */
function makeEmptyCursorRequest() {
  return makeAsyncRequest(null); // null result = no cursor
}

class MockIDBObjectStore {
  add = vi.fn((value: any) => {
    const req = makeAsyncRequest();
    // Store the value keyed by its id so get() can retrieve it
    queueMicrotask(() => {
      mockDbStore.set(value.id, value);
    });
    return req;
  });
  get = vi.fn((id: string) => {
    const result = mockDbStore.get(id) ?? null;
    return makeAsyncRequest(result);
  });
  put = vi.fn((value: any) => {
    const req = makeAsyncRequest();
    queueMicrotask(() => {
      mockDbStore.set(value.id, value);
    });
    return req;
  });
  delete = vi.fn((id: string) => {
    const req = makeAsyncRequest();
    queueMicrotask(() => {
      mockDbStore.delete(id);
    });
    return req;
  });
  index = vi.fn(() => ({
    openCursor: vi.fn(() => makeEmptyCursorRequest()),
  }));
}

class MockIDBDatabase {
  objectStoreNames = { contains: vi.fn(() => false) };
  close = vi.fn();
  createObjectStore = vi.fn(() => ({
    createIndex: vi.fn(),
  }));
  transaction = vi.fn(() => ({
    objectStore: vi.fn(() => new MockIDBObjectStore()),
  }));
}

// Mock IDBKeyRange so cleanupOldNotifications doesn't throw
const mockIDBKeyRange = {
  upperBound: vi.fn((value: any) => ({ upper: value, lowerOpen: false, upperOpen: false })),
  lowerBound: vi.fn((value: any) => ({ lower: value })),
  bound: vi.fn((lower: any, upper: any) => ({ lower, upper })),
  only: vi.fn((value: any) => ({ value })),
};
// @ts-ignore
Object.defineProperty(globalThis, 'IDBKeyRange', {
  value: mockIDBKeyRange,
  writable: true,
  configurable: true,
});

const mockIndexedDB = {
  open: vi.fn(() => {
    const db = new MockIDBDatabase();
    const request: any = { result: db, error: null };
    let _onsuccess: any = null;
    Object.defineProperty(request, 'onsuccess', {
      set(fn: any) {
        _onsuccess = fn;
        // Fire via setTimeout so that: (1) the test's beforeEach completes first,
        // (2) then initialization runs asynchronously in the next tick.
        // Tests that need DB operations must await waitForInit() before calling service methods.
        if (fn) setTimeout(() => fn({ target: request }), 0);
      },
      get() {
        return _onsuccess;
      },
      configurable: true,
    });
    request.onerror = null;
    request.onupgradeneeded = null;
    return request;
  }),
};

// @ts-ignore
Object.defineProperty(globalThis, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
  configurable: true,
});

/** Wait for the NotificationService to finish initialization (DB open + load + cleanup). */
async function waitForInit() {
  // Allow setTimeout(0) for openDatabase onsuccess to fire, then drain microtasks
  await new Promise((resolve) => setTimeout(resolve, 10));
}

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

// Mock Notification API for jsdom
const mockNotification = vi.fn() as any;
mockNotification.permission = 'granted';
mockNotification.requestPermission = vi.fn().mockResolvedValue('granted');
vi.stubGlobal('Notification', mockNotification);

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
    mockDbStore.clear();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
      await waitForInit();
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
