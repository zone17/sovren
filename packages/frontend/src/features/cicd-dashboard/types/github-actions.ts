/**
 * CI/CD Dashboard - GitHub Actions API Type Definitions
 *
 * Type definitions for GitHub Actions REST API responses.
 * Based on GitHub API v3 (REST) documentation.
 */

/**
 * GitHub Actions workflow
 */
export interface GitHubWorkflow {
  /** Workflow ID */
  id: number;

  /** Workflow node ID */
  node_id: string;

  /** Workflow name */
  name: string;

  /** Workflow file path */
  path: string;

  /** Workflow state */
  state: 'active' | 'deleted' | 'disabled_fork' | 'disabled_inactivity' | 'disabled_manually';

  /** Workflow creation timestamp */
  created_at: string;

  /** Workflow last update timestamp */
  updated_at: string;

  /** Workflow URL */
  url: string;

  /** Workflow HTML URL */
  html_url: string;

  /** Workflow badge URL */
  badge_url: string;
}

/**
 * GitHub Actions workflow run
 */
export interface GitHubWorkflowRun {
  /** Run ID */
  id: number;

  /** Run name */
  name: string;

  /** Run node ID */
  node_id: string;

  /** Run number */
  run_number: number;

  /** Run attempt number */
  run_attempt: number;

  /** Event that triggered the run */
  event: string;

  /** Run status */
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';

  /** Run conclusion */
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;

  /** Workflow ID */
  workflow_id: number;

  /** Check suite ID */
  check_suite_id: number;

  /** Check suite node ID */
  check_suite_node_id: string;

  /** Run URL */
  url: string;

  /** Run HTML URL */
  html_url: string;

  /** Pull requests associated with this run */
  pull_requests: GitHubPullRequest[];

  /** Run creation timestamp */
  created_at: string;

  /** Run update timestamp */
  updated_at: string;

  /** Run start timestamp */
  run_started_at: string;

  /** Jobs URL */
  jobs_url: string;

  /** Logs URL */
  logs_url: string;

  /** Check suite URL */
  check_suite_url: string;

  /** Artifacts URL */
  artifacts_url: string;

  /** Cancel URL */
  cancel_url: string;

  /** Rerun URL */
  rerun_url: string;

  /** Previous attempt URL */
  previous_attempt_url: string | null;

  /** Workflow URL */
  workflow_url: string;

  /** Head commit */
  head_commit: GitHubCommit;

  /** Repository */
  repository: GitHubRepository;

  /** Head repository */
  head_repository: GitHubRepository;

  /** Head branch */
  head_branch: string;

  /** Head SHA */
  head_sha: string;

  /** Path */
  path: string;

  /** Display title */
  display_title: string;

  /** Actor */
  actor: GitHubUser;

  /** Triggering actor */
  triggering_actor: GitHubUser;
}

/**
 * GitHub Actions workflow job
 */
export interface GitHubWorkflowJob {
  /** Job ID */
  id: number;

  /** Run ID */
  run_id: number;

  /** Job URL */
  url: string;

  /** Job HTML URL */
  html_url: string;

  /** Job node ID */
  node_id: string;

  /** Job name */
  name: string;

  /** Job status */
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';

  /** Job conclusion */
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;

  /** Job start timestamp */
  started_at: string;

  /** Job completion timestamp */
  completed_at: string | null;

  /** Job steps */
  steps: GitHubWorkflowStep[];

  /** Check run URL */
  check_run_url: string;

  /** Job labels */
  labels: string[];

  /** Runner ID */
  runner_id: number | null;

  /** Runner name */
  runner_name: string | null;

  /** Runner group ID */
  runner_group_id: number | null;

  /** Runner group name */
  runner_group_name: string | null;
}

/**
 * GitHub Actions workflow step
 */
export interface GitHubWorkflowStep {
  /** Step name */
  name: string;

  /** Step status */
  status: 'queued' | 'in_progress' | 'completed';

  /** Step conclusion */
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null;

  /** Step number */
  number: number;

  /** Step start timestamp */
  started_at: string | null;

  /** Step completion timestamp */
  completed_at: string | null;
}

/**
 * GitHub pull request (minimal info from workflow run)
 */
export interface GitHubPullRequest {
  /** PR URL */
  url: string;

  /** PR ID */
  id: number;

  /** PR number */
  number: number;

  /** PR head ref */
  head: {
    ref: string;
    sha: string;
    repo: {
      id: number;
      url: string;
      name: string;
    };
  };

  /** PR base ref */
  base: {
    ref: string;
    sha: string;
    repo: {
      id: number;
      url: string;
      name: string;
    };
  };
}

/**
 * GitHub commit
 */
export interface GitHubCommit {
  /** Commit ID */
  id: string;

  /** Commit tree ID */
  tree_id: string;

  /** Commit message */
  message: string;

  /** Commit timestamp */
  timestamp: string;

  /** Commit author */
  author: {
    name: string;
    email: string;
  };

  /** Committer */
  committer: {
    name: string;
    email: string;
  };
}

/**
 * GitHub repository (minimal info)
 */
export interface GitHubRepository {
  /** Repository ID */
  id: number;

  /** Repository node ID */
  node_id: string;

  /** Repository name */
  name: string;

  /** Repository full name */
  full_name: string;

  /** Repository owner */
  owner: GitHubUser;

  /** Private repository flag */
  private: boolean;

  /** Repository HTML URL */
  html_url: string;

  /** Repository description */
  description: string | null;

  /** Fork flag */
  fork: boolean;

  /** Repository URL */
  url: string;
}

/**
 * GitHub user
 */
export interface GitHubUser {
  /** User login */
  login: string;

  /** User ID */
  id: number;

  /** User node ID */
  node_id: string;

  /** User avatar URL */
  avatar_url: string;

  /** User type */
  type: 'User' | 'Bot' | 'Organization';

  /** User site admin flag */
  site_admin: boolean;

  /** User HTML URL */
  html_url: string;
}

/**
 * GitHub Actions workflow runs list response
 */
export interface GitHubWorkflowRunsResponse {
  /** Total count */
  total_count: number;

  /** Workflow runs */
  workflow_runs: GitHubWorkflowRun[];
}

/**
 * GitHub Actions workflow jobs list response
 */
export interface GitHubWorkflowJobsResponse {
  /** Total count */
  total_count: number;

  /** Workflow jobs */
  jobs: GitHubWorkflowJob[];
}

/**
 * GitHub Actions artifacts list response
 */
export interface GitHubArtifactsResponse {
  /** Total count */
  total_count: number;

  /** Artifacts */
  artifacts: GitHubArtifact[];
}

/**
 * GitHub Actions artifact
 */
export interface GitHubArtifact {
  /** Artifact ID */
  id: number;

  /** Artifact node ID */
  node_id: string;

  /** Artifact name */
  name: string;

  /** Artifact size in bytes */
  size_in_bytes: number;

  /** Artifact URL */
  url: string;

  /** Archive download URL */
  archive_download_url: string;

  /** Artifact expired flag */
  expired: boolean;

  /** Artifact creation timestamp */
  created_at: string;

  /** Artifact expiration timestamp */
  expires_at: string;

  /** Artifact update timestamp */
  updated_at: string;

  /** Workflow run */
  workflow_run: {
    id: number;
    repository_id: number;
    head_repository_id: number;
    head_branch: string;
    head_sha: string;
  };
}

/**
 * GitHub API error response
 */
export interface GitHubAPIError {
  /** Error message */
  message: string;

  /** Documentation URL */
  documentation_url: string;

  /** Error status code */
  status?: number;

  /** Error details */
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

/**
 * GitHub Actions rate limit
 */
export interface GitHubRateLimit {
  /** Remaining requests */
  limit: number;

  /** Used requests */
  used: number;

  /** Remaining requests */
  remaining: number;

  /** Reset timestamp */
  reset: number;
}

/**
 * GitHub Actions workflow dispatch event
 */
export interface GitHubWorkflowDispatchRequest {
  /** Git ref (branch/tag) */
  ref: string;

  /** Workflow inputs */
  inputs?: Record<string, string>;
}

/**
 * Query parameters for listing workflow runs
 */
export interface GitHubWorkflowRunsQuery {
  /** Actor filter */
  actor?: string;

  /** Branch filter */
  branch?: string;

  /** Event filter */
  event?: string;

  /** Status filter */
  status?: 'queued' | 'in_progress' | 'completed';

  /** Results per page */
  per_page?: number;

  /** Page number */
  page?: number;

  /** Created date filter (ISO 8601 timestamp) */
  created?: string;

  /** Exclude pull requests */
  exclude_pull_requests?: boolean;

  /** Check suite ID filter */
  check_suite_id?: number;

  /** Head SHA filter */
  head_sha?: string;
}
