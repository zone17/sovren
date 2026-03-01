export interface AuditEntry {
  id?: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  [key: string]: any;
}

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  [key: string]: any;
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface ComplianceReport {
  period: TimePeriod;
  totalEntries: number;
  [key: string]: any;
}

export interface IAuditLogService {
  log(entry: AuditEntry): Promise<void>;
  query(filter: AuditFilter): Promise<AuditEntry[]>;
  export(filter: AuditFilter, format: 'json' | 'csv'): Promise<string>;
  getAuditTrail(entityId: string, entityType: string): Promise<AuditEntry[]>;
  purgeOldLogs(beforeDate: Date): Promise<number>;
  getComplianceReport(period: TimePeriod): Promise<ComplianceReport>;
}
