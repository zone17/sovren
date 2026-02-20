/**
 * Content Moderation Service Unit Tests
 * User Story: US-E5-013
 * Coverage Target: 95%+
 *
 * @description
 * Comprehensive test suite for ContentModerationService covering:
 * - AI-based moderation
 * - Rule-based moderation
 * - Manual review workflow
 * - Appeal process
 * - User reputation management
 * - Queue management
 * - Statistics and reporting
 */

import { ContentModerationService } from '../ContentModerationService.v2';
import {
  ModerationAction,
  ModerationStatus,
  ModerationSeverity,
  ModerationCategory,
  AppealStatus,
} from '../../../types/moderation';

describe('ContentModerationService', () => {
  // Mock dependencies
  let service: ContentModerationService;
  let mockAuditLog: any;
  let mockEventBus: any;
  let mockLogger: any;
  let mockCache: any;
  let mockAIService: any;
  let mockContentRepo: any;
  let mockMetrics: any;

  beforeEach(() => {
    // Initialize mocks
    mockAuditLog = {
      log: vi.fn().mockResolvedValue(undefined)
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined)
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };

    mockAIService = {
      analyzeContent: vi.fn().mockResolvedValue({
        categories: [],
        confidence: 0.5,
        details: {}
      })
    };

    mockContentRepo = {
      getContent: vi.fn().mockResolvedValue({
        authorId: 'author-123',
        content: 'Test content'
      }),
      updateContentStatus: vi.fn().mockResolvedValue(undefined)
    };

    mockMetrics = {
      recordHistogram: vi.fn(),
      incrementCounter: vi.fn()
    };

    // Create service instance
    service = new ContentModerationService(
      mockAuditLog,
      mockEventBus,
      mockLogger,
      mockCache,
      mockAIService,
      mockContentRepo,
      mockMetrics
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // MODERATION TESTS
  // =========================================================================

  describe('moderate()', () => {
    it('should approve clean content', async () => {
      const result = await service.moderate('content-1', 'This is clean content');

      expect(result.status).toBe('approved' as ModerationStatus);
      expect(result.action).toBe('approve' as ModerationAction);
      expect(result.severity).toBe(0); // NONE
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should detect spam keywords', async () => {
      const spamContent = 'BUY NOW! Limited time offer! Click here for FREE MONEY!!!';
      const result = await service.moderate('content-2', spamContent);

      expect(result.status).toBe('pending_review' as ModerationStatus);
      expect(result.action).toBe('flag_review' as ModerationAction);
      expect(result.categories).toContain('spam' as ModerationCategory);
      expect(result.severity).toBeGreaterThan(0);
    });

    it('should detect personal information (email)', async () => {
      const content = 'Contact me at user@example.com for more info';
      const result = await service.moderate('content-3', content);

      expect(result.categories).toContain('privacy' as ModerationCategory);
      expect(result.action).toBe('flag_review' as ModerationAction);
    });

    it('should detect personal information (SSN)', async () => {
      const content = 'My SSN is 123-45-6789';
      const result = await service.moderate('content-4', content);

      expect(result.categories).toContain('privacy' as ModerationCategory);
      expect(result.action).toBe('block' as ModerationAction);
      expect(result.severity).toBe(3); // HIGH
    });

    it('should detect credit card numbers', async () => {
      const content = 'My card is 1234 5678 9012 3456';
      const result = await service.moderate('content-5', content);

      expect(result.categories).toContain('privacy' as ModerationCategory);
      expect(result.action).toBe('block' as ModerationAction);
    });

    it('should use cached results when available', async () => {
      const cachedResult = {
        id: 'mod-1',
        contentId: 'content-6',
        status: 'approved' as ModerationStatus,
        action: 'approve' as ModerationAction,
        severity: 0,
        categories: [],
        confidence: 1.0,
        reasons: [],
        timestamp: new Date()
      };

      mockCache.get.mockResolvedValueOnce(cachedResult);

      const result = await service.moderate('content-6', 'Test content');

      expect(result).toEqual(cachedResult);
      expect(mockAIService.analyzeContent).not.toHaveBeenCalled();
    });

    it('should integrate AI analysis when available', async () => {
      mockAIService.analyzeContent.mockResolvedValueOnce({
        categories: ['hate_speech'],
        confidence: 0.9,
        severity: 0.8,
        details: { toxicity: 0.85 }
      });

      const result = await service.moderate('content-7', 'Hateful content');

      expect(result.categories).toContain('hate_speech' as ModerationCategory);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(mockAIService.analyzeContent).toHaveBeenCalled();
    });

    it('should handle AI service failures gracefully', async () => {
      mockAIService.analyzeContent.mockRejectedValueOnce(new Error('AI service down'));

      const result = await service.moderate('content-8', 'Test content');

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('AI analysis failed'),
        expect.any(Object)
      );
    });

    it('should require human review when option is set', async () => {
      const result = await service.moderate(
        'content-9',
        'Clean content',
        undefined,
        { requireHumanReview: true }
      );

      expect(result.status).toBe('pending_review' as ModerationStatus);
      expect(result.action).toBe('flag_review' as ModerationAction);
    });

    it('should skip AI when option is set', async () => {
      await service.moderate(
        'content-10',
        'Test content',
        undefined,
        { skipAI: true }
      );

      expect(mockAIService.analyzeContent).not.toHaveBeenCalled();
    });

    it('should skip rules when option is set', async () => {
      const spamContent = 'BUY NOW! Click here!';
      const result = await service.moderate(
        'content-11',
        spamContent,
        undefined,
        { skipRules: true }
      );

      // Should not flag spam since rules are skipped
      expect(result.categories).not.toContain('spam' as ModerationCategory);
    });

    it('should return failsafe result on critical error', async () => {
      mockAIService.analyzeContent.mockRejectedValueOnce(new Error('Critical error'));
      mockLogger.error = vi.fn(); // Suppress error logs

      const result = await service.moderate('content-12', 'Test content');

      expect(result.status).toBe('pending_review' as ModerationStatus);
      expect(result.reasons).toContain('Automatic moderation failed, manual review required');
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('moderation.errors');
    });

    it('should record performance metrics', async () => {
      await service.moderate('content-13', 'Test content');

      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        'moderation.duration',
        expect.any(Number)
      );
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        expect.stringMatching(/^moderation\.(status|action)\./)
      );
    });
  });

  // =========================================================================
  // MANUAL REVIEW TESTS
  // =========================================================================

  describe('reviewContent()', () => {
    it('should allow manual review and update status', async () => {
      // First moderate content
      await service.moderate('content-20', 'Flagged content');

      // Get the moderation ID
      const decisions = await service.queryModerations({ contentId: 'content-20' });
      const moderationId = decisions[0].id;

      // Review it
      const result = await service.reviewContent(
        moderationId,
        'moderator-1',
        'approve' as ModerationAction,
        { notes: 'Reviewed and approved' }
      );

      expect(result.status).toBe('approved' as ModerationStatus);
      expect(result.reviewerId).toBe('moderator-1');
      expect(result.reasons).toContain('Reviewed and approved');
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'content.reviewed'
        })
      );
    });

    it('should throw error for non-existent moderation', async () => {
      await expect(
        service.reviewContent('invalid-id', 'moderator-1', 'approve' as ModerationAction)
      ).rejects.toThrow('Moderation decision invalid-id not found');
    });

    it('should update moderation history', async () => {
      await service.moderate('content-21', 'Test content');
      const decisions = await service.queryModerations({ contentId: 'content-21' });
      const moderationId = decisions[0].id;

      await service.reviewContent(
        moderationId,
        'moderator-1',
        'block' as ModerationAction,
        { notes: 'Blocked after review' }
      );

      const history = await service.getModerationHistory('content-21');
      expect(history.length).toBeGreaterThan(1);
      expect(history.some(h => h.performedBy === 'moderator-1')).toBe(true);
    });
  });

  // =========================================================================
  // APPEAL TESTS
  // =========================================================================

  describe('appeal() and processAppeal()', () => {
    it('should allow users to submit appeals', async () => {
      // Moderate and flag content
      await service.moderate('content-30', 'Flagged content');
      const decisions = await service.queryModerations({ contentId: 'content-30' });
      const moderationId = decisions[0].id;

      // Submit appeal
      const appeal = await service.appeal(
        moderationId,
        'user-1',
        'This content does not violate rules'
      );

      expect(appeal.status).toBe('pending' as AppealStatus);
      expect(appeal.userId).toBe('user-1');
      expect(appeal.moderationId).toBe(moderationId);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should not allow appeals for non-appealable decisions', async () => {
      await service.moderate('content-31', 'Clean content');
      const decisions = await service.queryModerations({ contentId: 'content-31' });
      const moderationId = decisions[0].id;

      // Approved content is not appealable
      decisions[0].appealable = false;

      await expect(
        service.appeal(moderationId, 'user-1', 'Appeal reason')
      ).rejects.toThrow('This decision cannot be appealed');
    });

    it('should process appeals and approve', async () => {
      await service.moderate('content-32', 'Flagged content');
      const decisions = await service.queryModerations({ contentId: 'content-32' });
      const moderationId = decisions[0].id;

      const appeal = await service.appeal(moderationId, 'user-1', 'Valid appeal');

      const processedAppeal = await service.processAppeal(
        appeal.id,
        'moderator-1',
        true,
        'Appeal granted'
      );

      expect(processedAppeal.status).toBe('approved' as AppealStatus);
      expect(processedAppeal.reviewedBy).toBe('moderator-1');
      expect(processedAppeal.reviewNotes).toBe('Appeal granted');
    });

    it('should process appeals and reject', async () => {
      await service.moderate('content-33', 'Flagged content');
      const decisions = await service.queryModerations({ contentId: 'content-33' });
      const moderationId = decisions[0].id;

      const appeal = await service.appeal(moderationId, 'user-1', 'Invalid appeal');

      const processedAppeal = await service.processAppeal(
        appeal.id,
        'moderator-1',
        false,
        'Appeal denied'
      );

      expect(processedAppeal.status).toBe('rejected' as AppealStatus);
    });

    it('should update user reputation on successful appeal', async () => {
      await service.moderate('content-34', 'Flagged content');
      const decisions = await service.queryModerations({ contentId: 'content-34' });
      const appeal = await service.appeal(decisions[0].id, 'user-1', 'Appeal');

      await service.processAppeal(appeal.id, 'moderator-1', true);

      const reputation = await service.getUserReputation('user-1');
      expect(reputation.score).toBeGreaterThan(50); // Should be boosted
    });

    it('should throw error for non-existent appeal', async () => {
      await expect(
        service.processAppeal('invalid-appeal-id', 'moderator-1', true)
      ).rejects.toThrow('Appeal invalid-appeal-id not found');
    });
  });

  // =========================================================================
  // USER REPUTATION TESTS
  // =========================================================================

  describe('getUserReputation() and updateUserReputation()', () => {
    it('should initialize new user with neutral reputation', async () => {
      const reputation = await service.getUserReputation('new-user');

      expect(reputation.score).toBe(50);
      expect(reputation.trustLevel).toBe('new');
      expect(reputation.violationCount).toBe(0);
      expect(reputation.approvalCount).toBe(0);
    });

    it('should increase reputation on approved content', async () => {
      await service.updateUserReputation('user-2', true);
      await service.updateUserReputation('user-2', true);

      const reputation = await service.getUserReputation('user-2');
      expect(reputation.score).toBeGreaterThan(50);
      expect(reputation.approvalCount).toBe(2);
    });

    it('should decrease reputation on violations', async () => {
      await service.updateUserReputation('user-3', false);
      await service.updateUserReputation('user-3', false);

      const reputation = await service.getUserReputation('user-3');
      expect(reputation.score).toBeLessThan(50);
      expect(reputation.violationCount).toBe(2);
      expect(reputation.lastViolation).toBeDefined();
    });

    it('should update trust level based on score', async () => {
      // Boost score to verified level
      for (let i = 0; i < 45; i++) {
        await service.updateUserReputation('user-4', true);
      }

      const reputation = await service.getUserReputation('user-4');
      expect(reputation.trustLevel).toBe('verified');
      expect(reputation.score).toBeGreaterThanOrEqual(90);
    });

    it('should not exceed max score of 100', async () => {
      for (let i = 0; i < 100; i++) {
        await service.updateUserReputation('user-5', true);
      }

      const reputation = await service.getUserReputation('user-5');
      expect(reputation.score).toBeLessThanOrEqual(100);
    });

    it('should not go below min score of 0', async () => {
      for (let i = 0; i < 100; i++) {
        await service.updateUserReputation('user-6', false);
      }

      const reputation = await service.getUserReputation('user-6');
      expect(reputation.score).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // MODERATION QUEUE TESTS
  // =========================================================================

  describe('getModerationQueue() and queue management', () => {
    it('should retrieve moderation queue items', async () => {
      await service.addToQueue({
        id: 'queue-1',
        contentId: 'content-40',
        content: 'Test',
        authorId: 'author-1',
        priority: 'high',
        flaggedAt: new Date(),
        flags: ['spam'],
        reviewCount: 0
      });

      const queue = await service.getModerationQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe('queue-1');
    });

    it('should filter queue by priority', async () => {
      await service.addToQueue({
        id: 'queue-2',
        contentId: 'content-41',
        content: 'Test',
        authorId: 'author-1',
        priority: 'urgent',
        flaggedAt: new Date(),
        flags: [],
        reviewCount: 0
      });

      await service.addToQueue({
        id: 'queue-3',
        contentId: 'content-42',
        content: 'Test',
        authorId: 'author-1',
        priority: 'low',
        flaggedAt: new Date(),
        flags: [],
        reviewCount: 0
      });

      const urgentQueue = await service.getModerationQueue(50, 'urgent');
      expect(urgentQueue.length).toBe(1);
      expect(urgentQueue[0].priority).toBe('urgent');
    });

    it('should sort queue by priority', async () => {
      await service.addToQueue({
        id: 'queue-4',
        contentId: 'content-43',
        content: 'Test',
        authorId: 'author-1',
        priority: 'low',
        flaggedAt: new Date(),
        flags: [],
        reviewCount: 0
      });

      await service.addToQueue({
        id: 'queue-5',
        contentId: 'content-44',
        content: 'Test',
        authorId: 'author-1',
        priority: 'urgent',
        flaggedAt: new Date(),
        flags: [],
        reviewCount: 0
      });

      const queue = await service.getModerationQueue();
      expect(queue[0].priority).toBe('urgent');
      expect(queue[queue.length - 1].priority).toBe('low');
    });

    it('should remove items from queue', async () => {
      await service.addToQueue({
        id: 'queue-6',
        contentId: 'content-45',
        content: 'Test',
        authorId: 'author-1',
        priority: 'medium',
        flaggedAt: new Date(),
        flags: [],
        reviewCount: 0
      });

      await service.removeFromQueue('queue-6');

      const queue = await service.getModerationQueue();
      expect(queue.find(item => item.id === 'queue-6')).toBeUndefined();
    });

    it('should limit queue results', async () => {
      for (let i = 0; i < 100; i++) {
        await service.addToQueue({
          id: `queue-${100 + i}`,
          contentId: `content-${100 + i}`,
          content: 'Test',
          authorId: 'author-1',
          priority: 'medium',
          flaggedAt: new Date(),
          flags: [],
          reviewCount: 0
        });
      }

      const queue = await service.getModerationQueue(10);
      expect(queue.length).toBe(10);
    });
  });

  // =========================================================================
  // RULE MANAGEMENT TESTS
  // =========================================================================

  describe('Rule management', () => {
    it('should retrieve all rules', async () => {
      const rules = await service.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.id && r.name)).toBe(true);
    });

    it('should add custom rules', async () => {
      await service.addRule({
        id: 'custom-rule-1',
        name: 'Custom Rule',
        category: 'spam' as ModerationCategory,
        pattern: /test/gi,
        severity: 2,
        action: 'flag_review' as ModerationAction,
        enabled: true
      });

      const rules = await service.getRules();
      expect(rules.find(r => r.id === 'custom-rule-1')).toBeDefined();
    });

    it('should remove rules', async () => {
      await service.addRule({
        id: 'custom-rule-2',
        name: 'To Be Removed',
        category: 'spam' as ModerationCategory,
        pattern: null,
        severity: 1,
        action: 'warning' as ModerationAction,
        enabled: true
      });

      await service.removeRule('custom-rule-2');

      const rules = await service.getRules();
      expect(rules.find(r => r.id === 'custom-rule-2')).toBeUndefined();
    });

    it('should toggle rule enabled status', async () => {
      const rules = await service.getRules();
      const firstRuleId = rules[0].id;

      await service.toggleRule(firstRuleId, false);

      const updatedRules = await service.getRules();
      const updatedRule = updatedRules.find(r => r.id === firstRuleId);
      expect(updatedRule?.enabled).toBe(false);
    });

    it('should throw error when toggling non-existent rule', async () => {
      await expect(
        service.toggleRule('non-existent-rule', true)
      ).rejects.toThrow('Rule non-existent-rule not found');
    });
  });

  // =========================================================================
  // QUERY TESTS
  // =========================================================================

  describe('queryModerations() and queryAppeals()', () => {
    it('should query moderations by content ID', async () => {
      await service.moderate('content-50', 'Test');
      await service.moderate('content-51', 'Test');

      const results = await service.queryModerations({ contentId: 'content-50' });
      expect(results.length).toBe(1);
      expect(results[0].contentId).toBe('content-50');
    });

    it('should query moderations by status', async () => {
      await service.moderate('content-52', 'Clean content');
      await service.moderate('content-53', 'BUY NOW CLICK HERE');

      const approved = await service.queryModerations({
        status: ['approved' as ModerationStatus]
      });

      expect(approved.every(d => d.result.status === 'approved')).toBe(true);
    });

    it('should query moderations by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await service.moderate('content-54', 'Test');

      const results = await service.queryModerations({
        startDate: yesterday,
        endDate: new Date()
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should paginate moderation results', async () => {
      for (let i = 0; i < 20; i++) {
        await service.moderate(`content-${60 + i}`, 'Test');
      }

      const page1 = await service.queryModerations({ limit: 10, offset: 0 });
      const page2 = await service.queryModerations({ limit: 10, offset: 10 });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should query appeals by user ID', async () => {
      await service.moderate('content-80', 'Flagged');
      const decisions = await service.queryModerations({ contentId: 'content-80' });
      await service.appeal(decisions[0].id, 'user-10', 'Appeal');

      const appeals = await service.queryAppeals({ userId: 'user-10' });
      expect(appeals.length).toBeGreaterThan(0);
      expect(appeals[0].userId).toBe('user-10');
    });
  });

  // =========================================================================
  // STATISTICS TESTS
  // =========================================================================

  describe('getStatistics()', () => {
    it('should generate moderation statistics', async () => {
      await service.moderate('content-90', 'Clean');
      await service.moderate('content-91', 'BUY NOW');
      await service.moderate('content-92', 'CLICK HERE');

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const stats = await service.getStatistics(startDate, endDate);

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.approved).toBeGreaterThanOrEqual(0);
      expect(stats.blocked).toBeGreaterThanOrEqual(0);
      expect(stats.flagged).toBeGreaterThanOrEqual(0);
    });

    it('should include category breakdown in statistics', async () => {
      await service.moderate('content-93', 'user@example.com');

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();

      const stats = await service.getStatistics(startDate, endDate);

      expect(stats.byCategory).toBeDefined();
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
    });

    it('should include severity breakdown in statistics', async () => {
      await service.moderate('content-94', '123-45-6789'); // High severity

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();

      const stats = await service.getStatistics(startDate, endDate);

      expect(stats.bySeverity).toBeDefined();
      expect(Object.keys(stats.bySeverity).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // DISPOSAL TESTS
  // =========================================================================

  describe('dispose()', () => {
    it('should cleanup resources on disposal', async () => {
      await service.moderate('content-100', 'Test');
      await service.dispose();

      // Verify cleanup
      const decisions = await service.queryModerations({});
      expect(decisions.length).toBe(0);
    });
  });
});
