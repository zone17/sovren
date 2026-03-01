// @ts-nocheck
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
import { ContentCreationService } from '../../services/content/ContentCreationService';

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
    registry.registerSingleton(TYPES.ContentController, (container) => {
      const publishingService = container.resolve(TYPES.ContentPublishingService);
      const moderationService = container.resolve(TYPES.ContentModerationService);
      const searchService = container.resolve(TYPES.ContentSearchService);
      const recommendationService = container.resolve(TYPES.ContentRecommendationService);
      const analyticsService = container.resolve(TYPES.ContentAnalyticsService);
      const versioningService = container.resolve(TYPES.ContentVersioningService);
      const creationService = container.resolve(TYPES.ContentCreationService);

      return new ContentController(
        publishingService,
        moderationService,
        searchService,
        recommendationService,
        analyticsService,
        versioningService,
        creationService as unknown as ContentCreationService
      );
    });

    // ===========================
    // UserController - SCOPED
    // ===========================
    registry.registerSingleton(TYPES.UserController, (container) => {
      const profileService = container.resolve(TYPES.UserProfileService);
      const preferencesService = container.resolve(TYPES.UserPreferencesService);
      const activityService = container.resolve(TYPES.UserActivityService);
      const relationshipService = container.resolve(TYPES.UserRelationshipService);
      const analyticsService = container.resolve(TYPES.UserAnalyticsService);

      return new UserController(
        profileService,
        preferencesService,
        activityService,
        relationshipService,
        analyticsService
      );
    });

    // ===========================
    // PaymentController - SCOPED
    // ===========================
    registry.registerSingleton(TYPES.PaymentController, (container) => {
      const paymentService = container.resolve(TYPES.PaymentProcessingService);
      const invoiceService = container.resolve(TYPES.InvoiceService);
      const currencyService = container.resolve(TYPES.CurrencyService);
      const subscriptionService = container.resolve(TYPES.SubscriptionService);
      const refundService = container.resolve(TYPES.RefundService);
      const analyticsService = container.resolve(TYPES.PaymentAnalyticsService);
      const webhookService = container.resolve(TYPES.WebhookService);

      return new PaymentController(
        paymentService,
        invoiceService,
        currencyService,
        subscriptionService,
        refundService,
        analyticsService,
        webhookService
      );
    });
  }

  dependencies = ['ContentServicesModule', 'UserServicesModule', 'PaymentServicesModule'];
}

/**
 * Helper function to register all controllers
 */
export function registerControllers(registry: IServiceRegistry): void {
  const module = new ControllerModule();
  registry.registerModule(module);
}
