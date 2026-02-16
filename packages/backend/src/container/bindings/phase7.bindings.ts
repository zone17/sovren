/**
 * Phase 7 Services Binding Module
 * Registers all Phase 7 Creator Safety Net services in the DI container
 * EPIC-007: Creator Wellness + EPIC-008: Content Shield
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
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
      return new WellnessService(db as any, logger as any);
    });

    registry.registerSingletonFactory(TYPES.BurnoutScoringService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new BurnoutScoringService(db as any, logger as any);
    });

    registry.registerSingletonFactory(TYPES.ScheduleService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new ScheduleService(db as any, logger as any);
    });

    registry.registerSingletonFactory(TYPES.BoundaryService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new BoundaryService(db as any, logger as any);
    });

    // ===========================
    // Provenance Services (EPIC-008)
    // ===========================

    registry.registerSingletonFactory(TYPES.ProvenanceService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new ProvenanceService(db as any, logger as any);
    });

    registry.registerSingletonFactory(TYPES.FingerprintService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new FingerprintService(db as any, logger as any);
    });

    registry.registerSingletonFactory(TYPES.AlertService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new AlertService(db as any, logger as any);
    });

    registry.registerSingletonFactory(TYPES.DmcaService, (container) => {
      const db = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);
      return new DmcaService(db as any, logger as any);
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
