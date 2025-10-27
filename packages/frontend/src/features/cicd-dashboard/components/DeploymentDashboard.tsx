/**
 * CI/CD Dashboard - Main Dashboard Page
 *
 * Comprehensive real-time CI/CD monitoring dashboard.
 * Displays deployment status, health checks, smoke tests, and metrics.
 */

import React, { useState } from 'react';
import { useDeploymentStatus, useHealthChecks, useRealtimeUpdates } from '../hooks';
import { DeploymentStatusPanel } from './DeploymentStatusPanel';
import { HealthCheckMonitor } from './HealthCheckMonitor';
import type { DeploymentEnvironment } from '../types';

export const DeploymentDashboard: React.FC = () => {
  const [selectedEnvironment, setSelectedEnvironment] = useState<DeploymentEnvironment>('staging');

  // Deployment status with real-time updates
  const {
    currentDeployment,
    recentDeployments,
    isLoading: deploymentLoading,
    error: deploymentError,
    refresh: refreshDeployments,
    triggerRollback,
    retryDeployment,
    cancelDeployment,
  } = useDeploymentStatus({
    environment: selectedEnvironment,
    refreshInterval: 10000,
    enableRealtime: true,
  });

  // Health checks
  const {
    healthChecks,
    isHealthy,
    isDegraded,
    isUnhealthy,
    isLoading: healthLoading,
    error: healthError,
    refresh: refreshHealthChecks,
  } = useHealthChecks({
    environment: selectedEnvironment,
    pollingInterval: 30000,
    enabled: true,
  });

  // Real-time updates
  const { connectionState, isConnected } = useRealtimeUpdates({
    enabled: true,
    environment: selectedEnvironment,
    onMessage: (message) => {
      console.log('Real-time update:', message);
      // Refresh data on updates
      if (message.type === 'deployment_updated' || message.type === 'deployment_completed') {
        refreshDeployments();
      }
      if (message.type === 'health_check_updated') {
        refreshHealthChecks();
      }
    },
  });

  // Handle rollback
  const handleRollback = async () => {
    if (!currentDeployment) return;

    const confirmed = window.confirm(
      `Are you sure you want to rollback deployment ${currentDeployment.commitSha.substring(0, 7)}?`
    );

    if (confirmed) {
      try {
        await triggerRollback(currentDeployment.id, 'Manual rollback initiated from dashboard');
        alert('Rollback initiated successfully');
      } catch (error) {
        console.error('Rollback failed:', error);
        alert('Rollback failed. Please try again.');
      }
    }
  };

  // Handle retry
  const handleRetry = async () => {
    if (!currentDeployment) return;

    try {
      await retryDeployment(currentDeployment.id);
      alert('Deployment retry initiated');
    } catch (error) {
      console.error('Retry failed:', error);
      alert('Retry failed. Please try again.');
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!currentDeployment) return;

    const confirmed = window.confirm(
      `Are you sure you want to cancel deployment ${currentDeployment.commitSha.substring(0, 7)}?`
    );

    if (confirmed) {
      try {
        await cancelDeployment(currentDeployment.id);
        alert('Deployment cancelled successfully');
      } catch (error) {
        console.error('Cancel failed:', error);
        alert('Cancel failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                CI/CD Deployment Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time monitoring and management of deployment pipelines
              </p>
            </div>

            {/* Connection Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  } animate-pulse`}
                ></span>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Environment Selector */}
              <select
                value={selectedEnvironment}
                onChange={(e) =>
                  setSelectedEnvironment(e.target.value as DeploymentEnvironment)
                }
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  refreshDeployments();
                  refreshHealthChecks();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Messages */}
        {deploymentError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              <strong>Deployment Error:</strong> {deploymentError.message}
            </p>
          </div>
        )}

        {healthError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              <strong>Health Check Error:</strong> {healthError.message}
            </p>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Deployment Status */}
          <div className="lg:col-span-2 space-y-6">
            <DeploymentStatusPanel
              deployment={currentDeployment}
              isLoading={deploymentLoading}
            />

            {/* Action Buttons */}
            {currentDeployment && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Actions
                </h3>
                <div className="flex space-x-4">
                  {currentDeployment.status === 'failed' && (
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      🔄 Retry Deployment
                    </button>
                  )}

                  {currentDeployment.status === 'in_progress' && (
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
                    >
                      ⏸️ Cancel Deployment
                    </button>
                  )}

                  {(currentDeployment.status === 'success' ||
                    currentDeployment.status === 'in_progress') && (
                    <button
                      onClick={handleRollback}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      🚨 Emergency Rollback
                    </button>
                  )}

                  <a
                    href={`https://github.com/zone17/sovren/actions/runs/${currentDeployment.workflowRunId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    📊 View Full Logs
                  </a>
                </div>
              </div>
            )}

            {/* Recent Deployments */}
            {recentDeployments.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Recent Deployments
                  </h3>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-2">
                    {recentDeployments.slice(0, 5).map((deployment) => (
                      <div
                        key={deployment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-mono text-gray-600">
                            {deployment.commitSha.substring(0, 7)}
                          </span>
                          <span className="text-sm text-gray-900">
                            {deployment.commitMessage.substring(0, 50)}
                            {deployment.commitMessage.length > 50 ? '...' : ''}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {new Date(deployment.startTime).toLocaleTimeString()}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              deployment.status === 'success'
                                ? 'bg-green-100 text-green-800'
                                : deployment.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {deployment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Health & Metrics */}
          <div className="space-y-6">
            <HealthCheckMonitor
              healthChecks={healthChecks}
              isLoading={healthLoading}
            />

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Deployments</span>
                  <span className="text-lg font-bold text-gray-900">
                    {recentDeployments.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <span className="text-lg font-bold text-green-600">
                    {recentDeployments.length > 0
                      ? Math.round(
                          (recentDeployments.filter((d) => d.status === 'success').length /
                            recentDeployments.length) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Health Status</span>
                  <span
                    className={`text-lg font-bold ${
                      isHealthy
                        ? 'text-green-600'
                        : isDegraded
                        ? 'text-yellow-600'
                        : isUnhealthy
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {isHealthy ? 'Healthy' : isDegraded ? 'Degraded' : isUnhealthy ? 'Unhealthy' : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
