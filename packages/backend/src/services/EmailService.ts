// @ts-nocheck
/**
 * EmailService Implementation
 * User Story: US-E5-007
 * Handles email sending with retry logic, templates, and async processing
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { IEmailService } from '../interfaces/communication/IEmailService';
import type { IEventBus } from '../interfaces/shared/IEventBus';
import type { ILogger } from '../interfaces/shared/ILogger';
import type { ICacheService } from '../interfaces/shared/ICacheService';
import type { IAuditLogService } from '../interfaces/shared/IAuditLogService';
import type {
  EmailMessage,
  EmailTemplate,
  EmailAttachment,
  EmailDeliveryStatus,
  EmailBounce,
  EmailMetrics,
  EmailConfiguration,
  EmailSendResult,
  BulkEmailRequest,
  BulkEmailResult,
} from '../types/email';

import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';

/**
 * Email queue item
 */
interface EmailQueueItem {
  id: string;
  message: EmailMessage;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  nextRetryAt?: Date;
  error?: string;
}

/**
 * Concrete implementation of EmailService
 */
export class EmailService implements IEmailService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache?: ICacheService;
  private readonly auditLog?: IAuditLogService;
  private readonly config: EmailConfiguration;
  private readonly templates: Map<string, handlebars.TemplateDelegate> = new Map();
  private readonly queue: EmailQueueItem[] = [];
  private readonly metrics: EmailMetrics;
  private transporter: nodemailer.Transporter;
  private isProcessing = false;
  private processInterval?: NodeJS.Timeout;

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    config: EmailConfiguration,
    cache?: ICacheService,
    auditLog?: IAuditLogService
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.auditLog = auditLog;
    this.config = config;

    // Initialize metrics
    this.metrics = {
      sent: 0,
      failed: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      avgDeliveryTime: 0,
      queueSize: 0,
    };

    // Initialize transporter
    this.transporter = this.createTransporter();

    // Start queue processor
    this.startQueueProcessor();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      // Validate message
      this.validateMessage(message);

      // Add to audit log
      await this.auditLog?.log({
        action: 'email.send',
        details: {
          to: message.to,
          subject: message.subject,
          provider: this.config.provider,
        },
      });

      // Check rate limits
      if (await this.isRateLimited(message.to)) {
        throw new Error('Rate limit exceeded for recipient');
      }

      // Process template if specified
      let htmlContent = message.html;
      let textContent = message.text;

      if (message.template) {
        const rendered = await this.renderTemplate(message.template);
        htmlContent = rendered.html;
        textContent = rendered.text;
      }

      // Prepare mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: message.from || this.config.defaultFrom,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        text: textContent,
        html: htmlContent,
        attachments: await this.prepareAttachments(message.attachments),
        headers: message.headers,
        priority: message.priority || 'normal',
        replyTo: message.replyTo,
      };

      // Send email
      const startTime = Date.now();
      const info = await this.transporter.sendMail(mailOptions);
      const deliveryTime = Date.now() - startTime;

      // Update metrics
      this.metrics.sent++;
      this.metrics.avgDeliveryTime =
        (this.metrics.avgDeliveryTime * (this.metrics.sent - 1) + deliveryTime) / this.metrics.sent;

      // Emit success event
      await this.eventBus.emit('email.sent', {
        messageId: info.messageId,
        to: message.to,
        subject: message.subject,
        deliveryTime,
      });

      // Cache result for deduplication
      if (this.cache) {
        await this.cache.set(
          `email:sent:${this.getMessageHash(message)}`,
          { messageId: info.messageId, sentAt: new Date() },
          3600 // 1 hour TTL
        );
      }

      return {
        success: true,
        messageId: info.messageId,
        acceptedRecipients: info.accepted || [],
        rejectedRecipients: info.rejected || [],
        envelope: info.envelope,
        response: info.response,
      };
    } catch (error) {
      this.metrics.failed++;

      // Log error
      this.logger.error('Failed to send email', {
        error: error.message,
        to: message.to,
        subject: message.subject,
      });

      // Emit failure event
      await this.eventBus.emit('email.failed', {
        to: message.to,
        subject: message.subject,
        error: error.message,
      });

      // Add to retry queue if retriable
      if (this.isRetriableError(error) && (!message.maxRetries || message.maxRetries > 0)) {
        await this.addToQueue(message);

        return {
          success: false,
          error: error.message,
          queued: true,
          queueId: this.getMessageHash(message),
        };
      }

      return {
        success: false,
        error: error.message,
        queued: false,
      };
    }
  }

  async sendWithRetry(message: EmailMessage, maxRetries: number = 3): Promise<EmailSendResult> {
    message.maxRetries = maxRetries;
    return this.send(message);
  }

  async sendBulk(request: BulkEmailRequest): Promise<BulkEmailResult> {
    const results: EmailSendResult[] = [];
    const batchSize = request.batchSize || 10;
    const delayBetweenBatches = request.delayMs || 1000;

    // Process in batches
    for (let i = 0; i < request.messages.length; i += batchSize) {
      const batch = request.messages.slice(i, i + batchSize);

      // Send batch in parallel
      const batchResults = await Promise.allSettled(batch.map((message) => this.send(message)));

      // Collect results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      // Delay between batches
      if (i + batchSize < request.messages.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Calculate summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const queued = results.filter((r) => r.queued).length;

    return {
      totalSent: successful,
      totalFailed: failed,
      totalQueued: queued,
      results,
      duration: Date.now() - Date.now(), // This would track actual duration
    };
  }

  async sendTemplate(
    templateName: string,
    to: string | string[],
    data: Record<string, any>,
    options?: Partial<EmailMessage>
  ): Promise<EmailSendResult> {
    const template: EmailTemplate = {
      name: templateName,
      subject: options?.subject || `Email from ${this.config.defaultFrom}`,
      data,
    };

    const message: EmailMessage = {
      ...options,
      to,
      template,
    };

    return this.send(message);
  }

  async loadTemplate(name: string, content: string, isFilePath: boolean = false): Promise<void> {
    try {
      let templateContent = content;

      if (isFilePath) {
        templateContent = await fs.readFile(content, 'utf-8');
      }

      const compiled = handlebars.compile(templateContent);
      this.templates.set(name, compiled);

      this.logger.info(`Email template loaded: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to load email template: ${name}`, error);
      throw error;
    }
  }

  async getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<EmailDeliveryStatus>(`email:status:${messageId}`);
      if (cached) return cached;
    }

    // In production, this would query the email provider's API
    // For now, return mock status
    return {
      messageId,
      status: 'delivered',
      timestamp: new Date(),
      events: [
        {
          type: 'sent',
          timestamp: new Date(),
          details: {},
        },
      ],
    };
  }

  async processBounce(bounce: EmailBounce): Promise<void> {
    this.metrics.bounced++;

    // Log bounce
    this.logger.warn('Email bounce received', bounce);

    // Emit bounce event
    await this.eventBus.emit('email.bounced', bounce);

    // Update recipient status in cache
    if (this.cache) {
      await this.cache.set(
        `email:bounce:${bounce.recipient}`,
        bounce,
        86400 // 24 hours
      );
    }

    // Add to audit log
    await this.auditLog?.log({
      action: 'email.bounce',
      details: bounce,
    });
  }

  async getMetrics(): Promise<EmailMetrics> {
    return {
      ...this.metrics,
      queueSize: this.queue.length,
    };
  }

  async retryFailed(): Promise<void> {
    const failedItems = this.queue.filter((item) => item.retries > 0);

    for (const item of failedItems) {
      // Reset retry count
      item.retries = 0;
      item.nextRetryAt = new Date();
    }

    // Process immediately
    await this.processQueue();
  }

  async clearQueue(): Promise<void> {
    const queueSize = this.queue.length;
    this.queue.length = 0;

    this.logger.info(`Email queue cleared: ${queueSize} items removed`);
  }

  async updateConfiguration(config: Partial<EmailConfiguration>): Promise<void> {
    Object.assign(this.config, config);

    // Recreate transporter if provider changed
    if (config.provider || config.providerConfig) {
      this.transporter = this.createTransporter();
    }

    this.logger.info('Email configuration updated', config);
  }

  async dispose(): Promise<void> {
    // Stop queue processor
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    // Close transporter
    this.transporter.close();

    // Clear queue
    await this.clearQueue();

    this.logger.info('EmailService disposed');
  }

  // Private helper methods

  private createTransporter(): nodemailer.Transporter {
    switch (this.config.provider) {
      case 'smtp':
        return nodemailer.createTransporter({
          host: this.config.providerConfig.host,
          port: this.config.providerConfig.port,
          secure: this.config.providerConfig.secure,
          auth: {
            user: this.config.providerConfig.auth?.user,
            pass: this.config.providerConfig.auth?.pass,
          },
        });

      case 'sendgrid':
      case 'mailgun':
      case 'ses':
        // These would use provider-specific configurations
        return nodemailer.createTransporter({
          jsonTransport: true, // Mock for now
        });

      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }
  }

  private validateMessage(message: EmailMessage): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('Email recipient is required');
    }

    if (!message.subject && !message.template) {
      throw new Error('Email subject is required');
    }

    if (!message.text && !message.html && !message.template) {
      throw new Error('Email content is required');
    }
  }

  private async renderTemplate(template: EmailTemplate): Promise<{ html: string; text: string }> {
    const compiled = this.templates.get(template.name);

    if (!compiled) {
      throw new Error(`Template not found: ${template.name}`);
    }

    const html = compiled(template.data);
    const text = html.replace(/<[^>]*>/g, ''); // Strip HTML tags for text version

    return { html, text };
  }

  private async prepareAttachments(
    attachments?: EmailAttachment[]
  ): Promise<nodemailer.Attachment[]> {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    return attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
      encoding: att.encoding || 'base64',
      cid: att.cid,
    }));
  }

  private getMessageHash(message: EmailMessage): string {
    const data = JSON.stringify({
      to: message.to,
      subject: message.subject,
      content: message.text || message.html || message.template?.name,
    });

    return createHash('md5').update(data).digest('hex');
  }

  private async isRateLimited(recipient: string | string[]): Promise<boolean> {
    if (!this.config.rateLimits?.enabled || !this.cache) {
      return false;
    }

    const recipients = Array.isArray(recipient) ? recipient : [recipient];

    for (const email of recipients) {
      const key = `email:ratelimit:${email}`;
      const count = (await this.cache.get<number>(key)) || 0;

      if (count >= this.config.rateLimits.perHour) {
        return true;
      }

      await this.cache.set(key, count + 1, 3600);
    }

    return false;
  }

  private isRetriableError(error: any): boolean {
    const retriableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];

    return (
      retriableErrors.includes(error.code) ||
      error.message?.includes('rate limit') ||
      error.message?.includes('temporary')
    );
  }

  private async addToQueue(message: EmailMessage): Promise<void> {
    const item: EmailQueueItem = {
      id: this.getMessageHash(message),
      message,
      retries: 0,
      maxRetries: message.maxRetries || 3,
      createdAt: new Date(),
      nextRetryAt: new Date(Date.now() + 60000), // 1 minute initial delay
    };

    this.queue.push(item);

    this.logger.info(`Email added to retry queue: ${item.id}`);
  }

  private startQueueProcessor(): void {
    this.processInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue().catch((error) => {
          this.logger.error('Queue processing error', error);
        });
      }
    }, 10000); // Process every 10 seconds
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();
      const readyItems = this.queue.filter(
        (item) => !item.nextRetryAt || item.nextRetryAt.getTime() <= now
      );

      for (const item of readyItems) {
        try {
          const result = await this.send(item.message);

          if (result.success) {
            // Remove from queue
            const index = this.queue.indexOf(item);
            if (index > -1) {
              this.queue.splice(index, 1);
            }
          }
        } catch (error) {
          item.retries++;
          item.error = error.message;

          if (item.retries >= item.maxRetries) {
            // Max retries reached, remove from queue
            const index = this.queue.indexOf(item);
            if (index > -1) {
              this.queue.splice(index, 1);
            }

            // Emit permanent failure
            await this.eventBus.emit('email.permanentFailure', {
              message: item.message,
              error: item.error,
              retries: item.retries,
            });
          } else {
            // Calculate next retry with exponential backoff
            const delay = Math.min(60000 * Math.pow(2, item.retries), 3600000); // Max 1 hour
            item.nextRetryAt = new Date(Date.now() + delay);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
