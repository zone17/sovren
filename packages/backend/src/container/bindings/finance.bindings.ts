/**
 * Finance Services Binding Module
 * EPIC-011: Business Manager — Contracts, Invoicing, Revenue, Tax
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import { TYPES } from '../types';

import { ContractService } from '../../services/finance/ContractService';
import { BusinessInvoiceService } from '../../services/finance/BusinessInvoiceService';
import { RevenueService } from '../../services/finance/RevenueService';
import { TaxService } from '../../services/finance/TaxService';

function asDb(resolved: unknown): ISupabaseClient {
  return resolved as ISupabaseClient;
}

/**
 * Finance Services Module
 * Business Manager: Contracts, Invoicing, Revenue, Tax (4 services)
 */
export class FinanceServicesModule implements IServiceModule {
  name = 'FinanceServicesModule';

  register(registry: IServiceRegistry): void {
    registry.registerSingletonFactory(TYPES.ContractService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new ContractService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.BusinessInvoiceService, (container) => {
      const db = container.resolve(TYPES.Database);
      const queueService = container.resolve(TYPES.QueueService);
      const logger = container.resolve(TYPES.Logger);
      return new BusinessInvoiceService(asDb(db), queueService, logger);
    });

    registry.registerSingletonFactory(TYPES.RevenueService, (container) => {
      const db = container.resolve(TYPES.Database);
      const cacheService = container.resolve(TYPES.CacheService);
      const logger = container.resolve(TYPES.Logger);
      return new RevenueService(asDb(db), cacheService, logger);
    });

    registry.registerSingletonFactory(TYPES.TaxService, (container) => {
      const db = container.resolve(TYPES.Database);
      const cacheService = container.resolve(TYPES.CacheService);
      const logger = container.resolve(TYPES.Logger);
      return new TaxService(asDb(db), cacheService, logger);
    });
  }
}

/**
 * Register all EPIC-011 Finance services
 */
export function registerFinanceServices(registry: IServiceRegistry): void {
  const module = new FinanceServicesModule();
  registry.registerModule(module);
}
