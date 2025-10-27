/**
 * CI/CD Dashboard - Health Check Monitor Component
 *
 * Displays real-time health status for all monitored endpoints
 * across staging and production environments.
 */

import React from 'react';
import type { HealthCheckResult } from '../types';

interface HealthCheckMonitorProps {
  healthChecks: HealthCheckResult[];
  isLoading?: boolean;
}

/**
 * Get health status color
 */
function getHealthStatusColor(status: HealthCheckResult['status']): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600 bg-green-50';
    case 'degraded':
      return 'text-yellow-600 bg-yellow-50';
    case 'unhealthy':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Get health status icon
 */
function getHealthStatusIcon(status: HealthCheckResult['status']): string {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'degraded':
      return '⚠️';
    case 'unhealthy':
      return '❌';
    default:
      return '⚪';
  }
}

/**
 * Get endpoint display name
 */
function getEndpointName(endpoint: HealthCheckResult['endpoint']): string {
  switch (endpoint) {
    case '/health':
      return 'General Health';
    case '/ready':
      return 'Readiness Probe';
    case '/live':
      return 'Liveness Probe';
    case '/detailed':
      return 'Detailed Health';
    default:
      return endpoint;
  }
}

export const HealthCheckMonitor: React.FC<HealthCheckMonitorProps> = ({
  healthChecks,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const allHealthy = healthChecks.every((check) => check.status === 'healthy');
  const anyDegraded = healthChecks.some((check) => check.status === 'degraded');
  const anyUnhealthy = healthChecks.some((check) => check.status === 'unhealthy');

  let overallStatus: HealthCheckResult['status'] = 'healthy';
  if (anyUnhealthy) overallStatus = 'unhealthy';
  else if (anyDegraded) overallStatus = 'degraded';

  const overallColor = getHealthStatusColor(overallStatus);

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Health Status
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${overallColor}`}>
            {getHealthStatusIcon(overallStatus)} {overallStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {healthChecks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No health check data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {healthChecks.map((check, index) => {
              const statusColor = getHealthStatusColor(check.status);
              const statusIcon = getHealthStatusIcon(check.status);

              return (
                <div
                  key={`${check.endpoint}-${index}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{statusIcon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getEndpointName(check.endpoint)}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {check.endpoint}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    {/* Response Time */}
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Response Time</p>
                      <p className="text-sm font-medium text-gray-900">
                        {check.responseTime}ms
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {check.status}
                    </span>
                  </div>

                  {/* Error Message (if any) */}
                  {check.error && (
                    <div className="mt-2 text-xs text-red-600">
                      Error: {check.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Last Updated */}
        {healthChecks.length > 0 && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};
