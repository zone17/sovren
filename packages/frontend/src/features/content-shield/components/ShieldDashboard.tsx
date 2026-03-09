import React from 'react';
import { useAuth } from '@/features/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ContentShieldErrorBoundary } from '../ErrorBoundary';
import { AlertsFeed } from './AlertsFeed';
import { FingerprintCoverage } from './FingerprintCoverage';

export const ShieldDashboard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const creatorId = user?.nostr_pubkey;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!creatorId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Please log in to view your Content Shield dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ContentShieldErrorBoundary>
      <div className="space-y-6 p-6 bg-background min-h-screen">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Content Shield</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protect your content with cryptographic provenance and copy detection.
          </p>
        </div>

        {/* Coverage */}
        <FingerprintCoverage creatorId={creatorId} />

        {/* Alerts */}
        <AlertsFeed />
      </div>
    </ContentShieldErrorBoundary>
  );
};
