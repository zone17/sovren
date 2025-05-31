import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RootState, useAppSelector } from '../store';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }): JSX.Element => {
  const currentUser = useAppSelector((state: RootState) => state.user.currentUser);
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/profile', label: 'Profile' },
    { path: '/monitoring', label: '📊 Monitoring' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                {/* @ts-ignore */}
                <Link to="/" className="text-xl font-bold text-gray-900">
                  SOVREN
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  /* @ts-ignore */
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive(item.path)
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              {currentUser ? (
                <div className="flex items-center space-x-4">
                  {/* @ts-ignore */}
                  <Link to="/profile" className="text-gray-700 hover:text-gray-900">
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      // TODO: Implement logout
                    }}
                    className="text-gray-700 hover:text-gray-900"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex space-x-4">
                  {/* @ts-ignore */}
                  <Link to="/login" className="text-gray-700 hover:text-gray-900">
                    Login
                  </Link>
                  {/* @ts-ignore */}
                  <Link to="/signup" className="text-blue-600 hover:text-blue-500">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} SOVREN. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
