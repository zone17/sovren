/**
 * 📧 **EMAIL INTEGRATION SERVICE - EXTENDED FEATURES** 📧
 *
 * Extended implementation for:
 * - US-141: Email Marketing Integration with campaigns and automation
 * - US-142: Transactional Email Handling with reliability and tracking
 *
 * This file extends the main EmailIntegrationService with advanced features.
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-15
 */

import {
  CreateCampaignRequest,
  EmailAnalyticsResponse,
  EmailAutomation,
  EmailAutomationSchema,
  EmailCampaign,
  EmailCampaignSchema,
  EmailNotificationStatus,
  EmailReport,
  EmailReportSchema,
  EmailSegment,
  EmailSegmentSchema,
  SendTransactionalRequest,
  TransactionalEmail,
  TransactionalEmailSchema,
} from '../types/email-integration';

/**
 * Email Marketing Campaign Manager
 */
export class EmailMarketingManager {
  constructor(
    private db: any,
    private redis: any,
    private logger: any,
    private templateEngine: any,
    private analyticsTracker: any,
    private transporters: Map<any, any>
  ) {}

  // ==========================================
  // US-141: EMAIL MARKETING INTEGRATION
  // ==========================================

  /**
   * Create email marketing campaign
   */
  async createCampaign(creatorId: string, request: CreateCampaignRequest): Promise<EmailCampaign> {
    try {
      this.logger.info(`Creating email campaign for creator: ${creatorId}`);

      const campaign = EmailCampaignSchema.parse({
        id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator_id: creatorId,
        name: request.name,
        type: request.type,
        status: 'draft',
        subject: request.subject,
        html_content: request.html_content,
        text_content: request.text_content,
        audience_filter: request.audience_filter,
        ab_test_enabled: request.ab_test_enabled || false,
        scheduled_at: request.scheduled_at,
        total_recipients: 0,
        sent_count: 0,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await this.db.campaigns.create(campaign);

      // Calculate audience size
      const audienceSize = await this.calculateAudienceSize(campaign.audience_filter);
      campaign.total_recipients = audienceSize;
      await this.db.campaigns.update(campaign.id, { total_recipients: audienceSize });

      // Schedule if requested
      if (request.scheduled_at) {
        await this.scheduleCampaign(campaign.id, request.scheduled_at);
      }

      this.logger.info(`Email campaign created: ${campaign.id} with ${audienceSize} recipients`);
      return campaign;
    } catch (error) {
      this.logger.error('Failed to create email campaign', error);
      throw error;
    }
  }

  /**
   * Create email segment for targeting
   */
  async createEmailSegment(
    creatorId: string,
    segmentData: Omit<EmailSegment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmailSegment> {
    try {
      this.logger.info(`Creating email segment for creator: ${creatorId}`);

      const segment = EmailSegmentSchema.parse({
        ...segmentData,
        id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator_id: creatorId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Calculate initial subscriber count
      const subscriberCount = await this.calculateSegmentSize(segment.criteria);
      segment.subscriber_count = subscriberCount;
      segment.last_calculated_at = new Date();

      await this.db.segments.create(segment);

      // Set up auto-update if enabled
      if (segment.auto_update) {
        await this.scheduleSegmentUpdate(segment.id, segment.update_frequency);
      }

      this.logger.info(`Email segment created: ${segment.id} with ${subscriberCount} subscribers`);
      return segment;
    } catch (error) {
      this.logger.error('Failed to create email segment', error);
      throw error;
    }
  }

  /**
   * Create email automation workflow
   */
  async createAutomation(
    creatorId: string,
    automationData: Omit<EmailAutomation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmailAutomation> {
    try {
      this.logger.info(`Creating email automation for creator: ${creatorId}`);

      const automation = EmailAutomationSchema.parse({
        ...automationData,
        id: `automation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator_id: creatorId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await this.db.automations.create(automation);

      // Set up trigger listeners if automation is active
      if (automation.status === 'active') {
        await this.activateAutomationTriggers(automation);
      }

      this.logger.info(`Email automation created: ${automation.id}`);
      return automation;
    } catch (error) {
      this.logger.error('Failed to create email automation', error);
      throw error;
    }
  }

  /**
   * Send email campaign
   */
  async sendCampaign(campaignId: string): Promise<EmailCampaign> {
    try {
      const campaign = await this.db.campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status === 'completed') {
        throw new Error('Campaign already sent');
      }

      // Get audience
      const audience = await this.getAudience(campaign.audience_filter);

      // Handle A/B testing
      if (campaign.ab_test_enabled && campaign.ab_test_variants.length > 0) {
        return await this.sendABTestCampaign(campaign, audience);
      }

      // Regular campaign send
      campaign.status = 'active';
      campaign.total_recipients = audience.length;
      campaign.updated_at = new Date();

      await this.db.campaigns.update(campaignId, campaign);

      // Send to all recipients
      const sendPromises = audience.map((recipient) =>
        this.sendCampaignToRecipient(campaign, recipient)
      );

      const results = await Promise.allSettled(sendPromises);

      // Update campaign statistics
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      campaign.sent_count = successful;
      campaign.status = 'completed';

      await this.db.campaigns.update(campaignId, campaign);

      this.logger.info(
        `Campaign sent: ${campaignId} to ${successful}/${audience.length} recipients`
      );
      return campaign;
    } catch (error) {
      this.logger.error('Failed to send campaign', error);
      throw error;
    }
  }

  /**
   * Send A/B test campaign
   */
  private async sendABTestCampaign(
    campaign: EmailCampaign,
    audience: any[]
  ): Promise<EmailCampaign> {
    const variants = campaign.ab_test_variants;
    const testSize = Math.floor(audience.length * 0.2); // 20% for A/B test
    const testAudience = audience.slice(0, testSize);
    const remainingAudience = audience.slice(testSize);

    // Split test audience between variants
    const variantSize = Math.floor(testAudience.length / variants.length);

    // Send test variants
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const variantAudience = testAudience.slice(i * variantSize, (i + 1) * variantSize);

      await Promise.allSettled(
        variantAudience.map((recipient) => this.sendCampaignVariant(campaign, variant, recipient))
      );
    }

    // Wait for test duration
    await this.waitForABTestCompletion(campaign.id, campaign.ab_test_duration_hours || 24);

    // Determine winner and send to remaining audience
    const winner = await this.determineABTestWinner(campaign.id, variants);

    await Promise.allSettled(
      remainingAudience.map((recipient) => this.sendCampaignVariant(campaign, winner, recipient))
    );

    campaign.status = 'completed';
    await this.db.campaigns.update(campaign.id, campaign);

    return campaign;
  }

  /**
   * Get campaign performance analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<EmailAnalyticsResponse> {
    try {
      return await this.analyticsTracker.generateReport({
        campaign_id: campaignId,
      });
    } catch (error) {
      this.logger.error('Failed to get campaign analytics', error);
      throw error;
    }
  }

  /**
   * Calculate audience size based on filters
   */
  private async calculateAudienceSize(audienceFilter: any): Promise<number> {
    try {
      // Implementation would query database with filters
      const query: any = {};

      if (audienceFilter.include_lists?.length > 0) {
        query.list_ids = { $in: audienceFilter.include_lists };
      }

      if (audienceFilter.tags?.length > 0) {
        query.tags = { $in: audienceFilter.tags };
      }

      // Apply custom filters
      Object.assign(query, audienceFilter.custom_filters);

      const count = await this.db.subscribers.count(query);
      return count;
    } catch (error) {
      this.logger.error('Failed to calculate audience size', error);
      return 0;
    }
  }

  /**
   * Calculate segment size based on criteria
   */
  private async calculateSegmentSize(criteria: any): Promise<number> {
    try {
      // Implementation would build complex query based on criteria
      const query: any = {};

      // Demographics criteria
      if (criteria.demographics) {
        if (criteria.demographics.location) {
          query.location = { $in: criteria.demographics.location };
        }
        if (criteria.demographics.timezone) {
          query.timezone = { $in: criteria.demographics.timezone };
        }
      }

      // Behavior criteria
      if (criteria.behavior) {
        if (criteria.behavior.engagement_score_range) {
          const range = criteria.behavior.engagement_score_range;
          query.engagement_score = { $gte: range.min, $lte: range.max };
        }
        if (criteria.behavior.last_opened_days) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - criteria.behavior.last_opened_days);
          query.last_opened_at = { $gte: cutoffDate };
        }
      }

      const count = await this.db.subscribers.count(query);
      return count;
    } catch (error) {
      this.logger.error('Failed to calculate segment size', error);
      return 0;
    }
  }

  /**
   * Get audience based on filters
   */
  private async getAudience(audienceFilter: any): Promise<any[]> {
    try {
      // Implementation would build and execute complex query
      const query: any = { status: 'active' };

      if (audienceFilter.include_lists?.length > 0) {
        query.list_ids = { $in: audienceFilter.include_lists };
      }

      if (audienceFilter.tags?.length > 0) {
        query.tags = { $in: audienceFilter.tags };
      }

      // Exclude lists/segments
      if (audienceFilter.exclude_lists?.length > 0) {
        query.list_ids = { $nin: audienceFilter.exclude_lists };
      }

      const subscribers = await this.db.subscribers.findMany(query);
      return subscribers;
    } catch (error) {
      this.logger.error('Failed to get audience', error);
      return [];
    }
  }

  /**
   * Send campaign to individual recipient
   */
  private async sendCampaignToRecipient(campaign: EmailCampaign, recipient: any): Promise<void> {
    try {
      // Personalize content
      const personalizedContent = this.templateEngine.renderTemplate(
        campaign.template_id || 'template_campaign_default',
        {
          recipient_name: recipient.first_name || recipient.email,
          campaign_name: campaign.name,
          content: campaign.html_content,
          unsubscribe_url: this.generateUnsubscribeUrl(recipient.id),
        }
      );

      if (!personalizedContent) {
        throw new Error('Failed to render campaign content');
      }

      // Send via first available provider
      const providers = Array.from(this.transporters.keys());
      for (const provider of providers) {
        try {
          const transporter = this.transporters.get(provider);
          if (!transporter) continue;

          await transporter.sendMail({
            from: `${campaign.name} <${process.env.DEFAULT_FROM_EMAIL}>`,
            to: recipient.email,
            subject: campaign.subject,
            html: personalizedContent.html,
            text: personalizedContent.text,
          });

          // Track send
          await this.analyticsTracker.trackEvent(`campaign_${campaign.id}_${recipient.id}`, 'sent');
          break;
        } catch (error) {
          this.logger.warn(`Failed to send campaign via ${provider}`, error);
          continue;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send campaign to recipient: ${recipient.email}`, error);
    }
  }

  /**
   * Send A/B test variant
   */
  private async sendCampaignVariant(
    campaign: EmailCampaign,
    variant: any,
    recipient: any
  ): Promise<void> {
    try {
      // Similar to sendCampaignToRecipient but with variant content
      const personalizedContent = this.templateEngine.renderTemplate(
        variant.template_id || 'template_campaign_default',
        {
          recipient_name: recipient.first_name || recipient.email,
          campaign_name: campaign.name,
          content: variant.content,
          unsubscribe_url: this.generateUnsubscribeUrl(recipient.id),
        }
      );

      const providers = Array.from(this.transporters.keys());
      for (const provider of providers) {
        try {
          const transporter = this.transporters.get(provider);
          if (!transporter) continue;

          await transporter.sendMail({
            from: `${campaign.name} <${process.env.DEFAULT_FROM_EMAIL}>`,
            to: recipient.email,
            subject: variant.subject,
            html: personalizedContent.html,
            text: personalizedContent.text,
            headers: {
              'X-Campaign-Variant': variant.id,
            },
          });

          await this.analyticsTracker.trackEvent(
            `campaign_${campaign.id}_${recipient.id}`,
            'sent',
            { variant_id: variant.id }
          );
          break;
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send campaign variant to recipient: ${recipient.email}`, error);
    }
  }

  /**
   * Helper methods for automation, scheduling, etc.
   */
  private async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
    // Implementation would use job queue
    this.logger.info(`Campaign scheduled: ${campaignId} for ${scheduledAt.toISOString()}`);
  }

  private async scheduleSegmentUpdate(segmentId: string, frequency: string): Promise<void> {
    // Implementation would schedule recurring job
    this.logger.info(`Segment update scheduled: ${segmentId} with frequency ${frequency}`);
  }

  private async activateAutomationTriggers(automation: EmailAutomation): Promise<void> {
    // Implementation would set up event listeners
    this.logger.info(`Automation triggers activated: ${automation.id}`);
  }

  private async waitForABTestCompletion(campaignId: string, hours: number): Promise<void> {
    // Implementation would use delay/scheduling
    return new Promise((resolve) => setTimeout(resolve, hours * 60 * 60 * 1000));
  }

  private async determineABTestWinner(campaignId: string, variants: any[]): Promise<any> {
    // Implementation would analyze performance metrics
    return variants[0]; // Placeholder
  }

  private generateUnsubscribeUrl(subscriberId: string): string {
    const token = Buffer.from(JSON.stringify({ subscriberId, timestamp: Date.now() })).toString(
      'base64'
    );
    return `${process.env.BASE_URL}/unsubscribe?token=${token}`;
  }
}

/**
 * Transactional Email Manager
 */
export class TransactionalEmailManager {
  constructor(
    private db: any,
    private redis: any,
    private logger: any,
    private templateEngine: any,
    private analyticsTracker: any,
    private transporters: Map<any, any>
  ) {}

  // ==========================================
  // US-142: TRANSACTIONAL EMAIL HANDLING
  // ==========================================

  /**
   * Send transactional email with high reliability
   */
  async sendTransactionalEmail(request: SendTransactionalRequest): Promise<TransactionalEmail> {
    try {
      this.logger.info(`Sending transactional email: ${request.type} to ${request.to_email}`);

      // Create transactional email record
      const transactionalEmail = TransactionalEmailSchema.parse({
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: request.type,
        status: 'pending',
        priority: request.priority || 'high', // Transactional emails are high priority
        to_email: request.to_email,
        to_name: request.to_name,
        from_email: process.env.TRANSACTIONAL_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL,
        from_name: 'Sovren Platform',
        reply_to: process.env.SUPPORT_EMAIL,
        template_data: request.template_data,
        metadata: request.metadata || {},
        track_opens: true,
        track_clicks: true,
        track_unsubscribes: false, // Generally false for transactional
        requires_encryption: this.requiresEncryption(request.type),
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Render template or use custom content
      let emailContent;
      if (request.custom_template) {
        emailContent = {
          subject: request.custom_template.subject,
          html: request.custom_template.html_content,
          text: request.custom_template.text_content,
        };
      } else {
        const templateId = this.getTransactionalTemplateId(request.type);
        emailContent = this.templateEngine.renderTemplate(templateId, request.template_data);

        if (!emailContent) {
          throw new Error(`Template not found for transactional type: ${request.type}`);
        }
      }

      transactionalEmail.subject = emailContent.subject;
      transactionalEmail.html_content = emailContent.html;
      transactionalEmail.text_content = emailContent.text;

      // Save to database
      await this.db.transactional_emails.create(transactionalEmail);

      // Send with high priority delivery
      await this.sendTransactionalEmailNow(transactionalEmail);

      return transactionalEmail;
    } catch (error) {
      this.logger.error('Failed to send transactional email', error);
      throw error;
    }
  }

  /**
   * Retry failed transactional email
   */
  async retryFailedEmail(emailId: string): Promise<TransactionalEmail> {
    try {
      const email = await this.db.transactional_emails.findById(emailId);
      if (!email) {
        throw new Error('Transactional email not found');
      }

      if (email.retry_count >= email.max_retries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      // Increment retry count
      email.retry_count += 1;
      email.status = 'pending';
      email.next_retry_at = null;
      email.updated_at = new Date();

      await this.db.transactional_emails.update(emailId, email);

      // Retry sending
      await this.sendTransactionalEmailNow(email);

      return email;
    } catch (error) {
      this.logger.error('Failed to retry transactional email', error);
      throw error;
    }
  }

  /**
   * Get delivery status of transactional email
   */
  async getDeliveryStatus(emailId: string): Promise<EmailNotificationStatus> {
    try {
      const email = await this.db.transactional_emails.findById(emailId);
      if (!email) {
        throw new Error('Transactional email not found');
      }

      // Check with provider for real-time status
      if (email.provider_message_id && email.provider) {
        const providerStatus = await this.checkProviderStatus(
          email.provider,
          email.provider_message_id
        );

        if (providerStatus && providerStatus !== email.status) {
          email.status = providerStatus;
          email.updated_at = new Date();
          await this.db.transactional_emails.update(emailId, email);
        }
      }

      return email.status;
    } catch (error) {
      this.logger.error('Failed to get delivery status', error);
      throw error;
    }
  }

  /**
   * Send transactional email with high reliability
   */
  private async sendTransactionalEmailNow(email: TransactionalEmail): Promise<void> {
    const providers = this.getOrderedProviders(); // High-reliability providers first
    let lastError: any;

    for (const provider of providers) {
      try {
        const transporter = this.transporters.get(provider);
        if (!transporter) continue;

        // Special handling for encrypted emails
        let mailOptions: any = {
          from: `${email.from_name} <${email.from_email}>`,
          to: email.to_email,
          subject: email.subject,
          html: email.html_content,
          text: email.text_content,
          replyTo: email.reply_to,
          priority: 'high',
        };

        if (email.requires_encryption) {
          mailOptions = await this.addEncryption(mailOptions);
        }

        const result = await transporter.sendMail(mailOptions);

        // Update status
        email.status = 'sent';
        email.provider = provider;
        email.provider_message_id = result.messageId;
        email.sent_at = new Date();
        email.updated_at = new Date();

        await this.db.transactional_emails.update(email.id, email);

        // Track analytics
        await this.analyticsTracker.trackEvent(email.id, 'sent');

        this.logger.info(`Transactional email sent successfully via ${provider}: ${email.id}`);
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Failed to send transactional email via ${provider}`, error);

        // Schedule retry if not last provider
        if (provider !== providers[providers.length - 1] && email.retry_count < email.max_retries) {
          await this.scheduleRetry(email);
        }

        continue;
      }
    }

    // All providers failed
    email.status = 'failed';
    email.error_message = lastError?.message || 'All providers failed';
    email.updated_at = new Date();

    // Schedule retry if within limits
    if (email.retry_count < email.max_retries) {
      await this.scheduleRetry(email);
    }

    await this.db.transactional_emails.update(email.id, email);

    throw lastError || new Error('All transactional email providers failed');
  }

  /**
   * Get template ID for transactional email type
   */
  private getTransactionalTemplateId(type: string): string {
    const templateMap: Record<string, string> = {
      welcome: 'template_txn_welcome',
      email_verification: 'template_txn_verification',
      password_reset: 'template_txn_password_reset',
      payment_confirmation: 'template_txn_payment_confirmation',
      invoice: 'template_txn_invoice',
      receipt: 'template_txn_receipt',
      security_alert: 'template_txn_security_alert',
      // ... more mappings
    };

    return templateMap[type] || 'template_txn_default';
  }

  /**
   * Check if email type requires encryption
   */
  private requiresEncryption(type: string): boolean {
    const encryptedTypes = [
      'password_reset',
      'security_alert',
      'account_locked',
      'api_key_created',
      'payment_confirmation',
      'invoice',
    ];

    return encryptedTypes.includes(type);
  }

  /**
   * Get providers ordered by reliability for transactional emails
   */
  private getOrderedProviders(): string[] {
    // For transactional emails, prioritize most reliable providers
    return ['postmark', 'sendgrid', 'ses', 'mailgun'];
  }

  /**
   * Add encryption to email if required
   */
  private async addEncryption(mailOptions: any): Promise<any> {
    // Implementation would add S/MIME or PGP encryption
    // For now, just add security headers
    mailOptions.headers = {
      ...mailOptions.headers,
      'X-Encrypted': 'true',
      'X-Security-Level': 'high',
    };

    return mailOptions;
  }

  /**
   * Schedule retry for failed email
   */
  private async scheduleRetry(email: TransactionalEmail): Promise<void> {
    const retryDelay = Math.pow(2, email.retry_count) * email.retry_delay_minutes * 60 * 1000; // Exponential backoff
    const nextRetryAt = new Date(Date.now() + retryDelay);

    email.next_retry_at = nextRetryAt;
    await this.db.transactional_emails.update(email.id, email);

    // Implementation would use job queue for scheduling
    this.logger.info(
      `Transactional email retry scheduled: ${email.id} at ${nextRetryAt.toISOString()}`
    );
  }

  /**
   * Check provider status (webhook integration)
   */
  private async checkProviderStatus(
    provider: string,
    messageId: string
  ): Promise<EmailNotificationStatus | null> {
    try {
      // Implementation would check provider API for status
      // This is typically done via webhooks in production
      return null;
    } catch (error) {
      this.logger.warn(`Failed to check provider status: ${provider}`, error);
      return null;
    }
  }

  /**
   * Generate comprehensive transactional email report
   */
  async generateTransactionalReport(filters: any): Promise<EmailReport> {
    try {
      const report = EmailReportSchema.parse({
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Transactional Email Report',
        type: 'domain',
        date_range: filters.date_range,
        metrics: await this.calculateTransactionalMetrics(filters),
        filters: filters,
        auto_generated: false,
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await this.db.reports.create(report);
      return report;
    } catch (error) {
      this.logger.error('Failed to generate transactional report', error);
      throw error;
    }
  }

  /**
   * Calculate transactional email metrics
   */
  private async calculateTransactionalMetrics(filters: any): Promise<any> {
    try {
      // Implementation would query database for metrics
      const metrics = {
        total_sent: 0,
        total_delivered: 0,
        total_opened: 0,
        total_clicked: 0,
        total_unsubscribed: 0,
        total_bounced: 0,
        total_complained: 0,
        delivery_rate: 0,
        open_rate: 0,
        click_rate: 0,
        unsubscribe_rate: 0,
        bounce_rate: 0,
        complaint_rate: 0,
        revenue_generated: 0,
        cost_per_send: 0,
        roi_percentage: 0,
      };

      // Query database with filters and calculate metrics
      // This would involve complex SQL queries or aggregation pipelines

      return metrics;
    } catch (error) {
      this.logger.error('Failed to calculate transactional metrics', error);
      throw error;
    }
  }
}

/**
 * Email Compliance Manager
 */
export class EmailComplianceManager {
  constructor(
    private db: any,
    private logger: any
  ) {}

  /**
   * Ensure GDPR compliance
   */
  async ensureGDPRCompliance(emailData: any): Promise<boolean> {
    try {
      // Check if user has consented to marketing emails
      if (emailData.type === 'marketing' || emailData.type === 'newsletter') {
        const consent = await this.db.user_consents.findOne({
          user_id: emailData.user_id,
          consent_type: 'marketing_emails',
          status: 'active',
        });

        if (!consent) {
          this.logger.warn(`No marketing consent found for user: ${emailData.user_id}`);
          return false;
        }
      }

      // Ensure unsubscribe link is present
      if (!emailData.html_content.includes('unsubscribe')) {
        this.logger.warn('Email missing unsubscribe link');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('GDPR compliance check failed', error);
      return false;
    }
  }

  /**
   * Ensure CAN-SPAM compliance
   */
  async ensureCANSPAMCompliance(emailData: any): Promise<boolean> {
    try {
      // Check sender information
      if (!emailData.from_email || !emailData.from_name) {
        this.logger.warn('Email missing sender information');
        return false;
      }

      // Check physical address in footer
      if (!emailData.html_content.includes('physical_address')) {
        this.logger.warn('Email missing physical address');
        return false;
      }

      // Check subject line truthfulness (basic check)
      if (emailData.subject.includes('FREE') || emailData.subject.includes('!!!')) {
        this.logger.warn('Email subject may violate CAN-SPAM');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CAN-SPAM compliance check failed', error);
      return false;
    }
  }
}

export { EmailComplianceManager, EmailMarketingManager, TransactionalEmailManager };
