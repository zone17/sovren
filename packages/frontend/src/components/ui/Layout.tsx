import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useAuthStatus } from '../../features/auth';
import { FeatureFlagToggle } from '../DevTools/FeatureFlagToggle';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }): JSX.Element => {
  const { isAuthenticated, user } = useAuthStatus();
  const { logout } = useAuth();

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-bold text-blue-600">Sovren</span>
                <span className="ml-2 text-sm text-gray-500">
                  ⚡ Decentralized Creator Platform
                </span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  {/* User navigation */}
                  <div className="flex items-center space-x-4">
                    <Link
                      to="/profile"
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Profile
                    </Link>

                    {user?.role === 'creator' && (
                      <>
                        <Link
                          to="/create"
                          className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          Create
                        </Link>
                        <Link
                          to="/dashboard"
                          className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          Dashboard
                        </Link>
                        <Link
                          to="/wellness"
                          className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          Wellness
                        </Link>
                        <Link
                          to="/shield"
                          className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          Shield
                        </Link>
                      </>
                    )}

                    {user?.role === 'admin' && (
                      <>
                        <Link
                          to="/monitoring"
                          className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          Admin
                        </Link>
                      </>
                    )}

                    {/* User info */}
                    <div className="flex items-center space-x-2">
                      <div className="text-sm">
                        <span className="text-gray-500">
                          {user?.role === 'creator' && '✨'}
                          {user?.role === 'supporter' && '💚'}
                          {user?.role === 'admin' && '🔑'}
                        </span>
                        <span className="text-gray-700 ml-1">
                          {user?.name || user?.email || 'User'}
                        </span>
                        {user?.nostr_pubkey && (
                          <span className="text-xs text-blue-600 ml-1">🌐 NOSTR</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => void handleLogout()}
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Guest navigation */}
                  <div className="flex space-x-4">
                    <Link
                      to="/login"
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Login
                    </Link>
                    <Link
                      to="/signup"
                      className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Sign Up
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} SOVREN. Decentralized creator freedom.
            </p>
            <div className="flex space-x-4 text-sm text-gray-500">
              <span>🌐 NOSTR Protocol</span>
              <span>⚡ Lightning Network</span>
              <span>🔐 Self-Sovereign</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 🚩 DEV TOOLS: Feature Flag Toggle */}
      <FeatureFlagToggle />
    </div>
  );
};

export default Layout;
