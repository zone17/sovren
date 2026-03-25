import logger from '../lib/logger';
import { supabase } from '../config/supabase';

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// Notification types permitted by the notifications table CHECK constraint.
const VALID_NOTIFICATION_TYPES = new Set([
  'new_comment',
  'new_follower',
  'payment_received',
  'mentorship_request',
  'mentorship_accepted',
  'mentorship_declined',
  'circle_join',
  'circle_post',
]);

/**
 * Notification Service — writes in-app notifications to the `notifications` table.
 *
 * Types not in the CHECK constraint are logged but not persisted (graceful
 * degradation — unknown types don't crash callers).
 *
 * TODO: add email/push delivery layer once a provider is selected.
 */
export class NotificationService {
  async sendNotification(payload: NotificationPayload): Promise<void> {
    logger.info('Sending notification', {
      userId: payload.user_id,
      type: payload.type,
      title: payload.title,
    });

    if (!VALID_NOTIFICATION_TYPES.has(payload.type)) {
      // Unknown type — skip DB write to avoid CHECK constraint violation.
      logger.warn('Unknown notification type, skipping DB write', { type: payload.type });
      return;
    }

    const { error } = await supabase.from('notifications').insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      body: payload.message,
      data: payload.data ?? {},
    });

    if (error) {
      logger.error('Failed to persist notification', {
        userId: payload.user_id,
        type: payload.type,
        error: error.message,
      });
    }
  }
}
