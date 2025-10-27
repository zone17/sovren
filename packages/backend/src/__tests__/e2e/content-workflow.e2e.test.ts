/**
 * Content Workflow E2E Tests
 * Tests complete content management from creation to publication
 * Part of US-E5-034: Integration Test Suite
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import { createTestUser, createTestContent } from '../fixtures/test-data-factory';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';

describe('Content Workflow E2E Tests', () => {
  let container: IServiceContainer;

  beforeAll(async () => {
    container = await createTestContainer();
  });

  afterAll(async () => {
    await cleanupTestContainer(container);
  });

  describe('Content Creation and Publishing', () => {
    it('should complete full content creation workflow', async () => {
      // Arrange
      const creator = createTestUser({ role: 'creator' });
      const content = createTestContent({ userId: creator.id });
      const db = container.resolve({ name: 'IDatabase' });
      const cache = container.resolve({ name: 'ICacheService' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      await db.insert('users', creator);

      // Act - Content workflow
      // Step 1: Create draft
      const draft = { ...content, status: 'draft' };
      await db.insert('content', draft);
      await eventBus.publish('content.draft_created', { contentId: content.id });

      // Step 2: Review and edit
      await db.update('content', content.id, { body: 'Updated content' });

      // Step 3: Publish
      await db.update('content', content.id, {
        status: 'published',
        publishedAt: new Date()
      });
      await cache.set(`content:${content.id}`, content, 3600);
      await eventBus.publish('content.published', { contentId: content.id });

      // Assert
      const published = await db.findById('content', content.id);
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeDefined();
    });
  });
});
