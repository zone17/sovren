/**
 * Mock Services for Integration Tests
 * Lightweight mock implementations of external services
 * Part of US-E5-034: Integration Test Suite
 */

import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { IEventBusService } from '../../interfaces/shared/IEventBusService';

/**
 * Mock Logger Implementation
 */
export function createMockLogger(): ILogger {
  const logs: Array<{ level: string; message: string; meta?: any }> = [];

  return {
    info: (message: string, meta?: any) => {
      logs.push({ level: 'info', message, meta });
    },
    error: (message: string, meta?: any) => {
      logs.push({ level: 'error', message, meta });
    },
    warn: (message: string, meta?: any) => {
      logs.push({ level: 'warn', message, meta });
    },
    debug: (message: string, meta?: any) => {
      logs.push({ level: 'debug', message, meta });
    },
    getLogs: () => logs,
    clearLogs: () => {
      logs.length = 0;
    },
  };
}

/**
 * Mock Database Implementation
 */
export function createMockDatabase(config?: { real?: boolean }): any {
  const data = new Map<string, Map<string, any>>();

  return {
    query: async (sql: string, params?: any[]) => {
      // Simple mock query execution
      return { rows: [], rowCount: 0 };
    },

    transaction: async <T>(callback: (trx: any) => Promise<T>): Promise<T> => {
      // Mock transaction
      return callback({
        query: async (sql: string, params?: any[]) => {
          return { rows: [], rowCount: 0 };
        },
        commit: async () => {},
        rollback: async () => {},
      });
    },

    insert: async (table: string, record: any) => {
      if (!data.has(table)) {
        data.set(table, new Map());
      }
      const tableData = data.get(table)!;
      const id = record.id || `mock-${Date.now()}`;
      tableData.set(id, { ...record, id });
      return { ...record, id };
    },

    findById: async (table: string, id: string) => {
      const tableData = data.get(table);
      return tableData?.get(id) || null;
    },

    findAll: async (table: string) => {
      const tableData = data.get(table);
      return tableData ? Array.from(tableData.values()) : [];
    },

    update: async (table: string, id: string, updates: any) => {
      const tableData = data.get(table);
      if (!tableData) return null;
      const record = tableData.get(id);
      if (!record) return null;
      const updated = { ...record, ...updates };
      tableData.set(id, updated);
      return updated;
    },

    delete: async (table: string, id: string) => {
      const tableData = data.get(table);
      if (!tableData) return false;
      return tableData.delete(id);
    },

    clear: () => {
      data.clear();
    },
  };
}

/**
 * Mock Cache Implementation (In-Memory)
 */
export function createMockCache(config?: { real?: boolean }): ICacheService {
  const cache = new Map<string, { value: any; expiresAt?: number }>();

  return {
    get: async <T>(key: string): Promise<T | null> => {
      const entry = cache.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
      }
      return entry.value;
    },

    set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
      cache.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
    },

    delete: async (key: string): Promise<boolean> => {
      return cache.delete(key);
    },

    clear: async (): Promise<void> => {
      cache.clear();
    },

    exists: async (key: string): Promise<boolean> => {
      return cache.has(key);
    },

    ttl: async (key: string): Promise<number> => {
      const entry = cache.get(key);
      if (!entry || !entry.expiresAt) return -1;
      const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },

    increment: async (key: string, amount = 1): Promise<number> => {
      const current = (await cache.get(key)) || 0;
      const newValue = (current as number) + amount;
      await cache.set(key, newValue);
      return newValue;
    },

    getSize: () => cache.size,
    getKeys: () => Array.from(cache.keys()),
  };
}

/**
 * Mock Event Bus Implementation
 */
export function createMockEventBus(config?: { real?: boolean }): IEventBusService {
  const subscribers = new Map<string, Array<(event: any) => void | Promise<void>>>();
  const publishedEvents: Array<{ event: string; payload: any; timestamp: Date }> = [];

  return {
    publish: async <T>(event: string, payload: T): Promise<void> => {
      publishedEvents.push({ event, payload, timestamp: new Date() });

      const handlers = subscribers.get(event) || [];
      await Promise.all(handlers.map((handler) => handler(payload)));
    },

    subscribe: <T>(event: string, handler: (payload: T) => void | Promise<void>): void => {
      if (!subscribers.has(event)) {
        subscribers.set(event, []);
      }
      subscribers.get(event)!.push(handler);
    },

    unsubscribe: (event: string, handler: (payload: any) => void): void => {
      const handlers = subscribers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    },

    getPublishedEvents: () => publishedEvents,
    getSubscribers: (event: string) => subscribers.get(event)?.length || 0,
    clear: () => {
      subscribers.clear();
      publishedEvents.length = 0;
    },
  };
}

/**
 * Mock Lightning Network Service
 */
export function createMockLightningService(): any {
  const invoices = new Map<string, any>();
  const payments = new Map<string, any>();

  return {
    createInvoice: async (amount: number, description: string) => {
      const paymentHash = `hash_${Date.now()}`;
      const paymentRequest = `lnbc${amount}u1p${Date.now()}`;
      const invoice = {
        payment_hash: paymentHash,
        payment_request: paymentRequest,
        amount,
        description,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        settled: false,
      };
      invoices.set(paymentHash, invoice);
      return invoice;
    },

    checkPayment: async (paymentHash: string) => {
      return invoices.get(paymentHash) || null;
    },

    settleInvoice: async (paymentHash: string, preimage: string) => {
      const invoice = invoices.get(paymentHash);
      if (invoice) {
        invoice.settled = true;
        invoice.settle_date = Math.floor(Date.now() / 1000);
        invoice.preimage = preimage;
      }
      return invoice;
    },

    sendPayment: async (paymentRequest: string) => {
      const paymentHash = `payment_${Date.now()}`;
      const payment = {
        payment_hash: paymentHash,
        payment_request: paymentRequest,
        status: 'pending',
        created_at: Date.now(),
      };
      payments.set(paymentHash, payment);
      return payment;
    },
  };
}

/**
 * Mock Email Service
 */
export function createMockEmailService(): any {
  const sentEmails: Array<{
    to: string;
    subject: string;
    body: string;
    timestamp: Date;
  }> = [];

  return {
    send: async (to: string, subject: string, body: string) => {
      sentEmails.push({ to, subject, body, timestamp: new Date() });
      return {
        messageId: `msg_${Date.now()}`,
        accepted: [to],
        rejected: [],
      };
    },

    getSentEmails: () => sentEmails,
    clearSentEmails: () => {
      sentEmails.length = 0;
    },
  };
}

/**
 * Mock Nostr Relay Service
 */
export function createMockNostrService(): any {
  const publishedEvents: any[] = [];

  return {
    publishEvent: async (event: any) => {
      publishedEvents.push({ ...event, publishedAt: new Date() });
      return {
        success: true,
        eventId: event.id,
      };
    },

    subscribeToEvents: async (filter: any, callback: (event: any) => void) => {
      // Mock subscription
      return () => {}; // Unsubscribe function
    },

    getPublishedEvents: () => publishedEvents,
    clearPublishedEvents: () => {
      publishedEvents.length = 0;
    },
  };
}

/**
 * Mock External Exchange Rate Service
 */
export function createMockExchangeRateService(): any {
  const rates: Record<string, number> = {
    'BTC/USD': 45000,
    'BTC/EUR': 40000,
    'BTC/SAT': 100000000,
  };

  return {
    getRate: async (pair: string): Promise<number> => {
      return rates[pair] || 0;
    },

    setRate: (pair: string, rate: number) => {
      rates[pair] = rate;
    },
  };
}
