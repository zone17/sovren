/**
 * 📧 **EMAIL NOTIFICATION PREFERENCES COMPONENT** 📧
 *
 * Comprehensive React component for managing email notification preferences.
 * Implements US-139.3: Create notification preference management
 *
 * **Features:**
 * - Granular notification type controls
 * - Quiet hours configuration
 * - Frequency preferences
 * - Real-time preference updates
 * - GDPR compliance controls
 * - Accessibility compliant interface
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-15
 */

import {
  Bell,
  BellOff,
  Clock,
  CreditCard,
  Info,
  Mail,
  MessageSquare,
  Moon,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useEmailService } from '../../hooks/useEmailService';
import { useToast } from '../../hooks/useToast';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';

// Type definitions
interface NotificationPreferences {
  id: string;
  user_id: string;
  enabled: boolean;

  // Channel preferences
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;

  // Notification type preferences
  content_notifications: boolean;
  payment_notifications: boolean;
  subscription_notifications: boolean;
  social_notifications: boolean;
  system_notifications: boolean;
  marketing_notifications: boolean;

  // Frequency settings
  instant_notifications: boolean;
  daily_digest: boolean;
  weekly_digest: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;

  // Advanced settings
  max_emails_per_day: number;
  batch_notifications: boolean;

  created_at: Date;
  updated_at: Date;
}

interface EmailNotificationPreferencesProps {
  userId: string;
  className?: string;
}

// Notification categories configuration
const NOTIFICATION_CATEGORIES = [
  {
    id: 'content_notifications',
    title: 'Content Notifications',
    description: 'Updates about your content, likes, comments, and shares',
    icon: MessageSquare,
    examples: ['New comments on your posts', 'Content likes and shares', 'Content featured'],
  },
  {
    id: 'payment_notifications',
    title: 'Payment Notifications',
    description: 'Payment confirmations, failures, and financial updates',
    icon: CreditCard,
    examples: ['Payment received', 'Payment processed', 'Payout notifications'],
  },
  {
    id: 'subscription_notifications',
    title: 'Subscription Notifications',
    description: 'Subscription renewals, cancellations, and plan changes',
    icon: Users,
    examples: ['New subscribers', 'Subscription renewals', 'Plan upgrades'],
  },
  {
    id: 'social_notifications',
    title: 'Social Notifications',
    description: 'Followers, mentions, and social interactions',
    icon: Users,
    examples: ['New followers', 'Mentions', 'Collaboration invites'],
  },
  {
    id: 'system_notifications',
    title: 'System Notifications',
    description: 'Account security, updates, and important announcements',
    icon: Shield,
    examples: ['Security alerts', 'Feature announcements', 'Policy updates'],
  },
  {
    id: 'marketing_notifications',
    title: 'Marketing & Promotional',
    description: 'Product updates, tips, and promotional content',
    icon: Mail,
    examples: ['Feature highlights', 'Success tips', 'Platform updates'],
  },
];

// Time zone options
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

// Generate time options
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const displayTime = new Date(`2024-01-01T${timeString}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      times.push({ value: timeString, label: displayTime });
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

export const EmailNotificationPreferences: React.FC<EmailNotificationPreferencesProps> = ({
  userId,
  className = '',
}) => {
  // State management
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Hooks
  const { toast } = useToast();
  const { getNotificationPreferences, updateNotificationPreferences } = useEmailService();

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [userId]);

  /**
   * Load user notification preferences
   */
  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await getNotificationPreferences(userId);
      setPreferences(data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!preferences) return;

      try {
        setSaving(true);
        const updatedPreferences = { ...preferences, ...updates };

        await updateNotificationPreferences(userId, updates);
        setPreferences(updatedPreferences);
        setHasChanges(false);

        toast({
          title: 'Preferences Updated',
          description: 'Your notification preferences have been saved successfully.',
          variant: 'default',
        });
      } catch (error) {
        console.error('Failed to update preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to update preferences. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [preferences, userId, updateNotificationPreferences, toast]
  );

  /**
   * Handle preference change
   */
  const handlePreferenceChange = useCallback(
    (key: keyof NotificationPreferences, value: any) => {
      if (!preferences) return;

      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);
      setHasChanges(true);
    },
    [preferences]
  );

  /**
   * Save all changes
   */
  const saveChanges = async () => {
    if (!preferences || !hasChanges) return;
    await updatePreferences(preferences);
  };

  /**
   * Reset to defaults
   */
  const resetToDefaults = () => {
    if (!preferences) return;

    const defaultPreferences: Partial<NotificationPreferences> = {
      enabled: true,
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      in_app_enabled: true,
      content_notifications: true,
      payment_notifications: true,
      subscription_notifications: true,
      social_notifications: true,
      system_notifications: true,
      marketing_notifications: false,
      instant_notifications: true,
      daily_digest: false,
      weekly_digest: false,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      quiet_hours_timezone: 'UTC',
      max_emails_per_day: 10,
      batch_notifications: true,
    };

    setPreferences({ ...preferences, ...defaultPreferences });
    setHasChanges(true);
  };

  /**
   * Disable marketing communications (GDPR compliance)
   */
  const disableMarketing = () => {
    handlePreferenceChange('marketing_notifications', false);
  };

  if (loading) {
    return (
      <Card className={`w-full max-w-4xl mx-auto ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card className={`w-full max-w-4xl mx-auto ${className}`}>
        <CardContent className="p-8 text-center">
          <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Preferences</h3>
          <p className="text-gray-600 mb-4">
            We couldn't load your notification preferences. Please try again.
          </p>
          <Button onClick={loadPreferences}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Preferences
          </CardTitle>
          <p className="text-sm text-gray-600">
            Control how and when you receive email notifications from Sovren.
          </p>
        </CardHeader>
      </Card>

      {/* Master Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Master Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Email Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {preferences.email_enabled ? (
                <Mail className="h-5 w-5 text-blue-600" />
              ) : (
                <BellOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <h3 className="font-medium">Email Notifications</h3>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
            </div>
            <Switch
              checked={preferences.email_enabled}
              onCheckedChange={(checked) => handlePreferenceChange('email_enabled', checked)}
              aria-label="Toggle email notifications"
            />
          </div>

          {/* Global Enable/Disable */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {preferences.enabled ? (
                <Bell className="h-5 w-5 text-green-600" />
              ) : (
                <BellOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <h3 className="font-medium">All Notifications</h3>
                <p className="text-sm text-gray-600">Master switch for all notification types</p>
              </div>
            </div>
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(checked) => handlePreferenceChange('enabled', checked)}
              aria-label="Toggle all notifications"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Categories</CardTitle>
          <p className="text-sm text-gray-600">
            Choose which types of notifications you want to receive.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isEnabled = preferences[
                category.id as keyof NotificationPreferences
              ] as boolean;

              return (
                <div key={category.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-5 w-5 ${isEnabled ? 'text-blue-600' : 'text-gray-400'}`}
                      />
                      <div>
                        <h3 className="font-medium">{category.title}</h3>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          category.id as keyof NotificationPreferences,
                          checked
                        )
                      }
                      disabled={!preferences.enabled || !preferences.email_enabled}
                      aria-label={`Toggle ${category.title}`}
                    />
                  </div>

                  {isEnabled && (
                    <div className="ml-8 space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Examples:</p>
                      {category.examples.map((example, index) => (
                        <Badge key={index} variant="secondary" className="text-xs mr-2">
                          {example}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Frequency Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Frequency Preferences</CardTitle>
          <p className="text-sm text-gray-600">Control how often you receive notifications.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Instant</h4>
                <p className="text-xs text-gray-600">Real-time notifications</p>
              </div>
              <Switch
                checked={preferences.instant_notifications}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('instant_notifications', checked)
                }
                disabled={!preferences.enabled || !preferences.email_enabled}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Daily Digest</h4>
                <p className="text-xs text-gray-600">Once per day summary</p>
              </div>
              <Switch
                checked={preferences.daily_digest}
                onCheckedChange={(checked) => handlePreferenceChange('daily_digest', checked)}
                disabled={!preferences.enabled || !preferences.email_enabled}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Weekly Digest</h4>
                <p className="text-xs text-gray-600">Weekly summary</p>
              </div>
              <Switch
                checked={preferences.weekly_digest}
                onCheckedChange={(checked) => handlePreferenceChange('weekly_digest', checked)}
                disabled={!preferences.enabled || !preferences.email_enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <p className="text-sm text-gray-600">
            Set times when you don't want to receive notifications.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Enable Quiet Hours</h4>
              <p className="text-sm text-gray-600">Pause notifications during specified hours</p>
            </div>
            <Switch
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => handlePreferenceChange('quiet_hours_enabled', checked)}
              disabled={!preferences.enabled || !preferences.email_enabled}
            />
          </div>

          {preferences.quiet_hours_enabled && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Start Time</label>
                  <Select
                    value={preferences.quiet_hours_start}
                    onValueChange={(value) => handlePreferenceChange('quiet_hours_start', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">End Time</label>
                  <Select
                    value={preferences.quiet_hours_end}
                    onValueChange={(value) => handlePreferenceChange('quiet_hours_end', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Timezone</label>
                <Select
                  value={preferences.quiet_hours_timezone}
                  onValueChange={(value) => handlePreferenceChange('quiet_hours_timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Notifications will be paused from {preferences.quiet_hours_start} to{' '}
                  {preferences.quiet_hours_end} in your selected timezone.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Settings
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'Hide' : 'Show'}
            </Button>
          </CardTitle>
        </CardHeader>

        {showAdvanced && (
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Maximum Emails Per Day: {preferences.max_emails_per_day}
                </label>
                <Slider
                  value={[preferences.max_emails_per_day]}
                  onValueChange={([value]) => handlePreferenceChange('max_emails_per_day', value)}
                  max={50}
                  min={1}
                  step={1}
                  className="w-full"
                  disabled={!preferences.enabled || !preferences.email_enabled}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 email</span>
                  <span>50 emails</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium">Batch Notifications</h4>
                  <p className="text-xs text-gray-600">Group similar notifications together</p>
                </div>
                <Switch
                  checked={preferences.batch_notifications}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange('batch_notifications', checked)
                  }
                  disabled={!preferences.enabled || !preferences.email_enabled}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* GDPR Compliance */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-orange-800">
            <Shield className="h-5 w-5" />
            Privacy & Data Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-orange-700">
            You have full control over your email preferences. You can unsubscribe from marketing
            communications at any time while keeping important account and security notifications.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={disableMarketing}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              Disable Marketing Emails
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      {hasChanges && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-800">
                  You have unsaved changes to your notification preferences.
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadPreferences();
                    setHasChanges(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmailNotificationPreferences;
