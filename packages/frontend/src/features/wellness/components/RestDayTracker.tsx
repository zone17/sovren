import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWellnessPatterns } from '../hooks/useWellnessPatterns';

const REST_DAY_TARGET = 2;

export const RestDayTracker: React.FC = () => {
  const { data, isLoading, error } = useWellnessPatterns('7d');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Failed to load rest day data.
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Rest Days</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No activity tracked yet. Rest day tracking starts after your first week.
        </CardContent>
      </Card>
    );
  }

  const restDays = data.rest_days;
  const workDays = 7 - restDays;
  const restRatio = restDays / 7;
  const onTarget = restDays >= REST_DAY_TARGET;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Rest Days</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-3xl font-bold ${onTarget ? 'text-green-600' : 'text-orange-600'}`}>
            {restDays}
          </span>
          <span className="text-sm text-muted-foreground">
            / {REST_DAY_TARGET} target this week
          </span>
        </div>

        {/* Segmented bar */}
        <div
          className="flex h-3 rounded-full overflow-hidden mb-2"
          role="img"
          aria-label={`${workDays} work days, ${restDays} rest days this week`}
        >
          <div
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${((7 - restDays) / 7) * 100}%` }}
          />
          <div
            className="bg-green-400 transition-all duration-500"
            style={{ width: `${restRatio * 100}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{workDays} work days</span>
          <span>{restDays} rest days</span>
        </div>

        {!onTarget && (
          <p className="text-xs text-orange-600 mt-3">Consider scheduling a rest day this week.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default RestDayTracker;
