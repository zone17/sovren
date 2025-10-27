/**
 * CI/CD Dashboard - Deployment Status Panel Component
 *
 * Displays current deployment status with real-time updates,
 * progress tracking, and stage visualization.
 */

import React from 'react';
import type { Deployment, DeploymentStage } from '../types';

interface DeploymentStatusPanelProps {
  deployment: Deployment | null;
  isLoading?: boolean;
}

/**
 * Get status color class
 */
function getStatusColor(status: Deployment['status']): string {
  switch (status) {
    case 'success':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'in_progress':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'failed':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'rolled_back':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'cancelled':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get stage status icon
 */
function getStageStatusIcon(status: DeploymentStage['status']): string {
  switch (status) {
    case 'success':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'failed':
      return '❌';
    case 'pending':
      return '⏳';
    default:
      return '⚪';
  }
}

/**
 * Format duration
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export const DeploymentStatusPanel: React.FC<DeploymentStatusPanelProps> = ({
  deployment,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No Active Deployment</p>
          <p className="text-sm mt-2">There are no deployments currently in progress.</p>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(deployment.status);
  const progress = deployment.stages.length > 0
    ? (deployment.stages.filter(s => s.status === 'success').length / deployment.stages.length) * 100
    : 0;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Current Deployment
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColor}`}>
            {deployment.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {/* Deployment Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Environment</p>
            <p className="text-base font-medium text-gray-900 capitalize">
              {deployment.environment}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="text-base font-medium text-gray-900">
              {deployment.duration
                ? formatDuration(deployment.duration)
                : 'In progress...'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Commit</p>
            <p className="text-base font-mono text-gray-900">
              {deployment.commitSha.substring(0, 7)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Author</p>
            <p className="text-base font-medium text-gray-900">
              {deployment.author}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {deployment.status === 'in_progress' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Progress</p>
              <p className="text-sm font-medium text-gray-900">{Math.round(progress)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Commit Message */}
        <div>
          <p className="text-sm text-gray-500 mb-1">Commit Message</p>
          <p className="text-sm text-gray-900">{deployment.commitMessage}</p>
        </div>

        {/* Stages */}
        {deployment.stages.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-3">Deployment Stages</p>
            <div className="space-y-2">
              {deployment.stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getStageStatusIcon(stage.status)}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                      <p className="text-xs text-gray-500">{stage.description}</p>
                    </div>
                  </div>
                  {stage.duration && (
                    <span className="text-xs text-gray-500">
                      {formatDuration(stage.duration)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Summary */}
        {(deployment.status === 'success' || deployment.status === 'failed') && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {deployment.metrics.healthCheckSuccessRate.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">Health Checks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {deployment.metrics.passedSmokeTests}/{deployment.metrics.totalSmokeTests}
              </p>
              <p className="text-xs text-gray-500">Smoke Tests</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {deployment.metrics.responseTimeP95.toFixed(0)}ms
              </p>
              <p className="text-xs text-gray-500">Response P95</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
