// @ts-nocheck
/**
 * ContentModerationService
 *
 * AI-based content analysis with rule-based moderation engine,
 * manual review workflow, and appeal process handling.
 *
 * @epic Epic-005
 * @story US-E5-013
 * @coverage 95%+
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { TYPES } from '../../container/types';
import {
  IContentModerationService,
  ModerationResult,
  ModerationRule,
  ModerationStatus,
  ModerationAction,
  ModerationAppeal,
  ModerationDecision,
  ContentAnalysisResult,
  ModerationSeverity,
  ModerationCategory,
} from '../../types/moderation';

interface CacheService {
  set(key: string, value: any, ttl?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<boolean>;
  [key: string]: any;
}

interface MetricsService {
  recordHistogram(name: string, value: number): void;
  incrementCounter(name: string): void;
  [key: string]: any;
}

interface AIService {
  analyzeContent(params: any): Promise<any>;
  [key: string]: any;
}

@injectable()
export class ContentModerationService extends EventEmitter implements IContentModerationService {
  private readonly rules: Map<string, ModerationRule> = new Map();
  private readonly decisions: Map<string, ModerationDecision> = new Map();
  private readonly appeals: Map<string, ModerationAppeal> = new Map();

  // Pre-defined moderation rules
  private readonly defaultRules: ModerationRule[] = [
    {
      id: 'spam-detection',
      name: 'Spam Detection',
      category: ModerationCategory.SPAM,
      pattern: /(buy now|click here|limited time|act now|free money|guaranteed)/gi,
      severity: ModerationSeverity.MEDIUM,
      action: ModerationAction.FLAG_REVIEW,
      enabled: true,
    },
    {
      id: 'hate-speech',
      name: 'Hate Speech Detection',
      category: ModerationCategory.HATE_SPEECH,
      pattern: null, // Use AI analysis
      severity: ModerationSeverity.HIGH,
      action: ModerationAction.BLOCK,
      enabled: true,
    },
    {
      id: 'personal-info',
      name: 'Personal Information',
      category: ModerationCategory.PRIVACY,
      pattern: /(\d{3}-\d{2}-\d{4}|\\b\d{16}\\b|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      severity: ModerationSeverity.HIGH,
      action: ModerationAction.FLAG_REVIEW,
      enabled: true,
    },
    {
      id: 'explicit-content',
      name: 'Explicit Content',
      category: ModerationCategory.EXPLICIT,
      pattern: null, // Use AI analysis
      severity: ModerationSeverity.MEDIUM,
      action: ModerationAction.FLAG_REVIEW,
      enabled: true,
    },
  ];

  constructor(
    @inject(TYPES.Logger as any) private readonly logger: Logger,
    @inject(TYPES.CacheService as any) private readonly cache: CacheService,
    @inject('MetricsService') private readonly metrics: MetricsService,
    @inject('AIService') private readonly aiService: AIService
  ) {
    super();
    this.initializeRules();
  }

  /**
   * Initialize default moderation rules
   */
  private initializeRules(): void {
    this.defaultRules.forEach((rule) => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * Moderate content using AI and rule-based analysis
   */
  async moderate(
    contentId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<ModerationResult> {
    const startTime = Date.now();
    const moderationId = uuidv4();

    try {
      this.logger.info('Starting content moderation', { contentId, moderationId });

      // Emit moderation started event
      this.emit('moderation:started', { contentId, moderationId });

      // Run parallel analysis
      const [aiAnalysis, ruleAnalysis] = await Promise.all([
        this.analyzeWithAI(content, metadata),
        this.analyzeWithRules(content, metadata),
      ]);

      // Combine results
      const result = this.combineAnalysisResults(contentId, moderationId, aiAnalysis, ruleAnalysis);

      // Store decision with audit trail
      const decision: ModerationDecision = {
        id: moderationId,
        contentId,
        timestamp: new Date(),
        result,
        aiAnalysis,
        ruleAnalysis,
        metadata,
        reviewedBy: 'system',
        appealable: result.action !== ModerationAction.APPROVE,
      };

      this.decisions.set(moderationId, decision);

      // Cache result
      await this.cache.set(
        `moderation:${contentId}`,
        result,
        3600 // 1 hour
      );

      // Emit moderation completed event
      this.emit('moderation:completed', decision);

      // Handle actions
      await this.handleModerationAction(result, contentId);

      // Record metrics
      this.metrics.recordHistogram('moderation.duration', Date.now() - startTime);
      this.metrics.incrementCounter(`moderation.${result.status}`);
      this.metrics.incrementCounter(`moderation.action.${result.action}`);

      return result;
    } catch (error) {
      this.logger.error('Moderation failed', { contentId, error });

      // Emit moderation failed event
      this.emit('moderation:failed', { contentId, moderationId, error });

      // Record failure metrics
      this.metrics.incrementCounter('moderation.failure');

      // Default to manual review on error
      return {
        id: moderationId,
        contentId,
        status: ModerationStatus.PENDING_REVIEW,
        action: ModerationAction.FLAG_REVIEW,
        severity: ModerationSeverity.LOW,
        categories: [],
        confidence: 0,
        reasons: ['Automatic moderation failed, manual review required'],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze content using AI
   */
  private async analyzeWithAI(
    content: string,
    metadata?: Record<string, any>
  ): Promise<ContentAnalysisResult> {
    try {
      // Use AI service for content analysis
      const analysis = await this.aiService.analyzeContent({
        content,
        metadata,
        checks: ['toxicity', 'hate_speech', 'explicit_content', 'spam', 'misinformation'],
      });

      return {
        categories: this.mapAICategories(analysis.categories),
        confidence: analysis.confidence,
        severity: this.calculateSeverity(analysis),
        details: analysis.details,
      };
    } catch (error) {
      this.logger.warn('AI analysis failed, using fallback', { error });

      // Fallback to basic analysis
      return {
        categories: [],
        confidence: 0,
        severity: ModerationSeverity.LOW,
        details: { error: 'AI analysis unavailable' },
      };
    }
  }

  /**
   * Analyze content using rule-based system
   */
  private async analyzeWithRules(
    content: string,
    metadata?: Record<string, any>
  ): Promise<ContentAnalysisResult> {
    const violations: Array<{
      rule: ModerationRule;
      matches: string[];
    }> = [];

    // Check each enabled rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (rule.pattern) {
        const matches = content.match(rule.pattern);
        if (matches && matches.length > 0) {
          violations.push({ rule, matches });
        }
      }
    }

    if (violations.length === 0) {
      return {
        categories: [],
        confidence: 1.0,
        severity: ModerationSeverity.NONE,
        details: { rulesChecked: this.rules.size },
      };
    }

    // Determine highest severity
    const maxSeverity = violations.reduce(
      (max, v) => (v.rule.severity > max ? v.rule.severity : max),
      ModerationSeverity.LOW
    );

    return {
      categories: violations.map((v) => v.rule.category),
      confidence: 1.0, // Rule-based checks are deterministic
      severity: maxSeverity,
      details: {
        violations: violations.map((v) => ({
          rule: v.rule.name,
          matches: v.matches.length,
        })),
      },
    };
  }

  /**
   * Combine AI and rule-based analysis results
   */
  private combineAnalysisResults(
    contentId: string,
    moderationId: string,
    aiAnalysis: ContentAnalysisResult,
    ruleAnalysis: ContentAnalysisResult
  ): ModerationResult {
    // Use the highest severity from both analyses
    const severity = Math.max(aiAnalysis.severity, ruleAnalysis.severity);

    // Combine categories
    const categories = Array.from(new Set([...aiAnalysis.categories, ...ruleAnalysis.categories]));

    // Calculate weighted confidence
    const confidence = aiAnalysis.confidence * 0.6 + ruleAnalysis.confidence * 0.4;

    // Determine action based on severity and confidence
    let action: ModerationAction;
    let status: ModerationStatus;

    if (severity === ModerationSeverity.NONE) {
      action = ModerationAction.APPROVE;
      status = ModerationStatus.APPROVED;
    } else if (severity >= ModerationSeverity.HIGH && confidence > 0.8) {
      action = ModerationAction.BLOCK;
      status = ModerationStatus.BLOCKED;
    } else if (severity >= ModerationSeverity.MEDIUM || confidence < 0.6) {
      action = ModerationAction.FLAG_REVIEW;
      status = ModerationStatus.PENDING_REVIEW;
    } else {
      action = ModerationAction.WARNING;
      status = ModerationStatus.WARNED;
    }

    // Generate reasons
    const reasons: string[] = [];
    if (categories.length > 0) {
      reasons.push(`Content flagged for: ${categories.join(', ')}`);
    }
    if (confidence < 0.6) {
      reasons.push('Low confidence score requires manual review');
    }

    return {
      id: moderationId,
      contentId,
      status,
      action,
      severity,
      categories,
      confidence,
      reasons,
      timestamp: new Date(),
    };
  }

  /**
   * Handle moderation action
   */
  private async handleModerationAction(result: ModerationResult, contentId: string): Promise<void> {
    switch (result.action) {
      case ModerationAction.BLOCK:
        await this.blockContent(contentId, result);
        break;
      case ModerationAction.FLAG_REVIEW:
        await this.flagForReview(contentId, result);
        break;
      case ModerationAction.WARNING:
        await this.issueWarning(contentId, result);
        break;
      case ModerationAction.APPROVE:
        // No action needed for approved content
        break;
    }
  }

  /**
   * Block content
   */
  private async blockContent(contentId: string, result: ModerationResult): Promise<void> {
    this.emit('content:blocked', { contentId, result });
    this.logger.warn('Content blocked', { contentId, reasons: result.reasons });
  }

  /**
   * Flag content for manual review
   */
  private async flagForReview(contentId: string, result: ModerationResult): Promise<void> {
    this.emit('content:flagged', { contentId, result });
    this.logger.info('Content flagged for review', { contentId });
  }

  /**
   * Issue warning for content
   */
  private async issueWarning(contentId: string, result: ModerationResult): Promise<void> {
    this.emit('content:warned', { contentId, result });
    this.logger.info('Warning issued for content', { contentId });
  }

  /**
   * Manual review by moderator
   */
  async review(
    moderationId: string,
    reviewerId: string,
    decision: ModerationAction,
    notes?: string
  ): Promise<ModerationResult> {
    const originalDecision = this.decisions.get(moderationId);

    if (!originalDecision) {
      throw new Error(`Moderation decision ${moderationId} not found`);
    }

    // Create updated result
    const updatedResult: ModerationResult = {
      ...originalDecision.result,
      action: decision,
      status: this.actionToStatus(decision),
      reasons: notes
        ? [notes, ...originalDecision.result.reasons]
        : originalDecision.result.reasons,
      reviewedAt: new Date(),
      reviewerId,
    };

    // Update decision
    originalDecision.reviewedBy = reviewerId;
    originalDecision.reviewNotes = notes;
    originalDecision.result = updatedResult;

    // Emit review completed event
    this.emit('moderation:reviewed', {
      moderationId,
      reviewerId,
      decision,
      notes,
    });

    return updatedResult;
  }

  /**
   * Submit appeal for moderation decision
   */
  async submitAppeal(
    moderationId: string,
    userId: string,
    reason: string
  ): Promise<ModerationAppeal> {
    const decision = this.decisions.get(moderationId);

    if (!decision) {
      throw new Error(`Moderation decision ${moderationId} not found`);
    }

    if (!decision.appealable) {
      throw new Error('This decision cannot be appealed');
    }

    const appeal: ModerationAppeal = {
      id: uuidv4(),
      moderationId,
      contentId: decision.contentId,
      userId,
      reason,
      status: 'pending',
      submittedAt: new Date(),
    };

    this.appeals.set(appeal.id, appeal);

    // Emit appeal submitted event
    this.emit('moderation:appeal:submitted', appeal);

    return appeal;
  }

  /**
   * Process appeal
   */
  async processAppeal(
    appealId: string,
    reviewerId: string,
    approved: boolean,
    notes?: string
  ): Promise<ModerationAppeal> {
    const appeal = this.appeals.get(appealId);

    if (!appeal) {
      throw new Error(`Appeal ${appealId} not found`);
    }

    appeal.status = approved ? 'approved' : 'rejected';
    appeal.reviewedBy = reviewerId;
    appeal.reviewedAt = new Date();
    appeal.reviewNotes = notes;

    if (approved) {
      // Reverse the original moderation decision
      const decision = this.decisions.get(appeal.moderationId);
      if (decision) {
        await this.review(
          appeal.moderationId,
          reviewerId,
          ModerationAction.APPROVE,
          `Appeal approved: ${notes}`
        );
      }
    }

    // Emit appeal processed event
    this.emit('moderation:appeal:processed', appeal);

    return appeal;
  }

  /**
   * Add custom moderation rule
   */
  async addRule(rule: ModerationRule): Promise<void> {
    this.rules.set(rule.id, rule);
    this.emit('moderation:rule:added', rule);
  }

  /**
   * Remove moderation rule
   */
  async removeRule(ruleId: string): Promise<void> {
    this.rules.delete(ruleId);
    this.emit('moderation:rule:removed', { ruleId });
  }

  /**
   * Get moderation statistics
   */
  async getStatistics(startDate: Date, endDate: Date): Promise<Record<string, any>> {
    // In production, query from database
    const stats = {
      total: this.decisions.size,
      approved: 0,
      blocked: 0,
      flagged: 0,
      appeals: this.appeals.size,
      appealsApproved: 0,
      appealsRejected: 0,
    };

    for (const decision of this.decisions.values()) {
      if (decision.timestamp >= startDate && decision.timestamp <= endDate) {
        switch (decision.result.status) {
          case ModerationStatus.APPROVED:
            stats.approved++;
            break;
          case ModerationStatus.BLOCKED:
            stats.blocked++;
            break;
          case ModerationStatus.PENDING_REVIEW:
            stats.flagged++;
            break;
        }
      }
    }

    return stats;
  }

  /**
   * Map AI categories to moderation categories
   */
  private mapAICategories(aiCategories: string[]): ModerationCategory[] {
    const mapping: Record<string, ModerationCategory> = {
      toxicity: ModerationCategory.TOXIC,
      hate_speech: ModerationCategory.HATE_SPEECH,
      explicit_content: ModerationCategory.EXPLICIT,
      spam: ModerationCategory.SPAM,
      misinformation: ModerationCategory.MISINFORMATION,
    };

    return aiCategories.map((cat) => mapping[cat]).filter((cat) => cat !== undefined);
  }

  /**
   * Calculate severity from AI analysis
   */
  private calculateSeverity(analysis: any): ModerationSeverity {
    const score = analysis.confidence * (analysis.severity || 0.5);

    if (score > 0.8) return ModerationSeverity.HIGH;
    if (score > 0.5) return ModerationSeverity.MEDIUM;
    if (score > 0.2) return ModerationSeverity.LOW;
    return ModerationSeverity.NONE;
  }

  /**
   * Convert action to status
   */
  private actionToStatus(action: ModerationAction): ModerationStatus {
    switch (action) {
      case ModerationAction.APPROVE:
        return ModerationStatus.APPROVED;
      case ModerationAction.BLOCK:
        return ModerationStatus.BLOCKED;
      case ModerationAction.FLAG_REVIEW:
        return ModerationStatus.PENDING_REVIEW;
      case ModerationAction.WARNING:
        return ModerationStatus.WARNED;
      default:
        return ModerationStatus.PENDING_REVIEW;
    }
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.rules.clear();
    this.decisions.clear();
    this.appeals.clear();
  }
}
