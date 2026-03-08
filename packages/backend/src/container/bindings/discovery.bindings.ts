// @ts-nocheck
/**
 * Discovery Services Binding Module
 * Todo #568: DiscoveryService DI registration
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import { TYPES } from '../types';
import { DiscoveryService } from '../../services/discovery/DiscoveryService';

/** Cast container-resolved DB to ISupabaseClient via unknown (safe DI pattern) */
function asDb(resolved: unknown): ISupabaseClient {
  return resolved as ISupabaseClient;
}

export class DiscoveryServicesModule implements IServiceModule {
  name = 'DiscoveryServicesModule';

  register(registry: IServiceRegistry): void {
    registry.registerSingletonFactory(TYPES.DiscoveryService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new DiscoveryService(asDb(db), logger);
    });
  }
}

export function registerDiscoveryServices(registry: IServiceRegistry): void {
  const module = new DiscoveryServicesModule();
  registry.registerModule(module);
}
