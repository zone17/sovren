/**
 * 🧪 **SUPABASE REAL-TIME SERVICE TESTS**
 *
 * Test suite for the Supabase real-time service implementation
 * covering US-208: Supabase Real-time Features.
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

import { createClient } from '@supabase/supabase-js';
import type {
  ChannelConfig,
  EventFilter,
  RealtimeConfig,
} from '../services/supabase-realtime-service';
import { SupabaseRealtimeService } from '../services/supabase-realtime-service';

// Mock Supabase client
vi.mock('@supabase/supabase-js');

const mockCreateClient = createClient as anyedFunction<typeof createClient>;

// Test configuration
const testConfig: RealtimeConfig = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseKey: 'test-key',
  enableHeartbeat: true,
  heartbeatInterval: 30000,
  reconnectInterval: 5000,
  maxReconnectAttempts: 5,
  connectionTimeout: 10000,
  enableMetrics: true,
  enableDebugLogging: false,
  enableEventFiltering: true,
  eventThrottleMs: 100,
  batchSize: 50,
  maxChannels: 100,
};

// Mock channel
const mockChannel = {
  on: vi.fn(),
  off: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  send: vi.fn(),
};

// Mock Supabase client
const mockSupabaseClient = {
  channel: vi.fn().mockReturnValue(mockChannel),
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
  }),
  removeAllChannels: vi.fn(),
  getChannels: vi.fn().mockReturnValue([]),
};

describe('SupabaseRealtimeService', () => {
  let service: SupabaseRealtimeService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabaseClient as any);
    service = new SupabaseRealtimeService(testConfig);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('US-208.1: Client Configuration and Initialization', () => {
    it('should initialize with valid configuration', async () => {
      await service.initialize();
      expect(mockCreateClient).toHaveBeenCalledWith(testConfig.supabaseUrl, testConfig.supabaseKey);
    });

    it('should validate configuration schema', () => {
      const invalidConfig = {
        supabaseUrl: 'invalid-url',
        supabaseKey: '',
      };

      expect(() => new SupabaseRealtimeService(invalidConfig as any)).toThrow();
    });

    it('should test connection on initialization', async () => {
      await service.initialize();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should setup metrics and monitoring', async () => {
      await service.initialize();
      const metrics = service.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.isConnected).toBe(false);
      expect(metrics.channelCount).toBe(0);
    });

    it('should handle initialization errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Connection failed')),
        }),
      });

      await expect(service.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('US-208.2: Channel Subscription Management', () => {
    const channelConfig: ChannelConfig = {
      table: 'users',
      enableInsert: true,
      enableUpdate: true,
      enableDelete: true,
      userId: 'user123',
    };

    const callbacks = {
      onInsert: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onError: vi.fn(),
    };

    beforeEach(async () => {
      await service.initialize();
    });

    it('should create channel subscription', async () => {
      const subscriptionId = await service.subscribe('test-channel', channelConfig, callbacks);

      expect(subscriptionId).toBeDefined();
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('realtime:users');
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should configure channel events based on config', async () => {
      await service.subscribe('test-channel', channelConfig, callbacks);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'users',
        }),
        expect.any(Function)
      );
    });

    it('should handle subscription errors', async () => {
      mockChannel.subscribe.mockRejectedValue(new Error('Subscription failed'));

      await expect(service.subscribe('test-channel', channelConfig, callbacks)).rejects.toThrow(
        'Subscription failed'
      );
    });

    it('should unsubscribe from channel', async () => {
      const subscriptionId = await service.subscribe('test-channel', channelConfig, callbacks);
      await service.unsubscribe(subscriptionId);

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });

    it('should list active subscriptions', async () => {
      const subscriptionId = await service.subscribe('test-channel', channelConfig, callbacks);
      const subscriptions = service.getSubscriptions();

      expect(subscriptions).toHaveLength(1);
      const subscriptionArray = Array.from(subscriptions);
      expect(subscriptionArray[0]).toMatchObject({
        id: subscriptionId,
        table: 'users',
        isActive: true,
      });
    });

    it('should prevent duplicate subscriptions', async () => {
      await service.subscribe('test-channel', channelConfig, callbacks);

      await expect(service.subscribe('test-channel', channelConfig, callbacks)).rejects.toThrow(
        'Subscription already exists'
      );
    });

    it('should enforce max channels limit', async () => {
      const limitedConfig = { ...testConfig, maxChannels: 1 };
      const limitedService = new SupabaseRealtimeService(limitedConfig);
      await limitedService.initialize();

      await limitedService.subscribe('channel1', channelConfig, callbacks);

      await expect(limitedService.subscribe('channel2', channelConfig, callbacks)).rejects.toThrow(
        'Maximum channels limit reached'
      );

      await limitedService.shutdown();
    });
  });

  describe('US-208.3: Event Handling and Filtering', () => {
    const channelConfig: ChannelConfig = {
      table: 'users',
      enableInsert: true,
      enableUpdate: true,
      enableDelete: true,
      userId: 'user123',
    };

    const callbacks = {
      onInsert: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onError: vi.fn(),
    };

    const eventFilter: EventFilter = {
      userId: 'user123',
      eventTypes: ['INSERT', 'UPDATE'],
      tables: ['users'],
      priority: 'high',
      maxEvents: 100,
      timeWindow: 60000,
    };

    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle real-time events', async () => {
      await service.subscribe('test-channel', channelConfig, callbacks);

      // Simulate event
      const eventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].event === 'INSERT'
      )?.[2];

      if (eventHandler) {
        eventHandler({
          schema: 'public',
          table: 'users',
          new: { id: 1, name: 'John' },
        });
      }

      expect(callbacks.onInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INSERT',
          table: 'users',
          record: { id: 1, name: 'John' },
        })
      );
    });

    it('should apply event filtering', async () => {
      await service.subscribe('test-channel', channelConfig, callbacks, eventFilter);

      // Simulate event with different user
      const eventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].event === 'INSERT'
      )?.[2];

      if (eventHandler) {
        eventHandler({
          schema: 'public',
          table: 'users',
          new: { id: 1, name: 'John', userId: 'different-user' },
        });
      }

      // Should not trigger callback due to user filter
      expect(callbacks.onInsert).not.toHaveBeenCalled();
    });

    it('should handle event processing errors', async () => {
      callbacks.onInsert.mockImplementation(() => {
        throw new Error('Processing error');
      });

      await service.subscribe('test-channel', channelConfig, callbacks);

      const eventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].event === 'INSERT'
      )?.[2];

      if (eventHandler) {
        eventHandler({
          schema: 'public',
          table: 'users',
          new: { id: 1, name: 'John' },
        });
      }

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should emit global events', async () => {
      const globalEventHandler = vi.fn();
      service.on('event:received', globalEventHandler);

      await service.subscribe('test-channel', channelConfig, callbacks);

      const eventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].event === 'INSERT'
      )?.[2];

      if (eventHandler) {
        eventHandler({
          schema: 'public',
          table: 'users',
          new: { id: 1, name: 'John' },
        });
      }

      expect(globalEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INSERT',
          table: 'users',
        })
      );
    });
  });

  describe('US-208.4: Connection Management and Health Monitoring', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track connection metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toMatchObject({
        isConnected: expect.any(Boolean),
        connectionTime: expect.any(Date),
        reconnectAttempts: expect.any(Number),
        totalConnections: expect.any(Number),
        channelCount: expect.any(Number),
      });
    });

    it('should handle connection state changes', async () => {
      const stateHandler = vi.fn();
      service.on('connection:state-changed', stateHandler);

      await service.connect();

      expect(stateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'connected',
          previousState: 'disconnected',
        })
      );
    });

    it('should perform heartbeat monitoring', async () => {
      const heartbeatHandler = vi.fn();
      service.on('heartbeat:sent', heartbeatHandler);

      await service.connect();

      // Wait for heartbeat
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(heartbeatHandler).toHaveBeenCalled();
    });
  });

  describe('US-208.5: Error Handling and Recovery', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle reconnection attempts', async () => {
      const reconnectHandler = vi.fn();
      service.on('connection:reconnecting', reconnectHandler);

      // Simulate connection failure
      await service.disconnect();

      expect(reconnectHandler).toHaveBeenCalled();
    });

    it('should implement exponential backoff', async () => {
      const attempts: number[] = [];
      const originalSetTimeout = setTimeout;

      vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        attempts.push(delay as number);
        return originalSetTimeout(callback, 0);
      });

      // Simulate multiple reconnection attempts
      for (let i = 0; i < 3; i++) {
        await service.disconnect();
      }

      expect(attempts.length).toBeGreaterThan(0);
      // Verify exponential backoff pattern
      if (attempts.length > 1) {
        expect(attempts[1]).toBeGreaterThan(attempts[0]);
      }
    });

    it('should handle maximum reconnection attempts', async () => {
      const failedHandler = vi.fn();
      service.on('connection:failed', failedHandler);

      // Simulate exceeding max attempts
      for (let i = 0; i <= testConfig.maxReconnectAttempts; i++) {
        await service.disconnect();
      }

      expect(failedHandler).toHaveBeenCalled();
    });
  });

  describe('US-208.6: Performance Optimization', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should batch events for performance', async () => {
      const batchHandler = vi.fn();
      service.on('batch:processed', batchHandler);

      // Simulate multiple events
      const callbacks = {
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        onError: vi.fn(),
      };

      const fullChannelConfig: ChannelConfig = {
        table: 'users',
        enableInsert: true,
        enableUpdate: true,
        enableDelete: true,
      };

      await service.subscribe('test-channel', fullChannelConfig, callbacks);

      // Trigger multiple events
      const eventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].event === 'INSERT'
      )?.[2];

      if (eventHandler) {
        for (let i = 0; i < 5; i++) {
          eventHandler({
            schema: 'public',
            table: 'users',
            new: { id: i, name: `User${i}` },
          });
        }
      }

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(batchHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.any(Array),
          batchId: expect.any(String),
        })
      );
    });

    it('should throttle events', async () => {
      const throttledConfig = { ...testConfig, eventThrottleMs: 100 };
      const throttledService = new SupabaseRealtimeService(throttledConfig);
      await throttledService.initialize();

      const callbacks = {
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        onError: vi.fn(),
      };

      const fullChannelConfig: ChannelConfig = {
        table: 'users',
        enableInsert: true,
        enableUpdate: true,
        enableDelete: true,
      };

      await throttledService.subscribe('test-channel', fullChannelConfig, callbacks);

      // Rapid fire events
      const eventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].event === 'INSERT'
      )?.[2];

      if (eventHandler) {
        for (let i = 0; i < 10; i++) {
          eventHandler({
            schema: 'public',
            table: 'users',
            new: { id: i, name: `User${i}` },
          });
        }
      }

      // Should throttle callbacks
      expect(callbacks.onInsert.mock.calls.length).toBeLessThan(10);

      await throttledService.shutdown();
    });
  });

  describe('US-208.7: Graceful Shutdown', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should cleanup resources on shutdown', async () => {
      const channelConfig: ChannelConfig = {
        table: 'users',
        enableInsert: true,
        enableUpdate: true,
        enableDelete: true,
      };

      const callbacks = {
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        onError: vi.fn(),
      };

      await service.subscribe('test-channel', channelConfig, callbacks);

      const shutdownHandler = vi.fn();
      service.on('shutdown:complete', shutdownHandler);

      await service.shutdown();

      expect(mockSupabaseClient.removeAllChannels).toHaveBeenCalled();
      expect(shutdownHandler).toHaveBeenCalled();
    });

    it('should handle graceful shutdown timeout', async () => {
      const timeoutConfig = { ...testConfig, connectionTimeout: 100 };
      const timeoutService = new SupabaseRealtimeService(timeoutConfig);
      await timeoutService.initialize();

      // Simulate slow shutdown
      mockSupabaseClient.removeAllChannels.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      const start = Date.now();
      await timeoutService.shutdown();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThan(100);
    });

    it('should prevent operations after shutdown', async () => {
      await service.shutdown();

      const channelConfig: ChannelConfig = {
        table: 'users',
        enableInsert: true,
        enableUpdate: true,
        enableDelete: true,
      };

      await expect(
        service.subscribe('test-channel', channelConfig, {
          onInsert: vi.fn(),
          onUpdate: vi.fn(),
          onDelete: vi.fn(),
          onError: vi.fn(),
        })
      ).rejects.toThrow('Service is shutting down');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex real-world scenario', async () => {
      await service.initialize();

      const userCallbacks = {
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        onError: vi.fn(),
      };

      const contentCallbacks = {
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        onError: vi.fn(),
      };

      const userChannelConfig: ChannelConfig = {
        table: 'users',
        enableInsert: true,
        enableUpdate: true,
        enableDelete: true,
      };

      const contentChannelConfig: ChannelConfig = {
        table: 'content',
        enableInsert: true,
        enableUpdate: true,
        enableDelete: true,
      };

      // Subscribe to multiple tables
      await service.subscribe('users', userChannelConfig, userCallbacks);
      await service.subscribe('content', contentChannelConfig, contentCallbacks);

      // Simulate events
      const userEventHandler = mockChannel.on.mock.calls.find(
        (call: any) => call[1].table === 'users' && call[1].event === 'INSERT'
      )?.[2];

      if (userEventHandler) {
        userEventHandler({
          schema: 'public',
          table: 'users',
          new: { id: 1, name: 'John' },
        });
      }

      // Verify metrics
      const metrics = service.getMetrics();
      expect(metrics.channelCount).toBe(2);
      expect(metrics.eventRate).toBeGreaterThan(0);

      // Cleanup
      await service.shutdown();
    });
  });
});
