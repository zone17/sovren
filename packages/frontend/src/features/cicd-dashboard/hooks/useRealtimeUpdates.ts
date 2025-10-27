/**
 * CI/CD Dashboard - useRealtimeUpdates Hook
 *
 * React hook for managing real-time WebSocket/SSE connections.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRealtimeService } from '../services';
import type {
  WebSocketMessage,
  WebSocketStatus,
  RealtimeConnectionState,
} from '../types';

interface UseRealtimeUpdatesOptions {
  enabled?: boolean;
  deploymentId?: string;
  environment?: 'staging' | 'production';
  onMessage?: (message: WebSocketMessage) => void;
}

interface UseRealtimeUpdatesReturn {
  connectionState: RealtimeConnectionState;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  connect: () => void;
  disconnect: () => void;
}

export function useRealtimeUpdates(
  options: UseRealtimeUpdatesOptions = {}
): UseRealtimeUpdatesReturn {
  const { enabled = true, deploymentId, environment, onMessage } = options;

  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>({
    type: null,
    status: 'disconnected',
    reconnectAttempts: 0,
    subscriptions: [],
  });

  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep onMessage ref up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    const realtimeService = getRealtimeService();
    realtimeService.connect();
  }, []);

  const disconnect = useCallback(() => {
    const realtimeService = getRealtimeService();
    realtimeService.disconnect();
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    setLastMessage(message);
    onMessageRef.current?.(message);
  }, []);

  const handleStatusChange = useCallback((status: WebSocketStatus) => {
    setConnectionState((prev) => ({ ...prev, status }));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const realtimeService = getRealtimeService();

    // Add message listener
    realtimeService.addMessageListener(handleMessage);

    // Add status listener
    realtimeService.addStatusListener(handleStatusChange);

    // Subscribe to updates
    if (deploymentId) {
      subscriptionIdRef.current = realtimeService.subscribe({
        type: 'deployment',
        filter: { deploymentId },
        callback: handleMessage,
      });
    } else if (environment) {
      subscriptionIdRef.current = realtimeService.subscribe({
        type: 'environment',
        filter: { environment },
        callback: handleMessage,
      });
    } else {
      subscriptionIdRef.current = realtimeService.subscribe({
        type: 'all',
        callback: handleMessage,
      });
    }

    // Connect
    realtimeService.connect();

    return () => {
      realtimeService.removeMessageListener(handleMessage);
      realtimeService.removeStatusListener(handleStatusChange);

      if (subscriptionIdRef.current) {
        realtimeService.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [enabled, deploymentId, environment, handleMessage, handleStatusChange]);

  return {
    connectionState,
    isConnected: connectionState.status === 'connected',
    lastMessage,
    connect,
    disconnect,
  };
}
