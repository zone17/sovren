/**
 * 🎣 **USE REALTIME SERVICE HOOK**
 *
 * Elite React hook for Supabase real-time integration with comprehensive features:
 * - Real-time subscription management
 * - Connection state management
 * - Optimistic updates with automatic rollback
 * - Error handling and recovery
 * - Performance monitoring
 * - Automatic cleanup
 *
 * **Implementation for US-208: Supabase Real-time Features**
 *
 * Features:
 * - US-208.1: Easy React integration ✅
 * - US-208.2: Automatic subscription management ✅
 * - US-208.3: Optimistic updates with rollback ✅
 * - US-208.4: Connection state management ✅
 * - US-208.5: Error handling and recovery ✅
 * - US-208.6: Performance monitoring ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  ChannelConfig,
  ConnectionMetrics,
  EventFilter,
  FrontendSupabaseRealtimeService,
  getFrontendRealtimeService,
  OptimisticUpdate,
  RealtimeEvent,
} from '../services/supabase-realtime-service';

// 🔧 **HOOK CONFIGURATION SCHEMA**

const UseRealtimeConfigSchema = z.object({
  autoConnect: z.boolean().default(true),
  autoReconnect: z.boolean().default(true),
  enableMetrics: z.boolean().default(true),
  enableOptimisticUpdates: z.boolean().default(true),
  userId: z.string().optional(),
  debugMode: z.boolean().default(false),
});

export type UseRealtimeConfig = z.infer<typeof UseRealtimeConfigSchema>;

// 📊 **HOOK STATE INTERFACES**

export interface RealtimeConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface RealtimeSubscription {
  id: string;
  table: string;
  isActive: boolean;
  eventsReceived: number;
  lastEventTime: Date | null;
  errors: number;
}

export interface RealtimeHookState {
  connectionState: RealtimeConnectionState;
  subscriptions: Map<string, RealtimeSubscription>;
  metrics: ConnectionMetrics | null;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  isInitialized: boolean;
  error: string | null;
}

// 🎣 **MAIN HOOK**

export function useRealtimeService(config: UseRealtimeConfig = {}) {
  const validatedConfig = UseRealtimeConfigSchema.parse(config);

  // Service instance
  const serviceRef = useRef<FrontendSupabaseRealtimeService | null>(null);

  // Hook state
  const [state, setState] = useState<RealtimeHookState>({
    connectionState: {
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      connectionError: null,
      lastConnectedAt: null,
      reconnectAttempts: 0,
      connectionQuality: 'offline',
    },
    subscriptions: new Map(),
    metrics: null,
    optimisticUpdates: new Map(),
    isInitialized: false,
    error: null,
  });

  // Event handlers
  const handleConnectionStateChange = useCallback((newState: Partial<RealtimeConnectionState>) => {
    setState((prev) => ({
      ...prev,
      connectionState: {
        ...prev.connectionState,
        ...newState,
      },
    }));
  }, []);

  const handleSubscriptionUpdate = useCallback(
    (subscriptionId: string, update: Partial<RealtimeSubscription>) => {
      setState((prev) => {
        const newSubscriptions = new Map(prev.subscriptions);
        const existing = newSubscriptions.get(subscriptionId);
        if (existing) {
          newSubscriptions.set(subscriptionId, { ...existing, ...update });
        }
        return {
          ...prev,
          subscriptions: newSubscriptions,
        };
      });
    },
    []
  );

  const handleOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setState((prev) => {
      const newUpdates = new Map(prev.optimisticUpdates);
      newUpdates.set(update.id, update);
      return {
        ...prev,
        optimisticUpdates: newUpdates,
      };
    });
  }, []);

  const handleOptimisticUpdateRemoval = useCallback((updateId: string) => {
    setState((prev) => {
      const newUpdates = new Map(prev.optimisticUpdates);
      newUpdates.delete(updateId);
      return {
        ...prev,
        optimisticUpdates: newUpdates,
      };
    });
  }, []);

  // Initialize service
  useEffect(() => {
    if (serviceRef.current) return;

    try {
      serviceRef.current = getFrontendRealtimeService();

      if (validatedConfig.autoConnect) {
        serviceRef.current
          .initialize(validatedConfig.userId)
          .then(() => {
            setState((prev) => ({ ...prev, isInitialized: true }));

            if (validatedConfig.autoConnect) {
              serviceRef.current?.connect();
            }
          })
          .catch((error) => {
            setState((prev) => ({ ...prev, error: error.message }));
          });
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [validatedConfig.autoConnect, validatedConfig.userId]);

  // Setup event listeners
  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;

    // Connection events
    const handleConnecting = () => {
      handleConnectionStateChange({ isConnecting: true, connectionError: null });
    };

    const handleConnected = ({ latency }: { latency: number }) => {
      handleConnectionStateChange({
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        lastConnectedAt: new Date(),
        connectionError: null,
        connectionQuality: latency < 100 ? 'excellent' : latency < 300 ? 'good' : 'poor',
      });
    };

    const handleDisconnected = () => {
      handleConnectionStateChange({
        isConnected: false,
        isConnecting: false,
        connectionQuality: 'offline',
      });
    };

    const handleConnectionError = (error: Error) => {
      handleConnectionStateChange({
        isConnected: false,
        isConnecting: false,
        isReconnecting: validatedConfig.autoReconnect,
        connectionError: error.message,
        connectionQuality: 'offline',
      });
    };

    // Subscription events
    const handleSubscriptionCreated = ({
      subscriptionId,
      config,
    }: {
      subscriptionId: string;
      config: ChannelConfig;
    }) => {
      const subscription: RealtimeSubscription = {
        id: subscriptionId,
        table: config.table,
        isActive: false,
        eventsReceived: 0,
        lastEventTime: null,
        errors: 0,
      };

      setState((prev) => {
        const newSubscriptions = new Map(prev.subscriptions);
        newSubscriptions.set(subscriptionId, subscription);
        return { ...prev, subscriptions: newSubscriptions };
      });
    };

    const handleSubscriptionSubscribed = ({ subscriptionId }: { subscriptionId: string }) => {
      handleSubscriptionUpdate(subscriptionId, { isActive: true });
    };

    const handleSubscriptionClosed = ({ subscriptionId }: { subscriptionId: string }) => {
      handleSubscriptionUpdate(subscriptionId, { isActive: false });
    };

    const handleSubscriptionError = ({ subscriptionId }: { subscriptionId: string }) => {
      handleSubscriptionUpdate(subscriptionId, { errors: 1 });
    };

    const handleSubscriptionRemoved = ({ subscriptionId }: { subscriptionId: string }) => {
      setState((prev) => {
        const newSubscriptions = new Map(prev.subscriptions);
        newSubscriptions.delete(subscriptionId);
        return { ...prev, subscriptions: newSubscriptions };
      });
    };

    // Event handling
    const handleEventReceived = (event: RealtimeEvent) => {
      // Find the subscription that matches this event
      const subscription = Array.from(state.subscriptions.values()).find(
        (sub) => sub.table === event.table
      );
      if (subscription) {
        handleSubscriptionUpdate(subscription.id, {
          eventsReceived: subscription.eventsReceived + 1,
          lastEventTime: event.timestamp,
        });
      }
    };

    // Optimistic update events
    const handleOptimisticUpdateEvent = (update: OptimisticUpdate) => {
      handleOptimisticUpdate(update);
    };

    const handleOptimisticVerified = (update: OptimisticUpdate) => {
      handleOptimisticUpdateRemoval(update.id);
    };

    const handleOptimisticRollback = (update: OptimisticUpdate) => {
      handleOptimisticUpdateRemoval(update.id);
    };

    const handleOptimisticTimeout = (update: OptimisticUpdate) => {
      handleOptimisticUpdateRemoval(update.id);
    };

    // Register event listeners
    service.on('connection:connecting', handleConnecting);
    service.on('connection:connected', handleConnected);
    service.on('connection:disconnected', handleDisconnected);
    service.on('connection:error', handleConnectionError);
    service.on('subscription:created', handleSubscriptionCreated);
    service.on('subscription:subscribed', handleSubscriptionSubscribed);
    service.on('subscription:closed', handleSubscriptionClosed);
    service.on('subscription:error', handleSubscriptionError);
    service.on('subscription:removed', handleSubscriptionRemoved);
    service.on('event:received', handleEventReceived);
    service.on('optimistic:update', handleOptimisticUpdateEvent);
    service.on('optimistic:verified', handleOptimisticVerified);
    service.on('optimistic:rollback', handleOptimisticRollback);
    service.on('optimistic:timeout', handleOptimisticTimeout);

    return () => {
      // Cleanup event listeners
      service.off('connection:connecting', handleConnecting);
      service.off('connection:connected', handleConnected);
      service.off('connection:disconnected', handleDisconnected);
      service.off('connection:error', handleConnectionError);
      service.off('subscription:created', handleSubscriptionCreated);
      service.off('subscription:subscribed', handleSubscriptionSubscribed);
      service.off('subscription:closed', handleSubscriptionClosed);
      service.off('subscription:error', handleSubscriptionError);
      service.off('subscription:removed', handleSubscriptionRemoved);
      service.off('event:received', handleEventReceived);
      service.off('optimistic:update', handleOptimisticUpdateEvent);
      service.off('optimistic:verified', handleOptimisticVerified);
      service.off('optimistic:rollback', handleOptimisticRollback);
      service.off('optimistic:timeout', handleOptimisticTimeout);
    };
  }, [
    validatedConfig.autoReconnect,
    handleConnectionStateChange,
    handleSubscriptionUpdate,
    handleOptimisticUpdate,
    handleOptimisticUpdateRemoval,
    state.subscriptions,
  ]);

  // Metrics update
  useEffect(() => {
    if (!validatedConfig.enableMetrics || !serviceRef.current) return;

    const updateMetrics = () => {
      if (serviceRef.current) {
        const metrics = serviceRef.current.getMetrics();
        setState((prev) => ({ ...prev, metrics }));
      }
    };

    // Update metrics immediately
    updateMetrics();

    // Set up periodic updates
    const interval = setInterval(updateMetrics, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [validatedConfig.enableMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.shutdown().catch(console.error);
      }
    };
  }, []);

  // 🔧 **HOOK METHODS**

  const connect = useCallback(async () => {
    if (!serviceRef.current) {
      throw new Error('Realtime service not initialized');
    }

    try {
      await serviceRef.current.connect();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.disconnect();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }, []);

  const subscribe = useCallback(
    async (
      subscriptionId: string,
      config: ChannelConfig,
      callbacks: {
        onInsert?: (event: RealtimeEvent) => void;
        onUpdate?: (event: RealtimeEvent) => void;
        onDelete?: (event: RealtimeEvent) => void;
        onError?: (error: Error) => void;
      },
      filter?: EventFilter
    ) => {
      if (!serviceRef.current) {
        throw new Error('Realtime service not initialized');
      }

      try {
        return await serviceRef.current.subscribe(subscriptionId, config, callbacks, filter);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    },
    []
  );

  const unsubscribe = useCallback(async (subscriptionId: string) => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.unsubscribe(subscriptionId);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }, []);

  const performOptimisticUpdate = useCallback(
    async (
      table: string,
      operation: 'INSERT' | 'UPDATE' | 'DELETE',
      data: any,
      originalData?: any
    ) => {
      if (!serviceRef.current) {
        throw new Error('Realtime service not initialized');
      }

      if (!validatedConfig.enableOptimisticUpdates) {
        throw new Error('Optimistic updates are disabled');
      }

      try {
        return await serviceRef.current.performOptimisticUpdate(
          table,
          operation,
          data,
          originalData
        );
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    },
    [validatedConfig.enableOptimisticUpdates]
  );

  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    if (!serviceRef.current) return;

    try {
      serviceRef.current.rollbackOptimisticUpdate(updateId);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }, []);

  const getHealthStatus = useCallback(async () => {
    if (!serviceRef.current) {
      return {
        healthy: false,
        status: 'not_initialized',
        metrics: null,
        details: { error: 'Service not initialized' },
      };
    }

    try {
      return await serviceRef.current.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        metrics: null,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // 🎯 **RETURN OBJECT**

  return {
    // State
    ...state,

    // Connection methods
    connect,
    disconnect,

    // Subscription methods
    subscribe,
    unsubscribe,

    // Optimistic update methods
    performOptimisticUpdate,
    rollbackOptimisticUpdate,

    // Utility methods
    getHealthStatus,
    clearError,

    // Computed properties
    isConnected: state.connectionState.isConnected,
    isConnecting: state.connectionState.isConnecting,
    connectionError: state.connectionState.connectionError,
    subscriptionCount: state.subscriptions.size,
    optimisticUpdateCount: state.optimisticUpdates.size,

    // Debug information (only in debug mode)
    ...(validatedConfig.debugMode && {
      debugInfo: {
        service: serviceRef.current,
        config: validatedConfig,
        internalState: state,
      },
    }),
  };
}

// 🎣 **SPECIALIZED HOOKS**

/**
 * Hook for subscribing to a specific table with real-time updates
 */
export function useRealtimeTable(
  table: string,
  callbacks: {
    onInsert?: (event: RealtimeEvent) => void;
    onUpdate?: (event: RealtimeEvent) => void;
    onDelete?: (event: RealtimeEvent) => void;
    onError?: (error: Error) => void;
  },
  options: {
    filter?: string;
    userId?: string;
    enabled?: boolean;
  } = {}
) {
  const { enabled = true } = options;
  const realtimeService = useRealtimeService({ userId: options.userId });
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !realtimeService.isInitialized) return;

    const subscriptionId = `table_${table}_${Date.now()}`;
    subscriptionIdRef.current = subscriptionId;

    const channelConfig: ChannelConfig = {
      table,
      filter: options.filter,
      userId: options.userId,
    };

    realtimeService.subscribe(subscriptionId, channelConfig, callbacks).catch(console.error);

    return () => {
      if (subscriptionIdRef.current) {
        realtimeService.unsubscribe(subscriptionIdRef.current).catch(console.error);
      }
    };
  }, [table, enabled, realtimeService.isInitialized, options.filter, options.userId]);

  return {
    isSubscribed:
      subscriptionIdRef.current !== null &&
      realtimeService.subscriptions.has(subscriptionIdRef.current),
    subscription: subscriptionIdRef.current
      ? realtimeService.subscriptions.get(subscriptionIdRef.current)
      : null,
  };
}

/**
 * Hook for performing optimistic updates with automatic rollback
 */
export function useOptimisticUpdate() {
  const realtimeService = useRealtimeService({ enableOptimisticUpdates: true });

  const performUpdate = useCallback(
    async (
      table: string,
      operation: 'INSERT' | 'UPDATE' | 'DELETE',
      data: any,
      originalData?: any
    ) => {
      try {
        return await realtimeService.performOptimisticUpdate(table, operation, data, originalData);
      } catch (error) {
        console.error('Optimistic update failed:', error);
        throw error;
      }
    },
    [realtimeService]
  );

  const rollbackUpdate = useCallback(
    (updateId: string) => {
      try {
        realtimeService.rollbackOptimisticUpdate(updateId);
      } catch (error) {
        console.error('Optimistic update rollback failed:', error);
        throw error;
      }
    },
    [realtimeService]
  );

  return {
    performUpdate,
    rollbackUpdate,
    optimisticUpdates: realtimeService.optimisticUpdates,
    optimisticUpdateCount: realtimeService.optimisticUpdateCount,
  };
}

/**
 * Hook for monitoring real-time connection health
 */
export function useRealtimeHealth() {
  const realtimeService = useRealtimeService({ enableMetrics: true });

  return {
    isHealthy:
      realtimeService.connectionState.isConnected &&
      !realtimeService.connectionState.connectionError,
    connectionState: realtimeService.connectionState,
    metrics: realtimeService.metrics,
    getHealthStatus: realtimeService.getHealthStatus,
  };
}

export default useRealtimeService;
