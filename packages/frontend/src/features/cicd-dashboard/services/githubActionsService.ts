/**
 * CI/CD Dashboard - GitHub Actions API Service
 *
 * Service for interacting with GitHub Actions REST API to fetch workflow data,
 * monitor deployments, and trigger actions.
 *
 * Uses the Octokit REST API client for type-safe GitHub API interactions.
 */

import type {
  GitHubWorkflow,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
  GitHubWorkflowJob,
  GitHubWorkflowJobsResponse,
  GitHubWorkflowRunsQuery,
  GitHubWorkflowDispatchRequest,
  GitHubAPIError,
} from '../types';

/**
 * GitHub repository configuration
 */
interface GitHubRepoConfig {
  owner: string;
  repo: string;
  token: string;
}

/**
 * GitHub Actions service class
 */
export class GitHubActionsService {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;
  private readonly baseUrl = 'https://api.github.com';
  private readonly apiVersion = '2022-11-28';

  constructor(config: GitHubRepoConfig) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.token = config.token;
  }

  /**
   * Make authenticated GitHub API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': this.apiVersion,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error: GitHubAPIError = await response.json();
        throw new Error(`GitHub API error: ${error.message} (${response.status})`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown GitHub API error');
    }
  }

  /**
   * List all workflows for the repository
   */
  async listWorkflows(): Promise<GitHubWorkflow[]> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/workflows`;
    const response = await this.request<{ workflows: GitHubWorkflow[] }>(endpoint);
    return response.workflows;
  }

  /**
   * Get workflow by ID or filename
   */
  async getWorkflow(workflowId: number | string): Promise<GitHubWorkflow> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}`;
    return this.request<GitHubWorkflow>(endpoint);
  }

  /**
   * List workflow runs
   */
  async listWorkflowRuns(
    workflowId?: number | string,
    query?: GitHubWorkflowRunsQuery
  ): Promise<GitHubWorkflowRunsResponse> {
    const params = new URLSearchParams();

    if (query?.actor) params.append('actor', query.actor);
    if (query?.branch) params.append('branch', query.branch);
    if (query?.event) params.append('event', query.event);
    if (query?.status) params.append('status', query.status);
    if (query?.per_page) params.append('per_page', query.per_page.toString());
    if (query?.page) params.append('page', query.page.toString());
    if (query?.created) params.append('created', query.created);
    if (query?.exclude_pull_requests) {
      params.append('exclude_pull_requests', 'true');
    }
    if (query?.check_suite_id) {
      params.append('check_suite_id', query.check_suite_id.toString());
    }
    if (query?.head_sha) params.append('head_sha', query.head_sha);

    const queryString = params.toString();
    const endpoint = workflowId
      ? `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs${queryString ? `?${queryString}` : ''}`
      : `/repos/${this.owner}/${this.repo}/actions/runs${queryString ? `?${queryString}` : ''}`;

    return this.request<GitHubWorkflowRunsResponse>(endpoint);
  }

  /**
   * Get a specific workflow run
   */
  async getWorkflowRun(runId: number): Promise<GitHubWorkflowRun> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}`;
    return this.request<GitHubWorkflowRun>(endpoint);
  }

  /**
   * List jobs for a workflow run
   */
  async listWorkflowJobs(
    runId: number,
    filter?: 'latest' | 'all'
  ): Promise<GitHubWorkflowJobsResponse> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs${filter === 'latest' ? '?filter=latest' : ''}`;
    return this.request<GitHubWorkflowJobsResponse>(endpoint);
  }

  /**
   * Get a specific job
   */
  async getJob(jobId: number): Promise<GitHubWorkflowJob> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/jobs/${jobId}`;
    return this.request<GitHubWorkflowJob>(endpoint);
  }

  /**
   * Download job logs
   */
  async downloadJobLogs(jobId: number): Promise<string> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/jobs/${jobId}/logs`;

    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': this.apiVersion,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to download logs: ${response.status}`);
    }

    return response.text();
  }

  /**
   * Download workflow run logs (all jobs)
   */
  async downloadWorkflowRunLogs(runId: number): Promise<Blob> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/logs`;

    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': this.apiVersion,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to download logs: ${response.status}`);
    }

    return response.blob();
  }

  /**
   * Cancel a workflow run
   */
  async cancelWorkflowRun(runId: number): Promise<void> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/cancel`;
    await this.request<void>(endpoint, { method: 'POST' });
  }

  /**
   * Re-run a workflow
   */
  async rerunWorkflow(runId: number): Promise<void> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/rerun`;
    await this.request<void>(endpoint, { method: 'POST' });
  }

  /**
   * Re-run failed jobs only
   */
  async rerunFailedJobs(runId: number): Promise<void> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/rerun-failed-jobs`;
    await this.request<void>(endpoint, { method: 'POST' });
  }

  /**
   * Trigger workflow dispatch event
   */
  async triggerWorkflowDispatch(
    workflowId: number | string,
    dispatch: GitHubWorkflowDispatchRequest
  ): Promise<void> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`;
    await this.request<void>(endpoint, {
      method: 'POST',
      body: JSON.stringify(dispatch),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get workflow run attempt
   */
  async getWorkflowRunAttempt(runId: number, attemptNumber: number): Promise<GitHubWorkflowRun> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/attempts/${attemptNumber}`;
    return this.request<GitHubWorkflowRun>(endpoint);
  }

  /**
   * List workflow run jobs for specific attempt
   */
  async listWorkflowRunAttemptJobs(
    runId: number,
    attemptNumber: number
  ): Promise<GitHubWorkflowJobsResponse> {
    const endpoint = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/attempts/${attemptNumber}/jobs`;
    return this.request<GitHubWorkflowJobsResponse>(endpoint);
  }
}

/**
 * Singleton instance factory
 */
let githubActionsServiceInstance: GitHubActionsService | null = null;

/**
 * Initialize GitHub Actions service
 */
export function initGitHubActionsService(config: GitHubRepoConfig): GitHubActionsService {
  githubActionsServiceInstance = new GitHubActionsService(config);
  return githubActionsServiceInstance;
}

/**
 * Get GitHub Actions service instance
 */
export function getGitHubActionsService(): GitHubActionsService {
  if (!githubActionsServiceInstance) {
    throw new Error('GitHubActionsService not initialized. Call initGitHubActionsService first.');
  }
  return githubActionsServiceInstance;
}

/**
 * Default export for convenience
 */
export default {
  init: initGitHubActionsService,
  getInstance: getGitHubActionsService,
};
