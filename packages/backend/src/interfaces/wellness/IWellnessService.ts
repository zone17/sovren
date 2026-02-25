/**
 * IWellnessService Interface
 * Handles work pattern CRUD and pulse check-ins
 * EPIC-007: Creator Wellness System
 */

import type {
  WorkPattern,
  WorkPatternAggregation,
  HeatmapData,
  PulseCheckIn,
  PulseHistory,
  WellnessBenchmark,
  WorkActivityType,
} from '@shared/types/wellness';

export interface CreateWorkPatternInput {
  type: WorkActivityType;
  duration_mins: number;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface PulseInput {
  energy: number;
  motivation: number;
  stress: number;
}

export interface IWellnessService {
  recordWorkPattern(creatorId: string, input: CreateWorkPatternInput): Promise<WorkPattern>;
  getWorkPatterns(creatorId: string, period: '7d' | '30d' | '90d'): Promise<WorkPatternAggregation>;
  getHeatmap(creatorId: string, period: '7d' | '30d'): Promise<HeatmapData>;
  recordPulse(creatorId: string, input: PulseInput): Promise<PulseCheckIn>;
  getPulseHistory(creatorId: string, period: '30d' | '90d' | 'all'): Promise<PulseHistory>;
  deletePulseHistory(creatorId: string): Promise<number>;
  deleteAllWellnessData(creatorId: string): Promise<Record<string, number>>;
  getBenchmark(): Promise<WellnessBenchmark | null>;
}
