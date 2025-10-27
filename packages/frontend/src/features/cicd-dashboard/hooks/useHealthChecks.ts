/**
 * CI/CD Dashboard - useHealthChecks Hook
 *
 * React hook for monitoring health check endpoints across environments.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getHealthCheckService } from '../services';
import type { HealthCheckResult } from '../types';

interface UseHealthChecksOptions {
  environment?: 'staging' | 'production' | 'all';
  pollingInterval?: number;
  enabled?: boolean;
}

interface UseHealthChecksReturn {
  healthChecks: HealthCheckResult[];
  isHealthy: boolean;
  isDegraded: boolean;
  isUnhealthy: boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useHealthChecks(
  options: UseHealthChecksOptions = {}
): UseHealthChecksReturn {
  const {
    environment = 'all',
    pollingInterval = 30000,
    enabled = true,
  } = options;

  const [healthChecks, setHealthChecks] = useState<HealthCheckResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const fetchHealthChecks = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const healthService = getHealthCheckService();

      let results: HealthCheckResult[];

      if (environment === 'all') {
        const { staging, production } = await healthService.checkAllEnvironments();
        results = [...staging, ...production];
      } else {
        results = await healthService.checkEnvironment(environment);
      }

      if (!isMountedRef.current) return;

      setHealthChecks(results);
      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error('Failed to fetch health checks:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, [environment, enabled]);

  const refresh = useCallback(async () => {
    await fetchHealthChecks();
  }, [fetchHealthChecks]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchHealthChecks();

    const intervalId = setInterval(fetchHealthChecks, pollingInterval);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchHealthChecks, pollingInterval]);

  const isHealthy = healthChecks.every((check) => check.status === 'healthy');
  const isDegraded = healthChecks.some((check) => check.status === 'degraded');
  const isUnhealthy = healthChecks.some((check) => check.status === 'unhealthy');

  return {
    healthChecks,
    isHealthy,
    isDegraded,
    isUnhealthy,
    isLoading,
    error,
    refresh,
  };
}
