/**
 * User Preferences Service Implementation
 * User Story: US-E5-020
 * Part of Epic 005 - Backend Service Refactoring
 *
 * Features:
 * - Notification preferences management
 * - Privacy settings control
 * - Content and display preferences
 * - Communication preferences
 * - Accessibility settings
 * - Data export preferences
 * - Preference presets (beginner, creator, power-user)
 * - Change history and audit trail
 * - Bulk atomic updates
 * - Multi-layer caching (memory + Redis)
 */

import type { IUserPreferencesService } from '../../interfaces/user/IUserPreferencesService';
import type { IUserPreferencesRepository } from '../../repositories/user/UserPreferencesRepository';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type {
  UserPreferences,
  PreferenceUpdateRequest,
  PreferenceChangeHistory,
  PreferenceValidationResult,
  PreferenceQueryOptions,
  PreferenceExportResult,
  BulkPreferenceUpdateRequest,
  NotificationPreference,
  PrivacySettings,
  ContentPreferences,
  DisplayPreferences,
  CommunicationPreferences,
  AccessibilitySettings,
  DataExportPreferences
} from '../../types/user-preferences';
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_PRESETS
} from '../../types/user-preferences';
import { DomainEventBuilder, DomainEventType } from '../../interfaces/shared/IEventBus';
import { v4 as uuidv4 } from 'uuid';

/**
 * Concrete implementation of UserPreferencesService
 */
export class UserPreferencesService implements IUserPreferencesService {
  private readonly repository: IUserPreferencesRepository;
  private readonly cacheService: ICacheService;
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cacheTtl = 3600; // 1 hour
  private readonly cachePrefix = 'user:preferences';

  constructor(
    repository: IUserPreferencesRepository,
    cacheService: ICacheService,
    eventBus: IEventBus,
    logger: ILogger
  ) {
    this.repository = repository;
    this.cacheService = cacheService;
    this.eventBus = eventBus;
    this.logger = logger;

    this.logger.info('UserPreferencesService initialized');
  }

  /**
   * Get user preferences with optional query options
   */
  async getPreferences(
    userId: string,
    options?: PreferenceQueryOptions
  ): Promise<UserPreferences> {
    this.validateUserId(userId);

    // Try cache first
    const cacheKey = this.getCacheKey(userId);
    const cached = await this.cacheService.get<UserPreferences>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for preferences: ${userId}`);
      return cached;
    }

    // Get from repository
    let preferences = await this.repository.findById(userId);

    // Create with defaults if not found
    if (!preferences) {
      this.logger.info(`Creating default preferences for user: ${userId}`);
      preferences = await this.createDefaultPreferences(userId);
    }

    // Cache the result
    await this.cacheService.set(cacheKey, preferences, this.cacheTtl);

    return preferences;
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    const preferences = await this.getPreferences(userId);
    return preferences.notifications;
  }

  /**
   * Get privacy settings
   */
  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    const preferences = await this.getPreferences(userId);
    return preferences.privacy;
  }

  /**
   * Get content preferences
   */
  async getContentPreferences(userId: string): Promise<ContentPreferences> {
    const preferences = await this.getPreferences(userId);
    return preferences.content;
  }

  /**
   * Get display preferences
   */
  async getDisplayPreferences(userId: string): Promise<DisplayPreferences> {
    const preferences = await this.getPreferences(userId);
    return preferences.display;
  }

  /**
   * Get communication preferences
   */
  async getCommunicationPreferences(userId: string): Promise<CommunicationPreferences> {
    const preferences = await this.getPreferences(userId);
    return preferences.communication;
  }

  /**
   * Get accessibility settings
   */
  async getAccessibilitySettings(userId: string): Promise<AccessibilitySettings> {
    const preferences = await this.getPreferences(userId);
    return preferences.accessibility;
  }

  /**
   * Get data export preferences
   */
  async getDataExportPreferences(userId: string): Promise<DataExportPreferences> {
    const preferences = await this.getPreferences(userId);
    return preferences.dataExport;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    request: PreferenceUpdateRequest
  ): Promise<UserPreferences> {
    this.validateUserId(request.userId);

    // Validate updates
    const validation = await this.validatePreferences(request.updates);
    if (!validation.valid) {
      const errors = validation.errors.map(e => e.message).join(', ');
      throw new Error(`Preference validation failed: ${errors}`);
    }

    // Get current preferences
    const current = await this.getPreferences(request.userId);

    // Track changes for history
    const changes = this.detectChanges(current, request.updates);

    // Update in repository
    const updated = await this.repository.update(request.userId, request.updates);

    // Invalidate cache
    await this.invalidateCache(request.userId);

    // Add history entries
    for (const change of changes) {
      await this.addHistoryEntry({
        id: uuidv4(),
        userId: request.userId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason: request.reason,
        changedBy: request.userId,
        changedAt: new Date()
      });
    }

    // Emit event
    await this.emitPreferenceUpdatedEvent(request.userId, updated, changes);

    this.logger.info(`Preferences updated for user: ${request.userId}`);

    return updated;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreference[]
  ): Promise<UserPreferences> {
    return this.updatePreferences({
      userId,
      updates: { notifications: preferences }
    });
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    userId: string,
    settings: Partial<PrivacySettings>
  ): Promise<UserPreferences> {
    const current = await this.getPrivacySettings(userId);
    const merged = { ...current, ...settings };

    return this.updatePreferences({
      userId,
      updates: { privacy: merged }
    });
  }

  /**
   * Update content preferences
   */
  async updateContentPreferences(
    userId: string,
    preferences: Partial<ContentPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getContentPreferences(userId);
    const merged = { ...current, ...preferences };

    return this.updatePreferences({
      userId,
      updates: { content: merged }
    });
  }

  /**
   * Update display preferences
   */
  async updateDisplayPreferences(
    userId: string,
    preferences: Partial<DisplayPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getDisplayPreferences(userId);
    const merged = { ...current, ...preferences };

    return this.updatePreferences({
      userId,
      updates: { display: merged }
    });
  }

  /**
   * Update communication preferences
   */
  async updateCommunicationPreferences(
    userId: string,
    preferences: Partial<CommunicationPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getCommunicationPreferences(userId);
    const merged = { ...current, ...preferences };

    return this.updatePreferences({
      userId,
      updates: { communication: merged }
    });
  }

  /**
   * Update accessibility settings
   */
  async updateAccessibilitySettings(
    userId: string,
    settings: Partial<AccessibilitySettings>
  ): Promise<UserPreferences> {
    const current = await this.getAccessibilitySettings(userId);
    const merged = { ...current, ...settings };

    return this.updatePreferences({
      userId,
      updates: { accessibility: merged }
    });
  }

  /**
   * Update data export preferences
   */
  async updateDataExportPreferences(
    userId: string,
    preferences: Partial<DataExportPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getDataExportPreferences(userId);
    const merged = { ...current, ...preferences };

    return this.updatePreferences({
      userId,
      updates: { dataExport: merged }
    });
  }

  /**
   * Bulk update preferences with atomic transaction support
   */
  async bulkUpdatePreferences(
    request: BulkPreferenceUpdateRequest
  ): Promise<UserPreferences> {
    this.validateUserId(request.userId);

    if (request.updates.length === 0) {
      throw new Error('No updates provided');
    }

    try {
      // Get current preferences
      const current = await this.getPreferences(request.userId);

      // Build update object
      const updates: Partial<UserPreferences> = {};
      for (const update of request.updates) {
        (updates as any)[update.category] = update.value;
      }

      // Validate all updates
      const validation = await this.validatePreferences(updates);
      if (!validation.valid) {
        const errors = validation.errors.map(e => e.message).join(', ');
        throw new Error(`Bulk update validation failed: ${errors}`);
      }

      // Apply updates (atomic if requested)
      if (request.atomic) {
        // In production, this would use database transactions
        const updated = await this.repository.update(request.userId, updates);

        // Invalidate cache
        await this.invalidateCache(request.userId);

        // Track changes
        const changes = this.detectChanges(current, updates);
        for (const change of changes) {
          await this.addHistoryEntry({
            id: uuidv4(),
            userId: request.userId,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            reason: 'Bulk update',
            changedBy: request.userId,
            changedAt: new Date()
          });
        }

        // Emit event
        await this.emitPreferenceUpdatedEvent(request.userId, updated, changes);

        this.logger.info(`Bulk preferences updated for user: ${request.userId}`);

        return updated;
      } else {
        // Non-atomic: update one by one
        return this.updatePreferences({
          userId: request.userId,
          updates,
          reason: 'Bulk update'
        });
      }

    } catch (error) {
      this.logger.error(`Bulk update failed for user ${request.userId}`, error);
      throw error;
    }
  }

  /**
   * Apply a preference preset
   */
  async applyPreset(
    userId: string,
    preset: 'beginner' | 'creator' | 'power_user'
  ): Promise<UserPreferences> {
    this.validateUserId(userId);

    const presetConfig = PREFERENCE_PRESETS.find(p => p.name === preset);
    if (!presetConfig) {
      throw new Error(`Invalid preset: ${preset}`);
    }

    this.logger.info(`Applying preset "${preset}" for user: ${userId}`);

    return this.updatePreferences({
      userId,
      updates: {
        ...presetConfig.preferences,
        preset
      },
      reason: `Applied ${preset} preset`
    });
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<UserPreferences> {
    this.validateUserId(userId);

    this.logger.info(`Resetting preferences for user: ${userId}`);

    const defaults = {
      ...DEFAULT_PREFERENCES,
      preset: 'custom' as const
    };

    return this.updatePreferences({
      userId,
      updates: defaults,
      reason: 'Reset to defaults'
    });
  }

  /**
   * Delete all user preferences
   */
  async deletePreferences(userId: string): Promise<boolean> {
    this.validateUserId(userId);

    const deleted = await this.repository.delete(userId);

    if (deleted) {
      // Invalidate cache
      await this.invalidateCache(userId);

      // Emit event
      await this.eventBus.publish(
        new DomainEventBuilder()
          .withType(DomainEventType.USER_UPDATED)
          .withAggregateId(userId)
          .withAggregateType('user')
          .withPayload({ action: 'preferences_deleted' })
          .withUserId(userId)
          .withSource('UserPreferencesService')
          .build()
      );

      this.logger.info(`Preferences deleted for user: ${userId}`);
    }

    return deleted;
  }

  /**
   * Validate preference values
   */
  async validatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<PreferenceValidationResult> {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate privacy settings
    if (preferences.privacy) {
      const validVisibility = ['public', 'private', 'followers_only'];
      if (preferences.privacy.profileVisibility &&
          !validVisibility.includes(preferences.privacy.profileVisibility)) {
        errors.push({
          field: 'privacy.profileVisibility',
          message: 'Invalid profile visibility value',
          code: 'INVALID_VISIBILITY'
        });
      }
      if (preferences.privacy.activityVisibility &&
          !validVisibility.includes(preferences.privacy.activityVisibility)) {
        errors.push({
          field: 'privacy.activityVisibility',
          message: 'Invalid activity visibility value',
          code: 'INVALID_VISIBILITY'
        });
      }
    }

    // Validate content preferences
    if (preferences.content) {
      if (preferences.content.languages && preferences.content.languages.length === 0) {
        errors.push({
          field: 'content.languages',
          message: 'At least one language must be selected',
          code: 'EMPTY_LANGUAGES'
        });
      }

      const validSensitiveContent = ['show', 'blur', 'hide'];
      if (preferences.content.sensitiveContent &&
          !validSensitiveContent.includes(preferences.content.sensitiveContent)) {
        errors.push({
          field: 'content.sensitiveContent',
          message: 'Invalid sensitive content value',
          code: 'INVALID_SENSITIVE_CONTENT'
        });
      }
    }

    // Validate display preferences
    if (preferences.display) {
      const validThemes = ['light', 'dark', 'auto'];
      if (preferences.display.theme &&
          !validThemes.includes(preferences.display.theme)) {
        errors.push({
          field: 'display.theme',
          message: 'Invalid theme value',
          code: 'INVALID_THEME'
        });
      }

      const validFontSizes = ['small', 'medium', 'large', 'xlarge'];
      if (preferences.display.fontSize &&
          !validFontSizes.includes(preferences.display.fontSize)) {
        errors.push({
          field: 'display.fontSize',
          message: 'Invalid font size value',
          code: 'INVALID_FONT_SIZE'
        });
      }

      const validLayouts = ['compact', 'comfortable', 'spacious'];
      if (preferences.display.layout &&
          !validLayouts.includes(preferences.display.layout)) {
        errors.push({
          field: 'display.layout',
          message: 'Invalid layout value',
          code: 'INVALID_LAYOUT'
        });
      }
    }

    // Validate communication preferences
    if (preferences.communication) {
      const validFrequencies = ['realtime', 'daily', 'weekly', 'never'];
      if (preferences.communication.frequency &&
          !validFrequencies.includes(preferences.communication.frequency)) {
        errors.push({
          field: 'communication.frequency',
          message: 'Invalid frequency value',
          code: 'INVALID_FREQUENCY'
        });
      }

      // Warn if all notifications are disabled
      if (preferences.communication.emailNotifications === false &&
          preferences.communication.pushNotifications === false &&
          preferences.communication.smsNotifications === false) {
        warnings.push({
          field: 'communication',
          message: 'All notification channels are disabled'
        });
      }
    }

    // Validate data export preferences
    if (preferences.dataExport) {
      const validFormats = ['json', 'csv', 'xml'];
      if (preferences.dataExport.format &&
          !validFormats.includes(preferences.dataExport.format)) {
        errors.push({
          field: 'dataExport.format',
          message: 'Invalid export format',
          code: 'INVALID_FORMAT'
        });
      }

      const validExportFrequencies = ['manual', 'weekly', 'monthly', 'quarterly'];
      if (preferences.dataExport.frequency &&
          !validExportFrequencies.includes(preferences.dataExport.frequency)) {
        errors.push({
          field: 'dataExport.frequency',
          message: 'Invalid export frequency',
          code: 'INVALID_EXPORT_FREQUENCY'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get preference change history
   */
  async getPreferenceHistory(
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<PreferenceChangeHistory[]> {
    this.validateUserId(userId);
    return this.repository.getHistory(userId, limit, offset);
  }

  /**
   * Get preference changes for a specific field
   */
  async getFieldHistory(
    userId: string,
    field: string,
    limit = 100
  ): Promise<PreferenceChangeHistory[]> {
    this.validateUserId(userId);
    return this.repository.getFieldHistory(userId, field, limit);
  }

  /**
   * Export user preferences
   */
  async exportPreferences(
    userId: string,
    format: 'json' | 'csv' | 'xml' = 'json',
    includeHistory = false
  ): Promise<PreferenceExportResult> {
    this.validateUserId(userId);

    const preferences = await this.getPreferences(userId);

    const result: PreferenceExportResult = {
      userId,
      preferences,
      exportedAt: new Date(),
      format
    };

    if (includeHistory) {
      result.history = await this.repository.getHistory(userId);
    }

    this.logger.info(`Preferences exported for user: ${userId} (format: ${format})`);

    return result;
  }

  /**
   * Import user preferences
   */
  async importPreferences(
    userId: string,
    data: PreferenceExportResult
  ): Promise<UserPreferences> {
    this.validateUserId(userId);

    if (data.userId !== userId) {
      throw new Error('User ID mismatch in import data');
    }

    // Validate imported preferences
    const validation = await this.validatePreferences(data.preferences);
    if (!validation.valid) {
      const errors = validation.errors.map(e => e.message).join(', ');
      throw new Error(`Import validation failed: ${errors}`);
    }

    this.logger.info(`Importing preferences for user: ${userId}`);

    // Update preferences
    return this.updatePreferences({
      userId,
      updates: data.preferences,
      reason: 'Imported preferences'
    });
  }

  /**
   * Get available preference presets
   */
  async getAvailablePresets(): Promise<Array<{
    name: string;
    displayName: string;
    description: string;
  }>> {
    return PREFERENCE_PRESETS.map(preset => ({
      name: preset.name,
      displayName: preset.displayName,
      description: preset.description
    }));
  }

  /**
   * Check if user has customized preferences
   */
  async hasCustomPreferences(userId: string): Promise<boolean> {
    this.validateUserId(userId);

    const exists = await this.repository.exists(userId);
    if (!exists) {
      return false;
    }

    const preferences = await this.getPreferences(userId);
    return preferences.preset === 'custom' || preferences.version > 1;
  }

  /**
   * Get preference defaults
   */
  async getDefaults(): Promise<Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'>> {
    return DEFAULT_PREFERENCES;
  }

  /**
   * Dispose of service resources
   */
  async dispose(): Promise<void> {
    this.logger.info('UserPreferencesService disposed');
  }

  // Private helper methods

  /**
   * Create default preferences for a new user
   */
  private async createDefaultPreferences(userId: string): Promise<UserPreferences> {
    const preferences: UserPreferences = {
      userId,
      ...DEFAULT_PREFERENCES,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.repository.create(preferences);
  }

  /**
   * Validate user ID
   */
  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Invalid user ID');
    }
  }

  /**
   * Get cache key for user preferences
   */
  private getCacheKey(userId: string): string {
    return `${this.cachePrefix}:${userId}`;
  }

  /**
   * Invalidate cache for user
   */
  private async invalidateCache(userId: string): Promise<void> {
    const cacheKey = this.getCacheKey(userId);
    await this.cacheService.delete(cacheKey);
    this.logger.debug(`Cache invalidated for user: ${userId}`);
  }

  /**
   * Detect changes between current and updated preferences
   */
  private detectChanges(
    current: UserPreferences,
    updates: Partial<UserPreferences>
  ): Array<{ field: string; oldValue: any; newValue: any }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = (current as any)[key];

      // Skip if unchanged
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }

      changes.push({
        field: key,
        oldValue,
        newValue
      });
    }

    return changes;
  }

  /**
   * Add history entry
   */
  private async addHistoryEntry(entry: PreferenceChangeHistory): Promise<void> {
    try {
      await this.repository.addHistoryEntry(entry);
    } catch (error) {
      this.logger.error('Failed to add history entry', error);
      // Don't throw - history is non-critical
    }
  }

  /**
   * Emit preference updated event
   */
  private async emitPreferenceUpdatedEvent(
    userId: string,
    preferences: UserPreferences,
    changes: Array<{ field: string; oldValue: any; newValue: any }>
  ): Promise<void> {
    try {
      await this.eventBus.publish(
        new DomainEventBuilder()
          .withType(DomainEventType.USER_UPDATED)
          .withAggregateId(userId)
          .withAggregateType('user')
          .withPayload({
            action: 'preferences_updated',
            changes,
            version: preferences.version
          })
          .withUserId(userId)
          .withSource('UserPreferencesService')
          .build()
      );
    } catch (error) {
      this.logger.error('Failed to emit preference updated event', error);
      // Don't throw - event emission is non-critical
    }
  }
}
