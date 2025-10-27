/**
 * 🌐 NOSTR Relay Mock Server for E2E Tests
 * Simulates NOSTR relay behavior for testing
 */
import { Event as NostrEvent, validateEvent, verifyEvent } from 'nostr-tools';
import { WebSocket, WebSocketServer } from 'ws';

export interface RelayMockConfig {
  port: number;
  acceptAllEvents?: boolean;
  responseDelay?: number;
  failureRate?: number;
  supportedNIPs?: number[];
}

export class NostrRelayMock {
  private server: WebSocketServer | null = null;
  private config: RelayMockConfig;
  private events: Map<string, NostrEvent> = new Map();
  private subscriptions: Map<string, any> = new Map();
  private connections: Set<WebSocket> = new Set();

  constructor(config: RelayMockConfig) {
    this.config = {
      acceptAllEvents: true,
      responseDelay: 0,
      failureRate: 0,
      supportedNIPs: [1, 2, 4],
      ...config,
    };
  }

  /**
   * Start the mock relay server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({ port: this.config.port });

        this.server.on('listening', () => {
          console.log(`🌐 [RelayMock] Server started on port ${this.config.port}`);
          resolve();
        });

        this.server.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        this.server.on('error', (error) => {
          console.error('❌ [RelayMock] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the mock relay server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.connections.forEach((ws) => {
        ws.close();
      });
      this.connections.clear();

      this.server.close(() => {
        console.log('🛑 [RelayMock] Server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.connections.add(ws);
    console.log(`🔌 [RelayMock] New connection (total: ${this.connections.size})`);

    ws.on('message', async (data: Buffer) => {
      await this.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      this.connections.delete(ws);
      console.log(`🔌 [RelayMock] Connection closed (total: ${this.connections.size})`);
    });

    ws.on('error', (error) => {
      console.error('❌ [RelayMock] WebSocket error:', error);
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private async handleMessage(ws: WebSocket, message: string): Promise<void> {
    try {
      const msg = JSON.parse(message);
      const [type, ...args] = msg;

      // Simulate network delay if configured
      if (this.config.responseDelay && this.config.responseDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.responseDelay));
      }

      // Simulate random failures if configured
      if (Math.random() < (this.config.failureRate || 0)) {
        this.sendNotice(ws, 'error: simulated failure');
        return;
      }

      switch (type) {
        case 'EVENT':
          await this.handleEventMessage(ws, args[0]);
          break;
        case 'REQ':
          await this.handleReqMessage(ws, args[0], args.slice(1));
          break;
        case 'CLOSE':
          this.handleCloseMessage(ws, args[0]);
          break;
        default:
          this.sendNotice(ws, `error: unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('❌ [RelayMock] Failed to handle message:', error);
      this.sendNotice(ws, 'error: invalid message format');
    }
  }

  /**
   * Handle EVENT message (client publishing an event)
   */
  private async handleEventMessage(ws: WebSocket, event: NostrEvent): Promise<void> {
    try {
      // Validate event structure
      if (!event || !event.id || !event.pubkey || !event.sig) {
        this.sendOk(ws, event?.id || 'unknown', false, 'invalid: missing required fields');
        return;
      }

      // Verify event signature
      const isValid = verifyEvent(event);
      if (!isValid) {
        this.sendOk(ws, event.id, false, 'invalid: signature verification failed');
        return;
      }

      // Store the event
      this.events.set(event.id, event);

      // Send OK response
      this.sendOk(ws, event.id, true, '');

      // Notify subscribers
      this.notifySubscribers(event);

      console.log(`📝 [RelayMock] Stored event ${event.id} (total: ${this.events.size})`);
    } catch (error) {
      console.error('❌ [RelayMock] Failed to handle EVENT:', error);
      this.sendOk(ws, event?.id || 'unknown', false, 'error: internal server error');
    }
  }

  /**
   * Handle REQ message (client subscribing to events)
   */
  private async handleReqMessage(ws: WebSocket, subId: string, filters: any[]): Promise<void> {
    try {
      // Store subscription
      this.subscriptions.set(subId, { ws, filters });

      // Find matching events
      const matchingEvents = Array.from(this.events.values()).filter((event) =>
        this.eventMatchesFilters(event, filters)
      );

      // Send matching events
      for (const event of matchingEvents) {
        this.sendEvent(ws, subId, event);
      }

      // Send EOSE (end of stored events)
      this.sendEose(ws, subId);

      console.log(
        `📡 [RelayMock] Subscription ${subId} created (${matchingEvents.length} events sent)`
      );
    } catch (error) {
      console.error('❌ [RelayMock] Failed to handle REQ:', error);
      this.sendNotice(ws, 'error: subscription failed');
    }
  }

  /**
   * Handle CLOSE message (client closing subscription)
   */
  private handleCloseMessage(ws: WebSocket, subId: string): void {
    this.subscriptions.delete(subId);
    console.log(`📡 [RelayMock] Subscription ${subId} closed`);
  }

  /**
   * Check if event matches subscription filters
   */
  private eventMatchesFilters(event: NostrEvent, filters: any[]): boolean {
    return filters.some((filter) => {
      // Check IDs
      if (filter.ids && !filter.ids.includes(event.id)) return false;

      // Check authors
      if (filter.authors && !filter.authors.includes(event.pubkey)) return false;

      // Check kinds
      if (filter.kinds && !filter.kinds.includes(event.kind)) return false;

      // Check since
      if (filter.since && event.created_at < filter.since) return false;

      // Check until
      if (filter.until && event.created_at > filter.until) return false;

      // Check tags
      if (filter['#e'] || filter['#p'] || filter['#t']) {
        const tagMatches = Object.entries(filter).some(([key, values]) => {
          if (!key.startsWith('#')) return true;
          const tagName = key.substring(1);
          return event.tags.some(
            (tag) => tag[0] === tagName && (values as string[]).includes(tag[1])
          );
        });
        if (!tagMatches) return false;
      }

      return true;
    });
  }

  /**
   * Notify subscribers of new event
   */
  private notifySubscribers(event: NostrEvent): void {
    this.subscriptions.forEach((sub, subId) => {
      if (this.eventMatchesFilters(event, sub.filters)) {
        this.sendEvent(sub.ws, subId, event);
      }
    });
  }

  /**
   * Send OK message to client
   */
  private sendOk(ws: WebSocket, eventId: string, accepted: boolean, message: string): void {
    this.send(ws, ['OK', eventId, accepted, message]);
  }

  /**
   * Send EVENT message to client
   */
  private sendEvent(ws: WebSocket, subId: string, event: NostrEvent): void {
    this.send(ws, ['EVENT', subId, event]);
  }

  /**
   * Send EOSE message to client
   */
  private sendEose(ws: WebSocket, subId: string): void {
    this.send(ws, ['EOSE', subId]);
  }

  /**
   * Send NOTICE message to client
   */
  private sendNotice(ws: WebSocket, message: string): void {
    this.send(ws, ['NOTICE', message]);
  }

  /**
   * Send raw message to client
   */
  private send(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      connections: this.connections.size,
      events: this.events.size,
      subscriptions: this.subscriptions.size,
    };
  }

  /**
   * Clear all stored events
   */
  clearEvents(): void {
    this.events.clear();
    console.log('🧹 [RelayMock] All events cleared');
  }

  /**
   * Get all stored events
   */
  getAllEvents(): NostrEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): NostrEvent | undefined {
    return this.events.get(eventId);
  }
}
