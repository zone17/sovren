/**
 * Phase 7 Services Binding Module
 * Registers all Phase 7 Creator Safety Net services in the DI container
 * EPIC-007: Creator Wellness + EPIC-008: Content Shield
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import { TYPES } from '../types';

// Wellness service implementations
import { WellnessService } from '../../services/wellness/WellnessService';
import { BurnoutScoringService } from '../../services/wellness/BurnoutScoringService';
import { ScheduleService } from '../../services/wellness/ScheduleService';
import { BoundaryService } from '../../services/wellness/BoundaryService';

// Provenance service implementations
import { ProvenanceService } from '../../services/provenance/ProvenanceService';
import { FingerprintService } from '../../services/provenance/FingerprintService';
import { AlertService } from '../../services/provenance/AlertService';
import { DmcaService } from '../../services/provenance/DmcaService';

/** Cast container-resolved DB to ISupabaseClient via unknown (safe DI pattern) */
function asDb(resolved: unknown): ISupabaseClient {
  return resolved as ISupabaseClient;
}

/**
 * Phase 7 Services Module
 * Creator Safety Net: Wellness (4 services) + Content Shield (4 services)
 * Total Services: 8
 */
export class Phase7ServicesModule implements IServiceModule {
  name = 'Phase7ServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // Wellness Services (EPIC-007)
    // ===========================

    registry.registerSingletonFactory(TYPES.WellnessService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new WellnessService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.BurnoutScoringService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new BurnoutScoringService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.ScheduleService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new ScheduleService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.BoundaryService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new BoundaryService(asDb(db), logger);
    });

    // ===========================
    // Provenance Services (EPIC-008)
    // ===========================

    registry.registerSingletonFactory(TYPES.ProvenanceService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new ProvenanceService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.FingerprintService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new FingerprintService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.AlertService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new AlertService(asDb(db), logger);
    });

    registry.registerSingletonFactory(TYPES.DmcaService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new DmcaService(asDb(db), logger);
    });
  }
}

/**
 * Helper function to register all Phase 7 services
 */
export function registerPhase7Services(registry: IServiceRegistry): void {
  const module = new Phase7ServicesModule();
  registry.registerModule(module);
}
