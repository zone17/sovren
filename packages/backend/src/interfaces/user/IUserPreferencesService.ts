/**
 * User Preferences Service Interface
 * User Story: US-E5-020
 * Part of Epic 005 - Backend Service Refactoring
 */

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
  DataExportPreferences,
} from '../../types/user-preferences';

/**
 * Service for managing user preferences and settings
 */
export interface IUserPreferencesService {
  /**
   * Get user preferences with optional query options
   */
  getPreferences(userId: string, options?: PreferenceQueryOptions): Promise<UserPreferences>;

  /**
   * Get specific preference category
   */
  getNotificationPreferences(userId: string): Promise<NotificationPreference[]>;
  getPrivacySettings(userId: string): Promise<PrivacySettings>;
  getContentPreferences(userId: string): Promise<ContentPreferences>;
  getDisplayPreferences(userId: string): Promise<DisplayPreferences>;
  getCommunicationPreferences(userId: string): Promise<CommunicationPreferences>;
  getAccessibilitySettings(userId: string): Promise<AccessibilitySettings>;
  getDataExportPreferences(userId: string): Promise<DataExportPreferences>;

  /**
   * Update user preferences
   */
  updatePreferences(request: PreferenceUpdateRequest): Promise<UserPreferences>;

  /**
   * Update specific preference categories
   */
  updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreference[]
  ): Promise<UserPreferences>;

  updatePrivacySettings(
    userId: string,
    settings: Partial<PrivacySettings>
  ): Promise<UserPreferences>;

  updateContentPreferences(
    userId: string,
    preferences: Partial<ContentPreferences>
  ): Promise<UserPreferences>;

  updateDisplayPreferences(
    userId: string,
    preferences: Partial<DisplayPreferences>
  ): Promise<UserPreferences>;

  updateCommunicationPreferences(
    userId: string,
    preferences: Partial<CommunicationPreferences>
  ): Promise<UserPreferences>;

  updateAccessibilitySettings(
    userId: string,
    settings: Partial<AccessibilitySettings>
  ): Promise<UserPreferences>;

  updateDataExportPreferences(
    userId: string,
    preferences: Partial<DataExportPreferences>
  ): Promise<UserPreferences>;

  /**
   * Bulk update preferences with atomic transaction support
   */
  bulkUpdatePreferences(request: BulkPreferenceUpdateRequest): Promise<UserPreferences>;

  /**
   * Apply a preference preset
   */
  applyPreset(
    userId: string,
    preset: 'beginner' | 'creator' | 'power_user'
  ): Promise<UserPreferences>;

  /**
   * Reset preferences to defaults
   */
  resetPreferences(userId: string): Promise<UserPreferences>;

  /**
   * Delete all user preferences
   */
  deletePreferences(userId: string): Promise<boolean>;

  /**
   * Validate preference values
   */
  validatePreferences(preferences: Partial<UserPreferences>): Promise<PreferenceValidationResult>;

  /**
   * Get preference change history
   */
  getPreferenceHistory(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<PreferenceChangeHistory[]>;

  /**
   * Get preference changes for a specific field
   */
  getFieldHistory(
    userId: string,
    field: string,
    limit?: number
  ): Promise<PreferenceChangeHistory[]>;

  /**
   * Export user preferences
   */
  exportPreferences(
    userId: string,
    format?: 'json' | 'csv' | 'xml',
    includeHistory?: boolean
  ): Promise<PreferenceExportResult>;

  /**
   * Import user preferences
   */
  importPreferences(userId: string, data: PreferenceExportResult): Promise<UserPreferences>;

  /**
   * Get available preference presets
   */
  getAvailablePresets(): Promise<
    Array<{
      name: string;
      displayName: string;
      description: string;
    }>
  >;

  /**
   * Check if user has customized preferences
   */
  hasCustomPreferences(userId: string): Promise<boolean>;

  /**
   * Get preference defaults
   */
  getDefaults(): Promise<Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'>>;

  /**
   * Dispose of service resources
   */
  dispose(): Promise<void>;
}
