/**
 * 🏗️ **SHARED EDGE FUNCTION TYPES**
 *
 * Elite TypeScript type definitions for Supabase Edge Functions
 *
 * **Implementation for US-210: Supabase Edge Functions**
 *
 * Features:
 * - US-210.1: Type-safe Edge Function development ✅
 * - US-210.2: Shared interfaces and types ✅
 * - US-210.3: Authentication types ✅
 * - US-210.4: Content processing types ✅
 * - US-210.5: Notification types ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

// 🔧 Base Edge Function Types
export interface EdgeFunctionRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface EdgeFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  executionTime?: number;
}

export interface EdgeFunctionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  origin?: string;
  timestamp: string;
}

// 🔐 Authentication Types
export interface NOSTRChallenge {
  challenge: string;
  expires_at: string;
  public_key?: string;
  created_at?: string;
}

export interface NOSTRAuthRequest {
  publicKey: string;
  signature: string;
  challenge: string;
  event: NOSTREvent;
}

export interface NOSTREvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface JWTPayload {
  sub: string; // User ID
  iat: number; // Issued at
  exp: number; // Expires at
  aud: string; // Audience
  iss: string; // Issuer
  jti?: string; // JWT ID
  role?: string; // User role
  session_id?: string; // Session ID
  email?: string; // User email
  nostr_pubkey?: string; // NOSTR public key
}

export interface AuthSession {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  last_activity_at: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
}

export interface MFARequest {
  method: 'totp' | 'sms' | 'email';
  code: string;
  session_id: string;
}

// 📝 Content Processing Types
export interface ContentValidationRequest {
  content: string;
  content_type: 'text' | 'html' | 'markdown' | 'json';
  user_id: string;
  validation_rules?: ContentValidationRules;
}

export interface ContentValidationRules {
  max_length?: number;
  min_length?: number;
  allowed_tags?: string[];
  blocked_words?: string[];
  require_moderation?: boolean;
  content_rating?: 'general' | 'mature' | 'explicit';
}

export interface ContentValidationResult {
  is_valid: boolean;
  sanitized_content?: string;
  violations: ContentViolation[];
  confidence_score: number;
  requires_moderation: boolean;
  content_rating: string;
}

export interface ContentViolation {
  type: 'profanity' | 'spam' | 'harmful' | 'inappropriate' | 'length' | 'format';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: {
    start: number;
    end: number;
  };
  suggested_fix?: string;
}

export interface ContentTransformRequest {
  content: string;
  source_format: 'markdown' | 'html' | 'text' | 'json';
  target_format: 'html' | 'text' | 'markdown' | 'json';
  options?: ContentTransformOptions;
}

export interface ContentTransformOptions {
  preserve_formatting?: boolean;
  strip_styles?: boolean;
  optimize_images?: boolean;
  add_syntax_highlighting?: boolean;
  minify?: boolean;
  add_meta_tags?: boolean;
}

export interface ContentAnalytics {
  content_id: string;
  user_id: string;
  word_count: number;
  reading_time: number;
  sentiment_score: number;
  topics: string[];
  engagement_prediction: number;
  seo_score: number;
  readability_score: number;
}

// 📢 Notification Types
export interface NotificationRequest {
  type: 'email' | 'push' | 'sms' | 'in_app';
  recipients: NotificationRecipient[];
  template_id?: string;
  subject?: string;
  content: string;
  data?: Record<string, any>;
  schedule_at?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expires_at?: string;
}

export interface NotificationRecipient {
  user_id: string;
  email?: string;
  phone?: string;
  push_token?: string;
  preferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  quiet_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'push' | 'sms' | 'in_app';
  subject_template?: string;
  content_template: string;
  variables: TemplateVariable[];
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'url';
  required: boolean;
  default_value?: any;
  description?: string;
}

export interface NotificationResult {
  id: string;
  status: 'sent' | 'failed' | 'pending' | 'scheduled';
  recipient_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  sent_at?: string;
  error_message?: string;
}

// 📊 Monitoring and Analytics Types
export interface EdgeFunctionMetrics {
  function_name: string;
  execution_count: number;
  average_duration: number;
  success_rate: number;
  error_rate: number;
  last_execution: string;
  memory_usage: number;
  cpu_usage: number;
}

export interface ErrorLog {
  id: string;
  function_name: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  request_context: EdgeFunctionContext;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  overall_score: number;
  last_check: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

// 🔄 Utility Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface DatabaseConnection {
  url: string;
  key: string;
  schema?: string;
  max_connections?: number;
  timeout?: number;
}

export interface CacheOptions {
  ttl?: number;
  key_prefix?: string;
  serialize?: boolean;
  compress?: boolean;
}

// 🎯 Function-Specific Response Types
export type AuthFunctionResponse = EdgeFunctionResponse<{
  access_token?: string;
  refresh_token?: string;
  user?: any;
  session?: AuthSession;
  challenge?: NOSTRChallenge;
}>;

export type ContentFunctionResponse = EdgeFunctionResponse<{
  validation_result?: ContentValidationResult;
  transformed_content?: string;
  analytics?: ContentAnalytics;
}>;

export type NotificationFunctionResponse = EdgeFunctionResponse<{
  notification_id?: string;
  result?: NotificationResult;
  template?: NotificationTemplate;
}>;

export type MonitoringFunctionResponse = EdgeFunctionResponse<{
  metrics?: EdgeFunctionMetrics;
  health?: HealthCheckResult;
  logs?: ErrorLog[];
}>;
