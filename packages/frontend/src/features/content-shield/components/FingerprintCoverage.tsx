import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFingerprintCoverage } from '../hooks/useFingerprintCoverage';

interface FingerprintCoverageProps {
  creatorId: string;
}

export const FingerprintCoverage: React.FC<FingerprintCoverageProps> = ({ creatorId }) => {
  const { data: response, isLoading, error } = useFingerprintCoverage(creatorId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Fingerprint Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !response) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Fingerprint Coverage</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Failed to load fingerprint coverage.
        </CardContent>
      </Card>
    );
  }

  const data = response.data;
  const coverage = data.coverage_percentage;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (coverage / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Fingerprint Coverage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="relative shrink-0">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              role="img"
              aria-label={`${coverage.toFixed(0)}% fingerprint coverage`}
            >
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={coverage >= 80 ? '#22c55e' : coverage >= 50 ? '#eab308' : '#ef4444'}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="transition-all duration-700 -rotate-90 origin-center"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-foreground">{coverage.toFixed(0)}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{data.total_fingerprinted}</p>
              <p className="text-xs text-muted-foreground">Fingerprinted</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{data.total_content}</p>
              <p className="text-xs text-muted-foreground">Total Content</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {data.total_content - data.total_fingerprinted}
              </p>
              <p className="text-xs text-muted-foreground">Unprotected</p>
            </div>
          </div>
        </div>

        {data.total_content - data.total_fingerprinted > 0 && (
          <p className="text-xs text-orange-600 mt-4">
            {data.total_content - data.total_fingerprinted} pieces of content are not yet
            fingerprinted. New content is automatically fingerprinted on publish.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
