/**
 * Queue Services Binding Module
 * Registers BullMQ QueueService in the DI container
 * ADR-022: Job Queue Selection — BullMQ
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import { TYPES } from '../types';
import { QueueService } from '../../services/queue/QueueService';

/**
 * Queue Services Module
 * Registers the BullMQ-backed QueueService as a singleton
 */
export class QueueServicesModule implements IServiceModule {
  name = 'QueueServicesModule';

  register(registry: IServiceRegistry): void {
    registry.registerSingletonFactory(TYPES.QueueService, (container) => {
      const logger = container.resolve(TYPES.Logger);
      return new QueueService(logger);
    });
  }
}

/**
 * Helper function to register queue services
 */
export function registerQueueServices(registry: IServiceRegistry): void {
  const module = new QueueServicesModule();
  registry.registerModule(module);
}
