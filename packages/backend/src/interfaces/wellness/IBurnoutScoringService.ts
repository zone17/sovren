/**
 * IBurnoutScoringService Interface
 * Weighted 5-factor burnout scoring per ADR-019
 * EPIC-007: Creator Wellness System
 */

import type { BurnoutRiskScore, SensitivityLevel } from '@shared/types/wellness';

export interface IBurnoutScoringService {
  calculateScore(creatorId: string): Promise<BurnoutRiskScore>;
  setSensitivity(creatorId: string, sensitivity: SensitivityLevel): Promise<{ sensitivity: SensitivityLevel; updated_at: string }>;
  getSensitivity(creatorId: string): Promise<SensitivityLevel>;
}
