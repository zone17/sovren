/**
 * Payment Services Binding Module
 * Registers all Phase 5 payment services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
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
 */
export class PaymentServicesModule implements IServiceModule {
  name = 'PaymentServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // PaymentProcessingService - SCOPED
    // ===========================
    // Core payment processing (per request)
    registry.registerSingleton(TYPES.PaymentProcessingService, (container) => {
      const paymentRepo = container.resolve(TYPES.PaymentRepository);
      const lightning = container.resolve(TYPES.LightningService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new PaymentProcessingService(paymentRepo, lightning, eventBus, logger);
    });

    // ===========================
    // CurrencyService - TRANSIENT
    // ===========================
    // Multi-currency support (stateless)
    registry.registerTransient(TYPES.CurrencyService, (container) => {
      const config = container.resolve(TYPES.Config);
      const cache = container.resolve(TYPES.CacheService);

      return new CurrencyService(config, cache);
    });

    // ===========================
    // SubscriptionService - SCOPED
    // ===========================
    // Subscription management (per request)
    registry.registerSingleton(TYPES.SubscriptionService, (container) => {
      const subscriptionRepo = container.resolve(TYPES.SubscriptionRepository);
      const paymentProcessing = container.resolve(TYPES.PaymentProcessingService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new SubscriptionService(subscriptionRepo, paymentProcessing, eventBus, logger);
    });

    // ===========================
    // RefundService - SCOPED
    // ===========================
    // Refund processing and tracking (per request)
    registry.registerSingleton(TYPES.RefundService, (container) => {
      const paymentRepo = container.resolve(TYPES.PaymentRepository);
      const paymentProcessing = container.resolve(TYPES.PaymentProcessingService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new RefundService(paymentRepo, paymentProcessing, eventBus, logger);
    });

    // ===========================
    // PaymentAnalyticsService - SCOPED
    // ===========================
    // Payment analytics and reporting (per request)
    registry.registerSingleton(TYPES.PaymentAnalyticsService, (container) => {
      const paymentRepo = container.resolve(TYPES.PaymentRepository);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new PaymentAnalyticsService(paymentRepo, eventBus, logger);
    });

    // ===========================
    // WebhookService - SCOPED
    // ===========================
    // Webhook management and delivery (per request)
    registry.registerSingleton(TYPES.WebhookService, (container) => {
      const database = container.resolve(TYPES.Database);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new WebhookService(database, eventBus, logger);
    });

    // ===========================
    // InvoiceService - SCOPED
    // ===========================
    // Invoice generation and management (per request)
    registry.registerSingleton(TYPES.InvoiceService, (container) => {
      const paymentRepo = container.resolve(TYPES.PaymentRepository);
      const logger = container.resolve(TYPES.Logger);

      return new InvoiceService(paymentRepo, logger);
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
