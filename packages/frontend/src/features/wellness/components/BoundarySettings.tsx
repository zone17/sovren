import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useBoundaries, useUpdateBoundaries } from '../hooks/useBoundaries';
import type { AvailabilityStatus, BoundaryConfig, DayOfWeek } from '../types';

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'creating', label: 'Creating' },
  { value: 'offline', label: 'Offline' },
];

const DEFAULT_BOUNDARIES: BoundaryConfig = {
  focus_hours: {
    enabled: false,
    start: '09:00',
    end: '17:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  },
  weekly_engagement_budget_mins: 120,
  engagement_used_mins: null, // Not yet implemented — null signals "not available"
  dnd_mode: {
    active: false,
    auto_response_enabled: false,
    auto_response_template: "I'm currently in focus mode. I'll respond when I'm back.",
  },
  availability_status: 'available',
  availability_public: true,
  notification_batching: true,
};

export const BoundarySettings: React.FC = () => {
  const { data, isLoading, error } = useBoundaries();
  const updateMutation = useUpdateBoundaries();
  const [form, setForm] = useState<BoundaryConfig | null>(null);

  useEffect(() => {
    if (data) {
      setForm(data);
    } else if (!isLoading && !error) {
      // No data yet — show form with sensible defaults
      setForm(DEFAULT_BOUNDARIES);
    }
  }, [data, isLoading, error]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Boundaries</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Boundaries</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Failed to load boundary settings.
        </CardContent>
      </Card>
    );
  }

  // form may be null briefly while useEffect runs — show skeleton
  if (!form) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({
      focus_hours: form.focus_hours,
      weekly_engagement_budget_mins: form.weekly_engagement_budget_mins,
      dnd_mode: form.dnd_mode,
      availability_status: form.availability_status,
      notification_batching: form.notification_batching,
    });
  };

  const toggleDay = (day: DayOfWeek) => {
    setForm((prev) => {
      if (!prev) return prev;
      const days = prev.focus_hours.days.includes(day)
        ? prev.focus_hours.days.filter((d) => d !== day)
        : [...prev.focus_hours.days, day];
      return { ...prev, focus_hours: { ...prev.focus_hours, days } };
    });
  };

  const safeMax = Number(form.weekly_engagement_budget_mins) || 0;
  const safeCurrent = Number(form.engagement_used_mins) || 0;
  const engagementPercent =
    safeMax > 0 ? Math.min(Math.max((safeCurrent / safeMax) * 100, 0), 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Boundaries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Focus Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Focus Hours</Label>
            <Switch
              checked={form.focus_hours.enabled}
              onCheckedChange={(checked) =>
                setForm((prev) =>
                  prev ? { ...prev, focus_hours: { ...prev.focus_hours, enabled: checked } } : prev
                )
              }
              aria-label="Toggle focus hours"
            />
          </div>
          {form.focus_hours.enabled && (
            <div className="space-y-2 pl-1">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={form.focus_hours.start}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? { ...prev, focus_hours: { ...prev.focus_hours, start: e.target.value } }
                        : prev
                    )
                  }
                  className="w-28"
                  aria-label="Focus hours start time"
                />
                <span className="text-xs text-gray-500">to</span>
                <Input
                  type="time"
                  value={form.focus_hours.end}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? { ...prev, focus_hours: { ...prev.focus_hours, end: e.target.value } }
                        : prev
                    )
                  }
                  className="w-28"
                  aria-label="Focus hours end time"
                />
              </div>
              <div className="flex gap-1">
                {DAYS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleDay(value)}
                    className={`flex-1 py-1 text-xs rounded ${
                      form.focus_hours.days.includes(value)
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'bg-gray-50 text-gray-400'
                    }`}
                    aria-pressed={form.focus_hours.days.includes(value)}
                    aria-label={`${label} focus hours`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Engagement Budget */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Weekly Engagement Budget</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={1440}
              value={form.weekly_engagement_budget_mins}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, weekly_engagement_budget_mins: parseInt(e.target.value) || 0 }
                    : prev
                )
              }
              className="w-24"
              aria-label="Weekly engagement budget in minutes"
            />
            <span className="text-xs text-gray-500">min/week</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                engagementPercent > 90
                  ? 'bg-red-500'
                  : engagementPercent > 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${engagementPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            {form.engagement_used_mins !== null
              ? `${form.engagement_used_mins} / ${form.weekly_engagement_budget_mins} min used`
              : `${form.weekly_engagement_budget_mins} min budget (tracking coming soon)`}
          </p>
        </div>

        {/* DND Mode */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Do Not Disturb</Label>
            <Switch
              checked={form.dnd_mode.active}
              onCheckedChange={(active) =>
                setForm((prev) =>
                  prev ? { ...prev, dnd_mode: { ...prev.dnd_mode, active } } : prev
                )
              }
              aria-label="Toggle do not disturb"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Auto-response</Label>
            <Switch
              checked={form.dnd_mode.auto_response_enabled}
              onCheckedChange={(auto_response_enabled) =>
                setForm((prev) =>
                  prev ? { ...prev, dnd_mode: { ...prev.dnd_mode, auto_response_enabled } } : prev
                )
              }
              aria-label="Toggle auto-response"
            />
          </div>
          {form.dnd_mode.auto_response_enabled && (
            <Textarea
              value={form.dnd_mode.auto_response_template}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        dnd_mode: { ...prev.dnd_mode, auto_response_template: e.target.value },
                      }
                    : prev
                )
              }
              rows={2}
              className="text-sm"
              placeholder="Auto-response message..."
              aria-label="Auto-response message"
            />
          )}
        </div>

        {/* Availability Status */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() =>
                  setForm((prev) => (prev ? { ...prev, availability_status: value } : prev))
                }
                className={`flex-1 py-2 text-xs rounded ${
                  form.availability_status === value
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
                aria-pressed={form.availability_status === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification Batching */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Batch Notifications</Label>
          <Switch
            checked={form.notification_batching}
            onCheckedChange={(notification_batching) =>
              setForm((prev) => (prev ? { ...prev, notification_batching } : prev))
            }
            aria-label="Toggle notification batching"
          />
        </div>

        {/* Save button */}
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
          {updateMutation.isPending ? 'Saving...' : 'Save Boundaries'}
        </Button>

        {updateMutation.isSuccess && (
          <p className="text-xs text-green-600 text-center">Boundaries saved.</p>
        )}
        {updateMutation.isError && (
          <p className="text-xs text-red-600 text-center">Failed to save. Please try again.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default BoundarySettings;
