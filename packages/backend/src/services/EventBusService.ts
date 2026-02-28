/**
 * Event Bus Service Implementation
 * Central event-driven communication system
 * Part of Epic 005 - Backend Service Refactoring - Story E5-005
 */

import crypto from 'crypto';
import {
  IEventBus,
  DomainEvent,
  EventHandler,
  EventFilter,
  EventSubscription,
  EventReplayOptions,
  DomainEventType
} from '../interfaces/shared/IEventBus';

/**
 * In-memory event store for development and testing
 */
interface StoredEvent {
  event: DomainEvent;
  timestamp: Date;
  processed: boolean;
  retryCount: number;
}

/**
 * Subscription registry entry
 */
interface SubscriptionEntry {
  subscription: EventSubscription;
  handler: EventHandler;
  filter?: EventFilter;
  errorCount: number;
  lastError?: Error;
}

/**
 * Event Bus implementation with retry logic and error handling
 */
export class EventBusService implements IEventBus {
  private subscriptions: Map<string, SubscriptionEntry> = new Map();
  private eventStore: StoredEvent[] = [];
  private eventTypeSubscriptions: Map<DomainEventType, Set<string>> = new Map();
  private wildcardSubscriptions: Set<string> = new Set();
  private isProcessing = false;
  private eventQueue: DomainEvent[] = [];
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private maxEventStoreSize = 10000;
  private eventStats: Map<DomainEventType, number> = new Map();

  constructor(private logger?: ILogger) {}

  /**
   * Publish a single event
   */
  async publish<T = any>(event: DomainEvent<T>): Promise<void> {
    this.validateEvent(event);

    // Store event
    this.storeEvent(event);

    // Update stats
    this.updateEventStats(event.type);

    // Add to queue for processing
    this.eventQueue.push(event);

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processEventQueue();
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch<T = any>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      this.validateEvent(event);
      this.storeEvent(event);
      this.updateEventStats(event.type);
      this.eventQueue.push(event);
    }

    if (!this.isProcessing) {
      await this.processEventQueue();
    }
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: DomainEventType, handler: EventHandler): string {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: [eventType],
      handler,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, {
      subscription,
      handler,
      errorCount: 0
    });

    // Add to event type index
    if (!this.eventTypeSubscriptions.has(eventType)) {
      this.eventTypeSubscriptions.set(eventType, new Set());
    }
    this.eventTypeSubscriptions.get(eventType)!.add(subscriptionId);

    this.log('info', `Subscription ${subscriptionId} created for ${eventType}`);

    return subscriptionId;
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeToMany(eventTypes: DomainEventType[], handler: EventHandler): string {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes,
      handler,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, {
      subscription,
      handler,
      errorCount: 0
    });

    // Add to event type indexes
    for (const eventType of eventTypes) {
      if (!this.eventTypeSubscriptions.has(eventType)) {
        this.eventTypeSubscriptions.set(eventType, new Set());
      }
      this.eventTypeSubscriptions.get(eventType)!.add(subscriptionId);
    }

    return subscriptionId;
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(handler: EventHandler): string {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: [],
      handler,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, {
      subscription,
      handler,
      errorCount: 0
    });

    this.wildcardSubscriptions.add(subscriptionId);

    return subscriptionId;
  }

  /**
   * Subscribe with custom filter
   */
  subscribeWithFilter(filter: EventFilter, handler: EventHandler): string {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: filter.types || [],
      handler,
      filter,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, {
      subscription,
      handler,
      filter,
      errorCount: 0
    });

    // If filter includes specific types, add to indexes
    if (filter.types) {
      for (const eventType of filter.types) {
        if (!this.eventTypeSubscriptions.has(eventType)) {
          this.eventTypeSubscriptions.set(eventType, new Set());
        }
        this.eventTypeSubscriptions.get(eventType)!.add(subscriptionId);
      }
    } else {
      // No specific types means it's a wildcard with filter
      this.wildcardSubscriptions.add(subscriptionId);
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (!entry) return;

    // Remove from event type indexes
    for (const eventType of entry.subscription.eventTypes) {
      this.eventTypeSubscriptions.get(eventType)?.delete(subscriptionId);
    }

    // Remove from wildcard if present
    this.wildcardSubscriptions.delete(subscriptionId);

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    this.log('info', `Subscription ${subscriptionId} removed`);
  }

  /**
   * Unsubscribe all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
    this.eventTypeSubscriptions.clear();
    this.wildcardSubscriptions.clear();
  }

  /**
   * Get a specific event by ID
   */
  async getEvent(eventId: string): Promise<DomainEvent | null> {
    const stored = this.eventStore.find(s => s.event.id === eventId);
    return stored?.event || null;
  }

  /**
   * Query events with filter
   */
  async queryEvents(filter: EventFilter, limit = 100, offset = 0): Promise<DomainEvent[]> {
    let filtered = this.eventStore.map(s => s.event);

    // Apply filters
    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter(e => filter.types!.includes(e.type));
    }

    if (filter.aggregateTypes && filter.aggregateTypes.length > 0) {
      filtered = filtered.filter(e => filter.aggregateTypes!.includes(e.aggregateType));
    }

    if (filter.userId) {
      filtered = filtered.filter(e => e.metadata.userId === filter.userId);
    }

    if (filter.after) {
      filtered = filtered.filter(e => e.metadata.timestamp >= filter.after!);
    }

    if (filter.before) {
      filtered = filtered.filter(e => e.metadata.timestamp <= filter.before!);
    }

    // Apply pagination
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Replay events based on options
   */
  async replayEvents(options: EventReplayOptions): Promise<DomainEvent[]> {
    const events = await this.queryEvents({
      ...options.filter,
      after: options.from,
      before: options.to
    });

    const batchSize = options.batchSize || 100;
    const delayMs = options.delayMs || 0;

    const replayed: DomainEvent[] = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      for (const event of batch) {
        replayed.push(event);
      }

      if (delayMs > 0 && i + batchSize < events.length) {
        await this.delay(delayMs);
      }
    }

    return replayed;
  }

  /**
   * Replay events to a specific handler
   */
  async replayEventsToHandler(options: EventReplayOptions, handler: EventHandler): Promise<void> {
    const events = await this.replayEvents(options);

    for (const event of events) {
      try {
        await handler(event);
      } catch (error) {
        this.log('error', `Error replaying event ${event.id}`, error);
      }
    }
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values()).map(e => e.subscription);
  }

  /**
   * Get event statistics
   */
  async getEventStats(): Promise<{ [key in DomainEventType]?: number }> {
    const stats: { [key in DomainEventType]?: number } = {};

    for (const [type, count] of this.eventStats) {
      stats[type] = count;
    }

    return stats;
  }

  /**
   * Clear event store
   */
  async clearEventStore(): Promise<void> {
    this.eventStore = [];
    this.eventStats.clear();
  }

  /**
   * Check if event bus is healthy
   */
  async isHealthy(): Promise<boolean> {
    return !this.isProcessing || this.eventQueue.length < 1000;
  }

  /**
   * Dispose of event bus resources
   */
  async dispose(): Promise<void> {
    this.unsubscribeAll();
    this.eventQueue = [];
    this.eventStore = [];
    this.isProcessing = false;
  }

  /**
   * Process queued events
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: DomainEvent): Promise<void> {
    const handlers = this.getHandlersForEvent(event);

    for (const { subscriptionId, handler, entry } of handlers) {
      try {
        await this.executeHandler(handler, event);

        // Reset error count on success
        if (entry.errorCount > 0) {
          entry.errorCount = 0;
          entry.lastError = undefined;
        }
      } catch (error) {
        entry.errorCount++;
        entry.lastError = error as Error;

        this.log('error', `Handler ${subscriptionId} failed for event ${event.id}`, error);

        // Retry logic
        if (entry.errorCount <= this.maxRetries) {
          await this.delay(this.retryDelay * entry.errorCount);

          try {
            await this.executeHandler(handler, event);
            entry.errorCount = 0;
            entry.lastError = undefined;
          } catch (retryError) {
            this.log('error', `Retry failed for handler ${subscriptionId}`, retryError);
          }
        }
      }
    }
  }

  /**
   * Execute a handler with timeout
   */
  private async executeHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
    const timeoutMs = 30000; // 30 second timeout

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Handler timeout')), timeoutMs);
    });

    await Promise.race([
      handler(event),
      timeoutPromise
    ]);
  }

  /**
   * Get all handlers that should receive an event
   */
  private getHandlersForEvent(event: DomainEvent): Array<{
    subscriptionId: string;
    handler: EventHandler;
    entry: SubscriptionEntry;
  }> {
    const handlers: Array<{
      subscriptionId: string;
      handler: EventHandler;
      entry: SubscriptionEntry;
    }> = [];

    // Get type-specific subscriptions
    const typeSubscriptions = this.eventTypeSubscriptions.get(event.type);
    if (typeSubscriptions) {
      for (const subscriptionId of typeSubscriptions) {
        const entry = this.subscriptions.get(subscriptionId);
        if (entry && this.matchesFilter(event, entry.filter)) {
          handlers.push({
            subscriptionId,
            handler: entry.handler,
            entry
          });
        }
      }
    }

    // Get wildcard subscriptions
    for (const subscriptionId of this.wildcardSubscriptions) {
      const entry = this.subscriptions.get(subscriptionId);
      if (entry && this.matchesFilter(event, entry.filter)) {
        handlers.push({
          subscriptionId,
          handler: entry.handler,
          entry
        });
      }
    }

    return handlers;
  }

  /**
   * Check if an event matches a filter
   */
  private matchesFilter(event: DomainEvent, filter?: EventFilter): boolean {
    if (!filter) return true;

    if (filter.aggregateTypes && !filter.aggregateTypes.includes(event.aggregateType)) {
      return false;
    }

    if (filter.userId && event.metadata.userId !== filter.userId) {
      return false;
    }

    if (filter.after && event.metadata.timestamp < filter.after) {
      return false;
    }

    if (filter.before && event.metadata.timestamp > filter.before) {
      return false;
    }

    return true;
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: DomainEvent): void {
    if (!event.id) {
      throw new Error('Event must have an id');
    }

    if (!event.type) {
      throw new Error('Event must have a type');
    }

    if (!event.aggregateId) {
      throw new Error('Event must have an aggregateId');
    }

    if (!event.aggregateType) {
      throw new Error('Event must have an aggregateType');
    }

    if (!event.metadata) {
      throw new Error('Event must have metadata');
    }

    if (!event.metadata.timestamp) {
      throw new Error('Event metadata must have a timestamp');
    }

    if (!event.metadata.source) {
      throw new Error('Event metadata must have a source');
    }
  }

  /**
   * Store event in the event store
   */
  private storeEvent(event: DomainEvent): void {
    this.eventStore.push({
      event,
      timestamp: new Date(),
      processed: false,
      retryCount: 0
    });

    // Trim store if too large
    if (this.eventStore.length > this.maxEventStoreSize) {
      this.eventStore = this.eventStore.slice(-this.maxEventStoreSize);
    }
  }

  /**
   * Update event statistics
   */
  private updateEventStats(type: DomainEventType): void {
    const current = this.eventStats.get(type) || 0;
    this.eventStats.set(type, current + 1);
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging helper
   */
  private log(level: 'info' | 'error' | 'warn', message: string, error?: any): void {
    if (this.logger) {
      switch (level) {
        case 'info':
          this.logger.info(message);
          break;
        case 'error':
          this.logger.error(message, error);
          break;
        case 'warn':
          this.logger.warn(message);
          break;
      }
    }
  }
}

/**
 * Logger interface for event bus
 */
interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error): void;
  warn(message: string, meta?: any): void;
}

/**
 * Create a configured event bus instance
 */
export function createEventBus(logger?: ILogger): IEventBus {
  return new EventBusService(logger);
}