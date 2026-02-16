/**
 * Wellness API Validation Schemas
 * Zod schemas for /api/v2/wellness/* endpoints
 * EPIC-007: Creator Wellness System
 */

import { z } from 'zod';

// ============================================================================
// Work Patterns
// ============================================================================

export const RecordWorkPatternSchema = z.object({
  type: z.enum(['content_creation', 'engagement', 'management']),
  duration_mins: z.number().int().positive().max(1440),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const GetWorkPatternsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('7d'),
});

export const GetHeatmapQuerySchema = z.object({
  period: z.enum(['7d', '30d']).default('7d'),
});

// ============================================================================
// Burnout Risk Score
// ============================================================================

export const SetSensitivitySchema = z.object({
  sensitivity: z.enum(['relaxed', 'normal', 'sensitive']),
});

// ============================================================================
// Pulse Check-Ins
// ============================================================================

export const RecordPulseSchema = z.object({
  energy: z.number().int().min(1).max(5),
  motivation: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
});

export const GetPulseHistoryQuerySchema = z.object({
  period: z.enum(['30d', '90d', 'all']).default('90d'),
});

// ============================================================================
// Boundaries
// ============================================================================

export const UpdateBoundariesSchema = z.object({
  focus_hours: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string(),
      days: z.array(
        z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
      ),
    })
    .optional(),
  weekly_engagement_budget_mins: z.number().int().min(0).max(10080).optional(),
  dnd_mode: z
    .object({
      auto_response_enabled: z.boolean(),
      auto_response_template: z.string().max(500).transform((val) => {
        // Decode HTML entities first to prevent double-encoding bypass
        const decoded = val
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'");
        // Strip HTML tags
        return decoded.replace(/<[^>]*>/g, '');
      }),
    })
    .optional(),
  availability_status: z.enum(['hidden', 'available', 'creating', 'offline']).optional(),
  notification_batching: z.boolean().optional(),
});

// ============================================================================
// Aggregated exports for route use
// ============================================================================

export const WellnessValidators = {
  recordWorkPattern: RecordWorkPatternSchema,
  getWorkPatterns: GetWorkPatternsQuerySchema,
  getHeatmap: GetHeatmapQuerySchema,
  setSensitivity: SetSensitivitySchema,
  recordPulse: RecordPulseSchema,
  getPulseHistory: GetPulseHistoryQuerySchema,
  updateBoundaries: UpdateBoundariesSchema,
};
