import nodemailer from 'nodemailer';
import { config } from '../config/environment';

// 📧 EMAIL TYPES AND INTERFACES
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailOptions {
  to: string | string[];
  subject?: string;
  template?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// 🎨 EMAIL TEMPLATES
const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to Sovren! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to Sovren!</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333;">Hello {{name}}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for joining Sovren. We're excited to have you on board!
          </p>
          <p style="color: #666; line-height: 1.6;">
            Your account has been successfully created. You can now start exploring our platform and all its features.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{loginUrl}}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Get Started
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            If you have any questions, feel free to contact our support team.
          </p>
        </div>
      </div>
    `,
    text: `Welcome to Sovren!\n\nHello {{name}}!\n\nThank you for joining Sovren. We're excited to have you on board!\n\nYour account has been successfully created. You can now start exploring our platform.\n\nGet started: {{loginUrl}}\n\nIf you have any questions, feel free to contact our support team.`
  },

  paymentConfirmation: {
    subject: 'Payment Confirmation - Thank You! 💳',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #28a745; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Confirmed!</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333;">Thank you for your purchase, {{name}}!</h2>
          <p style="color: #666; line-height: 1.6;">
            We've successfully processed your payment. Here are the details:
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Payment ID:</td>
                <td style="padding: 8px 0; font-weight: bold;">{{paymentId}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Amount:</td>
                <td style="padding: 8px 0; font-weight: bold;">{{amount}} {{currency}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0; font-weight: bold;">{{date}}</td>
              </tr>
            </table>
          </div>
          <p style="color: #666; line-height: 1.6;">
            You'll receive your purchase confirmation shortly. If you have any questions, please contact our support team.
          </p>
        </div>
      </div>
    `,
    text: `Payment Confirmed!\n\nThank you for your purchase, {{name}}!\n\nWe've successfully processed your payment.\n\nPayment ID: {{paymentId}}\nAmount: {{amount}} {{currency}}\nDate: {{date}}\n\nYou'll receive your purchase confirmation shortly.`
  },

  paymentFailed: {
    subject: 'Payment Issue - Action Required ⚠️',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc3545; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Issue</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333;">Hi {{name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            We encountered an issue processing your payment. Please review the details below:
          </p>
          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;">
              <strong>Reason:</strong> {{failureReason}}
            </p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            You can try again with a different payment method or contact your bank for assistance.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{retryUrl}}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Try Again
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Payment Issue\n\nHi {{name}},\n\nWe encountered an issue processing your payment.\n\nReason: {{failureReason}}\n\nYou can try again with a different payment method or contact your bank for assistance.\n\nTry again: {{retryUrl}}`
  },

  passwordReset: {
    subject: 'Password Reset Request 🔑',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6c757d; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333;">Hi {{name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetUrl}}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
          </p>
          <p style="color: #999; font-size: 12px;">
            Link: {{resetUrl}}
          </p>
        </div>
      </div>
    `,
    text: `Password Reset\n\nHi {{name}},\n\nWe received a request to reset your password.\n\nClick here to reset: {{resetUrl}}\n\nThis link will expire in 1 hour. If you didn't request this reset, please ignore this email.`
  }
};

// 🚀 EMAIL SERVICE CLASS
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (!config.email.isConfigured) {
      console.warn('Email service not configured - emails will be logged only');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort || 587,
        secure: config.email.smtpPort === 465,
        auth: {
          user: config.email.smtpUser,
          pass: config.email.smtpPass,
        },
        tls: {
          rejectUnauthorized: config.environment.isProduction,
        },
      });

      this.isConfigured = true;
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  // 📧 Send email with template support
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // 🎨 Process template if specified
      let { subject, html, text } = options;

      if (options.template && EMAIL_TEMPLATES[options.template]) {
        const template = EMAIL_TEMPLATES[options.template];
        subject = subject || template.subject;
        html = html || template.html;
        text = text || template.text;

        // 🔄 Replace template variables
        if (options.templateData) {
          subject = this.replaceTemplateVars(subject, options.templateData);
          html = this.replaceTemplateVars(html, options.templateData);
          text = this.replaceTemplateVars(text, options.templateData);
        }
      }

      // 📋 Prepare email data
      const emailData = {
        from: config.email.fromEmail || 'noreply@sovren.dev',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject,
        html,
        text,
        attachments: options.attachments,
        priority: options.priority || 'normal',
      };

      // 🚀 Send email or log if not configured
      if (!this.isConfigured || !this.transporter) {
        console.log('📧 Email (Development Mode):', {
          to: emailData.to,
          subject: emailData.subject,
          template: options.template,
        });
        return { success: true, messageId: 'dev-mode' };
      }

      const result = await this.transporter.sendMail(emailData);

      return {
        success: true,
        messageId: result.messageId,
      };

    } catch (error: any) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 🎯 Convenience methods for common email types
  async sendWelcomeEmail(to: string, name: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      template: 'welcome',
      templateData: {
        name,
        loginUrl: `${config.environment.vercelUrl || 'https://sovren.dev'}/login`,
      },
    });
  }

  async sendPaymentConfirmation(to: string, name: string, paymentData: any): Promise<EmailResult> {
    return this.sendEmail({
      to,
      template: 'paymentConfirmation',
      templateData: {
        name,
        paymentId: paymentData.id,
        amount: paymentData.amount,
        currency: paymentData.currency.toUpperCase(),
        date: new Date().toLocaleDateString(),
      },
    });
  }

  async sendPaymentFailedEmail(to: string, name: string, failureReason: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      template: 'paymentFailed',
      templateData: {
        name,
        failureReason,
        retryUrl: `${config.environment.vercelUrl || 'https://sovren.dev'}/payment`,
      },
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      template: 'passwordReset',
      templateData: {
        name,
        resetUrl: `${config.environment.vercelUrl || 'https://sovren.dev'}/reset-password?token=${resetToken}`,
      },
    });
  }

  // 🔄 Template variable replacement
  private replaceTemplateVars(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  // 🧪 Test email configuration
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection test failed:', error);
      return false;
    }
  }
}

// 🌟 SINGLETON INSTANCE
export const emailService = new EmailService();
