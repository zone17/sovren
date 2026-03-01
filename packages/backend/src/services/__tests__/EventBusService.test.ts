/**
 * Event Bus Service Tests
 * Test suite for event-driven communication system
 * Part of Epic 005 - Backend Service Refactoring - Story E5-005
 */

import { EventBusService, createEventBus } from '../EventBusService';
import { DomainEventBuilder, DomainEventType } from '../../interfaces/shared/IEventBus';

describe('EventBusService', () => {
  let eventBus: EventBusService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    eventBus = new EventBusService(mockLogger);
  });

  afterEach(async () => {
    await eventBus.dispose();
  });

  describe('Event Publishing', () => {
    it('should publish a single event', async () => {
      const event = new DomainEventBuilder()
        .withType(DomainEventType.PAYMENT_RECEIVED)
        .withAggregateId('payment_123')
        .withAggregateType('Payment')
        .withPayload({ amount: 100 })
        .withSource('test')
        .build();

      await expect(eventBus.publish(event)).resolves.not.toThrow();

      const storedEvent = await eventBus.getEvent(event.id);
      expect(storedEvent).toEqual(event);
    });

    it('should publish multiple events in batch', async () => {
      const events = [
        new DomainEventBuilder()
          .withType(DomainEventType.CONTENT_CREATED)
          .withAggregateId('content_1')
          .withAggregateType('Content')
          .withSource('test')
          .build(),
        new DomainEventBuilder()
          .withType(DomainEventType.CONTENT_PUBLISHED)
          .withAggregateId('content_2')
          .withAggregateType('Content')
          .withSource('test')
          .build(),
      ];

      await eventBus.publishBatch(events);

      for (const event of events) {
        const stored = await eventBus.getEvent(event.id);
        expect(stored).toEqual(event);
      }
    });

    it('should validate event structure', async () => {
      const invalidEvent = {
        id: 'test',
        // Missing required fields
      } as any;

      await expect(eventBus.publish(invalidEvent)).rejects.toThrow('Event must have a type');
    });

    it('should update event statistics', async () => {
      const event1 = new DomainEventBuilder()
        .withType(DomainEventType.USER_REGISTERED)
        .withAggregateId('user_1')
        .withAggregateType('User')
        .withSource('test')
        .build();

      const event2 = new DomainEventBuilder()
        .withType(DomainEventType.USER_REGISTERED)
        .withAggregateId('user_2')
        .withAggregateType('User')
        .withSource('test')
        .build();

      await eventBus.publish(event1);
      await eventBus.publish(event2);

      const stats = await eventBus.getEventStats();
      expect(stats[DomainEventType.USER_REGISTERED]).toBe(2);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to specific event type', async () => {
      const handler = vi.fn();
      const subscriptionId = eventBus.subscribe(DomainEventType.PAYMENT_RECEIVED, handler);

      expect(subscriptionId).toMatch(/^sub_/);

      const event = new DomainEventBuilder()
        .withType(DomainEventType.PAYMENT_RECEIVED)
        .withAggregateId('payment_456')
        .withAggregateType('Payment')
        .withPayload({ amount: 200 })
        .withSource('test')
        .build();

      await eventBus.publish(event);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should subscribe to multiple event types', async () => {
      const handler = vi.fn();
      const eventTypes = [DomainEventType.CONTENT_CREATED, DomainEventType.CONTENT_PUBLISHED];

      eventBus.subscribeToMany(eventTypes, handler);

      const event1 = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_CREATED)
        .withAggregateId('content_1')
        .withAggregateType('Content')
        .withSource('test')
        .build();

      const event2 = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_PUBLISHED)
        .withAggregateId('content_2')
        .withAggregateType('Content')
        .withSource('test')
        .build();

      const event3 = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_DELETED)
        .withAggregateId('content_3')
        .withAggregateType('Content')
        .withSource('test')
        .build();

      await eventBus.publish(event1);
      await eventBus.publish(event2);
      await eventBus.publish(event3);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).toHaveBeenCalledWith(event2);
      expect(handler).not.toHaveBeenCalledWith(event3);
    });

    it('should subscribe to all events', async () => {
      const handler = vi.fn();
      eventBus.subscribeToAll(handler);

      const events = [
        new DomainEventBuilder()
          .withType(DomainEventType.USER_REGISTERED)
          .withAggregateId('user_1')
          .withAggregateType('User')
          .withSource('test')
          .build(),
        new DomainEventBuilder()
          .withType(DomainEventType.PAYMENT_RECEIVED)
          .withAggregateId('payment_1')
          .withAggregateType('Payment')
          .withSource('test')
          .build(),
        new DomainEventBuilder()
          .withType(DomainEventType.CONTENT_CREATED)
          .withAggregateId('content_1')
          .withAggregateType('Content')
          .withSource('test')
          .build(),
      ];

      await eventBus.publishBatch(events);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(3);
      for (const event of events) {
        expect(handler).toHaveBeenCalledWith(event);
      }
    });

    it('should subscribe with filter', async () => {
      const handler = vi.fn();
      const userId = 'user_123';

      eventBus.subscribeWithFilter({ userId }, handler);

      const event1 = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_CREATED)
        .withAggregateId('content_1')
        .withAggregateType('Content')
        .withUserId(userId)
        .withSource('test')
        .build();

      const event2 = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_CREATED)
        .withAggregateId('content_2')
        .withAggregateType('Content')
        .withUserId('other_user')
        .withSource('test')
        .build();

      await eventBus.publish(event1);
      await eventBus.publish(event2);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).not.toHaveBeenCalledWith(event2);
    });

    it('should handle unsubscribe', async () => {
      const handler = vi.fn();
      const subscriptionId = eventBus.subscribe(DomainEventType.USER_LOGGED_IN, handler);

      eventBus.unsubscribe(subscriptionId);

      const event = new DomainEventBuilder()
        .withType(DomainEventType.USER_LOGGED_IN)
        .withAggregateId('user_1')
        .withAggregateType('User')
        .withSource('test')
        .build();

      await eventBus.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle unsubscribeAll', () => {
      eventBus.subscribe(DomainEventType.USER_REGISTERED, vi.fn());
      eventBus.subscribe(DomainEventType.PAYMENT_RECEIVED, vi.fn());
      eventBus.subscribeToAll(vi.fn());

      expect(eventBus.getActiveSubscriptions()).toHaveLength(3);

      eventBus.unsubscribeAll();

      expect(eventBus.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe('Event Query', () => {
    beforeEach(async () => {
      const events = [
        new DomainEventBuilder()
          .withType(DomainEventType.USER_REGISTERED)
          .withAggregateId('user_1')
          .withAggregateType('User')
          .withUserId('user_1')
          .withSource('test')
          .build(),
        new DomainEventBuilder()
          .withType(DomainEventType.USER_UPDATED)
          .withAggregateId('user_1')
          .withAggregateType('User')
          .withUserId('user_1')
          .withSource('test')
          .build(),
        new DomainEventBuilder()
          .withType(DomainEventType.PAYMENT_RECEIVED)
          .withAggregateId('payment_1')
          .withAggregateType('Payment')
          .withUserId('user_2')
          .withSource('test')
          .build(),
      ];

      await eventBus.publishBatch(events);
    });

    it('should query events by type', async () => {
      const results = await eventBus.queryEvents({
        types: [DomainEventType.USER_REGISTERED, DomainEventType.USER_UPDATED],
      });

      expect(results).toHaveLength(2);
      expect(
        results.every(
          (e) =>
            e.type === DomainEventType.USER_REGISTERED || e.type === DomainEventType.USER_UPDATED
        )
      ).toBe(true);
    });

    it('should query events by aggregate type', async () => {
      const results = await eventBus.queryEvents({
        aggregateTypes: ['User'],
      });

      expect(results).toHaveLength(2);
      expect(results.every((e) => e.aggregateType === 'User')).toBe(true);
    });

    it('should query events by user ID', async () => {
      const results = await eventBus.queryEvents({
        userId: 'user_1',
      });

      expect(results).toHaveLength(2);
      expect(results.every((e) => e.metadata.userId === 'user_1')).toBe(true);
    });

    it('should support pagination', async () => {
      const page1 = await eventBus.queryEvents({}, 2, 0);
      const page2 = await eventBus.queryEvents({}, 2, 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0]?.id);
    });
  });

  describe('Event Replay', () => {
    it('should replay events within time range', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour ago
      const later = new Date(now.getTime() + 3600000); // 1 hour later

      const event = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_CREATED)
        .withAggregateId('content_1')
        .withAggregateType('Content')
        .withSource('test')
        .build();

      await eventBus.publish(event);

      const replayed = await eventBus.replayEvents({
        from: earlier,
        to: later,
      });

      expect(replayed).toHaveLength(1);
      expect(replayed[0].id).toBe(event.id);
    });

    it('should replay events to handler', async () => {
      const handler = vi.fn();

      const events = [
        new DomainEventBuilder()
          .withType(DomainEventType.PAYMENT_RECEIVED)
          .withAggregateId('payment_1')
          .withAggregateType('Payment')
          .withSource('test')
          .build(),
        new DomainEventBuilder()
          .withType(DomainEventType.PAYMENT_RECEIVED)
          .withAggregateId('payment_2')
          .withAggregateType('Payment')
          .withSource('test')
          .build(),
      ];

      await eventBus.publishBatch(events);

      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000);
      const later = new Date(now.getTime() + 3600000);

      await eventBus.replayEventsToHandler(
        {
          from: earlier,
          to: later,
          filter: { types: [DomainEventType.PAYMENT_RECEIVED] },
        },
        handler
      );

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should respect batch size in replay', async () => {
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push(
          new DomainEventBuilder()
            .withType(DomainEventType.CONTENT_CREATED)
            .withAggregateId(`content_${i}`)
            .withAggregateType('Content')
            .withSource('test')
            .build()
        );
      }

      await eventBus.publishBatch(events);

      const now = new Date();
      const replayed = await eventBus.replayEvents({
        from: new Date(now.getTime() - 3600000),
        to: new Date(now.getTime() + 3600000),
        batchSize: 3,
      });

      expect(replayed).toHaveLength(10);
    });
  });

  describe('Error Handling', () => {
    it('should retry failed handlers', async () => {
      let callCount = 0;
      const handler = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First attempt failed');
        }
      });

      eventBus.subscribe(DomainEventType.PAYMENT_FAILED, handler);

      const event = new DomainEventBuilder()
        .withType(DomainEventType.PAYMENT_FAILED)
        .withAggregateId('payment_1')
        .withAggregateType('Payment')
        .withSource('test')
        .build();

      await eventBus.publish(event);

      // Wait for retry
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(handler).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should handle handler timeout', async () => {
      vi.useFakeTimers();

      const handler = vi.fn(async () => {
        // Simulate a very long running handler
        await new Promise((resolve) => setTimeout(resolve, 60000));
      });

      eventBus.subscribe(DomainEventType.SERVICE_ERROR, handler);

      const event = new DomainEventBuilder()
        .withType(DomainEventType.SERVICE_ERROR)
        .withAggregateId('service_1')
        .withAggregateType('Service')
        .withSource('test')
        .build();

      const publishPromise = eventBus.publish(event);

      // Advance past the 30s handler timeout + retry delay + retry timeout
      await vi.advanceTimersByTimeAsync(65000);

      await publishPromise;

      vi.useRealTimers();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should continue processing after handler error', async () => {
      const failingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const workingHandler = vi.fn();

      eventBus.subscribe(DomainEventType.USER_DELETED, failingHandler);
      eventBus.subscribe(DomainEventType.USER_DELETED, workingHandler);

      const event = new DomainEventBuilder()
        .withType(DomainEventType.USER_DELETED)
        .withAggregateId('user_1')
        .withAggregateType('User')
        .withSource('test')
        .build();

      await eventBus.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(failingHandler).toHaveBeenCalled();
      expect(workingHandler).toHaveBeenCalled();
    });
  });

  describe('Health and Management', () => {
    it('should report health status', async () => {
      const isHealthy = await eventBus.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should get active subscriptions', () => {
      eventBus.subscribe(DomainEventType.USER_REGISTERED, vi.fn());
      eventBus.subscribe(DomainEventType.PAYMENT_RECEIVED, vi.fn());

      const subscriptions = eventBus.getActiveSubscriptions();

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].eventTypes).toContain(DomainEventType.USER_REGISTERED);
      expect(subscriptions[1].eventTypes).toContain(DomainEventType.PAYMENT_RECEIVED);
    });

    it('should clear event store', async () => {
      const event = new DomainEventBuilder()
        .withType(DomainEventType.CONTENT_CREATED)
        .withAggregateId('content_1')
        .withAggregateType('Content')
        .withSource('test')
        .build();

      await eventBus.publish(event);

      const beforeClear = await eventBus.getEvent(event.id);
      expect(beforeClear).toBeDefined();

      await eventBus.clearEventStore();

      const afterClear = await eventBus.getEvent(event.id);
      expect(afterClear).toBeNull();
    });

    it('should dispose properly', async () => {
      eventBus.subscribe(DomainEventType.USER_REGISTERED, vi.fn());

      await eventBus.dispose();

      expect(eventBus.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe('Factory Function', () => {
    it('should create event bus with logger', () => {
      const bus = createEventBus(mockLogger);
      expect(bus).toBeInstanceOf(EventBusService);
    });

    it('should create event bus without logger', () => {
      const bus = createEventBus();
      expect(bus).toBeInstanceOf(EventBusService);
    });
  });
});
