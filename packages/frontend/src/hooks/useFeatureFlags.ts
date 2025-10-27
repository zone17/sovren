import { useEffect, useState } from 'react';

// Simple feature flags interface
export interface FeatureFlags {
  enablePayments: boolean;
  enableAIRecommendations: boolean;
  enableNostrIntegration: boolean;
  enableExperimentalUI: boolean;
  enableAdvancedAnalytics: boolean;
  enableRealTimeUpdates: boolean;
  enableExportFeatures: boolean;
  enableNotifications: boolean;
  enableBackendIntegration: boolean;
}

export function useFeatureFlags(): {
  flags: FeatureFlags | null;
  loading: boolean;
  error: string | null;
} {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    const defaultFlags: FeatureFlags = {
      enableAdvancedAnalytics: true,
      enableRealTimeUpdates: true,
      enableExportFeatures: true,
      enableNotifications: true,
      enableBackendIntegration: true,
      enablePayments: true,
      enableAIRecommendations: true,
      enableNostrIntegration: true,
      enableExperimentalUI: true,
    };

    // Use default flags for now instead of API call
    setTimeout(() => {
      setFlags(defaultFlags);
      setLoading(false);
    }, 100);
  }, []);

  return { flags, loading, error };
}
