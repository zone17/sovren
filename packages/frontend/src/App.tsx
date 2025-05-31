import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './monitoring/ErrorBoundary';

// Lazy load components for optimal performance
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Post = React.lazy(() => import('./pages/Post'));
const MonitoringDashboard = React.lazy(() => import('./components/MonitoringDashboard'));

function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
          }
        >
          {/* @ts-ignore - React Router v6 TypeScript compatibility issue */}
          <Routes>
            {/* @ts-ignore */}
            <Route path="/" element={<Home />} />
            {/* @ts-ignore */}
            <Route path="/login" element={<Login />} />
            {/* @ts-ignore */}
            <Route path="/signup" element={<Signup />} />
            {/* @ts-ignore */}
            <Route path="/profile" element={<Profile />} />
            {/* @ts-ignore */}
            <Route path="/post/:id" element={<Post />} />
            {/* @ts-ignore */}
            <Route path="/monitoring" element={<MonitoringDashboard />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
