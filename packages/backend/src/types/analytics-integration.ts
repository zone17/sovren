import { z } from 'zod';

// ==========================================
// Web Analytics Integration Types (US-143)
// ==========================================

export const AnalyticsEventSchema = z.object({
  id: z.string(),
  event_name: z.string(),
  event_category: z.string(),
  event_action: z.string(),
  event_label: z.string().optional(),
  event_value: z.number().optional(),
  user_id: z.string().optional(),
  session_id: z.string(),
  timestamp: z.date(),
  page_url: z.string(),
  referrer: z.string().optional(),
  user_agent: z.string(),
  ip_address: z.string(),
  geolocation: z
    .object({
      country: z.string(),
      region: z.string(),
      city: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  custom_properties: z.record(z.any()).optional(),
});

export const UserBehaviorSchema = z.object({
  user_id: z.string(),
  session_id: z.string(),
  page_views: z.array(
    z.object({
      page_url: z.string(),
      timestamp: z.date(),
      time_on_page: z.number(),
      scroll_depth: z.number(),
      bounce: z.boolean(),
    })
  ),
  interactions: z.array(
    z.object({
      type: z.enum(['click', 'scroll', 'form_submit', 'download', 'video_play']),
      element: z.string(),
      timestamp: z.date(),
      value: z.string().optional(),
    })
  ),
  conversion_events: z.array(
    z.object({
      funnel_step: z.string(),
      timestamp: z.date(),
      value: z.number().optional(),
    })
  ),
});

export const ConversionFunnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(
    z.object({
      step_name: z.string(),
      step_order: z.number(),
      event_criteria: z.record(z.any()),
      goal_url: z.string().optional(),
    })
  ),
  conversion_rate: z.number(),
  drop_off_points: z.array(
    z.object({
      step_name: z.string(),
      drop_off_rate: z.number(),
      users_dropped: z.number(),
    })
  ),
  created_at: z.date(),
  updated_at: z.date(),
});

export const AnalyticsDashboardConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  user_id: z.string(),
  widgets: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['chart', 'metric', 'table', 'funnel', 'heatmap']),
      title: z.string(),
      data_source: z.string(),
      configuration: z.record(z.any()),
      position: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })
  ),
  filters: z.record(z.any()).optional(),
  date_range: z.object({
    start_date: z.date(),
    end_date: z.date(),
  }),
  auto_refresh: z.boolean(),
  refresh_interval: z.number(),
});

// ==========================================
// Business Intelligence Types (US-144)
// ==========================================

export const DataWarehouseConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['postgresql', 'mysql', 'snowflake', 'bigquery', 'redshift']),
  connection_string: z.string(),
  credentials: z.object({
    username: z.string(),
    password: z.string(),
    database: z.string(),
    host: z.string(),
    port: z.number(),
  }),
  is_active: z.boolean(),
  last_sync: z.date().optional(),
  sync_frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  created_at: z.date(),
});

export const AutomatedReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  query: z.string(),
  parameters: z.record(z.any()).optional(),
  schedule: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
    time: z.string(),
    timezone: z.string(),
    day_of_week: z.number().optional(),
    day_of_month: z.number().optional(),
  }),
  recipients: z.array(z.string()),
  format: z.enum(['pdf', 'csv', 'excel', 'json']),
  last_run: z.date().optional(),
  next_run: z.date(),
  is_active: z.boolean(),
  created_by: z.string(),
  created_at: z.date(),
});

export const PredictiveAnalyticsModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['revenue_forecast', 'churn_prediction', 'user_growth', 'content_performance']),
  algorithm: z.enum(['linear_regression', 'random_forest', 'neural_network', 'time_series']),
  training_data: z.object({
    source_table: z.string(),
    feature_columns: z.array(z.string()),
    target_column: z.string(),
    training_period: z.object({
      start_date: z.date(),
      end_date: z.date(),
    }),
  }),
  model_metrics: z.object({
    accuracy: z.number(),
    precision: z.number(),
    recall: z.number(),
    f1_score: z.number(),
    mae: z.number().optional(),
    rmse: z.number().optional(),
  }),
  last_trained: z.date(),
  is_active: z.boolean(),
  predictions: z.array(
    z.object({
      date: z.date(),
      predicted_value: z.number(),
      confidence_interval: z.object({
        lower: z.number(),
        upper: z.number(),
      }),
    })
  ),
});

export const DataVisualizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['line_chart', 'bar_chart', 'pie_chart', 'scatter_plot', 'heatmap', 'gauge']),
  data_source: z.string(),
  query: z.string(),
  configuration: z.object({
    x_axis: z.string(),
    y_axis: z.string().optional(),
    color_scheme: z.string(),
    legend_position: z.enum(['top', 'bottom', 'left', 'right', 'none']),
    grid_lines: z.boolean(),
    animations: z.boolean(),
  }),
  filters: z.record(z.any()).optional(),
  created_by: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

// ==========================================
// Performance Monitoring Types (US-145)
// ==========================================

export const PerformanceMetricSchema = z.object({
  id: z.string(),
  metric_name: z.string(),
  metric_type: z.enum([
    'response_time',
    'throughput',
    'error_rate',
    'cpu_usage',
    'memory_usage',
    'disk_io',
  ]),
  value: z.number(),
  unit: z.string(),
  timestamp: z.date(),
  service_name: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  tags: z.record(z.string()).optional(),
});

export const PerformanceAlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric_name: z.string(),
  condition: z.enum(['greater_than', 'less_than', 'equals', 'not_equals']),
  threshold: z.number(),
  duration: z.number(), // in minutes
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  notification_channels: z.array(z.string()),
  is_active: z.boolean(),
  created_by: z.string(),
  created_at: z.date(),
});

export const PerformanceBaselineSchema = z.object({
  id: z.string(),
  service_name: z.string(),
  metric_name: z.string(),
  baseline_value: z.number(),
  acceptable_deviation: z.number(),
  calculation_period: z.object({
    start_date: z.date(),
    end_date: z.date(),
  }),
  confidence_level: z.number(),
  last_updated: z.date(),
  is_active: z.boolean(),
});

export const APMIntegrationSchema = z.object({
  id: z.string(),
  provider: z.enum(['datadog', 'new_relic', 'prometheus', 'grafana', 'custom']),
  configuration: z.object({
    api_key: z.string(),
    endpoint_url: z.string(),
    organization_id: z.string().optional(),
    project_id: z.string().optional(),
    custom_headers: z.record(z.string()).optional(),
  }),
  metrics_mapping: z.record(z.string()),
  sync_frequency: z.enum(['real_time', 'every_minute', 'every_5_minutes', 'hourly']),
  is_active: z.boolean(),
  last_sync: z.date().optional(),
  created_at: z.date(),
});

// ==========================================
// Error Tracking Types (US-146)
// ==========================================

export const ErrorEventSchema = z.object({
  id: z.string(),
  error_id: z.string(), // Groups similar errors
  title: z.string(),
  message: z.string(),
  stack_trace: z.string().optional(),
  error_type: z.enum(['javascript', 'server', 'database', 'api', 'network']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['unresolved', 'resolved', 'ignored']),
  first_seen: z.date(),
  last_seen: z.date(),
  occurrence_count: z.number(),
  affected_users: z.number(),
  environment: z.enum(['development', 'staging', 'production']),
  release_version: z.string().optional(),
  user_context: z
    .object({
      user_id: z.string().optional(),
      email: z.string().optional(),
      ip_address: z.string(),
      user_agent: z.string(),
    })
    .optional(),
  request_context: z
    .object({
      url: z.string(),
      method: z.string(),
      headers: z.record(z.string()),
      query_params: z.record(z.any()).optional(),
      body: z.any().optional(),
    })
    .optional(),
  system_context: z
    .object({
      os: z.string(),
      runtime: z.string(),
      memory_usage: z.number(),
      cpu_usage: z.number(),
    })
    .optional(),
  tags: z.record(z.string()).optional(),
});

export const ErrorCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pattern: z.string(), // Regex pattern for auto-categorization
  priority: z.number(),
  auto_assign: z.boolean(),
  notification_rules: z.object({
    slack_channel: z.string().optional(),
    email_recipients: z.array(z.string()),
    escalation_minutes: z.number(),
  }),
  created_at: z.date(),
  updated_at: z.date(),
});

export const ErrorResolutionWorkflowSchema = z.object({
  id: z.string(),
  error_id: z.string(),
  steps: z.array(
    z.object({
      step_name: z.string(),
      step_order: z.number(),
      description: z.string(),
      automated: z.boolean(),
      script: z.string().optional(),
      assigned_to: z.string().optional(),
      completed: z.boolean(),
      completed_at: z.date().optional(),
    })
  ),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  assigned_to: z.string(),
  created_by: z.string(),
  created_at: z.date(),
  completed_at: z.date().optional(),
});

export const ErrorAnalyticsSchema = z.object({
  time_period: z.object({
    start_date: z.date(),
    end_date: z.date(),
  }),
  total_errors: z.number(),
  new_errors: z.number(),
  resolved_errors: z.number(),
  error_rate: z.number(),
  mean_time_to_resolution: z.number(),
  top_errors: z.array(
    z.object({
      error_id: z.string(),
      title: z.string(),
      occurrence_count: z.number(),
      affected_users: z.number(),
    })
  ),
  error_trends: z.array(
    z.object({
      date: z.date(),
      error_count: z.number(),
      new_errors: z.number(),
    })
  ),
  resolution_metrics: z.object({
    average_resolution_time: z.number(),
    resolution_rate: z.number(),
    escalation_rate: z.number(),
  }),
});

// ==========================================
// Export Types
// ==========================================

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type UserBehavior = z.infer<typeof UserBehaviorSchema>;
export type ConversionFunnel = z.infer<typeof ConversionFunnelSchema>;
export type AnalyticsDashboardConfig = z.infer<typeof AnalyticsDashboardConfigSchema>;

export type DataWarehouseConnection = z.infer<typeof DataWarehouseConnectionSchema>;
export type AutomatedReport = z.infer<typeof AutomatedReportSchema>;
export type PredictiveAnalyticsModel = z.infer<typeof PredictiveAnalyticsModelSchema>;
export type DataVisualization = z.infer<typeof DataVisualizationSchema>;

export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;
export type PerformanceAlertRule = z.infer<typeof PerformanceAlertRuleSchema>;
export type PerformanceBaseline = z.infer<typeof PerformanceBaselineSchema>;
export type APMIntegration = z.infer<typeof APMIntegrationSchema>;

export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;
export type ErrorResolutionWorkflow = z.infer<typeof ErrorResolutionWorkflowSchema>;
export type ErrorAnalytics = z.infer<typeof ErrorAnalyticsSchema>;

// ==========================================
// Request/Response Types
// ==========================================

export interface TrackEventRequest {
  event_name: string;
  event_category: string;
  event_action: string;
  event_label?: string;
  event_value?: number;
  custom_properties?: Record<string, any>;
}

export interface CreateFunnelRequest {
  name: string;
  steps: Array<{
    step_name: string;
    step_order: number;
    event_criteria: Record<string, any>;
    goal_url?: string;
  }>;
}

export interface CreateReportRequest {
  name: string;
  description: string;
  query: string;
  parameters?: Record<string, any>;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;
    timezone: string;
    day_of_week?: number;
    day_of_month?: number;
  };
  recipients: string[];
  format: 'pdf' | 'csv' | 'excel' | 'json';
}

export interface CreateVisualizationRequest {
  name: string;
  type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'scatter_plot' | 'heatmap' | 'gauge';
  data_source: string;
  query: string;
  configuration: {
    x_axis: string;
    y_axis?: string;
    color_scheme: string;
    legend_position: 'top' | 'bottom' | 'left' | 'right' | 'none';
    grid_lines: boolean;
    animations: boolean;
  };
  filters?: Record<string, any>;
}

export interface CreateAlertRuleRequest {
  name: string;
  metric_name: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notification_channels: string[];
}

export interface ReportErrorRequest {
  title: string;
  message: string;
  stack_trace?: string;
  error_type: 'javascript' | 'server' | 'database' | 'api' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_context?: {
    user_id?: string;
    email?: string;
  };
  request_context?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    query_params?: Record<string, any>;
    body?: any;
  };
  system_context?: {
    os: string;
    runtime: string;
    memory_usage: number;
    cpu_usage: number;
  };
  tags?: Record<string, string>;
}

export interface AnalyticsExportRequest {
  data_type: 'events' | 'users' | 'funnels' | 'reports';
  format: 'csv' | 'json' | 'xlsx';
  filters: Record<string, any>;
  date_range: {
    start_date: Date;
    end_date: Date;
  };
  include_metadata: boolean;
}
