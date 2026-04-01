/**
 * Payment Services Binding Module
 * Registers all Phase 5 payment services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { IPaymentProcessingService } from '../../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../../interfaces/payment/ICurrencyService';
import type { ISubscriptionService } from '../../interfaces/payment/ISubscriptionService';
import type { IRefundService } from '../../interfaces/payment/IRefundService';
import type { IPaymentAnalyticsService } from '../../interfaces/payment/IPaymentAnalyticsService';
import type { IWebhookService } from '../../interfaces/payment/IWebhookService';
import type { IInvoiceService } from '../../interfaces/payment';
import { TYPES } from '../types';

// Import service implementations
import { PaymentProcessingService } from '../../services/payment/PaymentProcessingService';
import { CurrencyService } from '../../services/payment/CurrencyService';
import { SubscriptionService } from '../../services/payment/SubscriptionService';
import { RefundService } from '../../services/payment/RefundService';
import { PaymentAnalyticsService } from '../../services/payment/PaymentAnalyticsService';
import { WebhookService } from '../../services/payment/WebhookService';
import { InvoiceService } from '../../services/payment/InvoiceService';

/**
 * Payment Services Module
 * Phase 5: Payment Processing, Subscriptions, Refunds, Analytics
 * Total Services: 7
 *
 * Note: Concrete service constructors use @inject decorators (inversify) for
 * historical reasons but actual DI is done through this binding module.
 * We cast through `unknown` to bridge concrete implementations to token types.
 */
export class PaymentServicesModule implements IServiceModule {
  name = 'PaymentServicesModule';

  register(registry: IServiceRegistry): void {
    // PaymentProcessingService - SINGLETON
    registry.registerSingletonFactory(TYPES.PaymentProcessingService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      const paymentRepo = container.resolveOptional(TYPES.PaymentRepository);
      return new PaymentProcessingService(
        eventBus as any, logger as any, cache as any, paymentRepo as any,
      ) as unknown as IPaymentProcessingService;
    });

    // CurrencyService - TRANSIENT
    registry.registerTransient(TYPES.CurrencyService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      return new CurrencyService(
        eventBus as any, logger as any, cache as any,
      ) as unknown as ICurrencyService;
    });

    // SubscriptionService - SINGLETON
    registry.registerSingletonFactory(TYPES.SubscriptionService, (container) => {
      const paymentProcessing = container.resolve(TYPES.PaymentProcessingService);
      const currencyService = container.resolve(TYPES.CurrencyService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const subscriptionRepo = container.resolveOptional(TYPES.SubscriptionRepository);
      const cache = container.resolveOptional(TYPES.CacheService);
      return new SubscriptionService(
        paymentProcessing as any, currencyService as any, auditLog as any,
        eventBus as any, logger as any, subscriptionRepo as any, cache as any,
      ) as unknown as ISubscriptionService;
    });

    // RefundService - SINGLETON
    registry.registerSingletonFactory(TYPES.RefundService, (container) => {
      const paymentProcessing = container.resolve(TYPES.PaymentProcessingService);
      const currencyService = container.resolve(TYPES.CurrencyService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      const paymentRepo = container.resolveOptional(TYPES.PaymentRepository);
      return new RefundService(
        paymentProcessing as any, currencyService as any, eventBus as any,
        logger as any, cache as any, paymentRepo as any,
      ) as unknown as IRefundService;
    });

    // PaymentAnalyticsService - SINGLETON
    registry.registerSingletonFactory(TYPES.PaymentAnalyticsService, (container) => {
      const paymentProcessing = container.resolve(TYPES.PaymentProcessingService);
      const currencyService = container.resolve(TYPES.CurrencyService);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      return new PaymentAnalyticsService(
        paymentProcessing as any, currencyService as any,
        cache as any, eventBus as any, logger as any,
      ) as unknown as IPaymentAnalyticsService;
    });

    // WebhookService - SINGLETON
    registry.registerSingletonFactory(TYPES.WebhookService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      return new WebhookService(
        eventBus as any, logger as any, cache as any, auditLog as any,
      ) as unknown as IWebhookService;
    });

    // InvoiceService - SINGLETON
    registry.registerSingletonFactory(TYPES.InvoiceService, (container) => {
      const db = container.resolve(TYPES.Database);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      const notification = container.resolveOptional(TYPES.NotificationService);
      return new InvoiceService(
        db as any, cache as any, eventBus as any,
        auditLog as any, notification as any,
      ) as unknown as IInvoiceService;
    });
  }

  dependencies = [];
}

/**
 * Helper function to register all payment services
 */
export function registerPaymentServices(registry: IServiceRegistry): void {
  const module = new PaymentServicesModule();
  registry.registerModule(module);
}

/**
 * Service metadata for payment services
 */
export const PAYMENT_SERVICE_METADATA = {
  PaymentProcessingService: {
    version: '1.0.0',
    description: 'Core payment processing via Lightning Network',
    tags: ['payment', 'lightning', 'bitcoin'],
    metrics: ['payment_count', 'payment_volume', 'processing_time'],
  },
  CurrencyService: {
    version: '1.0.0',
    description: 'Multi-currency conversion and support',
    tags: ['payment', 'currency'],
    metrics: ['conversion_count', 'supported_currencies', 'conversion_time'],
  },
  SubscriptionService: {
    version: '1.0.0',
    description: 'Subscription lifecycle management',
    tags: ['payment', 'subscription', 'recurring'],
    metrics: ['active_subscriptions', 'subscription_revenue', 'churn_rate'],
  },
  RefundService: {
    version: '1.0.0',
    description: 'Refund processing and tracking',
    tags: ['payment', 'refund'],
    metrics: ['refund_count', 'refund_amount', 'refund_time'],
  },
  PaymentAnalyticsService: {
    version: '1.0.0',
    description: 'Payment analytics and financial reporting',
    tags: ['payment', 'analytics', 'reporting'],
    metrics: ['total_revenue', 'transaction_volume', 'analytics_time'],
  },
  WebhookService: {
    version: '1.0.0',
    description: 'Webhook delivery and management',
    tags: ['payment', 'webhooks', 'integration'],
    metrics: ['webhook_count', 'delivery_rate', 'delivery_time'],
  },
  InvoiceService: {
    version: '1.0.0',
    description: 'Invoice generation and tracking',
    tags: ['payment', 'invoicing'],
    metrics: ['invoice_count', 'invoice_amount', 'generation_time'],
  },
} as const;
