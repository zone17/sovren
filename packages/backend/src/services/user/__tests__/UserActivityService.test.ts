/**
 * UserActivityService Tests
 * Comprehensive test suite with 95%+ coverage
 *
 * @epic Epic-005
 * @story US-E5-021
 */

import { UserActivityService } from '../UserActivityService';
import {
  ActivityType,
  ActivityEvent,
  ActivityFeedOptions,
  UserSession,
  ActivityStats,
  SuspiciousActivityResult,
  ActivityExportRequest,
  ActivityRetentionPolicy,
} from '../../../types/user-activity';
import { DomainEventType } from '../../../interfaces/shared/IEventBus';

// Mock dependencies
const mockDatabase = {
  query: vi.fn(),
};

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  increment: vi.fn(),
};

const mockEventBus = {
  publish: vi.fn(),
  subscribe: vi.fn(),
  subscribeToMany: vi.fn(),
  subscribeToAll: vi.fn(),
  subscribeWithFilter: vi.fn(),
  unsubscribe: vi.fn(),
  unsubscribeAll: vi.fn(),
  getEvent: vi.fn(),
  queryEvents: vi.fn(),
  replayEvents: vi.fn(),
  replayEventsToHandler: vi.fn(),
  getActiveSubscriptions: vi.fn(),
  getEventStats: vi.fn(),
  clearEventStore: vi.fn(),
  isHealthy: vi.fn(),
  dispose: vi.fn(),
};

const mockAuditLog = {
  log: vi.fn(),
};

describe('UserActivityService', () => {
  let service: UserActivityService;
  let originalSetInterval: typeof global.setInterval;
  let intervalCallback: Function;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock setInterval to capture the callback
    originalSetInterval = global.setInterval;
    global.setInterval = vi.fn((callback: Function, ms: number) => {
      intervalCallback = callback;
      return 123 as any;
    }) as any;

    // Mock clearInterval
    global.clearInterval = vi.fn();

    // Create service instance with mocked dependencies
    service = new (UserActivityService as any)(
      mockDatabase,
      mockCache,
      mockEventBus,
      mockAuditLog
    );

    // Reset event bus subscribe calls (service subscribes on init)
    mockEventBus.subscribe.mockClear();
  });

  afterEach(async () => {
    global.setInterval = originalSetInterval;
    await service.dispose();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with flush interval', () => {
      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it('should subscribe to domain events', () => {
      // Service subscribes to multiple events on initialization
      expect(mockEventBus.subscribe).toHaveBeenCalled();
      const subscribedEvents = mockEventBus.subscribe.mock.calls.map((call) => call[0]);
      expect(subscribedEvents).toContain(DomainEventType.USER_LOGGED_IN);
      expect(subscribedEvents).toContain(DomainEventType.CONTENT_CREATED);
    });
  });

  // ============================================================================
  // Activity Logging Tests
  // ============================================================================

  describe('logActivity', () => {
    it('should log a single activity event', async () => {
      const userId = 'user-123';
      const type = ActivityType.LOGIN;
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
      };

      const result = await service.logActivity(userId, type, metadata);

      expect(result).toMatchObject({
        userId,
        type,
        metadata: expect.objectContaining({
          ipAddress: metadata.ipAddress,
          device: expect.objectContaining({
            type: 'desktop',
            os: 'Windows',
            browser: 'Chrome',
          }),
        }),
      });
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should add activity to buffer', async () => {
      await service.logActivity('user-123', ActivityType.LOGIN, {});

      // Access private buffer (for testing purposes)
      const buffer = (service as any).activityBuffer;
      expect(buffer.activities).toHaveLength(1);
    });

    it('should flush buffer when full', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      // Fill buffer to capacity
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(service.logActivity(`user-${i}`, ActivityType.CONTENT_VIEWED, {}));
      }

      await Promise.all(promises);

      // Buffer should have flushed
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    it('should publish event to event bus', async () => {
      await service.logActivity('user-123', ActivityType.LOGIN, {});

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DomainEventType.USER_LOGGED_IN,
          aggregateId: 'user-123',
          aggregateType: 'user_activity',
        })
      );
    });

    it('should update session if sessionId provided', async () => {
      const sessionId = 'session-123';
      mockCache.get.mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        isActive: true,
        activityCount: 5,
      });

      await service.logActivity('user-123', ActivityType.CONTENT_VIEWED, {}, sessionId);

      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockEventBus.publish.mockRejectedValue(new Error('Event bus error'));

      await expect(service.logActivity('user-123', ActivityType.LOGIN, {})).rejects.toThrow();
    });
  });

  describe('logActivityBatch', () => {
    it('should log multiple activities', async () => {
      const activities = [
        {
          userId: 'user-1',
          type: ActivityType.CONTENT_VIEWED,
          metadata: {},
        },
        {
          userId: 'user-2',
          type: ActivityType.CONTENT_LIKED,
          metadata: {},
        },
      ];

      const result = await service.logActivityBatch(activities as any);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
    });

    it('should add all activities to buffer', async () => {
      const activities = Array(50)
        .fill(null)
        .map((_, i) => ({
          userId: `user-${i}`,
          type: ActivityType.CONTENT_VIEWED,
          metadata: {},
        }));

      await service.logActivityBatch(activities as any);

      const buffer = (service as any).activityBuffer;
      expect(buffer.activities.length).toBeGreaterThanOrEqual(50);
    });
  });

  // ============================================================================
  // Activity Feed Tests
  // ============================================================================

  describe('getActivityFeed', () => {
    it('should return paginated activity feed', async () => {
      const mockActivities = [
        {
          id: 'act-1',
          user_id: 'user-123',
          type: ActivityType.LOGIN,
          metadata: '{}',
          timestamp: new Date(),
          is_anonymous: false,
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] }) // count query
        .mockResolvedValueOnce({ rows: mockActivities }); // data query

      const options: ActivityFeedOptions = {
        userId: 'user-123',
        limit: 10,
        offset: 0,
      };

      const result = await service.getActivityFeed(options);

      expect(result).toMatchObject({
        activities: expect.any(Array),
        total: 10,
        hasMore: true,
      });
      expect(result.activities).toHaveLength(1);
    });

    it('should filter by activity types', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      const options: ActivityFeedOptions = {
        types: [ActivityType.LOGIN, ActivityType.LOGOUT],
        limit: 10,
      };

      await service.getActivityFeed(options);

      const query = mockDatabase.query.mock.calls[0][0];
      expect(query).toContain('type = ANY');
    });

    it('should filter by date range', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      const options: ActivityFeedOptions = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 10,
      };

      await service.getActivityFeed(options);

      const query = mockDatabase.query.mock.calls[0][0];
      expect(query).toContain('timestamp >=');
      expect(query).toContain('timestamp <=');
    });

    it('should exclude anonymized activities by default', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getActivityFeed({ limit: 10 });

      const query = mockDatabase.query.mock.calls[0][0];
      expect(query).toContain('is_anonymous = false');
    });
  });

  // ============================================================================
  // Session Management Tests
  // ============================================================================

  describe('createSession', () => {
    it('should create a new session', async () => {
      mockCache.set.mockResolvedValue(undefined);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile Safari/604.1',
      };

      const result = await service.createSession('user-123', metadata);

      expect(result).toMatchObject({
        userId: 'user-123',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        isActive: true,
        activityCount: 0,
      });
      expect(result.id).toBeDefined();
      expect(result.device).toMatchObject({
        type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
      });
    });

    it('should store session in cache and database', async () => {
      mockCache.set.mockResolvedValue(undefined);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await service.createSession('user-123', {});

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.any(Object),
        expect.any(Number)
      );
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_sessions'),
        expect.any(Array)
      );
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session from cache', async () => {
      const sessionId = 'session-123';
      const session = {
        id: sessionId,
        userId: 'user-123',
        startedAt: new Date(),
        lastActivityAt: new Date(Date.now() - 10000),
        isActive: true,
        activityCount: 5,
      };

      mockCache.get.mockResolvedValue(session);
      mockCache.set.mockResolvedValue(undefined);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await service.updateSessionActivity(sessionId);

      expect(result.activityCount).toBe(6);
      expect(result.lastActivityAt.getTime()).toBeGreaterThan(session.lastActivityAt.getTime());
    });

    it('should fallback to database if not in cache', async () => {
      const sessionId = 'session-123';
      mockCache.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: sessionId,
            user_id: 'user-123',
            started_at: new Date(),
            last_activity_at: new Date(),
            is_active: true,
            activity_count: 5,
          },
        ],
      });

      const result = await service.updateSessionActivity(sessionId);

      expect(result.activityCount).toBe(6);
    });

    it('should throw NotFoundError if session does not exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await expect(service.updateSessionActivity('invalid-session')).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('endSession', () => {
    it('should end an active session', async () => {
      const sessionId = 'session-123';
      mockCache.get.mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        isActive: true,
      });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await service.endSession(sessionId);

      expect(result.isActive).toBe(false);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions SET is_active = false'),
        [sessionId]
      );
      expect(mockCache.delete).toHaveBeenCalledWith(`session:${sessionId}`);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for a user', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'session-1',
            user_id: 'user-123',
            started_at: new Date(),
            last_activity_at: new Date(),
            is_active: true,
            activity_count: 10,
          },
          {
            id: 'session-2',
            user_id: 'user-123',
            started_at: new Date(),
            last_activity_at: new Date(),
            is_active: true,
            activity_count: 5,
          },
        ],
      });

      const result = await service.getActiveSessions('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('getActivityStats', () => {
    it('should return comprehensive activity statistics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockCache.get.mockResolvedValue(null); // No cached stats

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '1000' }] }) // total activities
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // unique users
        .mockResolvedValueOnce({
          rows: [
            { type: ActivityType.LOGIN, count: '100' },
            { type: ActivityType.CONTENT_VIEWED, count: '500' },
          ],
        }) // by type
        .mockResolvedValueOnce({
          rows: Array(24)
            .fill(null)
            .map((_, i) => ({ hour: i.toString(), count: Math.floor(Math.random() * 100).toString() })),
        }) // by hour
        .mockResolvedValueOnce({
          rows: Array(7)
            .fill(null)
            .map((_, i) => ({ day: i.toString(), count: Math.floor(Math.random() * 200).toString() })),
        }) // by day
        .mockResolvedValueOnce({ rows: [{ count: '45' }] }) // DAU
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '1800000', avg_activities_per_session: '20' }],
        }); // session metrics

      const result = await service.getActivityStats(startDate, endDate);

      expect(result).toMatchObject({
        period: { startDate, endDate },
        metrics: {
          totalActivities: 1000,
          uniqueUsers: 50,
          dailyActiveUsers: 45,
        },
      });
      expect(result.byHour).toHaveLength(24);
      expect(result.byDayOfWeek).toHaveLength(7);
    });

    it('should cache statistics results', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockCache.get.mockResolvedValue(null);
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: '0', avg_activities_per_session: '0' }] });

      await service.getActivityStats(startDate, endDate);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('activity_stats:'),
        expect.any(Object),
        expect.any(Number)
      );
    });
  });

  describe('getDailyActiveUsers', () => {
    it('should return DAU count for today', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: '150' }] });

      const result = await service.getDailyActiveUsers();

      expect(result).toBe(150);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(DISTINCT user_id)'),
        expect.any(Array)
      );
    });

    it('should return DAU for specific date', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: '200' }] });

      const date = new Date('2024-01-15');
      const result = await service.getDailyActiveUsers(date);

      expect(result).toBe(200);
    });
  });

  describe('getWeeklyActiveUsers', () => {
    it('should return WAU count', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: '500' }] });

      const result = await service.getWeeklyActiveUsers();

      expect(result).toBe(500);
    });
  });

  describe('getMonthlyActiveUsers', () => {
    it('should return MAU count', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: '2000' }] });

      const result = await service.getMonthlyActiveUsers();

      expect(result).toBe(2000);
    });
  });

  describe('getRetentionRate', () => {
    it('should calculate retention rate correctly', async () => {
      const cohortDate = new Date('2024-01-01');
      const daysAfter = 7;

      // Cohort users
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }, { user_id: 'user-3' }, { user_id: 'user-4' }],
      });

      // Retained users
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      const result = await service.getRetentionRate(cohortDate, daysAfter);

      expect(result).toBe(0.75); // 3/4 = 75%
    });

    it('should return 0 if cohort is empty', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getRetentionRate(new Date(), 7);

      expect(result).toBe(0);
    });
  });

  describe('getActivityInsights', () => {
    it('should return comprehensive insights', async () => {
      const userId = 'user-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock stats
      mockCache.get.mockResolvedValue(null);
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({
          rows: [{ type: ActivityType.CONTENT_VIEWED, count: '50' }],
        })
        .mockResolvedValueOnce({ rows: Array(24).fill({ hour: '0', count: '0' }) })
        .mockResolvedValueOnce({ rows: Array(7).fill({ day: '0', count: '0' }) })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: '1800000', avg_activities_per_session: '10' }] });

      // Mock feed
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getActivityInsights(userId, startDate, endDate);

      expect(result).toMatchObject({
        userId,
        period: { startDate, endDate },
        patterns: {
          mostActiveHours: expect.any(Array),
          mostActiveDays: expect.any(Array),
          mostFrequentActivities: expect.any(Array),
        },
      });
    });
  });

  // ============================================================================
  // Aggregation Tests
  // ============================================================================

  describe('createAggregations', () => {
    it('should create hourly aggregations', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T03:00:00Z');

      mockCache.get.mockResolvedValue(null);
      mockDatabase.query
        .mockResolvedValue({ rows: [{ total: '10' }] })
        .mockResolvedValue({ rows: [{ count: '5' }] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [{ count: '5' }] })
        .mockResolvedValue({ rows: [{ avg_duration: '0', avg_activities_per_session: '0' }] });

      const result = await service.createAggregations('hourly', startDate, endDate);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatchObject({
        period: 'hourly',
        activityCounts: expect.any(Object),
      });
    });

    it('should store aggregations in database', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await service.createAggregations('daily', new Date('2024-01-01'), new Date('2024-01-02'));

      const insertCalls = mockDatabase.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO activity_aggregations')
      );
      expect(insertCalls.length).toBeGreaterThan(0);
    });
  });

  describe('getAggregations', () => {
    it('should retrieve stored aggregations', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'agg-1',
            period: 'daily',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-02'),
            activity_counts: '{}',
            unique_users: 10,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.getAggregations(
        'daily',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('daily');
    });
  });

  // ============================================================================
  // Security & Fraud Detection Tests
  // ============================================================================

  describe('detectSuspiciousActivity', () => {
    it('should detect rapid requests', async () => {
      const activities = Array(150)
        .fill(null)
        .map((_, i) => ({
          id: `act-${i}`,
          user_id: 'user-123',
          type: ActivityType.API_REQUEST,
          metadata: '{}',
          timestamp: new Date(),
          is_anonymous: false,
        }));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '150' }] })
        .mockResolvedValueOnce({ rows: activities });

      const result = await service.detectSuspiciousActivity('user-123', 60);

      expect(result.isSuspicious).toBe(true);
      expect(result.patterns.rapidRequests).toBe(true);
      expect(result.reasons).toContain(expect.stringContaining('High activity volume'));
    });

    it('should detect multiple failed logins', async () => {
      const activities = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `act-${i}`,
          user_id: 'user-123',
          type: ActivityType.FAILED_LOGIN,
          metadata: '{}',
          timestamp: new Date(),
          is_anonymous: false,
        }));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({ rows: activities });

      const result = await service.detectSuspiciousActivity('user-123');

      expect(result.patterns.multipleFailedLogins).toBe(true);
    });

    it('should detect unusual locations', async () => {
      const activities = ['US', 'UK', 'AU', 'JP', 'CN'].map((country, i) => ({
        id: `act-${i}`,
        user_id: 'user-123',
        type: ActivityType.LOGIN,
        metadata: JSON.stringify({ location: { country } }),
        timestamp: new Date(),
        is_anonymous: false,
      }));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: activities });

      const result = await service.detectSuspiciousActivity('user-123');

      expect(result.patterns.unusualLocation).toBe(true);
    });

    it('should recommend action based on severity', async () => {
      const activities = Array(200)
        .fill(null)
        .map(() => ({
          id: uuidv4(),
          user_id: 'user-123',
          type: ActivityType.FAILED_LOGIN,
          metadata: JSON.stringify({ location: { country: 'CN' } }),
          timestamp: new Date(Date.now() - Math.random() * 3600000),
          is_anonymous: false,
        }));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '200' }] })
        .mockResolvedValueOnce({ rows: activities });

      const result = await service.detectSuspiciousActivity('user-123');

      expect(result.recommendedAction).toBeDefined();
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      mockCache.get.mockResolvedValue(5);
      mockCache.increment.mockResolvedValue(6);

      const result = await service.checkRateLimit('user-123', ActivityType.API_REQUEST, 100, 1);

      expect(result).toBe(false);
    });

    it('should block requests exceeding limit', async () => {
      mockCache.get.mockResolvedValue(100);

      const result = await service.checkRateLimit('user-123', ActivityType.API_REQUEST, 100, 1);

      expect(result).toBe(true);
    });

    it('should set expiration on first request', async () => {
      mockCache.get.mockResolvedValue(0);
      mockCache.increment.mockResolvedValue(1);

      await service.checkRateLimit('user-123', ActivityType.LOGIN, 10, 15);

      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Privacy & Compliance Tests
  // ============================================================================

  describe('exportUserActivity', () => {
    it('should export activities in JSON format', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'act-1',
              user_id: 'user-123',
              type: ActivityType.LOGIN,
              metadata: '{}',
              timestamp: new Date(),
              is_anonymous: false,
            },
            {
              id: 'act-2',
              user_id: 'user-123',
              type: ActivityType.CONTENT_VIEWED,
              metadata: '{}',
              timestamp: new Date(),
              is_anonymous: false,
            },
          ],
        });

      const request: ActivityExportRequest = {
        userId: 'user-123',
        format: 'json',
        includeMetadata: true,
      };

      const result = await service.exportUserActivity(request);

      expect(result.format).toBe('json');
      expect(result.totalRecords).toBe(2);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should export activities in CSV format', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'act-1',
              user_id: 'user-123',
              type: ActivityType.LOGIN,
              metadata: '{}',
              timestamp: new Date(),
              is_anonymous: false,
            },
          ],
        });

      const request: ActivityExportRequest = {
        userId: 'user-123',
        format: 'csv',
        includeMetadata: false,
      };

      const result = await service.exportUserActivity(request);

      expect(result.format).toBe('csv');
      expect(typeof result.data).toBe('string');
      expect((result.data as string).includes('id,type,timestamp')).toBe(true);
    });

    it('should log export for audit', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const request: ActivityExportRequest = {
        userId: 'user-123',
        format: 'json',
        includeMetadata: true,
      };

      await service.exportUserActivity(request);

      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'privacy.activity_exported',
          userId: 'user-123',
        })
      );
    });
  });

  describe('anonymizeActivities', () => {
    it('should anonymize activities before cutoff date', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: 50 }] });

      const count = await service.anonymizeActivities('user-123', new Date('2024-01-01'));

      expect(count).toBe(50);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_anonymous = true'),
        expect.any(Array)
      );
    });

    it('should use default date if not provided', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: 10 }] });

      await service.anonymizeActivities('user-123');

      expect(mockDatabase.query).toHaveBeenCalled();
    });
  });

  describe('deleteActivities', () => {
    it('should delete activities before cutoff date', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: 100 }] });

      const count = await service.deleteActivities('user-123', new Date('2023-01-01'));

      expect(count).toBe(100);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_activities'),
        expect.any(Array)
      );
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should apply retention policy with anonymization and deletion', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: 50 }] }) // anonymize
        .mockResolvedValueOnce({ rows: [{ count: 20 }] }); // delete

      const policy: ActivityRetentionPolicy = {
        retentionDays: 730, // 2 years
        anonymizeAfterDays: 365, // 1 year
        deleteAfterDays: 730, // 2 years
      };

      const result = await service.applyRetentionPolicy(policy);

      expect(result).toEqual({
        anonymized: 50,
        deleted: 20,
      });
    });

    it('should respect exempt activity types', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: 30 }] })
        .mockResolvedValueOnce({ rows: [{ count: 10 }] });

      const policy: ActivityRetentionPolicy = {
        retentionDays: 365,
        anonymizeAfterDays: 180,
        deleteAfterDays: 365,
        exemptActivityTypes: [ActivityType.PAYMENT_MADE, ActivityType.SUBSCRIPTION_CREATED],
      };

      await service.applyRetentionPolicy(policy);

      const queries = mockDatabase.query.mock.calls.map((call) => call[0]);
      expect(queries.some((q) => q.includes('type NOT IN'))).toBe(true);
    });
  });

  // ============================================================================
  // Health & Monitoring Tests
  // ============================================================================

  describe('isHealthy', () => {
    it('should return true if all systems operational', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ result: 1 }] });
      mockCache.get.mockResolvedValue(null);

      const result = await service.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false if database unavailable', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false if cache unavailable', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('flush', () => {
    it('should flush buffered activities to database', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      // Add activities to buffer
      await service.logActivity('user-1', ActivityType.LOGIN, {});
      await service.logActivity('user-2', ActivityType.CONTENT_VIEWED, {});

      const count = await service.flush();

      expect(count).toBe(2);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activities'),
        expect.any(Array)
      );
    });

    it('should return 0 if buffer is empty', async () => {
      const count = await service.flush();

      expect(count).toBe(0);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should handle flush errors by re-adding to buffer', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      await service.logActivity('user-1', ActivityType.LOGIN, {});

      await expect(service.flush()).rejects.toThrow();

      // Activities should still be in buffer
      const buffer = (service as any).activityBuffer;
      expect(buffer.activities.length).toBeGreaterThan(0);
    });
  });

  describe('dispose', () => {
    it('should stop flush interval', async () => {
      await service.dispose();

      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('should flush remaining activities', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await service.logActivity('user-1', ActivityType.LOGIN, {});

      await service.dispose();

      expect(mockDatabase.query).toHaveBeenCalled();
    });

    it('should prevent operations after disposal', async () => {
      await service.dispose();

      await expect(service.logActivity('user-1', ActivityType.LOGIN, {})).rejects.toThrow(
        'Service has been disposed'
      );
    });
  });

  // ============================================================================
  // Helper Methods Tests
  // ============================================================================

  describe('Device Parsing', () => {
    it('should parse desktop user agent', async () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0';

      const result = await service.logActivity('user-123', ActivityType.LOGIN, { userAgent });

      expect(result.metadata.device).toMatchObject({
        type: 'desktop',
        os: 'Windows',
        browser: 'Chrome',
      });
    });

    it('should parse mobile user agent', async () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile Safari/604.1';

      const result = await service.logActivity('user-123', ActivityType.LOGIN, { userAgent });

      expect(result.metadata.device).toMatchObject({
        type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
      });
    });

    it('should parse tablet user agent', async () => {
      const userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15';

      const result = await service.logActivity('user-123', ActivityType.LOGIN, { userAgent });

      expect(result.metadata.device).toMatchObject({
        type: 'tablet',
      });
    });

    it('should handle unknown user agent', async () => {
      const result = await service.logActivity('user-123', ActivityType.LOGIN, {});

      expect(result.metadata.device).toMatchObject({
        type: 'unknown',
      });
    });
  });
});

// Helper function (using crypto.randomUUID would be better in real implementation)
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
