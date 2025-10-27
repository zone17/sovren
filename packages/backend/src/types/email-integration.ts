/**
 * 📧 **EMAIL INTEGRATION TYPE DEFINITIONS** 📧
 *
 * Comprehensive TypeScript definitions for elite email integration system covering:
 * - US-139: Email Notifications with advanced preferences and analytics
 * - US-140: Newsletter Functionality with subscriber management and scheduling
 * - US-141: Email Marketing Integration with campaigns and automation
 * - US-142: Transactional Email Handling with reliability and tracking
 *
 * **Features:**
 * - Advanced email template engine with personalization
 * - Real-time delivery tracking and analytics
 * - GDPR/CAN-SPAM compliance with unsubscribe handling
 * - Segmentation and targeting capabilities
 * - A/B testing and optimization features
 * - Multi-provider failover and load balancing
 * - Advanced spam prevention and reputation management
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-15
 */

import { z } from 'zod';

// ==========================================
// US-139: EMAIL NOTIFICATION SYSTEM
// ==========================================

export const EmailNotificationTypeSchema = z.enum([
  // Platform Notifications
  'welcome',
  'account_verification',
  'password_reset',
  'account_locked',
  'login_alert',
  'profile_updated',

  // Content Notifications
  'content_published',
  'content_liked',
  'content_commented',
  'content_shared',
  'content_featured',
  'content_moderated',

  // Payment Notifications
  'payment_received',
  'payment_failed',
  'payment_processed',
  'payment_refunded',
  'payment_dispute',
  'payout_processed',

  // Subscription Notifications
  'subscription_created',
  'subscription_renewed',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_trial_ending',

  // Social Notifications
  'new_follower',
  'new_subscriber',
  'collaboration_invite',
  'mention_received',
  'message_received',

  // System Notifications
  'maintenance_scheduled',
  'feature_announcement',
  'policy_update',
  'security_alert',
  'milestone_reached',
]);

export const EmailNotificationPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

export const EmailNotificationStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'unsubscribed',
  'failed',
]);

export const NotificationPreferencesSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  enabled: z.boolean().default(true),

  // Channel preferences
  email_enabled: z.boolean().default(true),
  push_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(false),
  in_app_enabled: z.boolean().default(true),

  // Notification type preferences
  content_notifications: z.boolean().default(true),
  payment_notifications: z.boolean().default(true),
  subscription_notifications: z.boolean().default(true),
  social_notifications: z.boolean().default(true),
  system_notifications: z.boolean().default(true),
  marketing_notifications: z.boolean().default(false),

  // Frequency settings
  instant_notifications: z.boolean().default(true),
  daily_digest: z.boolean().default(false),
  weekly_digest: z.boolean().default(false),

  // Quiet hours
  quiet_hours_enabled: z.boolean().default(false),
  quiet_hours_start: z.string().default('22:00'),
  quiet_hours_end: z.string().default('08:00'),
  quiet_hours_timezone: z.string().default('UTC'),

  // Advanced settings
  max_emails_per_day: z.number().default(10),
  batch_notifications: z.boolean().default(true),
  unsubscribe_token: z.string(),

  created_at: z.date(),
  updated_at: z.date(),
});

export const EmailNotificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: EmailNotificationTypeSchema,
  priority: EmailNotificationPrioritySchema,
  status: EmailNotificationStatusSchema,

  // Content
  subject: z.string(),
  template_id: z.string().optional(),
  template_data: z.record(z.any()).default({}),
  html_content: z.string().optional(),
  text_content: z.string().optional(),

  // Delivery details
  email_address: z.string().email(),
  from_email: z.string().email(),
  from_name: z.string(),
  reply_to: z.string().email().optional(),

  // Tracking
  message_id: z.string().optional(),
  provider_id: z.string().optional(),
  sent_at: z.date().optional(),
  delivered_at: z.date().optional(),
  opened_at: z.date().optional(),
  clicked_at: z.date().optional(),
  bounced_at: z.date().optional(),

  // Metadata
  campaign_id: z.string().optional(),
  batch_id: z.string().optional(),
  a_b_test_variant: z.string().optional(),
  metadata: z.record(z.any()).default({}),

  // Retry logic
  retry_count: z.number().default(0),
  max_retries: z.number().default(3),
  next_retry_at: z.date().optional(),

  created_at: z.date(),
  updated_at: z.date(),
});

// ==========================================
// US-140: NEWSLETTER FUNCTIONALITY
// ==========================================

export const NewsletterStatusSchema = z.enum([
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
  'failed',
]);

export const NewsletterFrequencySchema = z.enum([
  'weekly',
  'bi_weekly',
  'monthly',
  'quarterly',
  'on_demand',
]);

export const NewsletterSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  title: z.string(),
  description: z.string().optional(),

  // Content
  subject: z.string(),
  preview_text: z.string().optional(),
  html_content: z.string(),
  text_content: z.string(),
  template_id: z.string().optional(),

  // Scheduling
  status: NewsletterStatusSchema,
  frequency: NewsletterFrequencySchema,
  scheduled_at: z.date().optional(),
  sent_at: z.date().optional(),

  // Targeting
  subscriber_list_ids: z.array(z.string()).default([]),
  segment_ids: z.array(z.string()).default([]),
  exclude_unsubscribed: z.boolean().default(true),

  // A/B Testing
  is_ab_test: z.boolean().default(false),
  ab_test_subject_variants: z.array(z.string()).default([]),
  ab_test_content_variants: z.array(z.string()).default([]),
  ab_test_split_percentage: z.number().min(10).max(50).default(25),
  ab_test_winner_metric: z
    .enum(['open_rate', 'click_rate', 'conversion_rate'])
    .default('open_rate'),

  // Analytics
  total_recipients: z.number().default(0),
  sent_count: z.number().default(0),
  delivered_count: z.number().default(0),
  opened_count: z.number().default(0),
  clicked_count: z.number().default(0),
  unsubscribed_count: z.number().default(0),
  bounced_count: z.number().default(0),

  // Settings
  track_opens: z.boolean().default(true),
  track_clicks: z.boolean().default(true),
  allow_unsubscribe: z.boolean().default(true),
  custom_from_email: z.string().email().optional(),
  custom_from_name: z.string().optional(),

  created_at: z.date(),
  updated_at: z.date(),
});

export const SubscriberSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  email: z.string().email(),

  // Profile
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  location: z.string().optional(),
  timezone: z.string().default('UTC'),

  // Subscription details
  status: z.enum(['active', 'unsubscribed', 'bounced', 'complained']),
  subscribed_at: z.date(),
  unsubscribed_at: z.date().optional(),
  unsubscribe_reason: z.string().optional(),

  // Preferences
  frequency_preference: NewsletterFrequencySchema.optional(),
  content_interests: z.array(z.string()).default([]),

  // Engagement metrics
  total_opens: z.number().default(0),
  total_clicks: z.number().default(0),
  last_opened_at: z.date().optional(),
  last_clicked_at: z.date().optional(),
  engagement_score: z.number().min(0).max(100).default(50),

  // Source tracking
  source: z.enum(['website', 'social_media', 'referral', 'import', 'api', 'manual']),
  referrer_url: z.string().optional(),
  campaign_source: z.string().optional(),

  // Segmentation
  tags: z.array(z.string()).default([]),
  custom_fields: z.record(z.any()).default({}),

  created_at: z.date(),
  updated_at: z.date(),
});

export const SubscriberListSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  name: z.string(),
  description: z.string().optional(),

  // List settings
  is_default: z.boolean().default(false),
  double_opt_in: z.boolean().default(true),
  welcome_email_enabled: z.boolean().default(true),
  welcome_email_template_id: z.string().optional(),

  // Statistics
  subscriber_count: z.number().default(0),
  active_subscriber_count: z.number().default(0),

  created_at: z.date(),
  updated_at: z.date(),
});

// ==========================================
// US-141: EMAIL MARKETING INTEGRATION
// ==========================================

export const EmailCampaignTypeSchema = z.enum([
  'promotional',
  'transactional',
  'newsletter',
  'drip_campaign',
  'triggered',
  'broadcast',
]);

export const EmailCampaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
  'failed',
]);

export const EmailCampaignSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: EmailCampaignTypeSchema,
  status: EmailCampaignStatusSchema,

  // Content
  subject: z.string(),
  preview_text: z.string().optional(),
  html_content: z.string(),
  text_content: z.string(),
  template_id: z.string().optional(),

  // Targeting and Segmentation
  audience_filter: z.object({
    include_lists: z.array(z.string()).default([]),
    exclude_lists: z.array(z.string()).default([]),
    include_segments: z.array(z.string()).default([]),
    exclude_segments: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    custom_filters: z.record(z.any()).default({}),
  }),

  // Scheduling
  send_immediately: z.boolean().default(false),
  scheduled_at: z.date().optional(),
  timezone: z.string().default('UTC'),

  // Automation triggers
  trigger_event: z
    .enum([
      'user_signup',
      'subscription_created',
      'purchase_completed',
      'content_published',
      'engagement_milestone',
      'inactivity_period',
      'custom_event',
    ])
    .optional(),
  trigger_conditions: z.record(z.any()).default({}),

  // A/B Testing
  ab_test_enabled: z.boolean().default(false),
  ab_test_variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        subject: z.string(),
        content: z.string(),
        percentage: z.number().min(1).max(100),
      })
    )
    .default([]),
  ab_test_winner_criteria: z
    .enum(['open_rate', 'click_rate', 'conversion_rate'])
    .default('open_rate'),
  ab_test_duration_hours: z.number().default(24),

  // Performance tracking
  total_recipients: z.number().default(0),
  sent_count: z.number().default(0),
  delivered_count: z.number().default(0),
  opened_count: z.number().default(0),
  clicked_count: z.number().default(0),
  conversion_count: z.number().default(0),
  unsubscribed_count: z.number().default(0),
  bounced_count: z.number().default(0),
  complained_count: z.number().default(0),

  // ROI tracking
  revenue_generated: z.number().default(0),
  cost_per_send: z.number().default(0),
  roi_percentage: z.number().default(0),

  created_at: z.date(),
  updated_at: z.date(),
});

export const EmailSegmentSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  name: z.string(),
  description: z.string().optional(),

  // Segment criteria
  criteria: z.object({
    demographics: z
      .object({
        age_range: z.object({ min: z.number(), max: z.number() }).optional(),
        location: z.array(z.string()).optional(),
        timezone: z.array(z.string()).optional(),
      })
      .optional(),

    behavior: z
      .object({
        engagement_score_range: z.object({ min: z.number(), max: z.number() }).optional(),
        last_opened_days: z.number().optional(),
        total_clicks_range: z.object({ min: z.number(), max: z.number() }).optional(),
        subscription_duration_days: z.number().optional(),
      })
      .optional(),

    preferences: z
      .object({
        content_interests: z.array(z.string()).optional(),
        frequency_preference: z.array(NewsletterFrequencySchema).optional(),
      })
      .optional(),

    custom: z.record(z.any()).default({}),
  }),

  // Statistics
  subscriber_count: z.number().default(0),
  last_calculated_at: z.date().optional(),

  // Settings
  auto_update: z.boolean().default(true),
  update_frequency: z.enum(['real_time', 'hourly', 'daily', 'weekly']).default('daily'),

  created_at: z.date(),
  updated_at: z.date(),
});

export const EmailAutomationSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'draft']),

  // Trigger configuration
  trigger: z.object({
    event: z.enum([
      'user_signup',
      'subscription_created',
      'purchase_completed',
      'content_published',
      'email_opened',
      'link_clicked',
      'tag_added',
      'custom_event',
    ]),
    conditions: z.record(z.any()).default({}),
    delay_minutes: z.number().default(0),
  }),

  // Email sequence
  emails: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
      delay_days: z.number().default(0),
      delay_hours: z.number().default(0),

      subject: z.string(),
      template_id: z.string().optional(),
      html_content: z.string(),
      text_content: z.string(),

      send_conditions: z.record(z.any()).default({}),
    })
  ),

  // Settings
  max_emails_per_user: z.number().default(10),
  stop_on_unsubscribe: z.boolean().default(true),
  respect_quiet_hours: z.boolean().default(true),

  // Analytics
  total_triggered: z.number().default(0),
  total_completed: z.number().default(0),
  average_completion_rate: z.number().default(0),

  created_at: z.date(),
  updated_at: z.date(),
});

// ==========================================
// US-142: TRANSACTIONAL EMAIL HANDLING
// ==========================================

export const TransactionalEmailTypeSchema = z.enum([
  'welcome',
  'email_verification',
  'password_reset',
  'account_locked',
  'login_notification',
  'payment_confirmation',
  'invoice',
  'receipt',
  'shipping_notification',
  'order_update',
  'refund_notification',
  'account_update',
  'security_alert',
  'api_key_created',
  'subscription_confirmation',
  'trial_expiration',
  'payment_failed',
  'account_deletion',
  'data_export_ready',
  'backup_complete',
]);

export const EmailProviderSchema = z.enum([
  'sendgrid',
  'mailgun',
  'ses',
  'postmark',
  'mandrill',
  'smtp',
]);

export const TransactionalEmailSchema = z.object({
  id: z.string(),
  type: TransactionalEmailTypeSchema,
  status: EmailNotificationStatusSchema,
  priority: EmailNotificationPrioritySchema,

  // Recipient details
  to_email: z.string().email(),
  to_name: z.string().optional(),
  from_email: z.string().email(),
  from_name: z.string(),
  reply_to: z.string().email().optional(),

  // Content
  subject: z.string(),
  html_content: z.string(),
  text_content: z.string(),
  template_id: z.string().optional(),
  template_data: z.record(z.any()).default({}),

  // Delivery configuration
  provider: EmailProviderSchema,
  provider_message_id: z.string().optional(),
  webhook_url: z.string().url().optional(),

  // Tracking
  track_opens: z.boolean().default(true),
  track_clicks: z.boolean().default(true),
  track_unsubscribes: z.boolean().default(false), // Generally false for transactional

  // Timing
  send_at: z.date().optional(), // For scheduled sends
  sent_at: z.date().optional(),
  delivered_at: z.date().optional(),
  opened_at: z.date().optional(),
  clicked_at: z.date().optional(),
  bounced_at: z.date().optional(),

  // Retry logic
  retry_count: z.number().default(0),
  max_retries: z.number().default(3),
  retry_delay_minutes: z.number().default(5),
  next_retry_at: z.date().optional(),

  // Error handling
  error_message: z.string().optional(),
  bounce_reason: z.string().optional(),
  complaint_feedback: z.string().optional(),

  // Compliance and security
  requires_encryption: z.boolean().default(false),
  data_retention_days: z.number().default(90),
  compliance_tags: z.array(z.string()).default([]),

  // Metadata
  user_id: z.string().optional(),
  order_id: z.string().optional(),
  transaction_id: z.string().optional(),
  metadata: z.record(z.any()).default({}),

  created_at: z.date(),
  updated_at: z.date(),
});

export const EmailTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum(['notification', 'newsletter', 'marketing', 'transactional']),
  type: z.string(), // Specific type within category

  // Template content
  subject: z.string(),
  html_content: z.string(),
  text_content: z.string(),
  preview_text: z.string().optional(),

  // Personalization
  variables: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'date', 'boolean', 'url']),
        required: z.boolean().default(false),
        default_value: z.any().optional(),
        description: z.string().optional(),
      })
    )
    .default([]),

  // Styling
  css_styles: z.string().optional(),
  theme_id: z.string().optional(),

  // Version control
  version: z.number().default(1),
  is_active: z.boolean().default(true),
  parent_template_id: z.string().optional(), // For versioning

  // Usage tracking
  usage_count: z.number().default(0),
  last_used_at: z.date().optional(),

  // A/B testing
  ab_test_variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        subject: z.string(),
        html_content: z.string(),
        text_content: z.string(),
        traffic_percentage: z.number().min(0).max(100),
      })
    )
    .default([]),

  created_by: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

// ==========================================
// ANALYTICS AND REPORTING
// ==========================================

export const EmailAnalyticsSchema = z.object({
  id: z.string(),
  email_id: z.string(),
  campaign_id: z.string().optional(),
  newsletter_id: z.string().optional(),

  // Basic metrics
  sent_at: z.date(),
  delivered_at: z.date().optional(),
  opened_at: z.date().optional(),
  clicked_at: z.date().optional(),
  unsubscribed_at: z.date().optional(),
  bounced_at: z.date().optional(),
  complained_at: z.date().optional(),

  // Engagement details
  open_count: z.number().default(0),
  click_count: z.number().default(0),
  unique_clicks: z.number().default(0),
  time_to_open_minutes: z.number().optional(),
  time_to_click_minutes: z.number().optional(),

  // Device and location data
  user_agent: z.string().optional(),
  ip_address: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  device_type: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  email_client: z.string().optional(),

  // Link tracking
  clicked_links: z
    .array(
      z.object({
        url: z.string(),
        click_count: z.number(),
        first_clicked_at: z.date(),
        last_clicked_at: z.date(),
      })
    )
    .default([]),

  created_at: z.date(),
  updated_at: z.date(),
});

export const EmailReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['campaign', 'newsletter', 'automation', 'domain']),
  date_range: z.object({
    start_date: z.date(),
    end_date: z.date(),
  }),

  // Metrics
  metrics: z.object({
    total_sent: z.number(),
    total_delivered: z.number(),
    total_opened: z.number(),
    total_clicked: z.number(),
    total_unsubscribed: z.number(),
    total_bounced: z.number(),
    total_complained: z.number(),

    delivery_rate: z.number(),
    open_rate: z.number(),
    click_rate: z.number(),
    unsubscribe_rate: z.number(),
    bounce_rate: z.number(),
    complaint_rate: z.number(),

    revenue_generated: z.number().default(0),
    cost_per_send: z.number().default(0),
    roi_percentage: z.number().default(0),
  }),

  // Filters applied
  filters: z.record(z.any()).default({}),

  // Report settings
  auto_generated: z.boolean().default(false),
  schedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
  recipients: z.array(z.string().email()).default([]),

  created_by: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

// ==========================================
// EXPORTED TYPES
// ==========================================

export type EmailNotificationType = z.infer<typeof EmailNotificationTypeSchema>;
export type EmailNotificationPriority = z.infer<typeof EmailNotificationPrioritySchema>;
export type EmailNotificationStatus = z.infer<typeof EmailNotificationStatusSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type EmailNotification = z.infer<typeof EmailNotificationSchema>;

export type NewsletterStatus = z.infer<typeof NewsletterStatusSchema>;
export type NewsletterFrequency = z.infer<typeof NewsletterFrequencySchema>;
export type Newsletter = z.infer<typeof NewsletterSchema>;
export type Subscriber = z.infer<typeof SubscriberSchema>;
export type SubscriberList = z.infer<typeof SubscriberListSchema>;

export type EmailCampaignType = z.infer<typeof EmailCampaignTypeSchema>;
export type EmailCampaignStatus = z.infer<typeof EmailCampaignStatusSchema>;
export type EmailCampaign = z.infer<typeof EmailCampaignSchema>;
export type EmailSegment = z.infer<typeof EmailSegmentSchema>;
export type EmailAutomation = z.infer<typeof EmailAutomationSchema>;

export type TransactionalEmailType = z.infer<typeof TransactionalEmailTypeSchema>;
export type EmailProvider = z.infer<typeof EmailProviderSchema>;
export type TransactionalEmail = z.infer<typeof TransactionalEmailSchema>;
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

export type EmailAnalytics = z.infer<typeof EmailAnalyticsSchema>;
export type EmailReport = z.infer<typeof EmailReportSchema>;

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

export interface SendNotificationRequest {
  user_id: string;
  type: EmailNotificationType;
  template_data: Record<string, any>;
  priority?: EmailNotificationPriority;
  schedule_at?: Date;
  custom_template?: {
    subject: string;
    html_content: string;
    text_content: string;
  };
}

export interface CreateNewsletterRequest {
  title: string;
  subject: string;
  html_content: string;
  text_content: string;
  subscriber_list_ids: string[];
  scheduled_at?: Date;
  ab_test_enabled?: boolean;
  ab_test_variants?: Array<{
    subject: string;
    content: string;
    percentage: number;
  }>;
}

export interface CreateCampaignRequest {
  name: string;
  type: EmailCampaignType;
  subject: string;
  html_content: string;
  text_content: string;
  audience_filter: {
    include_lists?: string[];
    exclude_lists?: string[];
    include_segments?: string[];
    exclude_segments?: string[];
    tags?: string[];
  };
  scheduled_at?: Date;
  ab_test_enabled?: boolean;
}

export interface SendTransactionalRequest {
  type: TransactionalEmailType;
  to_email: string;
  to_name?: string;
  template_data: Record<string, any>;
  priority?: EmailNotificationPriority;
  custom_template?: {
    subject: string;
    html_content: string;
    text_content: string;
  };
  metadata?: Record<string, any>;
}

export interface EmailAnalyticsResponse {
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
    bounced: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    unsubscribe_rate: number;
    bounce_rate: number;
  };
  time_series: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
  top_links: Array<{
    url: string;
    clicks: number;
    unique_clicks: number;
  }>;
  device_breakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  location_breakdown: Array<{
    country: string;
    opens: number;
    clicks: number;
  }>;
}

// ==========================================
// SERVICE INTERFACES
// ==========================================

export interface EmailServiceInterface {
  // US-139: Email Notifications
  sendNotification(request: SendNotificationRequest): Promise<EmailNotification>;
  updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences>;
  getNotificationHistory(userId: string, filters?: any): Promise<EmailNotification[]>;
  unsubscribeFromNotifications(token: string): Promise<boolean>;

  // US-140: Newsletter Functionality
  createNewsletter(creatorId: string, request: CreateNewsletterRequest): Promise<Newsletter>;
  scheduleNewsletter(newsletterId: string, scheduledAt: Date): Promise<Newsletter>;
  sendNewsletter(newsletterId: string): Promise<Newsletter>;
  getNewsletterAnalytics(newsletterId: string): Promise<EmailAnalyticsResponse>;

  // US-141: Email Marketing Integration
  createCampaign(creatorId: string, request: CreateCampaignRequest): Promise<EmailCampaign>;
  createEmailSegment(
    creatorId: string,
    segment: Omit<EmailSegment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmailSegment>;
  createAutomation(
    creatorId: string,
    automation: Omit<EmailAutomation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmailAutomation>;

  // US-142: Transactional Email Handling
  sendTransactionalEmail(request: SendTransactionalRequest): Promise<TransactionalEmail>;
  retryFailedEmail(emailId: string): Promise<TransactionalEmail>;
  getDeliveryStatus(emailId: string): Promise<EmailNotificationStatus>;

  // Analytics and Reporting
  getEmailAnalytics(filters: any): Promise<EmailAnalyticsResponse>;
  generateReport(reportConfig: any): Promise<EmailReport>;
}
