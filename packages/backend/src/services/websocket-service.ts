import logger from '../lib/logger';

/**
 * WebSocket Service - Stub for real-time communication
 *
 * Logs WebSocket events via structured logger. Replace with a real
 * WebSocket implementation (ws, Socket.io) when needed.
 */
export class WebSocketService {
  broadcast(event: string, data: Record<string, unknown> = {}): void {
    logger.info('WebSocket broadcast', { event, ...data });
  }

  sendToUser(userId: string, event: string, data: Record<string, unknown> = {}): void {
    logger.info('WebSocket message', { userId, event, ...data });
  }
}
