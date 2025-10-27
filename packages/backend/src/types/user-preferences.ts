/**
 * User Preferences Type Definitions
 * User Story: US-E5-020
 * Part of Epic 005 - Backend Service Refactoring
 */

/**
 * Notification preference for a specific event type
 */
export interface NotificationPreference {
  eventType: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

/**
 * Privacy settings for user profile and activity
 */
export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'followers_only';
  activityVisibility: 'public' | 'private' | 'followers_only';
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowTagging: boolean;
  allowMentions: boolean;
  dataSharing: {
    analytics: boolean;
    thirdParty: boolean;
    marketing: boolean;
  };
}

/**
 * Content preferences for filtering and recommendations
 */
export interface ContentPreferences {
  languages: string[];
  topics: string[];
  contentTypes: string[];
  sensitiveContent: 'show' | 'blur' | 'hide';
  autoplayVideos: boolean;
  showSpoilers: boolean;
}

/**
 * Display preferences for UI customization
 */
export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  fontFamily: string;
  layout: 'compact' | 'comfortable' | 'spacious';
  density: 'default' | 'compact' | 'comfortable';
  colorScheme?: string;
}

/**
 * Communication preferences for notifications and marketing
 */
export interface CommunicationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  productUpdates: boolean;
  newsletters: boolean;
  weeklyDigest: boolean;
  monthlyReport: boolean;
  frequency: 'realtime' | 'daily' | 'weekly' | 'never';
}

/**
 * Accessibility settings for improved usability
 */
export interface AccessibilitySettings {
  screenReader: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  keyboardNavigation: boolean;
  largeClickTargets: boolean;
  audioDescriptions: boolean;
  closedCaptions: boolean;
  focusIndicators: boolean;
}

/**
 * Data export preferences
 */
export interface DataExportPreferences {
  format: 'json' | 'csv' | 'xml';
  includeMetadata: boolean;
  includeContent: boolean;
  includeAnalytics: boolean;
  frequency: 'manual' | 'weekly' | 'monthly' | 'quarterly';
  autoExport: boolean;
}

/**
 * Complete user preferences object
 */
export interface UserPreferences {
  userId: string;
  notifications: NotificationPreference[];
  privacy: PrivacySettings;
  content: ContentPreferences;
  display: DisplayPreferences;
  communication: CommunicationPreferences;
  accessibility: AccessibilitySettings;
  dataExport: DataExportPreferences;
  preset?: 'beginner' | 'creator' | 'power_user' | 'custom';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Preference update request
 */
export interface PreferenceUpdateRequest {
  userId: string;
  updates: Partial<Omit<UserPreferences, 'userId' | 'version' | 'createdAt' | 'updatedAt'>>;
  reason?: string;
}

/**
 * Preference change history entry
 */
export interface PreferenceChangeHistory {
  id: string;
  userId: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
  changedBy: string;
  changedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Preference validation result
 */
export interface PreferenceValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Preference preset definition
 */
export interface PreferencePreset {
  name: 'beginner' | 'creator' | 'power_user';
  displayName: string;
  description: string;
  preferences: Partial<Omit<UserPreferences, 'userId' | 'version' | 'createdAt' | 'updatedAt' | 'preset'>>;
}

/**
 * Bulk preference update request
 */
export interface BulkPreferenceUpdateRequest {
  userId: string;
  updates: Array<{
    category: keyof Omit<UserPreferences, 'userId' | 'version' | 'createdAt' | 'updatedAt' | 'preset'>;
    value: any;
  }>;
  atomic: boolean;
}

/**
 * Preference query options
 */
export interface PreferenceQueryOptions {
  includeHistory?: boolean;
  includeDefaults?: boolean;
  categories?: Array<keyof Omit<UserPreferences, 'userId' | 'version' | 'createdAt' | 'updatedAt'>>;
}

/**
 * Preference export result
 */
export interface PreferenceExportResult {
  userId: string;
  preferences: UserPreferences;
  history?: PreferenceChangeHistory[];
  exportedAt: Date;
  format: 'json' | 'csv' | 'xml';
}

/**
 * Default preference values
 */
export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'> = {
  notifications: [],
  privacy: {
    profileVisibility: 'public',
    activityVisibility: 'public',
    showOnlineStatus: true,
    showLastSeen: true,
    allowTagging: true,
    allowMentions: true,
    dataSharing: {
      analytics: true,
      thirdParty: false,
      marketing: false
    }
  },
  content: {
    languages: ['en'],
    topics: [],
    contentTypes: ['text', 'image', 'video', 'audio'],
    sensitiveContent: 'blur',
    autoplayVideos: false,
    showSpoilers: false
  },
  display: {
    theme: 'auto',
    fontSize: 'medium',
    fontFamily: 'system-ui',
    layout: 'comfortable',
    density: 'default'
  },
  communication: {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    productUpdates: true,
    newsletters: false,
    weeklyDigest: true,
    monthlyReport: false,
    frequency: 'realtime'
  },
  accessibility: {
    screenReader: false,
    highContrast: false,
    reducedMotion: false,
    keyboardNavigation: false,
    largeClickTargets: false,
    audioDescriptions: false,
    closedCaptions: false,
    focusIndicators: false
  },
  dataExport: {
    format: 'json',
    includeMetadata: true,
    includeContent: true,
    includeAnalytics: false,
    frequency: 'manual',
    autoExport: false
  },
  version: 1
};

/**
 * Preference presets
 */
export const PREFERENCE_PRESETS: PreferencePreset[] = [
  {
    name: 'beginner',
    displayName: 'Beginner',
    description: 'Simplified settings for new users',
    preferences: {
      notifications: [],
      privacy: {
        profileVisibility: 'public',
        activityVisibility: 'public',
        showOnlineStatus: true,
        showLastSeen: true,
        allowTagging: true,
        allowMentions: true,
        dataSharing: {
          analytics: true,
          thirdParty: false,
          marketing: false
        }
      },
      content: {
        languages: ['en'],
        topics: [],
        contentTypes: ['text', 'image'],
        sensitiveContent: 'hide',
        autoplayVideos: false,
        showSpoilers: false
      },
      display: {
        theme: 'auto',
        fontSize: 'medium',
        fontFamily: 'system-ui',
        layout: 'comfortable',
        density: 'comfortable'
      },
      communication: {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        productUpdates: true,
        newsletters: false,
        weeklyDigest: true,
        monthlyReport: false,
        frequency: 'daily'
      },
      accessibility: {
        screenReader: false,
        highContrast: false,
        reducedMotion: false,
        keyboardNavigation: false,
        largeClickTargets: false,
        audioDescriptions: false,
        closedCaptions: false,
        focusIndicators: false
      },
      dataExport: {
        format: 'json',
        includeMetadata: true,
        includeContent: true,
        includeAnalytics: false,
        frequency: 'manual',
        autoExport: false
      }
    }
  },
  {
    name: 'creator',
    displayName: 'Creator',
    description: 'Optimized for content creators',
    preferences: {
      notifications: [],
      privacy: {
        profileVisibility: 'public',
        activityVisibility: 'public',
        showOnlineStatus: true,
        showLastSeen: false,
        allowTagging: true,
        allowMentions: true,
        dataSharing: {
          analytics: true,
          thirdParty: false,
          marketing: true
        }
      },
      content: {
        languages: ['en'],
        topics: [],
        contentTypes: ['text', 'image', 'video', 'audio'],
        sensitiveContent: 'blur',
        autoplayVideos: true,
        showSpoilers: false
      },
      display: {
        theme: 'dark',
        fontSize: 'medium',
        fontFamily: 'system-ui',
        layout: 'spacious',
        density: 'comfortable'
      },
      communication: {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: true,
        productUpdates: true,
        newsletters: true,
        weeklyDigest: true,
        monthlyReport: true,
        frequency: 'realtime'
      },
      accessibility: {
        screenReader: false,
        highContrast: false,
        reducedMotion: false,
        keyboardNavigation: true,
        largeClickTargets: false,
        audioDescriptions: false,
        closedCaptions: true,
        focusIndicators: true
      },
      dataExport: {
        format: 'json',
        includeMetadata: true,
        includeContent: true,
        includeAnalytics: true,
        frequency: 'monthly',
        autoExport: true
      }
    }
  },
  {
    name: 'power_user',
    displayName: 'Power User',
    description: 'Advanced settings for experienced users',
    preferences: {
      notifications: [],
      privacy: {
        profileVisibility: 'followers_only',
        activityVisibility: 'private',
        showOnlineStatus: false,
        showLastSeen: false,
        allowTagging: false,
        allowMentions: true,
        dataSharing: {
          analytics: false,
          thirdParty: false,
          marketing: false
        }
      },
      content: {
        languages: ['en'],
        topics: [],
        contentTypes: ['text', 'image', 'video', 'audio'],
        sensitiveContent: 'show',
        autoplayVideos: false,
        showSpoilers: true
      },
      display: {
        theme: 'dark',
        fontSize: 'small',
        fontFamily: 'monospace',
        layout: 'compact',
        density: 'compact'
      },
      communication: {
        emailNotifications: false,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        productUpdates: true,
        newsletters: false,
        weeklyDigest: false,
        monthlyReport: false,
        frequency: 'realtime'
      },
      accessibility: {
        screenReader: false,
        highContrast: false,
        reducedMotion: false,
        keyboardNavigation: true,
        largeClickTargets: false,
        audioDescriptions: false,
        closedCaptions: false,
        focusIndicators: true
      },
      dataExport: {
        format: 'json',
        includeMetadata: true,
        includeContent: true,
        includeAnalytics: true,
        frequency: 'weekly',
        autoExport: true
      }
    }
  }
];
