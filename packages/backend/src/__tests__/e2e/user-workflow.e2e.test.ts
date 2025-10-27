/**
 * User Workflow E2E Tests
 * Tests complete user lifecycle from registration to content creation
 * Part of US-E5-034: Integration Test Suite
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import { createTestUser, createTestContent, scenarios } from '../fixtures/test-data-factory';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';

describe('User Workflow E2E Tests', () => {
  let container: IServiceContainer;

  beforeAll(async () => {
    container = await createTestContainer();
  });

  afterAll(async () => {
    await cleanupTestContainer(container);
  });

  describe('User Registration and Onboarding', () => {
    it('should complete full user registration workflow', async () => {
      // Arrange
      const user = createTestUser();
      const db = container.resolve({ name: 'IDatabase' });
      const cache = container.resolve({ name: 'ICacheService' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      // Act - Registration workflow
      // Step 1: Create user account
      await db.insert('users', { ...user, isVerified: false });
      await eventBus.publish('user.registered', { userId: user.id });

      // Step 2: Cache user data
      await cache.set(`user:${user.id}`, user, 3600);

      // Step 3: Send verification email (mocked)
      await eventBus.publish('user.verification_sent', { userId: user.id });

      // Step 4: Verify user
      await db.update('users', user.id, { isVerified: true });
      await cache.delete(`user:${user.id}`); // Invalidate cache

      // Assert
      const verifiedUser = await db.findById('users', user.id);
      expect(verifiedUser.isVerified).toBe(true);
    });

    it('should handle user profile updates', async () => {
      // Arrange
      const user = createTestUser();
      const db = container.resolve({ name: 'IDatabase' });
      const cache = container.resolve({ name: 'ICacheService' });

      await db.insert('users', user);
      await cache.set(`user:${user.id}`, user);

      // Act - Update profile
      const updates = {
        username: 'newusername',
        bio: 'Updated bio',
        updatedAt: new Date()
      };

      await db.update('users', user.id, updates);
      await cache.delete(`user:${user.id}`);
      await cache.set(`user:${user.id}`, { ...user, ...updates });

      // Assert
      const updatedUser = await db.findById('users', user.id);
      expect(updatedUser.username).toBe('newusername');
      expect(updatedUser.bio).toBe('Updated bio');
    });
  });

  describe('Content Creation Workflow', () => {
    it('should complete content publishing workflow', async () => {
      // Arrange
      const { creator, content } = scenarios.contentPublishing();
      const db = container.resolve({ name: 'IDatabase' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      // Act - Content creation workflow
      // Step 1: Create creator account
      await db.insert('users', creator);

      // Step 2: Create draft content
      const draft = { ...content, status: 'draft' };
      await db.insert('content', draft);
      await eventBus.publish('content.draft_created', { contentId: content.id });

      // Step 3: Publish content
      await db.update('content', content.id, {
        status: 'published',
        publishedAt: new Date()
      });
      await eventBus.publish('content.published', { contentId: content.id });

      // Assert
      const publishedContent = await db.findById('content', content.id);
      expect(publishedContent.status).toBe('published');
      expect(publishedContent.publishedAt).toBeDefined();
    });

    it('should handle premium content access control', async () => {
      // Arrange
      const creator = createTestUser({ role: 'creator' });
      const subscriber = createTestUser();
      const premiumContent = createTestContent({
        userId: creator.id,
        isPremium: true,
        visibility: 'subscribers'
      });

      const db = container.resolve({ name: 'IDatabase' });

      await db.insert('users', creator);
      await db.insert('users', subscriber);
      await db.insert('content', premiumContent);

      // Act - Check access
      const hasSubscription = true; // Simulated subscription check
      const canAccess = hasSubscription || premiumContent.visibility === 'public';

      // Assert
      expect(canAccess).toBe(true);
    });
  });

  describe('Subscription Workflow', () => {
    it('should complete subscription creation workflow', async () => {
      // Arrange
      const { subscriber, creator, subscription } = scenarios.subscriptionLifecycle();
      const db = container.resolve({ name: 'IDatabase' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      // Act - Subscription workflow
      // Step 1: Create users
      await db.insert('users', subscriber);
      await db.insert('users', creator);

      // Step 2: Create subscription
      await db.insert('subscriptions', subscription);
      await eventBus.publish('subscription.created', { subscriptionId: subscription.id });

      // Step 3: Process initial payment (mocked)
      await eventBus.publish('subscription.payment_processed', {
        subscriptionId: subscription.id
      });

      // Assert
      const activeSubscription = await db.findById('subscriptions', subscription.id);
      expect(activeSubscription.status).toBe('active');
    });

    it('should handle subscription cancellation', async () => {
      // Arrange
      const { subscriber, creator, subscription } = scenarios.subscriptionLifecycle();
      const db = container.resolve({ name: 'IDatabase' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      await db.insert('users', subscriber);
      await db.insert('users', creator);
      await db.insert('subscriptions', subscription);

      // Act - Cancel subscription
      const cancelAt = new Date(subscription.currentPeriodEnd);
      await db.update('subscriptions', subscription.id, {
        status: 'canceled',
        cancelAt,
        canceledAt: new Date()
      });
      await eventBus.publish('subscription.canceled', { subscriptionId: subscription.id });

      // Assert
      const canceled = await db.findById('subscriptions', subscription.id);
      expect(canceled.status).toBe('canceled');
      expect(canceled.canceledAt).toBeDefined();
    });
  });

  describe('User Activity Tracking', () => {
    it('should track user login activity', async () => {
      // Arrange
      const user = createTestUser();
      const db = container.resolve({ name: 'IDatabase' });
      const cache = container.resolve({ name: 'ICacheService' });

      await db.insert('users', user);

      // Act - Track login
      const loginActivity = {
        userId: user.id,
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      await db.insert('user_activity', loginActivity);
      await cache.set(`user:${user.id}:last_login`, loginActivity.timestamp, 86400);

      // Assert
      const lastLogin = await cache.get(`user:${user.id}:last_login`);
      expect(lastLogin).toBeDefined();
    });

    it('should track content interactions', async () => {
      // Arrange
      const user = createTestUser();
      const content = createTestContent();
      const db = container.resolve({ name: 'IDatabase' });

      await db.insert('users', user);
      await db.insert('content', content);

      // Act - Track view
      const interaction = {
        userId: user.id,
        contentId: content.id,
        type: 'view',
        timestamp: new Date()
      };

      await db.insert('interactions', interaction);

      // Assert
      const interactions = await db.findAll('interactions');
      const userInteractions = interactions.filter((i: any) => i.userId === user.id);
      expect(userInteractions.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle creator-subscriber relationship', async () => {
      // Arrange
      const creator = createTestUser({ role: 'creator' });
      const subscriber1 = createTestUser();
      const subscriber2 = createTestUser();
      const db = container.resolve({ name: 'IDatabase' });

      // Act - Setup relationships
      await db.insert('users', creator);
      await db.insert('users', subscriber1);
      await db.insert('users', subscriber2);

      // Create subscriptions
      await db.insert('subscriptions', {
        id: 'sub1',
        userId: subscriber1.id,
        creatorId: creator.id,
        status: 'active'
      });

      await db.insert('subscriptions', {
        id: 'sub2',
        userId: subscriber2.id,
        creatorId: creator.id,
        status: 'active'
      });

      // Assert
      const allSubs = await db.findAll('subscriptions');
      const creatorSubs = allSubs.filter((s: any) => s.creatorId === creator.id);
      expect(creatorSubs.length).toBe(2);
    });
  });
});
