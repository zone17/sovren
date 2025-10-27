import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStatus } from '../services/AuthContext';
import type { ProtectedRouteProps } from '../types';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireRole,
  requirePermissions,
  fallbackPath = '/login',
  showAccessDenied = false,
}): JSX.Element => {
  const { isAuthenticated, isLoading, user } = useAuthStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Check role requirement
  if (requireRole && user?.role !== requireRole) {
    if (showAccessDenied) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
    return <Navigate to={fallbackPath} replace />;
  }

  // Check permission requirements
  if (requirePermissions && user) {
    const hasRequiredPermissions = requirePermissions.every((permission) =>
      user.permissions.includes(permission)
    );

    if (!hasRequiredPermissions) {
      if (showAccessDenied) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
              <p className="text-gray-600">
                You don't have the required permissions to access this page.
              </p>
            </div>
          </div>
        );
      }
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
