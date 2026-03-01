export interface Notification {
  id?: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  [key: string]: any;
}

export interface BulkNotificationResult {
  sent: number;
  failed: number;
  results: NotificationResult[];
}

export interface NotificationChannel {
  type: string;
  enabled: boolean;
  [key: string]: any;
}

export interface NotificationPreferences {
  channels?: NotificationChannel[];
  [key: string]: any;
}

export interface INotificationService {
  sendNotification(notification: Notification): Promise<NotificationResult>;
  sendBulkNotifications(notifications: Notification[]): Promise<BulkNotificationResult>;
  getNotificationChannels(userId: string): Promise<NotificationChannel[]>;
  updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}
