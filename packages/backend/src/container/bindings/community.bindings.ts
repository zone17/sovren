/**
 * Community Services Binding Module
 * EPIC-010: Creator Network — Circles, Mentorship, Collaboration, Marketplace
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import { TYPES } from '../types';

import { CommentsService } from '../../services/community/CommentsService';
import { CreatorCircleService } from '../../services/community/CreatorCircleService';
import { MentorshipService } from '../../services/community/MentorshipService';
import { CollaborativeContentService } from '../../services/community/CollaborativeContentService';
import { MarketplaceService } from '../../services/community/MarketplaceService';
import { FollowService } from '../../services/community/FollowService';
import { NotificationPersistenceService } from '../../services/community/NotificationPersistenceService';

/** Cast container-resolved DB to ISupabaseClient via unknown (safe DI pattern) */
function asDb(resolved: unknown): ISupabaseClient {
  return resolved as ISupabaseClient;
}

/**
 * Community Services Module
 * EPIC-010: Creator Network (4 services)
 */
export class CommunityServicesModule implements IServiceModule {
  name = 'CommunityServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // Comments (Slice 6)
    // ===========================

    registry.registerSingletonFactory(TYPES.CommentsService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      const eventBus = container.resolve(TYPES.EventBusService);
      return new CommentsService(asDb(db), logger, eventBus);
    });

    // ===========================
    // Slice 8: Follow + Notifications
    // ===========================

    registry.registerSingletonFactory(TYPES.FollowService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      const eventBus = container.resolve(TYPES.EventBusService);
      return new FollowService(asDb(db), logger, eventBus);
    });

    registry.registerSingletonFactory(TYPES.NotificationPersistenceService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      const eventBus = container.resolve(TYPES.EventBusService);
      return new NotificationPersistenceService(asDb(db), logger, eventBus);
    });
    // NOTE (#702/#728): subscribeToEvents() is called exactly ONCE by server.ts eager init
    // (container.resolve(TYPES.NotificationPersistenceService) → service.subscribeToEvents()).
    // Calling it in the factory would cause a double-subscription on every hot-reload or test.

    // ===========================
    // Community Services (EPIC-010)
    // ===========================

    registry.registerSingletonFactory(TYPES.CreatorCircleService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      const eventBus = container.resolve(TYPES.EventBusService);
      return new CreatorCircleService(asDb(db), logger, eventBus);
    });

    registry.registerSingletonFactory(TYPES.MentorshipService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      const eventBus = container.resolve(TYPES.EventBusService);
      return new MentorshipService(asDb(db), logger, eventBus);
    });

    registry.registerSingletonFactory(TYPES.CollaborativeContentService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new CollaborativeContentService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.MarketplaceService, (container) => {
      const db = container.resolve(TYPES.Database);
      const lightning = container.resolve(TYPES.LightningService);
      const queue = container.resolve(TYPES.QueueService);
      const logger = container.resolve(TYPES.Logger);
      return new MarketplaceService(
        asDb(db),
        lightning as ConstructorParameters<typeof MarketplaceService>[1],
        queue as ConstructorParameters<typeof MarketplaceService>[2],
        logger
      );
    });
  }
}

/**
 * Helper function to register all Community services
 */
export function registerCommunityServices(registry: IServiceRegistry): void {
  const module = new CommunityServicesModule();
  registry.registerModule(module);
}
