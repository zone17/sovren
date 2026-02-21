/**
 * Content Moderation Service Interface
 * User Story: US-E5-013
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  ModerationResult,
  ModerationDecision,
  ModerationAppeal,
  ModerationHistory,
  ModerationQueueItem,
  ModerationRule,
  UserReputation,
  ModerationStats,
  ModerationOptions,
  ReviewOptions,
  AppealOptions,
  ModerationQuery,
  AppealQuery
} from '../../types/moderation';
import {
  ModerationAction,
  AppealStatus,
} from '../../types/moderation';

/**
 * Content Moderation Service
 *
 * Responsibilities:
 * - AI-based content analysis
 * - Rule-based moderation engine
 * - Manual review workflow
 * - Appeal process management
 * - User reputation tracking
 * - Moderation queue management
 * - Audit trail generation
 */
export interface IContentModerationService {
  /**
   * Moderate content using AI and rule-based analysis
   * @param contentId Unique identifier for the content
   * @param content The content to moderate
   * @param metadata Optional metadata for analysis
   * @param options Moderation options
   * @returns Moderation result with action to take
   */
  moderate(
    contentId: string,
    content: string,
    metadata?: Record<string, any>,
    options?: ModerationOptions
  ): Promise<ModerationResult>;

  /**
   * Manual review of flagged content by moderator
   * @param moderationId ID of the moderation decision
   * @param reviewerId ID of the reviewing moderator
   * @param decision Final moderation action
   * @param options Review options including notes
   * @returns Updated moderation result
   */
  reviewContent(
    moderationId: string,
    reviewerId: string,
    decision: ModerationAction,
    options?: ReviewOptions
  ): Promise<ModerationResult>;

  /**
   * Submit an appeal for a moderation decision
   * @param moderationId ID of the moderation decision to appeal
   * @param userId ID of the user submitting the appeal
   * @param reason Reason for the appeal
   * @param options Appeal options
   * @returns Appeal result
   */
  appeal(
    moderationId: string,
    userId: string,
    reason: string,
    options?: AppealOptions
  ): Promise<ModerationAppeal>;

  /**
   * Process an appeal (approve or reject)
   * @param appealId ID of the appeal
   * @param reviewerId ID of the reviewing moderator
   * @param approved Whether the appeal is approved
   * @param notes Optional notes from reviewer
   * @returns Updated appeal
   */
  processAppeal(
    appealId: string,
    reviewerId: string,
    approved: boolean,
    notes?: string
  ): Promise<ModerationAppeal>;

  /**
   * Get moderation history for content
   * @param contentId ID of the content
   * @returns Array of moderation history entries
   */
  getModerationHistory(contentId: string): Promise<ModerationHistory[]>;

  /**
   * Query moderation decisions
   * @param query Query parameters
   * @returns Array of moderation decisions matching query
   */
  queryModerations(query: ModerationQuery): Promise<ModerationDecision[]>;

  /**
   * Query appeals
   * @param query Query parameters
   * @returns Array of appeals matching query
   */
  queryAppeals(query: AppealQuery): Promise<ModerationAppeal[]>;

  /**
   * Get moderation queue for manual review
   * @param limit Maximum number of items to return
   * @param priority Optional priority filter
   * @returns Array of queue items
   */
  getModerationQueue(
    limit?: number,
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<ModerationQueueItem[]>;

  /**
   * Add item to moderation queue
   * @param item Queue item to add
   */
  addToQueue(item: ModerationQueueItem): Promise<void>;

  /**
   * Remove item from moderation queue
   * @param itemId ID of the queue item
   */
  removeFromQueue(itemId: string): Promise<void>;

  /**
   * Get user reputation for auto-moderation
   * @param userId ID of the user
   * @returns User reputation data
   */
  getUserReputation(userId: string): Promise<UserReputation>;

  /**
   * Update user reputation based on moderation outcomes
   * @param userId ID of the user
   * @param approved Whether content was approved
   */
  updateUserReputation(userId: string, approved: boolean): Promise<void>;

  /**
   * Add custom moderation rule
   * @param rule Rule to add
   */
  addRule(rule: ModerationRule): Promise<void>;

  /**
   * Remove moderation rule
   * @param ruleId ID of the rule to remove
   */
  removeRule(ruleId: string): Promise<void>;

  /**
   * Get all moderation rules
   * @returns Array of all rules
   */
  getRules(): Promise<ModerationRule[]>;

  /**
   * Enable or disable a moderation rule
   * @param ruleId ID of the rule
   * @param enabled Whether the rule should be enabled
   */
  toggleRule(ruleId: string, enabled: boolean): Promise<void>;

  /**
   * Get moderation statistics
   * @param startDate Start date for stats
   * @param endDate End date for stats
   * @returns Moderation statistics
   */
  getStatistics(startDate: Date, endDate: Date): Promise<ModerationStats>;

  /**
   * Get a specific moderation decision
   * @param moderationId ID of the moderation decision
   * @returns Moderation decision or null if not found
   */
  getDecision(moderationId: string): Promise<ModerationDecision | null>;

  /**
   * Get a specific appeal
   * @param appealId ID of the appeal
   * @returns Appeal or null if not found
   */
  getAppeal(appealId: string): Promise<ModerationAppeal | null>;

  /**
   * Cleanup on service shutdown
   */
  dispose(): Promise<void>;
}
