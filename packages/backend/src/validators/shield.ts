/**
 * Content Shield API Validation Schemas
 * Zod schemas for /api/v2/shield/* endpoints
 * EPIC-008: Content Shield
 */

import { z } from 'zod';

// ============================================================================
// Provenance
// ============================================================================

export const ContentIdParamSchema = z.object({
  contentId: z.string().min(1),
});

export const CertificateQuerySchema = z.object({
  format: z.enum(['json', 'pdf']).default('json'),
});

// ============================================================================
// Fingerprinting
// ============================================================================

export const CreateFingerprintSchema = z.object({
  content_id: z.string().min(1),
  content_type: z.enum(['text', 'image']),
  content_data: z.string().min(1).max(10_000_000), // 10MB max for base64 images
});

export const GetFingerprintsParamSchema = z.object({
  creatorId: z.string().min(1),
});

export const GetFingerprintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CompareSchema = z.object({
  hash_type: z.enum(['simhash', 'phash']),
  hash_value: z.string().regex(/^[0-9a-f]{16}$/, 'Must be a 16-character hex string'),
  threshold: z.number().min(0).max(1).default(0.70),
});

// ============================================================================
// Alerts
// ============================================================================

export const GetAlertsQuerySchema = z.object({
  status: z.enum(['new', 'reviewed', 'resolved', 'false_positive', 'reported']).default('new'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AlertIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const UpdateAlertStatusSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'false_positive', 'reported']),
});

// ============================================================================
// DMCA
// ============================================================================

export const DmcaReportQuerySchema = z.object({
  format: z.enum(['json', 'pdf']).default('json'),
});

// ============================================================================
// Provenance Sign
// ============================================================================

export const SignProvenanceBodySchema = z.object({
  content_id: z.string().min(1).max(255),
  content_body: z.string().min(1).max(1_000_000), // 1MB limit
  nostr_event_id: z.string().min(1).max(255),
  signature: z.string().min(1).max(2048),
  relays: z.array(z.string().url()).max(20).optional().default([]),
});

// ============================================================================
// Inferred types for route handlers
// ============================================================================

export type ContentIdParams = z.infer<typeof ContentIdParamSchema>;
export type CertificateQuery = z.infer<typeof CertificateQuerySchema>;
export type SignProvenanceBody = z.infer<typeof SignProvenanceBodySchema>;
export type CreateFingerprintBody = z.infer<typeof CreateFingerprintSchema>;
export type GetFingerprintsParams = z.infer<typeof GetFingerprintsParamSchema>;
export type GetFingerprintsQuery = z.infer<typeof GetFingerprintsQuerySchema>;
export type CompareBody = z.infer<typeof CompareSchema>;
export type GetAlertsQuery = z.infer<typeof GetAlertsQuerySchema>;
export type AlertIdParams = z.infer<typeof AlertIdParamSchema>;
export type UpdateAlertStatusBody = z.infer<typeof UpdateAlertStatusSchema>;
export type DmcaReportQuery = z.infer<typeof DmcaReportQuerySchema>;

// ============================================================================
// Aggregated exports for route use
// ============================================================================

export const ShieldValidators = {
  contentIdParam: ContentIdParamSchema,
  certificateQuery: CertificateQuerySchema,
  signProvenanceBody: SignProvenanceBodySchema,
  createFingerprint: CreateFingerprintSchema,
  getFingerprintsParam: GetFingerprintsParamSchema,
  getFingerprintsQuery: GetFingerprintsQuerySchema,
  compare: CompareSchema,
  getAlertsQuery: GetAlertsQuerySchema,
  alertIdParam: AlertIdParamSchema,
  updateAlertStatus: UpdateAlertStatusSchema,
  dmcaReportQuery: DmcaReportQuerySchema,
};
