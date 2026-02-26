import logger from '../lib/logger';

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Notification Service - Stub for user notifications
 *
 * Logs notification events via structured logger. Replace with a real
 * notification provider (email, push, in-app) when needed.
 */
export class NotificationService {
  async sendNotification(payload: NotificationPayload): Promise<void> {
    logger.info('Notification sent', {
      userId: payload.user_id,
      type: payload.type,
      title: payload.title,
    });
  }
}
