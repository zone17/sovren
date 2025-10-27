/**
 * CI/CD Dashboard - Real-time Updates Service
 *
 * Service for real-time deployment monitoring using WebSocket or Server-Sent Events (SSE).
 * Implements automatic reconnection, heartbeat monitoring, and fallback mechanisms.
 */

import type {
  WebSocketMessage,
  WebSocketStatus,
  WebSocketSubscription,
  RealtimeServiceConfig,
  RealtimeConnectionState,
} from '../types';

/**
 * Real-time service implementation
 */
export class RealtimeService {
  private config: RealtimeServiceConfig;
  private websocket: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private connectionType: 'websocket' | 'sse' | null = null;
  private connectionStatus: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  private messageListeners: Set<(message: WebSocketMessage) => void> = new Set();
  private statusListeners: Set<(status: WebSocketStatus) => void> = new Set();

  constructor(config: RealtimeServiceConfig) {
    this.config = {
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10,
      fallbackToSSE: true,
      ...config,
    };
  }

  /**
   * Connect to real-time service
   */
  async connect(): Promise<void> {
    if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
      return;
    }

    this.setStatus('connecting');

    try {
      if (this.config.preferredType === 'websocket') {
        await this.connectWebSocket();
      } else {
        await this.connectSSE();
      }

      this.reconnectAttempts = 0;
      this.startHeartbeat();
    } catch (error) {
      console.error('Failed to connect:', error);

      // Fallback to SSE if WebSocket fails
      if (
        this.config.preferredType === 'websocket' &&
        this.config.fallbackToSSE
      ) {
        try {
          await this.connectSSE();
          this.reconnectAttempts = 0;
          this.startHeartbeat();
        } catch (sseError) {
          console.error('SSE fallback failed:', sseError);
          this.handleConnectionError(sseError);
        }
      } else {
        this.handleConnectionError(error);
      }
    }
  }

  /**
   * Connect using WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = this.buildWebSocketUrl();
        this.websocket = new WebSocket(url);

        this.websocket.onopen = () => {
          this.connectionType = 'websocket';
          this.setStatus('connected');
          console.log('WebSocket connected');
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.websocket.onclose = () => {
          console.log('WebSocket disconnected');
          this.handleDisconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Connect using Server-Sent Events
   */
  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = this.buildSSEUrl();
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          this.connectionType = 'sse';
          this.setStatus('connected');
          console.log('SSE connected');
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          this.handleDisconnect();
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build WebSocket URL with authentication
   */
  private buildWebSocketUrl(): string {
    const url = new URL(this.config.websocketUrl);

    if (this.config.authToken) {
      url.searchParams.set('token', this.config.authToken);
    }

    return url.toString();
  }

  /**
   * Build SSE URL with authentication
   */
  private buildSSEUrl(): string {
    const url = new URL(this.config.sseUrl);

    if (this.config.authToken) {
      url.searchParams.set('token', this.config.authToken);
    }

    return url.toString();
  }

  /**
   * Disconnect from real-time service
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimeout();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectionType = null;
    this.setStatus('disconnected');
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      // Handle ping/pong
      if (message.type === 'ping') {
        this.sendPong();
        return;
      }

      // Notify message listeners
      this.messageListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (error) {
          console.error('Error in message listener:', error);
        }
      });

      // Notify subscription listeners
      this.subscriptions.forEach((subscription) => {
        const matchesFilter = this.messageMatchesSubscription(message, subscription);
        if (matchesFilter) {
          try {
            subscription.callback(message);
          } catch (error) {
            console.error('Error in subscription callback:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Check if message matches subscription filter
   */
  private messageMatchesSubscription(
    message: WebSocketMessage,
    subscription: WebSocketSubscription
  ): boolean {
    if (subscription.type === 'all') {
      return true;
    }

    if (subscription.type === 'deployment' && subscription.filter?.deploymentId) {
      return message.deploymentId === subscription.filter.deploymentId;
    }

    if (subscription.type === 'environment' && subscription.filter?.environment) {
      return message.environment === subscription.filter.environment;
    }

    return false;
  }

  /**
   * Send pong response to ping
   */
  private sendPong(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      const pongMessage: WebSocketMessage = {
        type: 'pong',
        payload: {},
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
      };
      this.websocket.send(JSON.stringify(pongMessage));
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    this.setStatus('disconnected');

    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: unknown): void {
    this.setStatus('error');

    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (
      this.config.maxReconnectAttempts &&
      this.reconnectAttempts >= this.config.maxReconnectAttempts
    ) {
      console.error('Max reconnect attempts reached');
      this.setStatus('error');
      return;
    }

    this.clearReconnectTimeout();

    const delay = this.config.reconnectDelay ?? 3000;
    const backoffDelay = delay * Math.pow(1.5, this.reconnectAttempts);

    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    console.log(
      `Reconnecting in ${backoffDelay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, backoffDelay);
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send ping every 30 seconds
    this.heartbeatIntervalId = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          type: 'ping',
          payload: {},
          timestamp: new Date().toISOString(),
          id: crypto.randomUUID(),
        };
        this.websocket.send(JSON.stringify(pingMessage));
      }
    }, 30000);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Subscribe to deployment updates
   */
  subscribe(subscription: Omit<WebSocketSubscription, 'id'>): string {
    const id = crypto.randomUUID();
    const fullSubscription: WebSocketSubscription = {
      ...subscription,
      id,
    };

    this.subscriptions.set(id, fullSubscription);

    // Send subscription message to server
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'deployment_started', // TODO: Add subscribe message type
        payload: {
          action: 'subscribe',
          subscriptionId: id,
          filter: subscription.filter,
        },
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
      };
      this.websocket.send(JSON.stringify(message));
    }

    return id;
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);

    if (subscription) {
      // Send unsubscribe message to server
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const message: WebSocketMessage = {
          type: 'deployment_started', // TODO: Add unsubscribe message type
          payload: {
            action: 'unsubscribe',
            subscriptionId,
          },
          timestamp: new Date().toISOString(),
          id: crypto.randomUUID(),
        };
        this.websocket.send(JSON.stringify(message));
      }

      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Add message listener
   */
  addMessageListener(listener: (message: WebSocketMessage) => void): void {
    this.messageListeners.add(listener);
  }

  /**
   * Remove message listener
   */
  removeMessageListener(listener: (message: WebSocketMessage) => void): void {
    this.messageListeners.delete(listener);
  }

  /**
   * Add status listener
   */
  addStatusListener(listener: (status: WebSocketStatus) => void): void {
    this.statusListeners.add(listener);
    // Immediately notify of current status
    listener(this.connectionStatus);
  }

  /**
   * Remove status listener
   */
  removeStatusListener(listener: (status: WebSocketStatus) => void): void {
    this.statusListeners.delete(listener);
  }

  /**
   * Set connection status
   */
  private setStatus(status: WebSocketStatus): void {
    this.connectionStatus = status;

    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  /**
   * Get current connection state
   */
  getConnectionState(): RealtimeConnectionState {
    return {
      type: this.connectionType,
      status: this.connectionStatus,
      lastConnected: undefined, // TODO: Track last connection time
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.values()),
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.messageListeners.clear();
    this.statusListeners.clear();
  }
}

/**
 * Singleton instance
 */
let realtimeServiceInstance: RealtimeService | null = null;

/**
 * Initialize real-time service
 */
export function initRealtimeService(config: RealtimeServiceConfig): RealtimeService {
  realtimeServiceInstance = new RealtimeService(config);
  return realtimeServiceInstance;
}

/**
 * Get real-time service instance
 */
export function getRealtimeService(): RealtimeService {
  if (!realtimeServiceInstance) {
    throw new Error(
      'RealtimeService not initialized. Call initRealtimeService first.'
    );
  }
  return realtimeServiceInstance;
}

/**
 * Default export
 */
export default {
  init: initRealtimeService,
  getInstance: getRealtimeService,
};
