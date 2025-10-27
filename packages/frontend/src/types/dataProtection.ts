import { z } from 'zod';

// ===========================
// US-127: DATA ENCRYPTION TYPES
// ===========================

export const EncryptionAlgorithmSchema = z.enum([
  'AES-256-GCM',
  'AES-256-CBC',
  'ChaCha20-Poly1305',
  'XSalsa20-Poly1305',
]);

export const KeyDerivationSchema = z.enum(['PBKDF2', 'scrypt', 'Argon2id', 'HKDF']);

export const EncryptedDataSchema = z.object({
  data: z.string(),
  algorithm: EncryptionAlgorithmSchema,
  iv: z.string(),
  salt: z.string(),
  authTag: z.string().optional(),
  keyDerivation: KeyDerivationSchema,
  iterations: z.number().positive(),
  encrypted_at: z.number(),
  version: z.string(),
});

export const EncryptionKeySchema = z.object({
  id: z.string(),
  algorithm: EncryptionAlgorithmSchema,
  keyDerivation: KeyDerivationSchema,
  created_at: z.number(),
  expires_at: z.number().optional(),
  rotated_count: z.number().default(0),
  last_rotated: z.number().optional(),
  usage_count: z.number().default(0),
  is_active: z.boolean().default(true),
});

export const FieldEncryptionConfigSchema = z.object({
  field_name: z.string(),
  encryption_required: z.boolean(),
  algorithm: EncryptionAlgorithmSchema,
  key_rotation_interval: z.number(),
  access_log_required: z.boolean(),
});

export const EncryptionMetricsSchema = z.object({
  total_encrypted_fields: z.number(),
  encryption_operations: z.number(),
  decryption_operations: z.number(),
  key_rotations: z.number(),
  performance_ms: z.number(),
  errors: z.number(),
  last_updated: z.number(),
});

// ===========================
// US-128: PRIVACY CONTROLS TYPES
// ===========================

export const DataVisibilitySchema = z.enum([
  'public',
  'followers_only',
  'subscribers_only',
  'private',
  'custom',
]);

export const DataCategorySchema = z.enum([
  'profile',
  'content',
  'analytics',
  'payment',
  'communication',
  'behavioral',
  'preference',
]);

export const PrivacySettingSchema = z.object({
  category: DataCategorySchema,
  field_name: z.string(),
  visibility: DataVisibilitySchema,
  custom_rules: z.array(z.string()).optional(),
  retention_days: z.number().optional(),
  deletion_scheduled: z.boolean().default(false),
  last_updated: z.number(),
});

export const ConsentSchema = z.object({
  purpose: z.string(),
  granted: z.boolean(),
  granted_at: z.number(),
  expires_at: z.number().optional(),
  revoked_at: z.number().optional(),
  legal_basis: z.enum([
    'consent',
    'contract',
    'legal_obligation',
    'vital_interests',
    'public_task',
    'legitimate_interests',
  ]),
  version: z.string(),
});

export const DataAccessRequestSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  request_type: z.enum(['access', 'portability', 'rectification', 'erasure', 'restriction']),
  status: z.enum(['pending', 'processing', 'completed', 'rejected']),
  requested_at: z.number(),
  completed_at: z.number().optional(),
  data_categories: z.array(DataCategorySchema),
  reason: z.string().optional(),
});

export const PrivacyImpactAssessmentSchema = z.object({
  id: z.string(),
  feature_name: z.string(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  data_types: z.array(DataCategorySchema),
  processing_purposes: z.array(z.string()),
  mitigation_measures: z.array(z.string()),
  assessed_by: z.string(),
  assessed_at: z.number(),
  review_date: z.number(),
});

// ===========================
// US-129: BACKUP & RECOVERY TYPES
// ===========================

export const BackupTypeSchema = z.enum(['full', 'incremental', 'differential', 'snapshot']);

export const BackupStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'corrupted',
  'expired',
]);

export const BackupStorageLocationSchema = z.enum([
  'local',
  'cloud_primary',
  'cloud_secondary',
  'offline',
  'distributed',
]);

export const BackupSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  backup_type: BackupTypeSchema,
  status: BackupStatusSchema,
  size_bytes: z.number(),
  checksum: z.string(),
  encryption_key_id: z.string(),
  storage_location: BackupStorageLocationSchema,
  created_at: z.number(),
  completed_at: z.number().optional(),
  expires_at: z.number(),
  verified_at: z.number().optional(),
  restore_count: z.number().default(0),
  metadata: z.record(z.unknown()).optional(),
});

export const RecoveryProcedureSchema = z.object({
  id: z.string(),
  procedure_type: z.enum([
    'full_restore',
    'selective_restore',
    'point_in_time',
    'disaster_recovery',
  ]),
  trigger: z.enum(['manual', 'automated', 'disaster']),
  backup_ids: z.array(z.string()),
  status: z.enum(['initiated', 'preparing', 'restoring', 'validating', 'completed', 'failed']),
  initiated_by: z.string(),
  initiated_at: z.number(),
  estimated_completion: z.number().optional(),
  completed_at: z.number().optional(),
  recovery_point_objective_ms: z.number(),
  recovery_time_objective_ms: z.number(),
  validation_results: z.array(z.string()).optional(),
});

export const BackupVerificationSchema = z.object({
  backup_id: z.string(),
  verification_type: z.enum(['integrity', 'recoverability', 'encryption', 'completeness']),
  status: z.enum(['passed', 'failed', 'warning']),
  verified_at: z.number(),
  details: z.string(),
  performance_metrics: z.record(z.number()).optional(),
});

export const BackupRetentionPolicySchema = z.object({
  policy_name: z.string(),
  data_category: DataCategorySchema,
  retention_days: z.number(),
  backup_frequency: z.enum(['real_time', 'hourly', 'daily', 'weekly', 'monthly']),
  storage_locations: z.array(BackupStorageLocationSchema),
  encryption_required: z.boolean(),
  verification_schedule: z.enum(['immediate', 'daily', 'weekly', 'monthly']),
  auto_cleanup: z.boolean(),
});

// ===========================
// US-130: AUDIT LOGGING TYPES
// ===========================

export const AuditEventTypeSchema = z.enum([
  'authentication',
  'authorization',
  'data_access',
  'data_modification',
  'data_deletion',
  'privacy_setting_change',
  'consent_change',
  'backup_operation',
  'recovery_operation',
  'security_event',
  'configuration_change',
  'system_event',
]);

export const AuditSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export const AuditEventSchema = z.object({
  id: z.string(),
  event_type: AuditEventTypeSchema,
  severity: AuditSeveritySchema,
  timestamp: z.number(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  ip_address: z.string(),
  user_agent: z.string().optional(),
  resource: z.string(),
  action: z.string(),
  outcome: z.enum(['success', 'failure', 'partial']),
  details: z.record(z.unknown()),
  risk_score: z.number().min(0).max(100).optional(),
  correlation_id: z.string().optional(),
  geolocation: z
    .object({
      country: z.string(),
      city: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
});

export const SecurityEventSchema = z.object({
  id: z.string(),
  event_type: z.enum([
    'suspicious_login',
    'multiple_failed_attempts',
    'privilege_escalation',
    'data_exfiltration_attempt',
    'injection_attempt',
    'unusual_access_pattern',
    'potential_account_takeover',
  ]),
  severity: AuditSeveritySchema,
  user_id: z.string().optional(),
  ip_address: z.string(),
  detected_at: z.number(),
  indicators: z.array(z.string()),
  risk_score: z.number().min(0).max(100),
  automated_response: z.boolean(),
  investigation_status: z.enum(['new', 'investigating', 'confirmed', 'false_positive', 'resolved']),
  response_actions: z.array(z.string()).optional(),
});

export const AuditLogRetentionSchema = z.object({
  event_type: AuditEventTypeSchema,
  retention_days: z.number(),
  archive_after_days: z.number(),
  encryption_required: z.boolean(),
  integrity_protection: z.boolean(),
  compliance_requirements: z.array(z.string()),
});

export const LogIntegritySchema = z.object({
  log_entry_id: z.string(),
  hash: z.string(),
  previous_hash: z.string().optional(),
  timestamp: z.number(),
  verification_status: z.enum(['valid', 'invalid', 'tampered', 'missing']),
  signature: z.string().optional(),
});

export const AuditReportSchema = z.object({
  id: z.string(),
  report_type: z.enum(['security', 'compliance', 'access', 'data_usage', 'performance']),
  period_start: z.number(),
  period_end: z.number(),
  generated_by: z.string(),
  generated_at: z.number(),
  filters: z.record(z.unknown()),
  metrics: z.object({
    total_events: z.number(),
    security_events: z.number(),
    failed_operations: z.number(),
    high_risk_events: z.number(),
    unique_users: z.number(),
    unique_ips: z.number(),
  }),
  findings: z.array(
    z.object({
      category: z.string(),
      severity: AuditSeveritySchema,
      description: z.string(),
      recommendation: z.string().optional(),
    })
  ),
  export_format: z.enum(['json', 'csv', 'pdf', 'excel']),
});

// ===========================
// SHARED TYPES
// ===========================

export const ComplianceFrameworkSchema = z.enum([
  'GDPR',
  'CCPA',
  'SOC2',
  'ISO27001',
  'HIPAA',
  'PCI_DSS',
]);

export const DataProtectionConfigSchema = z.object({
  encryption_enabled: z.boolean(),
  privacy_controls_enabled: z.boolean(),
  backup_enabled: z.boolean(),
  audit_logging_enabled: z.boolean(),
  compliance_frameworks: z.array(ComplianceFrameworkSchema),
  data_retention_default_days: z.number(),
  encryption_algorithm_default: EncryptionAlgorithmSchema,
  key_rotation_interval_days: z.number(),
  backup_frequency: z.enum(['real_time', 'hourly', 'daily', 'weekly']),
  audit_retention_days: z.number(),
});

// Export types
export type EncryptionAlgorithm = z.infer<typeof EncryptionAlgorithmSchema>;
export type KeyDerivation = z.infer<typeof KeyDerivationSchema>;
export type EncryptedData = z.infer<typeof EncryptedDataSchema>;
export type EncryptionKey = z.infer<typeof EncryptionKeySchema>;
export type FieldEncryptionConfig = z.infer<typeof FieldEncryptionConfigSchema>;
export type EncryptionMetrics = z.infer<typeof EncryptionMetricsSchema>;

export type DataVisibility = z.infer<typeof DataVisibilitySchema>;
export type DataCategory = z.infer<typeof DataCategorySchema>;
export type PrivacySetting = z.infer<typeof PrivacySettingSchema>;
export type Consent = z.infer<typeof ConsentSchema>;
export type DataAccessRequest = z.infer<typeof DataAccessRequestSchema>;
export type PrivacyImpactAssessment = z.infer<typeof PrivacyImpactAssessmentSchema>;

export type BackupType = z.infer<typeof BackupTypeSchema>;
export type BackupStatus = z.infer<typeof BackupStatusSchema>;
export type BackupStorageLocation = z.infer<typeof BackupStorageLocationSchema>;
export type Backup = z.infer<typeof BackupSchema>;
export type RecoveryProcedure = z.infer<typeof RecoveryProcedureSchema>;
export type BackupVerification = z.infer<typeof BackupVerificationSchema>;
export type BackupRetentionPolicy = z.infer<typeof BackupRetentionPolicySchema>;

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type SecurityEvent = z.infer<typeof SecurityEventSchema>;
export type AuditLogRetention = z.infer<typeof AuditLogRetentionSchema>;
export type LogIntegrity = z.infer<typeof LogIntegritySchema>;
export type AuditReport = z.infer<typeof AuditReportSchema>;

export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;
export type DataProtectionConfig = z.infer<typeof DataProtectionConfigSchema>;
