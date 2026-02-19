// EPIC-009B Inbox Types — extended types for new inbox features

export type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative';
export type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

export interface InboxFilters {
  platform: string;
  sentiment: SentimentFilter;
  priority: PriorityFilter;
  status: string;
  page: number;
  limit: number;
}

// #287: Field names aligned with SQL schema (template_text, not content)
export interface ReplyTemplate {
  id: string;
  name: string;
  template_text: string;
  created_at: string;
}

export interface CreateTemplatePayload {
  name: string;
  template_text: string;
}

export interface UpdateTemplatePayload {
  name?: string;
  template_text?: string;
}

export interface BYOKSubmitPayload {
  api_key: string;
  api_secret: string;
  access_token: string;
  access_token_secret: string;
}

export interface BYOKValidationResult {
  valid: boolean;
  username?: string;
  error?: string;
  write_only?: boolean;
}

export type BYOKStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'write_only';
