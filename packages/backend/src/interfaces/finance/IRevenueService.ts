/**
 * Revenue Service Interface
 * EPIC-011: Business Manager — Revenue tracking and diversification
 */

import type { DiversificationGoal } from '@shared/types/finance';

export interface IRevenueService {
  getRevenueBreakdown(
    creatorId: string,
    period?: { start: string; end: string }
  ): Promise<Array<{ source: string; totalSats: number; percentage: number }>>;
  getConcentrationRisk(creatorId: string): Promise<{
    riskLevel: string;
    dominantSource: string;
    percentage: number;
    suggestions: string[];
  }>;
  getDiversificationGoals(creatorId: string): Promise<DiversificationGoal | null>;
  setDiversificationGoals(creatorId: string, targets: Record<string, number>): Promise<void>;
  recordRevenue(
    creatorId: string,
    data: { source: string; amountSats: number; description?: string }
  ): Promise<{ id: string }>;
}
