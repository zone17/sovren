/**
 * NotificationSettings Component
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import React, { useState, useCallback, useEffect } from 'react';
import { NotificationPreferences } from '../types';
import { getNotificationService } from '../services/NotificationService';
import { useToast } from '@/components/providers/NotificationProvider';

export interface NotificationSettingsProps {
  onClose?: () => void;
  className?: string;
}

/**
 * Settings panel for notification preferences
 */
export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  onClose,
  className = '',
}) => {
  const service = getNotificationService();
  const [preferences, setPreferences] = useState<NotificationPreferences>(service.getPreferences());
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Load preferences on mount
  useEffect(() => {
    setPreferences(service.getPreferences());
  }, [service]);

  // Handle preference change
  const handleChange = useCallback(
    (key: keyof NotificationPreferences, value: boolean | number) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  // Save preferences
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await service.updatePreferences(preferences);
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [service, preferences, onClose]);

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.warning('Desktop notifications are not supported in this browser');
      return;
    }

    if (Notification.permission === 'granted') {
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      handleChange('showDesktopNotifications', true);
    }
  }, [handleChange]);

  return (
    <div
      className={`bg-card rounded-lg shadow-lg p-6 ${className}`}
      role="dialog"
      aria-labelledby="settings-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 id="settings-title" className="text-xl font-semibold text-foreground">
          Notification Settings
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close settings"
            type="button"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Notification Types */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Notification Types</h3>
        <div className="space-y-3">
          <ToggleSwitch
            label="Mentions"
            description="When someone mentions you in a post"
            checked={preferences.enableMentions}
            onChange={(checked) => handleChange('enableMentions', checked)}
          />
          <ToggleSwitch
            label="Replies"
            description="When someone replies to your posts"
            checked={preferences.enableReplies}
            onChange={(checked) => handleChange('enableReplies', checked)}
          />
          <ToggleSwitch
            label="Reactions"
            description="When someone reacts to your posts"
            checked={preferences.enableReactions}
            onChange={(checked) => handleChange('enableReactions', checked)}
          />
          <ToggleSwitch
            label="Reposts"
            description="When someone reposts your content"
            checked={preferences.enableReposts}
            onChange={(checked) => handleChange('enableReposts', checked)}
          />
          <ToggleSwitch
            label="Direct Messages"
            description="When you receive a direct message"
            checked={preferences.enableDMs}
            onChange={(checked) => handleChange('enableDMs', checked)}
          />
          <ToggleSwitch
            label="New Followers"
            description="When someone follows you"
            checked={preferences.enableFollows}
            onChange={(checked) => handleChange('enableFollows', checked)}
          />
          <ToggleSwitch
            label="Zaps (Lightning Payments)"
            description="When you receive a Lightning payment"
            checked={preferences.enableZaps}
            onChange={(checked) => handleChange('enableZaps', checked)}
          />
        </div>
      </div>

      {/* Sound Settings */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Sound & Alerts</h3>
        <div className="space-y-3">
          <ToggleSwitch
            label="Play Sound"
            description="Play a sound when you receive notifications"
            checked={preferences.playSound}
            onChange={(checked) => handleChange('playSound', checked)}
          />
          {preferences.playSound && (
            <div className="ml-6 mt-2">
              <label className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={preferences.soundVolume}
                  onChange={(e) => handleChange('soundVolume', parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {Math.round(preferences.soundVolume * 100)}%
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Notifications */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Desktop Notifications</h3>
        <div className="space-y-3">
          <ToggleSwitch
            label="Desktop Notifications"
            description="Show desktop notifications for new activity"
            checked={preferences.showDesktopNotifications}
            onChange={(checked) => {
              if (checked && Notification.permission !== 'granted') {
                requestDesktopPermission();
              } else {
                handleChange('showDesktopNotifications', checked);
              }
            }}
          />
          {Notification.permission === 'denied' && (
            <p className="text-xs text-red-500 ml-6">
              Desktop notifications are blocked. Please enable them in your browser settings.
            </p>
          )}
        </div>
      </div>

      {/* Display Settings */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Display</h3>
        <div className="space-y-3">
          <ToggleSwitch
            label="Group by Date"
            description="Group notifications by day, week, etc."
            checked={preferences.groupByDate}
            onChange={(checked) => handleChange('groupByDate', checked)}
          />
          <ToggleSwitch
            label="Auto Mark as Read"
            description="Automatically mark notifications as read when you view them"
            checked={preferences.autoMarkRead}
            onChange={(checked) => handleChange('autoMarkRead', checked)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground hover:bg-accent rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            type="button"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          type="button"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

/**
 * Toggle switch component
 */
interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, description, checked, onChange }) => {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${checked ? 'bg-blue-600' : 'bg-muted'}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
};
