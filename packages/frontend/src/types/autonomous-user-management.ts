import { z } from 'zod';

// ============================================================================
// AUTONOMOUS USER MANAGEMENT TYPES
// ============================================================================
// 🎯 Elite Type Definitions for US-171 through US-174
// Comprehensive autonomous user management with AI-powered insights
// and behavioral analytics for legendary-tier platform administration

// === Core User Management Types ===

export const UserAccountStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'banned',
  'pending_verification',
  'deleted',
]);

export const UserRoleSchema = z.enum(['supporter', 'creator', 'admin', 'moderator', 'super_admin']);

export const AutomationLevelSchema = z.enum(['manual', 'assisted', 'supervised', 'autonomous']);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

// === US-171: Automated User Account Management ===

export const UserAccountOperationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  operationType: z.enum([
    'account_creation',
    'account_activation',
    'account_suspension',
    'account_deletion',
    'profile_update',
    'role_assignment',
    'permission_update',
    'verification_status_change',
  ]),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  automationLevel: AutomationLevelSchema,
  triggeredBy: z.enum([
    'user_request',
    'system_rule',
    'ai_analysis',
    'admin_action',
    'scheduled_task',
  ]),
  reason: z.string(),
  evidence: z.array(
    z.object({
      type: z.string(),
      data: z.record(z.any()),
      timestamp: z.string(),
    })
  ),
  approvalRequired: z.boolean(),
  approvedBy: z.string().optional(),
  executedAt: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserAccountPolicy = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    'account_lifecycle',
    'security_enforcement',
    'compliance_validation',
    'behavior_monitoring',
    'performance_optimization',
  ]),
  conditions: z.array(
    z.object({
      field: z.string(),
      operator: z.enum([
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'contains',
        'matches',
      ]),
      value: z.any(),
      weight: z.number().min(0).max(1),
    })
  ),
  actions: z.array(
    z.object({
      type: z.string(),
      parameters: z.record(z.any()),
      automationLevel: AutomationLevelSchema,
    })
  ),
  priority: z.number().min(1).max(10),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserAccountMetrics = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  newUsersToday: z.number(),
  suspendedUsers: z.number(),
  automatedOperations: z.number(),
  automationSuccessRate: z.number().min(0).max(1),
  averageOperationTime: z.number(),
  pendingOperations: z.number(),
  riskScoreDistribution: z.record(z.number()),
});

// === US-172: Autonomous Role-Based Access Control ===

export const PermissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.string(),
  action: z.enum(['create', 'read', 'update', 'delete', 'execute', 'approve']),
  scope: z.enum(['global', 'organizational', 'departmental', 'personal']),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.any(),
      })
    )
    .optional(),
});

export const RoleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(PermissionSchema),
  hierarchy: z.object({
    level: z.number(),
    parent: z.string().optional(),
    children: z.array(z.string()),
  }),
  automatedAssignment: z.object({
    enabled: z.boolean(),
    criteria: z.array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.any(),
        weight: z.number(),
      })
    ),
    confidence_threshold: z.number().min(0).max(1),
  }),
  temporaryAssignment: z.object({
    allowed: z.boolean(),
    maxDuration: z.number().optional(),
    autoRevoke: z.boolean(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserRoleAssignmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  roleId: z.string(),
  assignedBy: z.enum(['user', 'admin', 'system', 'ai_analysis']),
  assignmentReason: z.string(),
  confidence: z.number().min(0).max(1),
  isTemporary: z.boolean(),
  expiresAt: z.string().optional(),
  status: z.enum(['active', 'inactive', 'expired', 'revoked']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AccessControlMetricsSchema = z.object({
  totalRoles: z.number(),
  activeRoleAssignments: z.number(),
  automatedAssignments: z.number(),
  privilegeEscalations: z.number(),
  accessViolations: z.number(),
  averageRoleAccuracy: z.number().min(0).max(1),
  temporaryAssignments: z.number(),
  expiredAssignments: z.number(),
});

// === US-173: AI-Powered User Behavior Analytics ===

export const UserBehaviorEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  eventType: z.enum([
    'login',
    'logout',
    'content_creation',
    'content_interaction',
    'payment_activity',
    'profile_update',
    'support_request',
    'violation_report',
    'unusual_activity',
  ]),
  eventData: z.record(z.any()),
  sessionId: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  location: z
    .object({
      country: z.string(),
      region: z.string(),
      city: z.string(),
    })
    .optional(),
  riskScore: z.number().min(0).max(1),
  anomalyScore: z.number().min(0).max(1),
  timestamp: z.string(),
});

export const BehaviorPatternSchema = z.object({
  id: z.string(),
  userId: z.string(),
  patternType: z.enum([
    'usage_pattern',
    'content_preference',
    'interaction_style',
    'risk_behavior',
    'compliance_pattern',
  ]),
  pattern: z.object({
    features: z.record(z.number()),
    frequency: z.number(),
    consistency: z.number().min(0).max(1),
    trend: z.enum(['increasing', 'decreasing', 'stable', 'volatile']),
  }),
  confidence: z.number().min(0).max(1),
  firstObserved: z.string(),
  lastObserved: z.string(),
  predictions: z.array(
    z.object({
      metric: z.string(),
      value: z.number(),
      confidence: z.number(),
      timeframe: z.string(),
    })
  ),
});

export const BehaviorAnomalySchema = z.object({
  id: z.string(),
  userId: z.string(),
  anomalyType: z.enum([
    'unusual_login_time',
    'unusual_location',
    'unusual_activity_volume',
    'unusual_content_creation',
    'unusual_spending_pattern',
    'security_violation',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  evidence: z.array(
    z.object({
      type: z.string(),
      value: z.any(),
      context: z.record(z.any()),
    })
  ),
  riskLevel: RiskLevelSchema,
  autoResolved: z.boolean(),
  resolution: z
    .object({
      action: z.string(),
      reason: z.string(),
      automationLevel: AutomationLevelSchema,
      resolvedAt: z.string(),
    })
    .optional(),
  detectedAt: z.string(),
});

export const BehaviorAnalyticsMetricsSchema = z.object({
  totalEvents: z.number(),
  eventsToday: z.number(),
  uniqueUsers: z.number(),
  anomaliesDetected: z.number(),
  highRiskUsers: z.number(),
  averageRiskScore: z.number().min(0).max(1),
  patternRecognitionAccuracy: z.number().min(0).max(1),
  falsePositiveRate: z.number().min(0).max(1),
  responseTime: z.number(),
});

// === US-174: Autonomous Bulk Operations Tools ===

export const BulkOperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  operationType: z.enum([
    'user_role_update',
    'user_status_change',
    'permission_assignment',
    'account_migration',
    'data_cleanup',
    'compliance_update',
    'security_remediation',
  ]),
  scope: z.object({
    targetCriteria: z.array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.any(),
      })
    ),
    estimatedAffectedUsers: z.number(),
    dryRunResults: z
      .object({
        matched: z.number(),
        warnings: z.array(z.string()),
        errors: z.array(z.string()),
      })
      .optional(),
  }),
  execution: z.object({
    batchSize: z.number(),
    parallelProcessing: z.boolean(),
    rollbackEnabled: z.boolean(),
    validationRequired: z.boolean(),
    approvalRequired: z.boolean(),
  }),
  status: z.enum([
    'draft',
    'validation',
    'approved',
    'running',
    'completed',
    'failed',
    'cancelled',
  ]),
  progress: z.object({
    totalItems: z.number(),
    processedItems: z.number(),
    successfulItems: z.number(),
    failedItems: z.number(),
    skippedItems: z.number(),
    estimatedTimeRemaining: z.number(),
  }),
  results: z
    .object({
      summary: z.record(z.number()),
      errors: z.array(
        z.object({
          userId: z.string(),
          error: z.string(),
          context: z.record(z.any()),
        })
      ),
      warnings: z.array(
        z.object({
          userId: z.string(),
          warning: z.string(),
          context: z.record(z.any()),
        })
      ),
    })
    .optional(),
  automation: z.object({
    level: AutomationLevelSchema,
    aiValidation: z.boolean(),
    riskAssessment: z.boolean(),
    impactAnalysis: z.boolean(),
  }),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export const BulkOperationTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  operationType: z.string(),
  template: z.object({
    defaultScope: z.record(z.any()),
    defaultExecution: z.record(z.any()),
    requiredApprovals: z.array(z.string()),
    riskLevel: RiskLevelSchema,
  }),
  usageCount: z.number(),
  averageSuccessRate: z.number().min(0).max(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BulkOperationsMetricsSchema = z.object({
  totalOperations: z.number(),
  activeOperations: z.number(),
  completedToday: z.number(),
  averageSuccessRate: z.number().min(0).max(1),
  averageExecutionTime: z.number(),
  usersAffectedToday: z.number(),
  automationRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
});

// === Type Exports ===

export type UserAccountStatus = z.infer<typeof UserAccountStatusSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type AutomationLevel = z.infer<typeof AutomationLevelSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export type UserAccountOperation = z.infer<typeof UserAccountOperationSchema>;
export type UserAccountPolicy = z.infer<typeof UserAccountPolicy>;
export type UserAccountMetrics = z.infer<typeof UserAccountMetrics>;

export type Permission = z.infer<typeof PermissionSchema>;
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;
export type UserRoleAssignment = z.infer<typeof UserRoleAssignmentSchema>;
export type AccessControlMetrics = z.infer<typeof AccessControlMetricsSchema>;

export type UserBehaviorEvent = z.infer<typeof UserBehaviorEventSchema>;
export type BehaviorPattern = z.infer<typeof BehaviorPatternSchema>;
export type BehaviorAnomaly = z.infer<typeof BehaviorAnomalySchema>;
export type BehaviorAnalyticsMetrics = z.infer<typeof BehaviorAnalyticsMetricsSchema>;

export type BulkOperation = z.infer<typeof BulkOperationSchema>;
export type BulkOperationTemplate = z.infer<typeof BulkOperationTemplateSchema>;
export type BulkOperationsMetrics = z.infer<typeof BulkOperationsMetricsSchema>;

// === Service Interface ===

export interface AutonomousUserManagementService {
  // US-171: Account Management
  executeAccountOperation(operation: Partial<UserAccountOperation>): Promise<UserAccountOperation>;
  getAccountPolicies(): Promise<UserAccountPolicy[]>;
  updateAccountPolicy(policy: UserAccountPolicy): Promise<UserAccountPolicy>;
  getAccountMetrics(): Promise<UserAccountMetrics>;
  getAccountOperations(filters?: Record<string, any>): Promise<UserAccountOperation[]>;

  // US-172: Role-Based Access Control
  getRoleDefinitions(): Promise<RoleDefinition[]>;
  createRole(role: Partial<RoleDefinition>): Promise<RoleDefinition>;
  updateRole(roleId: string, updates: Partial<RoleDefinition>): Promise<RoleDefinition>;
  assignRole(userId: string, roleId: string, reason: string): Promise<UserRoleAssignment>;
  revokeRole(assignmentId: string, reason: string): Promise<UserRoleAssignment>;
  getAccessControlMetrics(): Promise<AccessControlMetrics>;
  getUserRoleAssignments(userId: string): Promise<UserRoleAssignment[]>;

  // US-173: Behavior Analytics
  trackBehaviorEvent(event: Partial<UserBehaviorEvent>): Promise<UserBehaviorEvent>;
  getBehaviorPatterns(userId: string): Promise<BehaviorPattern[]>;
  getBehaviorAnomalies(filters?: Record<string, any>): Promise<BehaviorAnomaly[]>;
  getBehaviorAnalyticsMetrics(): Promise<BehaviorAnalyticsMetrics>;
  generateBehaviorReport(userId: string, period: string): Promise<any>;

  // US-174: Bulk Operations
  createBulkOperation(operation: Partial<BulkOperation>): Promise<BulkOperation>;
  executeBulkOperation(operationId: string): Promise<BulkOperation>;
  getBulkOperations(filters?: Record<string, any>): Promise<BulkOperation[]>;
  getBulkOperationTemplates(): Promise<BulkOperationTemplate[]>;
  getBulkOperationsMetrics(): Promise<BulkOperationsMetrics>;
  validateBulkOperation(
    operation: Partial<BulkOperation>
  ): Promise<{ valid: boolean; warnings: string[]; errors: string[] }>;
}
