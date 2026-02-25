/**
 * IDmcaService Interface
 * DMCA report generation (JSON + PDF)
 * EPIC-008: Content Shield
 */

import type { DmcaReport } from '@shared/types/provenance';

export interface IDmcaService {
  generateReport(creatorId: string, alertId: string): Promise<DmcaReport>;
}
