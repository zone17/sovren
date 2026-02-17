/**
 * Bull Board Admin Route
 * Provides a web UI for monitoring BullMQ queues
 * Mounted at /admin/queues
 * Part of E0-001: BullMQ Infrastructure
 */

import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { IQueueService } from '../../interfaces/queue/IQueueService';

/**
 * Create a Bull Board admin router.
 * Must be called after queues have been created so they appear in the UI.
 */
export function createBullBoardRouter(queueService: IQueueService): Router {
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
