export interface AuditLogEntry {
  id?: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, any>;
  [key: string]: any;
}

export interface AuditLogQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  [key: string]: any;
}

export interface AuditLogQueryResult {
  entries: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

export interface AuditLogMetrics {
  totalEntries: number;
  entriesByAction: Record<string, number>;
  entriesByEntity: Record<string, number>;
  [key: string]: any;
}

export interface AuditLogExport {
  format: 'json' | 'csv';
  data: string;
  entries: number;
}

export interface AuditLogRetention {
  retentionDays: number;
  archiveEnabled: boolean;
  [key: string]: any;
}

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  [key: string]: any;
}
