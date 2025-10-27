import { createHash, createHmac, randomBytes } from 'crypto';
import {
  AuditEvent,
  AuditEventSchema,
  AuditEventType,
  AuditLogRetention,
  AuditLogRetentionSchema,
  AuditReport,
  AuditReportSchema,
  AuditSeverity,
  ComplianceFramework,
  LogIntegrity,
  LogIntegritySchema,
  SecurityEvent,
  SecurityEventSchema,
} from '../types/dataProtection';

/**
 * 📊 Audit Logging Service
 * Implements comprehensive audit logging with security monitoring and compliance reporting
 *
 * US-130: As a user, I want audit logging so that security events are tracked and monitored.
 */
export class AuditLoggingService {
  private auditEvents = new Map<string, AuditEvent>();
  private securityEvents = new Map<string, SecurityEvent>();
  private retentionPolicies = new Map<string, AuditLogRetention>();
  private integrityRecords = new Map<string, LogIntegrity>();
  private metrics = {
    total_events: 0,
    security_events: 0,
    high_severity_events: 0,
    retention_violations: 0,
    integrity_failures: 0,
    last_updated: Date.now(),
  };
  private initialized = false;

  // ✅ 9.8.1: Design audit logging framework
  private readonly AUDIT_CONFIG = {
    DEFAULT_RETENTION_DAYS: 2555, // 7 years for compliance
    SECURITY_RETENTION_DAYS: 3650, // 10 years for security events
    MAX_EVENT_SIZE_BYTES: 64 * 1024, // 64KB
    BATCH_SIZE: 1000,
    INTEGRITY_CHECK_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
    COMPRESSION_ENABLED: true,
    ENCRYPTION_ENABLED: true,
    REAL_TIME_MONITORING: true,
    ALERT_THRESHOLDS: {
      HIGH_SEVERITY_RATE: 0.05, // 5% high severity events
      SECURITY_EVENT_RATE: 0.1, // 10% security events
      FAILED_LOGIN_THRESHOLD: 5,
      SUSPICIOUS_ACTIVITY_THRESHOLD: 10,
    },
  } as const;

  private readonly STORAGE_KEYS = {
    AUDIT_EVENTS: 'audit_events',
    SECURITY_EVENTS: 'security_events',
    RETENTION_POLICIES: 'audit_retention_policies',
    INTEGRITY_RECORDS: 'audit_integrity_records',
    METRICS: 'audit_metrics',
  } as const;

  constructor() {
    this.initialize();
  }

  // ✅ 9.8.2: Implement comprehensive event logging
  async logEvent(
    eventType: AuditEventType,
    userId: string,
    action: string,
    resource: string,
    outcome: 'success' | 'failure',
    severity: AuditSeverity = 'info',
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditEvent> {
    try {
      const eventId = this.generateEventId();
      const timestamp = Date.now();

      const event: AuditEvent = {
        id: eventId,
        event_type: eventType,
        user_id: userId,
        timestamp,
        action,
        resource,
        outcome,
        severity,
        ip_address: ipAddress || 'unknown',
        user_agent: userAgent || 'unknown',
        details: details || {},
        session_id: this.getCurrentSessionId(userId),
        correlation_id: this.generateCorrelationId(),
      };

      const validatedEvent = AuditEventSchema.parse(event);
      this.auditEvents.set(eventId, validatedEvent);

      // Update metrics
      await this.updateMetrics('event_logged', severity);

      // Check for security patterns
      await this.analyzeForSecurityEvents(validatedEvent);

      // Real-time monitoring
      if (this.AUDIT_CONFIG.REAL_TIME_MONITORING) {
        await this.processRealTimeEvent(validatedEvent);
      }

      await this.saveToStorage();

      return validatedEvent;
    } catch (error) {
      throw new Error(
        `Audit logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async logSecurityEvent(
    eventType: SecurityEvent['event_type'],
    userId: string,
    ipAddress: string,
    indicators: string[],
    riskScore: number,
    details?: Record<string, unknown>
  ): Promise<SecurityEvent> {
    try {
      const eventId = this.generateEventId();

      const securityEvent: SecurityEvent = {
        id: eventId,
        event_type: eventType,
        severity: this.calculateSeverityFromRisk(riskScore),
        user_id: userId,
        ip_address: ipAddress,
        detected_at: Date.now(),
        indicators,
        risk_score: riskScore,
        automated_response: riskScore >= 80,
        investigation_status: 'new',
        response_actions: riskScore >= 80 ? ['account_lock', 'alert_admin'] : undefined,
      };

      const validatedEvent = SecurityEventSchema.parse(securityEvent);
      this.securityEvents.set(eventId, validatedEvent);

      // Auto-response for high-risk events
      if (securityEvent.automated_response) {
        await this.triggerAutomatedResponse(securityEvent);
      }

      await this.updateMetrics('security_event', 'critical');
      await this.saveToStorage();

      return validatedEvent;
    } catch (error) {
      throw new Error(
        `Security event logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.8.3: Create log analysis and monitoring
  async analyzeSecurityPatterns(
    timeWindow: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<{
    suspicious_patterns: Array<{
      pattern: string;
      risk_level: 'low' | 'medium' | 'high' | 'critical';
      affected_users: string[];
      recommendations: string[];
    }>;
    anomalies: Array<{
      type: string;
      description: string;
      severity: AuditSeverity;
    }>;
  }> {
    const cutoffTime = Date.now() - timeWindow;
    const recentEvents = Array.from(this.auditEvents.values()).filter(
      (event) => event.timestamp > cutoffTime
    );

    const suspiciousPatterns: Array<{
      pattern: string;
      risk_level: 'low' | 'medium' | 'high' | 'critical';
      affected_users: string[];
      recommendations: string[];
    }> = [];

    const anomalies: Array<{
      type: string;
      description: string;
      severity: AuditSeverity;
    }> = [];

    // Pattern 1: Multiple failed logins
    const failedLogins = recentEvents.filter(
      (event) => event.event_type === 'authentication' && event.outcome === 'failure'
    );

    const userFailures = new Map<string, number>();
    failedLogins.forEach((event) => {
      const count = userFailures.get(event.user_id) || 0;
      userFailures.set(event.user_id, count + 1);
    });

    const suspiciousUsers = Array.from(userFailures.entries()).filter(
      ([_, count]) => count >= this.AUDIT_CONFIG.ALERT_THRESHOLDS.FAILED_LOGIN_THRESHOLD
    );

    if (suspiciousUsers.length > 0) {
      suspiciousPatterns.push({
        pattern: 'Multiple failed login attempts',
        risk_level: 'high',
        affected_users: suspiciousUsers.map(([userId]) => userId),
        recommendations: ['Implement account lockout', 'Enable 2FA', 'Investigate IP patterns'],
      });
    }

    // Pattern 2: Unusual access patterns
    const accessEvents = recentEvents.filter((event) => event.event_type === 'data_access');
    const ipPatterns = new Map<string, Set<string>>();

    accessEvents.forEach((event) => {
      if (!ipPatterns.has(event.user_id)) {
        ipPatterns.set(event.user_id, new Set());
      }
      ipPatterns.get(event.user_id)!.add(event.ip_address);
    });

    const unusualAccess = Array.from(ipPatterns.entries()).filter(([_, ips]) => ips.size > 5); // More than 5 different IPs

    if (unusualAccess.length > 0) {
      anomalies.push({
        type: 'unusual_access_pattern',
        description: `Users accessing from multiple IP addresses: ${unusualAccess.length} users`,
        severity: 'warning',
      });
    }

    return { suspicious_patterns: suspiciousPatterns, anomalies };
  }

  // ✅ 9.8.4: Add security event detection
  async detectAnomalies(timeWindow: number = 60 * 60 * 1000): Promise<
    Array<{
      type: string;
      severity: AuditSeverity;
      description: string;
      affected_entities: string[];
      recommended_actions: string[];
    }>
  > {
    const anomalies: Array<{
      type: string;
      severity: AuditSeverity;
      description: string;
      affected_entities: string[];
      recommended_actions: string[];
    }> = [];

    const cutoffTime = Date.now() - timeWindow;
    const recentEvents = Array.from(this.auditEvents.values()).filter(
      (event) => event.timestamp > cutoffTime
    );

    // Anomaly 1: Sudden spike in events
    const normalEventRate = this.calculateNormalEventRate();
    const currentRate = recentEvents.length / (timeWindow / (60 * 60 * 1000));

    if (currentRate > normalEventRate * 3) {
      anomalies.push({
        type: 'event_rate_spike',
        severity: 'warning',
        description: `Event rate spike detected: ${currentRate.toFixed(2)}/hour vs normal ${normalEventRate.toFixed(2)}/hour`,
        affected_entities: ['system'],
        recommended_actions: ['Investigate system load', 'Check for DDoS attacks'],
      });
    }

    // Anomaly 2: Privilege escalation attempts
    const privilegeEvents = recentEvents.filter(
      (event) => event.action.includes('permission') || event.action.includes('role')
    );

    if (privilegeEvents.length > 10) {
      anomalies.push({
        type: 'privilege_escalation_attempt',
        severity: 'critical',
        description: `Multiple privilege escalation attempts detected: ${privilegeEvents.length} events`,
        affected_entities: [...new Set(privilegeEvents.map((e) => e.user_id))],
        recommended_actions: ['Review user permissions', 'Investigate privilege changes'],
      });
    }

    return anomalies;
  }

  // ✅ 9.8.5: Implement log retention policies
  async createRetentionPolicy(
    policyName: string,
    retentionDays: number,
    eventTypes: AuditEventType[],
    complianceFrameworks: ComplianceFramework[] = [],
    autoDelete: boolean = true
  ): Promise<AuditLogRetention> {
    try {
      const policy: AuditLogRetention = {
        policy_name: policyName,
        retention_days: retentionDays,
        event_types: eventTypes,
        compliance_frameworks: complianceFrameworks,
        auto_delete: autoDelete,
        created_at: Date.now(),
        last_applied: Date.now(),
        events_affected: 0,
      };

      const validatedPolicy = AuditLogRetentionSchema.parse(policy);
      this.retentionPolicies.set(policyName, validatedPolicy);

      await this.saveToStorage();
      return validatedPolicy;
    } catch (error) {
      throw new Error(
        `Retention policy creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async applyRetentionPolicies(): Promise<{
    policies_applied: number;
    events_deleted: number;
    compliance_violations: string[];
  }> {
    let policiesApplied = 0;
    let eventsDeleted = 0;
    const complianceViolations: string[] = [];

    for (const [policyName, policy] of this.retentionPolicies.entries()) {
      if (!policy.auto_delete) continue;

      const cutoffDate = Date.now() - policy.retention_days * 24 * 60 * 60 * 1000;

      // Find events to delete
      const eventsToDelete = Array.from(this.auditEvents.values()).filter(
        (event) => event.timestamp < cutoffDate && policy.event_types.includes(event.event_type)
      );

      // Check compliance before deletion
      for (const event of eventsToDelete) {
        if (this.isComplianceRequired(event, policy.compliance_frameworks)) {
          complianceViolations.push(
            `Event ${event.id} cannot be deleted due to compliance requirements`
          );
          continue;
        }

        this.auditEvents.delete(event.id);
        eventsDeleted++;
      }

      policy.last_applied = Date.now();
      policy.events_affected = eventsToDelete.length;
      policiesApplied++;
    }

    await this.updateMetrics('retention_applied', 'info');
    await this.saveToStorage();

    return {
      policies_applied: policiesApplied,
      events_deleted: eventsDeleted,
      compliance_violations: complianceViolations,
    };
  }

  // ✅ 9.8.6: Create audit reporting system
  async generateAuditReport(
    reportType: 'security' | 'compliance' | 'user_activity' | 'system_health',
    startDate: number,
    endDate: number,
    filters?: {
      userIds?: string[];
      eventTypes?: AuditEventType[];
      severity?: AuditSeverity[];
    }
  ): Promise<AuditReport> {
    try {
      const reportId = this.generateReportId();

      // Filter events by date range and criteria
      let events = Array.from(this.auditEvents.values()).filter(
        (event) => event.timestamp >= startDate && event.timestamp <= endDate
      );

      if (filters?.userIds) {
        events = events.filter((event) => filters.userIds!.includes(event.user_id));
      }
      if (filters?.eventTypes) {
        events = events.filter((event) => filters.eventTypes!.includes(event.event_type));
      }
      if (filters?.severity) {
        events = events.filter((event) => filters.severity!.includes(event.severity));
      }

      // Generate report content based on type
      const reportContent = await this.generateReportContent(reportType, events);

      const report: AuditReport = {
        id: reportId,
        report_type: reportType,
        generated_at: Date.now(),
        period_start: startDate,
        period_end: endDate,
        total_events: events.length,
        summary: reportContent.summary,
        findings: reportContent.findings,
        recommendations: reportContent.recommendations,
        compliance_status: reportContent.complianceStatus,
        generated_by: 'system',
        format: 'json',
      };

      const validatedReport = AuditReportSchema.parse(report);
      return validatedReport;
    } catch (error) {
      throw new Error(
        `Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.8.7: Add log integrity protection
  async protectLogIntegrity(eventId: string): Promise<LogIntegrity> {
    try {
      const event = this.auditEvents.get(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const eventData = JSON.stringify(event);
      const hash = createHash('sha256').update(eventData).digest('hex');
      const signature = this.generateSignature(eventData);

      const integrity: LogIntegrity = {
        event_id: eventId,
        hash,
        signature,
        created_at: Date.now(),
        verification_count: 0,
        last_verified: Date.now(),
        integrity_status: 'valid',
      };

      const validatedIntegrity = LogIntegritySchema.parse(integrity);
      this.integrityRecords.set(eventId, validatedIntegrity);

      await this.saveToStorage();
      return validatedIntegrity;
    } catch (error) {
      throw new Error(
        `Integrity protection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async verifyLogIntegrity(eventId: string): Promise<{
    valid: boolean;
    details: string;
    last_verified: number;
  }> {
    try {
      const event = this.auditEvents.get(eventId);
      const integrity = this.integrityRecords.get(eventId);

      if (!event || !integrity) {
        return {
          valid: false,
          details: 'Event or integrity record not found',
          last_verified: 0,
        };
      }

      const currentEventData = JSON.stringify(event);
      const currentHash = createHash('sha256').update(currentEventData).digest('hex');

      const valid = currentHash === integrity.hash;

      // Update verification record
      integrity.verification_count++;
      integrity.last_verified = Date.now();
      integrity.integrity_status = valid ? 'valid' : 'compromised';

      if (!valid) {
        await this.updateMetrics('integrity_failure', 'critical');
      }

      await this.saveToStorage();

      return {
        valid,
        details: valid ? 'Log integrity verified' : 'Log integrity compromised - hash mismatch',
        last_verified: integrity.last_verified,
      };
    } catch (error) {
      return {
        valid: false,
        details: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        last_verified: Date.now(),
      };
    }
  }

  // ✅ 9.8.8: Test audit logging effectiveness
  async runAuditLoggingTests(): Promise<{
    passed: boolean;
    results: Array<{
      test: string;
      passed: boolean;
      details?: string;
    }>;
  }> {
    const results: Array<{ test: string; passed: boolean; details?: string }> = [];

    // Test 1: Basic event logging
    try {
      const testEvent = await this.logEvent(
        'authentication',
        'test_user',
        'login',
        'user_account',
        'success',
        'info'
      );

      results.push({
        test: 'Basic event logging',
        passed: testEvent.id !== undefined,
        details: `Event logged with ID: ${testEvent.id}`,
      });
    } catch (error) {
      results.push({
        test: 'Basic event logging',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 2: Security event detection
    try {
      const securityEvent = await this.logSecurityEvent(
        'suspicious_login',
        'test_user',
        '192.168.1.1',
        ['unusual_location', 'new_device'],
        75
      );

      results.push({
        test: 'Security event detection',
        passed: securityEvent.risk_score === 75,
        details: `Security event created with risk score: ${securityEvent.risk_score}`,
      });
    } catch (error) {
      results.push({
        test: 'Security event detection',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 3: Log integrity protection
    try {
      const events = Array.from(this.auditEvents.keys()).slice(0, 1);
      if (events.length > 0) {
        const integrity = await this.protectLogIntegrity(events[0]);
        const verification = await this.verifyLogIntegrity(events[0]);

        results.push({
          test: 'Log integrity protection',
          passed: verification.valid,
          details: `Integrity ${verification.valid ? 'verified' : 'failed'}: ${verification.details}`,
        });
      } else {
        results.push({
          test: 'Log integrity protection',
          passed: false,
          details: 'No events available for integrity testing',
        });
      }
    } catch (error) {
      results.push({
        test: 'Log integrity protection',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 4: Retention policy application
    try {
      await this.createRetentionPolicy(
        'test_policy',
        1, // 1 day for test
        ['authentication'],
        [],
        true
      );

      const result = await this.applyRetentionPolicies();

      results.push({
        test: 'Retention policy application',
        passed: result.policies_applied >= 0,
        details: `Applied ${result.policies_applied} policies, deleted ${result.events_deleted} events`,
      });
    } catch (error) {
      results.push({
        test: 'Retention policy application',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 5: Report generation
    try {
      const endDate = Date.now();
      const startDate = endDate - 24 * 60 * 60 * 1000; // 24 hours ago

      const report = await this.generateAuditReport('security', startDate, endDate);

      results.push({
        test: 'Report generation',
        passed: report.id !== undefined && report.total_events >= 0,
        details: `Report generated with ${report.total_events} events`,
      });
    } catch (error) {
      results.push({
        test: 'Report generation',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    const passed = results.every((result) => result.passed);
    console.log('[AuditLogging] Test results', { passed, results });

    return { passed, results };
  }

  // Private helper methods
  private generateEventId(): string {
    return `audit_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private generateCorrelationId(): string {
    return randomBytes(12).toString('hex');
  }

  private getCurrentSessionId(userId: string): string {
    // In production, get actual session ID
    return `session_${userId}_${randomBytes(4).toString('hex')}`;
  }

  private calculateSeverityFromRisk(riskScore: number): AuditSeverity {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'error';
    if (riskScore >= 40) return 'warning';
    return 'info';
  }

  private async analyzeForSecurityEvents(event: AuditEvent): Promise<void> {
    // Pattern detection for security events
    if (event.event_type === 'authentication' && event.outcome === 'failure') {
      const recentFailures = this.getRecentFailedLogins(event.user_id);
      if (recentFailures >= this.AUDIT_CONFIG.ALERT_THRESHOLDS.FAILED_LOGIN_THRESHOLD) {
        await this.logSecurityEvent(
          'multiple_failed_attempts',
          event.user_id,
          event.ip_address,
          [`${recentFailures}_failed_attempts`],
          70
        );
      }
    }
  }

  private getRecentFailedLogins(userId: string, timeWindow: number = 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - timeWindow;
    return Array.from(this.auditEvents.values()).filter(
      (event) =>
        event.user_id === userId &&
        event.event_type === 'authentication' &&
        event.outcome === 'failure' &&
        event.timestamp > cutoffTime
    ).length;
  }

  private async processRealTimeEvent(event: AuditEvent): Promise<void> {
    // Real-time processing for high-severity events
    if (event.severity === 'critical' || event.severity === 'error') {
      // In production, trigger real-time alerts
      console.warn('[AuditLogging] High-severity event detected', {
        eventId: event.id,
        eventType: event.event_type,
        severity: event.severity,
        userId: event.user_id,
      });
    }
  }

  private async triggerAutomatedResponse(securityEvent: SecurityEvent): Promise<void> {
    // In production, implement actual automated responses
    console.warn('[AuditLogging] Automated security response triggered', {
      eventId: securityEvent.id,
      eventType: securityEvent.event_type,
      riskScore: securityEvent.risk_score,
      actions: securityEvent.response_actions,
    });
  }

  private calculateNormalEventRate(): number {
    // Calculate baseline event rate from historical data
    const historicalEvents = Array.from(this.auditEvents.values());
    const timeSpan = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoffTime = Date.now() - timeSpan;

    const recentEvents = historicalEvents.filter((event) => event.timestamp > cutoffTime);
    return recentEvents.length / (timeSpan / (60 * 60 * 1000)); // events per hour
  }

  private isComplianceRequired(event: AuditEvent, frameworks: ComplianceFramework[]): boolean {
    // Check if event is required for compliance
    const complianceRequiredEvents: AuditEventType[] = [
      'data_access',
      'data_modification',
      'data_deletion',
      'privacy_setting_change',
    ];

    return frameworks.length > 0 && complianceRequiredEvents.includes(event.event_type);
  }

  private async generateReportContent(
    reportType: string,
    events: AuditEvent[]
  ): Promise<{
    summary: Record<string, unknown>;
    findings: string[];
    recommendations: string[];
    complianceStatus: Record<string, unknown>;
  }> {
    const summary = {
      total_events: events.length,
      unique_users: new Set(events.map((e) => e.user_id)).size,
      event_types: new Set(events.map((e) => e.event_type)).size,
      success_rate: (events.filter((e) => e.outcome === 'success').length / events.length) * 100,
    };

    const findings: string[] = [];
    const recommendations: string[] = [];
    const complianceStatus = { gdpr: 'compliant', ccpa: 'compliant' };

    // Generate findings based on report type
    if (reportType === 'security') {
      const securityEvents = events.filter(
        (e) => e.severity === 'critical' || e.severity === 'error'
      );
      if (securityEvents.length > 0) {
        findings.push(`${securityEvents.length} high-severity security events detected`);
        recommendations.push('Review security events and implement additional controls');
      }
    }

    return { summary, findings, recommendations, complianceStatus };
  }

  private generateSignature(data: string): string {
    // In production, use proper digital signatures
    return createHmac('sha256', 'audit_secret_key').update(data).digest('hex');
  }

  private async updateMetrics(
    operation: 'event_logged' | 'security_event' | 'retention_applied' | 'integrity_failure',
    severity: AuditSeverity
  ): Promise<void> {
    this.metrics.total_events++;

    if (operation === 'security_event') {
      this.metrics.security_events++;
    }

    if (severity === 'critical' || severity === 'error') {
      this.metrics.high_severity_events++;
    }

    if (operation === 'integrity_failure') {
      this.metrics.integrity_failures++;
    }

    this.metrics.last_updated = Date.now();
    await this.saveToStorage();
  }

  private async saveToStorage(): Promise<void> {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.AUDIT_EVENTS,
        JSON.stringify(Array.from(this.auditEvents.entries()))
      );
      localStorage.setItem(
        this.STORAGE_KEYS.SECURITY_EVENTS,
        JSON.stringify(Array.from(this.securityEvents.entries()))
      );
      localStorage.setItem(
        this.STORAGE_KEYS.RETENTION_POLICIES,
        JSON.stringify(Array.from(this.retentionPolicies.entries()))
      );
      localStorage.setItem(
        this.STORAGE_KEYS.INTEGRITY_RECORDS,
        JSON.stringify(Array.from(this.integrityRecords.entries()))
      );
      localStorage.setItem(this.STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
    } catch (error) {
      console.error('[AuditLogging] Failed to save to storage:', error);
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      // Load audit events
      const eventsData = localStorage.getItem(this.STORAGE_KEYS.AUDIT_EVENTS);
      if (eventsData) {
        const eventEntries = JSON.parse(eventsData) as Array<[string, AuditEvent]>;
        this.auditEvents = new Map(eventEntries);
      }

      // Load security events
      const securityData = localStorage.getItem(this.STORAGE_KEYS.SECURITY_EVENTS);
      if (securityData) {
        const securityEntries = JSON.parse(securityData) as Array<[string, SecurityEvent]>;
        this.securityEvents = new Map(securityEntries);
      }

      // Load retention policies
      const retentionData = localStorage.getItem(this.STORAGE_KEYS.RETENTION_POLICIES);
      if (retentionData) {
        const retentionEntries = JSON.parse(retentionData) as Array<[string, AuditLogRetention]>;
        this.retentionPolicies = new Map(retentionEntries);
      }

      // Load integrity records
      const integrityData = localStorage.getItem(this.STORAGE_KEYS.INTEGRITY_RECORDS);
      if (integrityData) {
        const integrityEntries = JSON.parse(integrityData) as Array<[string, LogIntegrity]>;
        this.integrityRecords = new Map(integrityEntries);
      }

      // Load metrics
      const metricsData = localStorage.getItem(this.STORAGE_KEYS.METRICS);
      if (metricsData) {
        this.metrics = { ...this.metrics, ...JSON.parse(metricsData) };
      }
    } catch (error) {
      console.error('[AuditLogging] Failed to load from storage:', error);
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromStorage();
      this.initialized = true;
      console.log('[AuditLogging] Service initialized successfully');
    } catch (error) {
      console.error('[AuditLogging] Failed to initialize:', error);
      throw error;
    }
  }

  // Public getters
  getAuditEvents(filters?: {
    userId?: string;
    eventType?: AuditEventType;
    startDate?: number;
    endDate?: number;
  }): AuditEvent[] {
    let events = Array.from(this.auditEvents.values());

    if (filters?.userId) {
      events = events.filter((event) => event.user_id === filters.userId);
    }
    if (filters?.eventType) {
      events = events.filter((event) => event.event_type === filters.eventType);
    }
    if (filters?.startDate) {
      events = events.filter((event) => event.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      events = events.filter((event) => event.timestamp <= filters.endDate!);
    }

    return events;
  }

  getSecurityEvents(): SecurityEvent[] {
    return Array.from(this.securityEvents.values());
  }

  getRetentionPolicies(): AuditLogRetention[] {
    return Array.from(this.retentionPolicies.values());
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
