import { useEffect, useState } from 'react';

// Simple feature flags interface
interface FeatureFlags {
  enablePayments: boolean;
  enableAIRecommendations: boolean;
  enableNostrIntegration: boolean;
  enableExperimentalUI: boolean;
}

export function useFeatureFlags(): {
  flags: FeatureFlags | null;
  loading: boolean;
  error: string | null;
} {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/feature-flags')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch feature flags');
        return res.json();
      })
      .then((data: FeatureFlags) => setFlags(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  return { flags, loading, error };
}
