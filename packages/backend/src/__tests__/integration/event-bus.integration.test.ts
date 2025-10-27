/**
 * Event Bus Integration Tests
 * Tests event emission, subscription, routing, and ordering
 * Part of US-E5-034: Integration Test Suite
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import { createTestPayment, createTestSubscription } from '../fixtures/test-data-factory';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';
import type { IEventBusService } from '../../interfaces/shared/IEventBusService';

describe('Event Bus Integration Tests', () => {
  let container: IServiceContainer;
  let eventBus: IEventBusService;

  beforeEach(async () => {
    container = await createTestContainer();
    eventBus = container.resolve({ name: 'IEventBusService' });
    eventBus.clear?.();
  });

  afterEach(async () => {
    await cleanupTestContainer(container);
  });

  describe('Event Emission', () => {
    it('should publish events successfully', async () => {
      // Arrange
      const receivedEvents: any[] = [];
      eventBus.subscribe('test.event', (payload: any) => {
        receivedEvents.push(payload);
      });

      // Act
      await eventBus.publish('test.event', { data: 'test' });

      // Assert
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({ data: 'test' });
    });

    it('should emit payment events', async () => {
      // Arrange
      const payment = createTestPayment();
      const events: string[] = [];

      eventBus.subscribe('payment.created', () => events.push('created'));
      eventBus.subscribe('payment.verified', () => events.push('verified'));

      // Act
      await eventBus.publish('payment.created', payment);
      await eventBus.publish('payment.verified', { paymentId: payment.id });

      // Assert
      expect(events).toEqual(['created', 'verified']);
    });

    it('should emit subscription events', async () => {
      // Arrange
      const subscription = createTestSubscription();
      const events: any[] = [];

      eventBus.subscribe('subscription.created', (e) => events.push(e));

      // Act
      await eventBus.publish('subscription.created', subscription);

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ id: subscription.id });
    });
  });

  describe('Event Subscription', () => {
    it('should allow multiple subscribers to same event', async () => {
      // Arrange
      const handler1Results: any[] = [];
      const handler2Results: any[] = [];

      eventBus.subscribe('test.event', (p) => handler1Results.push(p));
      eventBus.subscribe('test.event', (p) => handler2Results.push(p));

      // Act
      await eventBus.publish('test.event', { value: 1 });

      // Assert
      expect(handler1Results).toHaveLength(1);
      expect(handler2Results).toHaveLength(1);
    });

    it('should support wildcard subscriptions', async () => {
      // Arrange
      const allPaymentEvents: string[] = [];

      eventBus.subscribe('payment.*', (payload: any) => {
        allPaymentEvents.push(payload.type);
      });

      // Act
      await eventBus.publish('payment.created', { type: 'created' });
      await eventBus.publish('payment.verified', { type: 'verified' });
      await eventBus.publish('payment.failed', { type: 'failed' });

      // Assert
      expect(allPaymentEvents).toEqual(['created', 'verified', 'failed']);
    });

    it('should support unsubscribe', async () => {
      // Arrange
      const events: any[] = [];
      const handler = (p: any) => events.push(p);

      eventBus.subscribe('test.event', handler);
      await eventBus.publish('test.event', { value: 1 });

      // Act - Unsubscribe
      eventBus.unsubscribe('test.event', handler);
      await eventBus.publish('test.event', { value: 2 });

      // Assert
      expect(events).toHaveLength(1); // Only first event received
    });
  });

  describe('Event Ordering', () => {
    it('should maintain event order for sequential publishes', async () => {
      // Arrange
      const order: number[] = [];

      eventBus.subscribe('ordered.event', async (payload: any) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push(payload.seq);
      });

      // Act
      for (let i = 0; i < 5; i++) {
        await eventBus.publish('ordered.event', { seq: i });
      }

      // Assert
      expect(order).toEqual([0, 1, 2, 3, 4]);
    });

    it('should handle async handlers in order', async () => {
      // Arrange
      const results: string[] = [];

      eventBus.subscribe('async.event', async (payload: any) => {
        await new Promise(resolve => setTimeout(resolve, payload.delay));
        results.push(payload.id);
      });

      // Act
      await eventBus.publish('async.event', { id: 'first', delay: 50 });
      await eventBus.publish('async.event', { id: 'second', delay: 10 });

      // Assert
      expect(results).toEqual(['first', 'second']);
    });
  });

  describe('Error Handling', () => {
    it('should continue publishing despite handler errors', async () => {
      // Arrange
      const successfulHandler: any[] = [];

      eventBus.subscribe('error.event', () => {
        throw new Error('Handler failed');
      });

      eventBus.subscribe('error.event', (p) => {
        successfulHandler.push(p);
      });

      // Act
      try {
        await eventBus.publish('error.event', { test: true });
      } catch (error) {
        // Expected
      }

      // Assert - Second handler should still execute
      expect(successfulHandler.length).toBeGreaterThan(0);
    });

    it('should isolate errors between handlers', async () => {
      // Arrange
      const results: string[] = [];

      eventBus.subscribe('test.event', () => {
        results.push('handler1');
        throw new Error('Error in handler 1');
      });

      eventBus.subscribe('test.event', () => {
        results.push('handler2');
      });

      // Act
      try {
        await eventBus.publish('test.event', {});
      } catch (error) {
        // Expected
      }

      // Assert
      expect(results).toContain('handler1');
      expect(results).toContain('handler2');
    });
  });

  describe('Event Replay', () => {
    it('should store published events for replay', async () => {
      // Act
      await eventBus.publish('replay.event', { value: 1 });
      await eventBus.publish('replay.event', { value: 2 });

      // Assert
      const publishedEvents = eventBus.getPublishedEvents?.() || [];
      expect(publishedEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should replay events to new subscribers', async () => {
      // Arrange
      await eventBus.publish('history.event', { value: 1 });

      // Act - Subscribe after events published
      const lateEvents: any[] = [];
      eventBus.subscribe('history.event', (p) => lateEvents.push(p));

      // Re-publish stored events
      const stored = eventBus.getPublishedEvents?.() || [];
      for (const evt of stored.filter((e: any) => e.event === 'history.event')) {
        await eventBus.publish('history.event', evt.payload);
      }

      // Assert
      expect(lateEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle high-volume events', async () => {
      // Arrange
      let count = 0;
      eventBus.subscribe('volume.event', () => { count++; });

      // Act
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        await eventBus.publish('volume.event', { seq: i });
      }
      const duration = Date.now() - start;

      // Assert
      expect(count).toBe(1000);
      expect(duration).toBeLessThan(5000); // Complete in < 5s
    });

    it('should handle many concurrent publishes', async () => {
      // Arrange
      const results: number[] = [];
      eventBus.subscribe('concurrent.event', (p: any) => {
        results.push(p.value);
      });

      // Act
      const publishes = Array.from({ length: 100 }, (_, i) =>
        eventBus.publish('concurrent.event', { value: i })
      );

      await Promise.all(publishes);

      // Assert
      expect(results).toHaveLength(100);
    });
  });

  describe('Event Routing', () => {
    it('should route domain events correctly', async () => {
      // Arrange
      const paymentEvents: any[] = [];
      const subscriptionEvents: any[] = [];

      eventBus.subscribe('payment.*', (p) => paymentEvents.push(p));
      eventBus.subscribe('subscription.*', (p) => subscriptionEvents.push(p));

      // Act
      await eventBus.publish('payment.created', { type: 'payment' });
      await eventBus.publish('subscription.created', { type: 'subscription' });

      // Assert
      expect(paymentEvents).toHaveLength(1);
      expect(subscriptionEvents).toHaveLength(1);
    });

    it('should support event filtering', async () => {
      // Arrange
      const premiumEvents: any[] = [];

      eventBus.subscribe('content.created', (payload: any) => {
        if (payload.isPremium) {
          premiumEvents.push(payload);
        }
      });

      // Act
      await eventBus.publish('content.created', { isPremium: true, id: 1 });
      await eventBus.publish('content.created', { isPremium: false, id: 2 });

      // Assert
      expect(premiumEvents).toHaveLength(1);
      expect(premiumEvents[0].id).toBe(1);
    });
  });

  describe('Integration with Services', () => {
    it('should coordinate payment processing via events', async () => {
      // Arrange
      const payment = createTestPayment();
      const workflow: string[] = [];

      eventBus.subscribe('payment.created', () => workflow.push('created'));
      eventBus.subscribe('payment.verified', () => workflow.push('verified'));
      eventBus.subscribe('payment.settled', () => workflow.push('settled'));

      // Act
      await eventBus.publish('payment.created', payment);
      await eventBus.publish('payment.verified', { paymentId: payment.id });
      await eventBus.publish('payment.settled', { paymentId: payment.id });

      // Assert
      expect(workflow).toEqual(['created', 'verified', 'settled']);
    });

    it('should trigger notifications on events', async () => {
      // Arrange
      const notifications: any[] = [];

      eventBus.subscribe('payment.succeeded', async (payload: any) => {
        notifications.push({
          type: 'payment_success',
          userId: payload.userId
        });
      });

      // Act
      await eventBus.publish('payment.succeeded', { userId: 'user-123', amount: 1000 });

      // Assert
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: 'payment_success',
        userId: 'user-123'
      });
    });
  });
});
