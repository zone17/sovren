// TypeScript strict mode enabled
/**
 * Controller Binding Module
 * Registers all API controllers in the DI container
 * Security Fix: PREREQ-4 - Controllers declared in types.ts but never registered
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import { TYPES } from '../types';

// Import controller implementations
import { ContentController } from '../../controllers/content/ContentController';
import { UserController } from '../../controllers/user/UserController';
import { PaymentController } from '../../controllers/payment/PaymentController';

// Import concrete service types for DI factory casts
import {
  ContentPublishingService,
  ContentModerationService,
  ContentSearchService,
  ContentRecommendationService,
  ContentAnalyticsService as ContentAnalyticsSvc,
  ContentVersioningService,
  ContentCreationService,
} from '../../services/content';
import {
  UserProfileService,
  UserPreferencesService,
  UserActivityService,
  UserRelationshipService,
  UserAnalyticsService as UserAnalyticsSvc,
} from '../../services/user';
import {
  PaymentProcessingService,
  InvoiceService,
  CurrencyService,
  SubscriptionService,
  RefundService,
  PaymentAnalyticsService,
  WebhookService,
} from '../../services/payment';

/**
 * Controller Module
 * Registers ContentController, UserController, PaymentController
 * Total Controllers: 3
 */
export class ControllerModule implements IServiceModule {
  name = 'ControllerModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // ContentController - SCOPED
    // ===========================
    registry.registerSingletonFactory(TYPES.ContentController, container => {
      const publishingService = container.resolve(TYPES.ContentPublishingService);
      const moderationService = container.resolve(TYPES.ContentModerationService);
      const searchService = container.resolve(TYPES.ContentSearchService);
      const recommendationService = container.resolve(TYPES.ContentRecommendationService);
      const analyticsService = container.resolve(TYPES.ContentAnalyticsService);
      const versioningService = container.resolve(TYPES.ContentVersioningService);
      const creationService = container.resolve(TYPES.ContentCreationService);

      return new ContentController(
        publishingService as unknown as ContentPublishingService,
        moderationService as unknown as ContentModerationService,
        searchService as unknown as ContentSearchService,
        recommendationService as unknown as ContentRecommendationService,
        analyticsService as unknown as ContentAnalyticsSvc,
        versioningService as unknown as ContentVersioningService,
        creationService as unknown as ContentCreationService
      );
    });

    // ===========================
    // UserController - SCOPED
    // ===========================
    registry.registerSingletonFactory(TYPES.UserController, container => {
      const profileService = container.resolve(TYPES.UserProfileService);
      const preferencesService = container.resolve(TYPES.UserPreferencesService);
      const activityService = container.resolve(TYPES.UserActivityService);
      const relationshipService = container.resolve(TYPES.UserRelationshipService);
      const analyticsService = container.resolve(TYPES.UserAnalyticsService);

      return new UserController(
        profileService as unknown as UserProfileService,
        preferencesService as unknown as UserPreferencesService,
        activityService as unknown as UserActivityService,
        relationshipService as unknown as UserRelationshipService,
        analyticsService as unknown as UserAnalyticsSvc
      );
    });

    // ===========================
    // PaymentController - SCOPED
    // ===========================
    registry.registerSingletonFactory(TYPES.PaymentController, container => {
      const paymentService = container.resolve(TYPES.PaymentProcessingService);
      const invoiceService = container.resolve(TYPES.InvoiceService);
      const currencyService = container.resolve(TYPES.CurrencyService);
      const subscriptionService = container.resolve(TYPES.SubscriptionService);
      const refundService = container.resolve(TYPES.RefundService);
      const analyticsService = container.resolve(TYPES.PaymentAnalyticsService);
      const webhookService = container.resolve(TYPES.WebhookService);

      return new PaymentController(
        paymentService as unknown as PaymentProcessingService,
        invoiceService as unknown as InvoiceService,
        currencyService as unknown as CurrencyService,
        subscriptionService as unknown as SubscriptionService,
        refundService as unknown as RefundService,
        analyticsService as unknown as PaymentAnalyticsService,
        webhookService as unknown as WebhookService
      );
    });
  }

  dependencies: IServiceModule[] = [];
}

/**
 * Helper function to register all controllers
 */
export function registerControllers(registry: IServiceRegistry): void {
  const module = new ControllerModule();
  registry.registerModule(module);
}
