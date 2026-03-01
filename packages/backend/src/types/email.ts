export interface EmailMessage {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  [key: string]: any;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  html?: string;
  variables?: string[];
  [key: string]: any;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  [key: string]: any;
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'bounced' | 'failed';
  timestamp: Date;
  [key: string]: any;
}

export interface EmailBounce {
  messageId: string;
  email: string;
  type: 'hard' | 'soft';
  reason: string;
  [key: string]: any;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  [key: string]: any;
}

export interface EmailConfiguration {
  provider: string;
  apiKey?: string;
  fromEmail: string;
  fromName?: string;
  [key: string]: any;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  [key: string]: any;
}

export interface BulkEmailRequest {
  recipients: string[];
  subject: string;
  body: string;
  html?: string;
  [key: string]: any;
}

export interface BulkEmailResult {
  sent: number;
  failed: number;
  results: EmailSendResult[];
}
