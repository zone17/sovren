export interface Notification {
  id?: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  read?: boolean;
  createdAt?: Date;
  [key: string]: any;
}

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationChannel {
  type: string;
  enabled: boolean;
  config?: Record<string, any>;
  [key: string]: any;
}

export interface NotificationPreferences {
  channels?: NotificationChannel[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  [key: string]: any;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  title: string;
  body: string;
  variables?: string[];
  [key: string]: any;
}

export interface NotificationDeliveryStatus {
  notificationId: string;
  channel: string;
  status: 'sent' | 'delivered' | 'failed';
  timestamp: Date;
  [key: string]: any;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  deliveryStatus?: NotificationDeliveryStatus[];
  [key: string]: any;
}

export interface NotificationMetrics {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  [key: string]: any;
}

export interface BulkNotificationRequest {
  userIds: string[];
  notification: Omit<Notification, 'userId'>;
  [key: string]: any;
}

export interface BulkNotificationResult {
  sent: number;
  failed: number;
  results: NotificationResult[];
}

export interface NotificationHistory {
  notifications: Notification[];
  total: number;
  hasMore: boolean;
}
