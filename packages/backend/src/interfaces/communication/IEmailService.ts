export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  replyTo?: string;
  [key: string]: any;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  [key: string]: any;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  [key: string]: any;
}

export interface BulkEmailResult {
  sent: number;
  failed: number;
  results: EmailResult[];
}

export interface EmailTemplate {
  id: string;
  subject: string;
  body: string;
  [key: string]: any;
}

export interface EmailEvent {
  type: string;
  messageId: string;
  [key: string]: any;
}

export interface EmailStatsFilter {
  startDate?: Date;
  endDate?: Date;
  [key: string]: any;
}

export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  [key: string]: any;
}

export interface IEmailService {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
  sendBulkEmails(recipients: EmailRecipient[]): Promise<BulkEmailResult>;
  validateEmail(email: string): boolean;
  getEmailTemplate(templateId: string): Promise<EmailTemplate | null>;
  trackEmailEvent(event: EmailEvent): Promise<void>;
  getEmailStats(filter: EmailStatsFilter): Promise<EmailStats>;
}
