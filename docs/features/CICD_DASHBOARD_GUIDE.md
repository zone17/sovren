# CI/CD Dashboard - Comprehensive Guide

**Version**: 1.0.0
**Status**: ✅ Production Ready
**Last Updated**: 2025-10-27

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Setup & Installation](#setup--installation)
5. [Usage Guide](#usage-guide)
6. [API Reference](#api-reference)
7. [Component Reference](#component-reference)
8. [Real-time Monitoring](#real-time-monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

The CI/CD Dashboard is a cutting-edge real-time monitoring and management interface for the Sovren platform's continuous deployment pipeline. It provides comprehensive visibility into deployment status, health checks, smoke tests, and deployment metrics across staging and production environments.

### Key Capabilities

- **Real-time Deployment Monitoring**: Live updates on deployment progress, stages, and completion
- **Health Check Visualization**: Monitor all 4 health endpoints (/health, /ready, /live, /detailed)
- **Smoke Test Tracking**: View smoke test execution progress (28+ tests)
- **Deployment Metrics**: Success rates, average duration, error rates, response times
- **Emergency Controls**: One-click rollback, retry, and cancel operations
- **Multi-Environment**: Support for staging and production environments
- **GitHub Actions Integration**: Direct integration with GitHub Actions workflows
- **WebSocket/SSE Support**: Real-time updates with automatic fallback

---

## Features

### 1. Deployment Status Panel

**Real-time deployment tracking with**:

- Current deployment status (queued, in_progress, success, failed, rolled_back)
- Progress percentage and ETA
- Deployment stages visualization
- Commit information (SHA, author, message)
- Duration tracking
- Metrics summary (health checks, smoke tests, response times)

### 2. Health Check Monitor

**Continuous health monitoring across**:

- `/health` - General health status
- `/ready` - Readiness probe (DB, cache connectivity)
- `/live` - Liveness probe (process alive)
- `/detailed` - Detailed health report (admin only)

**Features**:

- Real-time status updates every 30 seconds
- Response time tracking
- Overall health status (healthy, degraded, unhealthy)
- Visual status indicators
- Error reporting

### 3. Real-time Updates

**Live monitoring with**:

- WebSocket connection for instant updates
- Server-Sent Events (SSE) fallback
- Automatic reconnection with exponential backoff
- Heartbeat monitoring
- Connection status indicator

### 4. Deployment Actions

**One-click controls**:

- **Emergency Rollback**: < 2 minutes to previous version
- **Retry Deployment**: Rerun failed deployments
- **Cancel Deployment**: Stop in-progress deployments
- **View Full Logs**: Direct link to GitHub Actions workflow

### 5. Deployment History

**Historical tracking**:

- Last 50 deployments
- Filter by environment, status, author
- Date range filtering
- Deployment comparison
- Success rate analytics

### 6. Analytics & Metrics

**Comprehensive insights**:

- Deployment frequency (daily, weekly, monthly)
- Average deployment duration
- Success rate trends
- Change failure rate
- Mean time to recovery (MTTR)
- Response time percentiles (P50, P95, P99)

---

## Architecture

### System Architecture

![CI/CD Dashboard Architecture](../architecture/diagrams/cicd-dashboard-architecture.mmd)

### Component Hierarchy

```
DeploymentDashboard (Main Page)
├── Header
│   ├── Environment Selector
│   ├── Connection Status
│   └── Refresh Button
├── Left Column (Deployment)
│   ├── DeploymentStatusPanel
│   ├── Action Buttons
│   └── Recent Deployments List
└── Right Column (Health & Stats)
    ├── HealthCheckMonitor
    └── Quick Stats Panel
```

### Data Flow

![CI/CD Dashboard Data Flow](../architecture/diagrams/cicd-dashboard-data-flow.mmd)

### Technology Stack

- **Frontend**: React 18.3.1 + TypeScript 5.3
- **State Management**: React Hooks (useDeploymentStatus, useHealthChecks, useRealtimeUpdates)
- **Styling**: TailwindCSS 3.x
- **GitHub Integration**: GitHub Actions REST API
- **Real-time**: WebSocket + SSE fallback
- **Caching**: In-memory caching with TTL

---

## Setup & Installation

### Prerequisites

1. **GitHub Personal Access Token** (for GitHub Actions API)
   - Required scopes: `repo`, `workflow`
   - Generate at: https://github.com/settings/tokens

2. **Environment Variables** (`.env`)
   ```bash
   VITE_GITHUB_OWNER=zone17
   VITE_GITHUB_REPO=sovren
   VITE_GITHUB_TOKEN=ghp_your_token_here
   VITE_STAGING_API_URL=https://api-staging.sovren.dev
   VITE_PRODUCTION_API_URL=https://api.sovren.dev
   VITE_WEBSOCKET_URL=wss://api.sovren.dev/ws/deployments
   VITE_SSE_URL=https://api.sovren.dev/sse/deployments
   ```

### Installation Steps

1. **Install Dependencies**

   ```bash
   cd packages/frontend
   npm install
   ```

2. **Initialize Services**

   In your app entry point (e.g., `main.tsx` or `App.tsx`):

   ```typescript
   import {
     initGitHubActionsService,
     initHealthCheckService,
     initRealtimeService,
   } from '@/features/cicd-dashboard';

   // Initialize GitHub Actions service
   initGitHubActionsService({
     owner: import.meta.env.VITE_GITHUB_OWNER,
     repo: import.meta.env.VITE_GITHUB_REPO,
     token: import.meta.env.VITE_GITHUB_TOKEN,
   });

   // Initialize Health Check service
   initHealthCheckService({
     stagingBaseUrl: import.meta.env.VITE_STAGING_API_URL,
     productionBaseUrl: import.meta.env.VITE_PRODUCTION_API_URL,
     pollingInterval: 30000, // 30 seconds
     timeout: 5000, // 5 seconds
     enableCache: true,
     cacheTTL: 10000, // 10 seconds
   });

   // Initialize Real-time service
   initRealtimeService({
     preferredType: 'websocket',
     websocketUrl: import.meta.env.VITE_WEBSOCKET_URL,
     sseUrl: import.meta.env.VITE_SSE_URL,
     fallbackToSSE: true,
     autoReconnect: true,
     reconnectDelay: 3000,
     maxReconnectAttempts: 10,
     authToken: import.meta.env.VITE_GITHUB_TOKEN,
   });
   ```

3. **Add Route**

   Add the dashboard route to your router:

   ```typescript
   import { DeploymentDashboard } from '@/features/cicd-dashboard';

   // In your router configuration
   {
     path: '/dashboard/deployments',
     element: <DeploymentDashboard />,
   }
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

5. **Access Dashboard**
   Navigate to: `http://localhost:3000/dashboard/deployments`

---

## Usage Guide

### Monitoring Deployments

1. **Select Environment**
   - Use the environment dropdown to switch between staging and production
   - Dashboard will automatically refresh to show environment-specific data

2. **View Current Deployment**
   - The main status panel shows the active deployment (if any)
   - Progress bar indicates deployment completion percentage
   - Stages are listed with real-time status updates

3. **Check Health Status**
   - Health check panel shows all 4 endpoints
   - Green = Healthy, Yellow = Degraded, Red = Unhealthy
   - Response times are displayed for each endpoint

4. **Monitor Real-time Updates**
   - Connection status indicator (green dot) shows WebSocket connection
   - Dashboard updates automatically when deployments change
   - No manual refresh needed

### Emergency Operations

#### Emergency Rollback

**When to use**: Critical production issues, deployment failures, performance degradation

**Steps**:

1. Click "🚨 Emergency Rollback" button
2. Confirm the action in the dialog
3. Rollback workflow triggers automatically
4. Monitor rollback progress (< 2 minutes guaranteed)
5. Verify production health after rollback

**What happens**:

- Previous version is re-deployed
- Traffic is shifted back (100% → 0% on new version)
- Health checks validate rollback success
- Team notification sent via Slack

#### Retry Deployment

**When to use**: Transient failures, flaky tests, network issues

**Steps**:

1. Identify failed deployment in status panel
2. Click "🔄 Retry Deployment" button
3. GitHub Actions re-runs the workflow
4. Monitor retry progress

#### Cancel Deployment

**When to use**: Wrong commit deployed, critical bug detected

**Steps**:

1. Click "⏸️ Cancel Deployment" button (only visible for in-progress deployments)
2. Confirm cancellation
3. Workflow stops immediately
4. No changes are deployed

### Viewing Deployment History

1. Scroll to "Recent Deployments" section
2. Last 5 deployments are displayed by default
3. Click on any deployment to view details
4. Filter by:
   - Environment (staging/production)
   - Status (success/failed/rolled_back)
   - Author
   - Date range

### Analyzing Metrics

**Quick Stats Panel**:

- Total Deployments: Count in selected environment
- Success Rate: Percentage of successful deployments
- Health Status: Overall system health

**Detailed Analytics** (coming soon):

- Deployment frequency trends
- Average deployment duration over time
- Change failure rate
- Mean time to recovery (MTTR)

---

## API Reference

### Hooks

#### `useDeploymentStatus`

Manages deployment status with real-time updates.

```typescript
const {
  currentDeployment,
  recentDeployments,
  isLoading,
  error,
  refresh,
  triggerRollback,
  retryDeployment,
  cancelDeployment,
} = useDeploymentStatus({
  environment: 'staging',
  refreshInterval: 10000,
  enableRealtime: true,
});
```

**Options**:

- `environment` (optional): 'staging' | 'production'
- `refreshInterval` (optional): Polling interval in ms (default: 10000)
- `enableRealtime` (optional): Enable WebSocket updates (default: true)
- `deploymentId` (optional): Monitor specific deployment

**Returns**:

- `currentDeployment`: Current deployment object or null
- `recentDeployments`: Array of recent deployments
- `isLoading`: Loading state boolean
- `error`: Error object or null
- `refresh`: Function to manually refresh
- `triggerRollback`: Function to trigger rollback
- `retryDeployment`: Function to retry deployment
- `cancelDeployment`: Function to cancel deployment

#### `useHealthChecks`

Monitors health check endpoints.

```typescript
const { healthChecks, isHealthy, isDegraded, isUnhealthy, isLoading, error, refresh } =
  useHealthChecks({
    environment: 'staging',
    pollingInterval: 30000,
    enabled: true,
  });
```

**Options**:

- `environment` (optional): 'staging' | 'production' | 'all'
- `pollingInterval` (optional): Polling interval in ms (default: 30000)
- `enabled` (optional): Enable polling (default: true)

**Returns**:

- `healthChecks`: Array of health check results
- `isHealthy`: All checks healthy boolean
- `isDegraded`: Any check degraded boolean
- `isUnhealthy`: Any check unhealthy boolean
- `isLoading`: Loading state boolean
- `error`: Error object or null
- `refresh`: Function to manually refresh

#### `useRealtimeUpdates`

Manages WebSocket/SSE real-time connection.

```typescript
const { connectionState, isConnected, lastMessage, connect, disconnect } = useRealtimeUpdates({
  enabled: true,
  deploymentId: '12345',
  environment: 'staging',
  onMessage: (message) => console.log(message),
});
```

**Options**:

- `enabled` (optional): Enable connection (default: true)
- `deploymentId` (optional): Subscribe to specific deployment
- `environment` (optional): Subscribe to environment updates
- `onMessage` (optional): Message handler callback

**Returns**:

- `connectionState`: Connection state object
- `isConnected`: Connection status boolean
- `lastMessage`: Last received message or null
- `connect`: Function to connect
- `disconnect`: Function to disconnect

### Services

#### GitHubActionsService

```typescript
import { getGitHubActionsService } from '@/features/cicd-dashboard';

const service = getGitHubActionsService();

// List workflow runs
const runs = await service.listWorkflowRuns('backend-deployment.yml', {
  per_page: 10,
  status: 'completed',
});

// Get specific run
const run = await service.getWorkflowRun(runId);

// List jobs for run
const jobs = await service.listWorkflowJobs(runId);

// Download logs
const logs = await service.downloadJobLogs(jobId);

// Trigger workflow
await service.triggerWorkflowDispatch('automated-rollback.yml', {
  ref: 'main',
  inputs: { environment: 'staging' },
});
```

#### HealthCheckService

```typescript
import { getHealthCheckService } from '@/features/cicd-dashboard';

const service = getHealthCheckService();

// Check all endpoints for environment
const results = await service.checkEnvironment('staging');

// Check all environments
const { staging, production } = await service.checkAllEnvironments();

// Start polling with callback
service.startPolling((results) => {
  console.log('Health checks:', results);
});

// Stop polling
service.stopPolling();
```

#### RealtimeService

```typescript
import { getRealtimeService } from '@/features/cicd-dashboard';

const service = getRealtimeService();

// Connect
await service.connect();

// Subscribe to deployment updates
const subscriptionId = service.subscribe({
  type: 'deployment',
  filter: { deploymentId: '12345' },
  callback: (message) => console.log(message),
});

// Unsubscribe
service.unsubscribe(subscriptionId);

// Disconnect
service.disconnect();
```

---

## Component Reference

### DeploymentDashboard

Main dashboard page component.

```typescript
import { DeploymentDashboard } from '@/features/cicd-dashboard';

<DeploymentDashboard />
```

**Features**:

- Environment selector
- Real-time connection indicator
- Deployment status panel
- Health check monitor
- Action buttons
- Recent deployments list
- Quick stats

### DeploymentStatusPanel

Displays current deployment status.

```typescript
import { DeploymentStatusPanel } from '@/features/cicd-dashboard';

<DeploymentStatusPanel
  deployment={currentDeployment}
  isLoading={false}
/>
```

**Props**:

- `deployment`: Deployment object or null
- `isLoading`: Loading state boolean

### HealthCheckMonitor

Displays health check status.

```typescript
import { HealthCheckMonitor } from '@/features/cicd-dashboard';

<HealthCheckMonitor
  healthChecks={healthChecks}
  isLoading={false}
/>
```

**Props**:

- `healthChecks`: Array of health check results
- `isLoading`: Loading state boolean

---

## Real-time Monitoring

### WebSocket Connection

The dashboard establishes a WebSocket connection for real-time updates.

**Connection Flow**:

1. Dashboard mounts → Connect to WebSocket URL
2. Authentication via token in query parameter
3. Subscribe to deployment/environment updates
4. Receive real-time messages
5. Auto-reconnect on disconnect

**Message Types**:

- `deployment_started`: New deployment initiated
- `deployment_updated`: Deployment status changed
- `deployment_completed`: Deployment finished
- `deployment_failed`: Deployment failed
- `stage_started`: Stage began execution
- `stage_completed`: Stage finished
- `health_check_updated`: Health status changed
- `smoke_test_updated`: Test status changed
- `ping`/`pong`: Heartbeat messages

**Reconnection Strategy**:

- Exponential backoff: 3s, 4.5s, 6.75s, 10s, ...
- Max attempts: 10
- Automatic fallback to SSE if WebSocket fails

### Server-Sent Events (SSE) Fallback

If WebSocket is unavailable, the dashboard falls back to SSE.

**SSE Advantages**:

- Simpler than WebSocket
- Works through proxies
- Automatic reconnection
- Same message format

**Limitations**:

- One-way communication (server → client only)
- Higher latency than WebSocket

---

## Troubleshooting

### Common Issues

#### 1. Dashboard shows "Disconnected"

**Symptoms**: Red dot next to connection status, no real-time updates

**Causes**:

- WebSocket server not running
- Network firewall blocking WebSocket
- Invalid authentication token

**Solutions**:

1. Check WebSocket URL in environment variables
2. Verify authentication token is valid
3. Test WebSocket connection: `wscat -c wss://api.sovren.dev/ws/deployments`
4. Check browser console for error messages
5. Dashboard will fallback to SSE automatically

#### 2. Health checks showing "Unhealthy"

**Symptoms**: Red status indicators, error messages in health panel

**Causes**:

- API server down
- Database connection issues
- High server load

**Solutions**:

1. Check API server status: `curl https://api-staging.sovren.dev/health`
2. Review server logs for errors
3. Verify database connectivity
4. Check server resources (CPU, memory)

#### 3. Deployments not showing up

**Symptoms**: Empty deployment list, "No Active Deployment" message

**Causes**:

- GitHub token invalid or expired
- Workflow not triggered
- API rate limiting

**Solutions**:

1. Verify GitHub token has correct scopes (`repo`, `workflow`)
2. Check GitHub Actions workflows: https://github.com/zone17/sovren/actions
3. Review GitHub API rate limits
4. Check browser console for API errors

#### 4. Rollback button not working

**Symptoms**: Error message after clicking rollback

**Causes**:

- Insufficient GitHub permissions
- Workflow dispatch not configured
- No previous deployment to rollback to

**Solutions**:

1. Verify GitHub token has `workflow` scope
2. Check `automated-rollback.yml` workflow exists
3. Ensure there's a previous successful deployment
4. Review GitHub Actions logs

### Debug Mode

Enable debug logging:

```typescript
// In browser console
localStorage.setItem('cicd-dashboard:debug', 'true');

// Reload page to see debug logs
```

### Performance Issues

If dashboard is slow:

1. **Reduce polling frequency**:

   ```typescript
   useDeploymentStatus({ refreshInterval: 30000 }); // 30s instead of 10s
   useHealthChecks({ pollingInterval: 60000 }); // 60s instead of 30s
   ```

2. **Disable real-time updates** (if not needed):

   ```typescript
   useDeploymentStatus({ enableRealtime: false });
   useRealtimeUpdates({ enabled: false });
   ```

3. **Clear cache**:
   ```typescript
   // In browser console
   getHealthCheckService().clearCache();
   ```

---

## Best Practices

### 1. Environment Management

- **Staging First**: Always deploy to staging before production
- **Monitor Staging**: Verify staging health before promoting to production
- **Use Manual Approval**: Production deployments should require manual approval

### 2. Rollback Strategy

- **Quick Rollback**: Use emergency rollback for critical issues (< 2 minutes)
- **Root Cause Analysis**: Investigate why rollback was needed
- **Fix Forward**: Prefer fixing issues with new deployment over multiple rollbacks

### 3. Health Checks

- **Monitor Trends**: Watch for degradation patterns
- **Set Alerts**: Configure alerts for unhealthy status
- **Response Time Thresholds**:
  - /health: < 500ms
  - /ready: < 1000ms
  - /live: < 100ms
  - /detailed: < 2000ms

### 4. Deployment Frequency

- **Small, Frequent Deployments**: Easier to rollback, less risk
- **Continuous Integration**: Deploy on every merge to main
- **Track Success Rate**: Aim for > 95% success rate

### 5. Monitoring

- **Dashboard Visibility**: Display on team monitors
- **Real-time Alerts**: Configure Slack notifications
- **Post-Deployment Validation**: Always verify production health after deployment

### 6. Security

- **Secure Tokens**: Store GitHub tokens in environment variables, never in code
- **Rotate Tokens**: Regularly rotate authentication tokens
- **Audit Logs**: Review deployment history for unauthorized changes

---

## Additional Resources

- **Architecture Diagrams**: [/docs/architecture/diagrams/](../architecture/diagrams/)
- **Deployment Guide**: [/docs/deployment/DEPLOYMENT_GUIDE.md](../deployment/DEPLOYMENT_GUIDE.md)
- **Epic 006 Documentation**: [/EPIC-006-DEPLOYMENT-AUTOMATION-COMPLETE.md](/EPIC-006-DEPLOYMENT-AUTOMATION-COMPLETE.md)
- **GitHub Actions Workflows**: [/.github/workflows/](/.github/workflows/)

---

## Support

For issues or questions:

- **GitHub Issues**: https://github.com/zone17/sovren/issues
- **Documentation**: This guide
- **Architecture Review**: Consult team lead

---

**Dashboard Version**: 1.0.0
**Last Updated**: 2025-10-27
**Maintained By**: Sovren Engineering Team
