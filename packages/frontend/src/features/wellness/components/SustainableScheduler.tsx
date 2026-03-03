import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useScheduleRecommendations } from '../hooks/useScheduleRecommendations';
import type { DayOfWeek } from '../types';

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const ALL_DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

export const SustainableScheduler: React.FC = () => {
  const { data, isLoading, error } = useScheduleRecommendations();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Failed to load schedule recommendations.
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Sustainable Schedule</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Schedule insights coming soon. Start posting to receive recommendations.
        </CardContent>
      </Card>
    );
  }

  const overPacing = data.current_posts_per_week > data.recommended_posts_per_week;
  const bufferLow = data.buffer_status === 'below_threshold';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Sustainable Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pace indicator */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div>
            <p className="text-sm font-medium text-gray-700">Posting Pace</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.current_posts_per_week}/week (recommended: {data.recommended_posts_per_week}
              /week)
            </p>
          </div>
          <Badge
            className={overPacing ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}
          >
            {overPacing ? 'Over pace' : 'On pace'}
          </Badge>
        </div>

        {/* Optimal days */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Best Days to Post</p>
          <div className="flex gap-1">
            {ALL_DAYS.map((day) => {
              const isOptimal = data.optimal_days.includes(day);
              return (
                <div
                  key={day}
                  className={`flex-1 py-1.5 text-center text-xs rounded ${
                    isOptimal ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  {DAY_LABELS[day]}
                </div>
              );
            })}
          </div>
        </div>

        {/* Optimal hours */}
        {data.optimal_hours.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Best Times</p>
            <p className="text-sm text-gray-700">{data.optimal_hours.map(formatHour).join(', ')}</p>
          </div>
        )}

        {/* Content buffer */}
        <div className={`p-3 rounded-lg ${bufferLow ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Content Buffer</span>
            <span className={`text-sm font-bold ${bufferLow ? 'text-red-600' : 'text-green-600'}`}>
              {data.content_buffer_days} days
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${bufferLow ? 'bg-red-500' : 'bg-green-500'}`}
              style={{
                width: `${Math.min((data.content_buffer_days / data.buffer_threshold) * 100, 100)}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Threshold: {data.buffer_threshold} days</p>
        </div>

        {/* Productive windows */}
        {data.productive_windows.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Productive Windows</p>
            <div className="space-y-1">
              {data.productive_windows.slice(0, 3).map((window, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded"
                >
                  <span className="text-gray-700 capitalize">{window.day}</span>
                  <span className="text-gray-500">
                    {window.start} - {window.end}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {(window.energy_score * 100).toFixed(0)}% energy
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SustainableScheduler;
