import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWellnessHeatmap } from '../hooks/useWellnessPatterns';
import type { HeatmapPeriod } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function intensityColor(intensity: number): string {
  if (intensity === 0) return 'bg-gray-100';
  if (intensity < 0.25) return 'bg-green-200';
  if (intensity < 0.5) return 'bg-green-400';
  if (intensity < 0.75) return 'bg-green-600';
  return 'bg-green-800';
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

interface WorkPatternHeatmapProps {
  period?: HeatmapPeriod;
}

export const WorkPatternHeatmap: React.FC<WorkPatternHeatmapProps> = ({ period = '7d' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<HeatmapPeriod>(period);
  const { data, isLoading, error } = useWellnessHeatmap(selectedPeriod);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Failed to load activity heatmap.
        </CardContent>
      </Card>
    );
  }

  if (!data || data.heatmap.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Work Activity</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          No activity data yet. Start working to see your patterns.
        </CardContent>
      </Card>
    );
  }

  const cellMap = new Map<string, { intensity: number; total_mins: number }>();
  data.heatmap.forEach((cell) => {
    cellMap.set(`${cell.day}-${cell.hour}`, {
      intensity: cell.intensity,
      total_mins: cell.total_mins,
    });
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Work Activity</CardTitle>
        <div className="flex gap-1">
          {(['7d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-2 py-1 text-xs rounded ${
                selectedPeriod === p
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-pressed={selectedPeriod === p}
            >
              {p}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex ml-10 mb-1">
                {HOURS.filter((h) => h % 3 === 0).map((h) => (
                  <span
                    key={h}
                    className="text-[10px] text-gray-400"
                    style={{ width: `${100 / 8}%` }}
                  >
                    {formatHour(h)}
                  </span>
                ))}
              </div>

              {/* Grid */}
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center mb-[2px]">
                  <span className="w-10 text-xs text-gray-500 text-right pr-2">{day}</span>
                  <div className="flex flex-1 gap-[2px]">
                    {HOURS.map((hour) => {
                      const cell = cellMap.get(`${dayIndex}-${hour}`);
                      const intensity = cell?.intensity ?? 0;
                      const mins = cell?.total_mins ?? 0;
                      return (
                        <Tooltip key={hour}>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex-1 aspect-square rounded-sm ${intensityColor(intensity)} cursor-default`}
                              role="gridcell"
                              aria-label={`${day} ${formatHour(hour)}: ${mins} minutes`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">
                              {day} {formatHour(hour)}
                            </p>
                            <p>{mins} min active</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-end mt-2 gap-1">
                <span className="text-[10px] text-gray-400 mr-1">Less</span>
                {[0, 0.15, 0.35, 0.6, 0.85].map((v) => (
                  <div key={v} className={`w-3 h-3 rounded-sm ${intensityColor(v)}`} />
                ))}
                <span className="text-[10px] text-gray-400 ml-1">More</span>
              </div>
            </div>
          </div>
        </TooltipProvider>

        {data.peak_hours && data.peak_hours.length > 0 && (
          <p className="text-xs text-gray-500 mt-3">
            Peak hours: {data.peak_hours.map(formatHour).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkPatternHeatmap;
