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
  metadata: z
    .record(z.string(), z.string())
    .refine((obj) => JSON.stringify(obj).length <= 10000, {
      message: 'Metadata must be less than 10KB',
    })
    .optional(),
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
      start: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid HH:MM time format'),
      end: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid HH:MM time format'),
      timezone: z
        .string()
        .max(64)
        .regex(/^[A-Za-z][A-Za-z0-9/_+-]{0,63}$/, 'Invalid IANA timezone identifier'),
      days: z.array(
        z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
      ),
    })
    .optional(),
  weekly_engagement_budget_mins: z.number().int().min(0).max(10080).optional(),
  dnd_mode: z
    .object({
      active: z.boolean().optional(),
      auto_response_enabled: z.boolean().optional(),
      auto_response_template: z
        .string()
        .max(500)
        .transform((val: string) => {
          // Decode HTML entities first to prevent double-encoding bypass
          let decoded = val
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&#039;/g, "'");
          // Strip HTML tags
          decoded = decoded.replace(/<[^>]*>/g, '');
          // Remove event handler patterns (onmouseover=, onclick=, etc.)
          decoded = decoded.replace(/\bon\w+\s*=/gi, '');
          // Remove javascript: URIs
          decoded = decoded.replace(/javascript\s*:/gi, '');
          return decoded;
        })
        .pipe(z.string().max(500))
        .optional(),
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
