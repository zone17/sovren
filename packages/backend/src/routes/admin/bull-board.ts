/**
 * Bull Board Admin Route
 * Provides a web UI for monitoring BullMQ queues
 * Mounted at /admin/queues (behind admin auth middleware)
 * Part of E0-001: BullMQ Infrastructure
 */

import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { QueueService } from '../../services/queue/QueueService';

/**
 * Create a Bull Board admin router.
 * Accepts the concrete QueueService (not IQueueService) because
 * getQueue() is an implementation detail not on the interface.
 * Auth middleware is applied at the mount point in app.ts.
 */
export function createBullBoardRouter(queueService: QueueService): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queueNames = queueService.getQueueNames();
  const adapters = queueNames.map((name) => {
    const queue = queueService.getQueue(name)!;
    return new BullMQAdapter(queue);
  });

  createBullBoard({
    queues: adapters,
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
