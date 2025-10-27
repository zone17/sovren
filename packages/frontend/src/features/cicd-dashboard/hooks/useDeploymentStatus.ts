/**
 * CI/CD Dashboard - useDeploymentStatus Hook
 *
 * React hook for managing deployment status and real-time updates.
 * Provides deployment data fetching, caching, and live monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getGitHubActionsService } from '../services';
import type { Deployment, GitHubWorkflowRun, WebSocketMessage } from '../types';

/**
 * Deployment status hook options
 */
interface UseDeploymentStatusOptions {
  /** Environment to monitor */
  environment?: 'staging' | 'production';

  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;

  /** Enable real-time updates */
  enableRealtime?: boolean;

  /** Deployment ID to monitor (for specific deployment tracking) */
  deploymentId?: string;
}

/**
 * Deployment status hook return value
 */
interface UseDeploymentStatusReturn {
  /** Current deployment (if any) */
  currentDeployment: Deployment | null;

  /** Recent deployments */
  recentDeployments: Deployment[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refresh deployments manually */
  refresh: () => Promise<void>;

  /** Trigger rollback */
  triggerRollback: (deploymentId: string, reason: string) => Promise<void>;

  /** Retry deployment */
  retryDeployment: (deploymentId: string) => Promise<void>;

  /** Cancel deployment */
  cancelDeployment: (deploymentId: string) => Promise<void>;
}

/**
 * Convert GitHub workflow run to Deployment
 */
function convertWorkflowRunToDeployment(
  run: GitHubWorkflowRun,
  environment: 'staging' | 'production'
): Deployment {
  const startTime = new Date(run.created_at);
  const endTime = run.updated_at ? new Date(run.updated_at) : undefined;
  const duration = endTime
    ? endTime.getTime() - startTime.getTime()
    : undefined;

  let status: Deployment['status'] = 'queued';
  if (run.status === 'completed') {
    if (run.conclusion === 'success') status = 'success';
    else if (run.conclusion === 'failure') status = 'failed';
    else if (run.conclusion === 'cancelled') status = 'cancelled';
  } else if (run.status === 'in_progress') {
    status = 'in_progress';
  }

  return {
    id: run.id.toString(),
    environment,
    status,
    commitSha: run.head_sha,
    commitMessage: run.head_commit.message,
    author: run.head_commit.author.name,
    authorEmail: run.head_commit.author.email,
    startTime,
    endTime,
    duration,
    workflowRunId: run.id,
    workflowName: run.name,
    stages: [],
    healthChecks: [],
    smokeTests: [],
    metrics: {
      filesChanged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      errorRate: 0,
      responseTimeP50: 0,
      responseTimeP95: 0,
      responseTimeP99: 0,
      healthCheckSuccessRate: 0,
      smokeTestPassRate: 0,
      totalSmokeTests: 0,
      passedSmokeTests: 0,
      failedSmokeTests: 0,
    },
    tags: [],
  };
}

/**
 * useDeploymentStatus Hook
 */
export function useDeploymentStatus(
  options: UseDeploymentStatusOptions = {}
): UseDeploymentStatusReturn {
  const {
    environment,
    refreshInterval = 10000, // Default: 10 seconds
    enableRealtime = true,
    deploymentId,
  } = options;

  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const [recentDeployments, setRecentDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch deployments from GitHub Actions
   */
  const fetchDeployments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const githubService = getGitHubActionsService();

      // Fetch workflow runs for backend deployment
      const response = await githubService.listWorkflowRuns(
        'backend-deployment.yml',
        {
          per_page: 10,
          status: 'completed',
        }
      );

      if (!isMountedRef.current) return;

      // Convert workflow runs to deployments
      const deployments = response.workflow_runs.map((run) => {
        // Determine environment from workflow run
        const runEnvironment =
          run.name.toLowerCase().includes('staging') ||
          run.head_branch === 'main'
            ? 'staging'
            : 'production';

        return convertWorkflowRunToDeployment(run, runEnvironment);
      });

      // Filter by environment if specified
      const filtered = environment
        ? deployments.filter((d) => d.environment === environment)
        : deployments;

      // Set recent deployments
      setRecentDeployments(filtered);

      // Set current deployment (in progress or most recent)
      const inProgress = filtered.find(
        (d) => d.status === 'in_progress' || d.status === 'queued'
      );
      setCurrentDeployment(inProgress || filtered[0] || null);

      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error('Failed to fetch deployments:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, [environment]);

  /**
   * Refresh deployments manually
   */
  const refresh = useCallback(async () => {
    await fetchDeployments();
  }, [fetchDeployments]);

  /**
   * Trigger rollback
   */
  const triggerRollback = useCallback(
    async (deploymentId: string, reason: string) => {
      try {
        const githubService = getGitHubActionsService();

        // Trigger rollback workflow
        await githubService.triggerWorkflowDispatch('automated-rollback.yml', {
          ref: 'main',
          inputs: {
            environment: environment || 'staging',
            reason,
          },
        });

        // Refresh deployments
        await fetchDeployments();
      } catch (err) {
        console.error('Failed to trigger rollback:', err);
        throw err;
      }
    },
    [environment, fetchDeployments]
  );

  /**
   * Retry deployment
   */
  const retryDeployment = useCallback(
    async (deploymentId: string) => {
      try {
        const githubService = getGitHubActionsService();

        // Re-run workflow
        await githubService.rerunWorkflow(parseInt(deploymentId, 10));

        // Refresh deployments
        await fetchDeployments();
      } catch (err) {
        console.error('Failed to retry deployment:', err);
        throw err;
      }
    },
    [fetchDeployments]
  );

  /**
   * Cancel deployment
   */
  const cancelDeployment = useCallback(
    async (deploymentId: string) => {
      try {
        const githubService = getGitHubActionsService();

        // Cancel workflow
        await githubService.cancelWorkflowRun(parseInt(deploymentId, 10));

        // Refresh deployments
        await fetchDeployments();
      } catch (err) {
        console.error('Failed to cancel deployment:', err);
        throw err;
      }
    },
    [fetchDeployments]
  );

  /**
   * Handle real-time updates
   */
  const handleRealtimeUpdate = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === 'deployment_updated' || message.type === 'deployment_completed') {
        // Refresh deployments when updates received
        fetchDeployments();
      }
    },
    [fetchDeployments]
  );

  /**
   * Setup polling and real-time updates
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchDeployments();

    // Setup polling
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchDeployments();
      }, refreshInterval);
    }

    return () => {
      isMountedRef.current = false;

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchDeployments, refreshInterval]);

  return {
    currentDeployment,
    recentDeployments,
    isLoading,
    error,
    refresh,
    triggerRollback,
    retryDeployment,
    cancelDeployment,
  };
}
