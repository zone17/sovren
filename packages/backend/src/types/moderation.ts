/**
 * Content Moderation Type Definitions
 * User Story: US-E5-013
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

// ============================================================================
// Enums
// ============================================================================

export enum ModerationStatus {
  APPROVED = 'approved',
  BLOCKED = 'blocked',
  PENDING_REVIEW = 'pending_review',
  WARNED = 'warned',
  APPEALED = 'appealed',
  APPEAL_APPROVED = 'appeal_approved',
  APPEAL_REJECTED = 'appeal_rejected'
}

export enum ModerationAction {
  APPROVE = 'approve',
  BLOCK = 'block',
  FLAG_REVIEW = 'flag_review',
  WARNING = 'warning',
  AUTO_APPROVE = 'auto_approve',
  AUTO_REJECT = 'auto_reject'
}

export enum ModerationSeverity {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum ModerationCategory {
  SPAM = 'spam',
  HATE_SPEECH = 'hate_speech',
  EXPLICIT = 'explicit',
  PRIVACY = 'privacy',
  VIOLENCE = 'violence',
  MISINFORMATION = 'misinformation',
  TOXIC = 'toxic',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  SCAM = 'scam'
}

export enum AppealStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn'
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Result of content moderation analysis
 */
export interface ModerationResult {
  id: string;
  contentId: string;
  status: ModerationStatus;
  action: ModerationAction;
  severity: ModerationSeverity;
  categories: ModerationCategory[];
  confidence: number; // 0.0 to 1.0
  reasons: string[];
  timestamp: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  metadata?: Record<string, any>;
}

/**
 * Moderation rule definition
 */
export interface ModerationRule {
  id: string;
  name: string;
  category: ModerationCategory;
  pattern: RegExp | null; // null means AI-based
  severity: ModerationSeverity;
  action: ModerationAction;
  enabled: boolean;
  threshold?: number;
  metadata?: Record<string, any>;
}

/**
 * AI-based content analysis result
 */
export interface ContentAnalysisResult {
  categories: ModerationCategory[];
  confidence: number;
  severity: ModerationSeverity;
  details: Record<string, any>;
}

/**
 * Moderation decision with audit trail
 */
export interface ModerationDecision {
  id: string;
  contentId: string;
  timestamp: Date;
  result: ModerationResult;
  aiAnalysis: ContentAnalysisResult;
  ruleAnalysis: ContentAnalysisResult;
  metadata?: Record<string, any>;
  reviewedBy: string; // 'system' or userId
  reviewNotes?: string;
  appealable: boolean;
}

/**
 * Appeal submission for moderation decision
 */
export interface ModerationAppeal {
  id: string;
  moderationId: string;
  contentId: string;
  userId: string;
  reason: string;
  status: AppealStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

/**
 * Moderation history entry
 */
export interface ModerationHistory {
  id: string;
  contentId: string;
  action: ModerationAction;
  status: ModerationStatus;
  performedBy: string;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Moderation queue item
 */
export interface ModerationQueueItem {
  id: string;
  contentId: string;
  content: string;
  authorId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  flaggedAt: Date;
  flags: string[];
  aiScore?: number;
  reviewCount: number;
  lastReviewedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * User reputation for auto-moderation
 */
export interface UserReputation {
  userId: string;
  score: number; // 0-100
  trustLevel: 'new' | 'low' | 'medium' | 'high' | 'verified';
  violationCount: number;
  approvalCount: number;
  appealSuccessRate: number;
  lastViolation?: Date;
  lastUpdated: Date;
}

/**
 * Moderation statistics
 */
export interface ModerationStats {
  total: number;
  approved: number;
  blocked: number;
  flagged: number;
  appeals: number;
  appealsApproved: number;
  appealsRejected: number;
  averageResponseTime: number; // milliseconds
  byCategory: Record<ModerationCategory, number>;
  bySeverity: Record<ModerationSeverity, number>;
}

/**
 * AI service analysis request
 */
export interface AIAnalysisRequest {
  content: string;
  metadata?: Record<string, any>;
  checks: string[]; // e.g., ['toxicity', 'hate_speech', 'explicit_content']
}

/**
 * AI service analysis response
 */
export interface AIAnalysisResponse {
  categories: string[];
  confidence: number;
  severity?: number;
  details: Record<string, any>;
}

// ============================================================================
// Query Interfaces
// ============================================================================

export interface ModerationQuery {
  contentId?: string;
  status?: ModerationStatus[];
  categories?: ModerationCategory[];
  severityMin?: ModerationSeverity;
  severityMax?: ModerationSeverity;
  startDate?: Date;
  endDate?: Date;
  reviewerId?: string;
  appealable?: boolean;
  limit?: number;
  offset?: number;
}

export interface AppealQuery {
  userId?: string;
  status?: AppealStatus[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Service Options
// ============================================================================

export interface ModerationOptions {
  skipAI?: boolean;
  skipRules?: boolean;
  requireHumanReview?: boolean;
  notifyAuthor?: boolean;
  metadata?: Record<string, any>;
}

export interface ReviewOptions {
  notifyAuthor?: boolean;
  escalate?: boolean;
  notes?: string;
}

export interface AppealOptions {
  autoReview?: boolean;
  priority?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}
