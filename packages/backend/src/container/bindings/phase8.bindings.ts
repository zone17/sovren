/**
 * Phase 8 Services Binding Module
 * Registers all Phase 8 Multi-Platform Hub services in the DI container
 * EPIC-009: Multi-Platform Distribution
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';
import { TYPES } from '../types';

// Distribution service implementations
import { PlatformConnectionService } from '../../services/distribution/PlatformConnectionService';
import { CrossPostService } from '../../services/distribution/CrossPostService';
import { RepurposingService } from '../../services/distribution/RepurposingService';
import { UnifiedInboxService } from '../../services/distribution/UnifiedInboxService';
import { CrossPlatformAnalyticsService } from '../../services/distribution/CrossPlatformAnalyticsService';
// EPIC-009B additions
import { InboxPollingService } from '../../services/distribution/InboxPollingService';
import { NostrReplyAdapter } from '../../services/distribution/NostrReplyAdapter';

/** Cast container-resolved DB to ISupabaseClient via unknown (safe DI pattern) */
function asDb(resolved: unknown): ISupabaseClient {
  return resolved as ISupabaseClient;
}

/**
 * Phase 8 Services Module
 * Multi-Platform Hub: Distribution (5 services) + EPIC-009B (2 services)
 * Total Services: 7
 */
export class Phase8ServicesModule implements IServiceModule {
  name = 'Phase8ServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // Distribution Services (EPIC-009)
    // ===========================

    registry.registerSingletonFactory(TYPES.PlatformConnectionService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new PlatformConnectionService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.CrossPostService, (container) => {
      const db = container.resolve(TYPES.Database);
      const queueService = container.resolve(TYPES.QueueService);
      const platformService = container.resolve(TYPES.PlatformConnectionService);
      const logger = container.resolve(TYPES.Logger);
      return new CrossPostService(
        asDb(db),
        queueService,
        platformService as IPlatformConnectionService,
        logger
      );
    });

    registry.registerSingletonFactory(TYPES.RepurposingService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new RepurposingService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.UnifiedInboxService, (container) => {
      const db = container.resolve(TYPES.Database);
      const platformService = container.resolve(TYPES.PlatformConnectionService);
      const logger = container.resolve(TYPES.Logger);
      return new UnifiedInboxService(
        asDb(db),
        platformService as IPlatformConnectionService,
        logger
      );
    });

    registry.registerSingletonFactory(TYPES.CrossPlatformAnalyticsService, (container) => {
      const db = container.resolve(TYPES.Database);
      const platformService = container.resolve(TYPES.PlatformConnectionService);
      const logger = container.resolve(TYPES.Logger);
      return new CrossPlatformAnalyticsService(
        asDb(db),
        platformService as IPlatformConnectionService,
        logger
      );
    });

    // ===========================
    // EPIC-009B Services
    // ===========================

    registry.registerSingletonFactory(TYPES.InboxPollingService, (container) => {
      const db = container.resolve(TYPES.Database);
      const platformService = container.resolve(TYPES.PlatformConnectionService);
      const logger = container.resolve(TYPES.Logger);
      return new InboxPollingService(
        asDb(db),
        platformService as IPlatformConnectionService,
        logger
      );
    });

    registry.registerSingletonFactory(TYPES.NostrReplyAdapter, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new NostrReplyAdapter(asDb(db), logger);
    });
  }
}

/**
 * Helper function to register all Phase 8 services
 */
export function registerPhase8Services(registry: IServiceRegistry): void {
  const module = new Phase8ServicesModule();
  registry.registerModule(module);
}
