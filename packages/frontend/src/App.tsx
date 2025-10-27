import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/ui/Layout';
import { AuthProvider, ProtectedRoute } from './features/auth';
import ErrorBoundary from './monitoring/ErrorBoundary';

// 🎯 **LAZY LOADING**
const Home = React.lazy(() =>
  import('./pages/Home').then((module) => ({ default: module.default }))
);
const Login = React.lazy(() =>
  import('./pages/Login').then((module) => ({ default: module.default }))
);
const Signup = React.lazy(() =>
  import('./pages/Signup').then((module) => ({ default: module.default }))
);
const Profile = React.lazy(() =>
  import('./pages/Profile').then((module) => ({ default: module.default }))
);
const Post = React.lazy(() =>
  import('./pages/Post').then((module) => ({ default: module.default }))
);
const CreatorDashboard = React.lazy(() =>
  import('./pages/CreatorDashboard').then((module) => ({ default: module.default }))
);
const AnalyticsDashboard = React.lazy(() =>
  import('./features/analytics/components/CreatorDashboard').then((module) => ({
    default: module.CreatorDashboard,
  }))
);
const SubscriptionManager = React.lazy(() =>
  import('./features/subscriptions/components/SubscriptionManager').then((module) => ({
    default: module.SubscriptionManager,
  }))
);
const MonitoringDashboard = React.lazy(() =>
  import('./features/dashboard/components/MonitoringDashboard').then((module) => ({
    default: module.default,
  }))
);

// 🚀 **ONBOARDING COMPONENTS**
const SovereignOnboarding = React.lazy(() =>
  import('./components/onboarding/SovereignOnboarding').then((module) => ({
    default: module.default,
  }))
);
const NostrOnboarding = React.lazy(() =>
  import('./components/onboarding/NostrOnboarding').then((module) => ({
    default: module.default,
  }))
);
const LightningOnboarding = React.lazy(() =>
  import('./components/onboarding/LightningOnboarding').then((module) => ({
    default: module.default,
  }))
);
const ProfileDashboard = React.lazy(() =>
  import('./components/ProfileDashboard').then((module) => ({
    default: module.default,
  }))
);

function App(): React.ReactElement {
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Pages with their own layout (no duplicates) */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* 🚀 ONBOARDING ROUTES */}
            <Route path="/onboarding" element={<SovereignOnboarding />} />
            <Route path="/onboarding/nostr" element={<NostrOnboarding />} />
            <Route path="/onboarding/lightning" element={<LightningOnboarding />} />

            {/* 👤 PROFILE DASHBOARD (Shows post-onboarding profile) */}
            <Route path="/profile-dashboard" element={<ProfileDashboard />} />

            {/* Protected Routes that need Layout */}
            <Route
              path="/profile"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                </Layout>
              }
            />

            <Route
              path="/post/:id"
              element={
                <Layout>
                  <ProtectedRoute>
                    <Post />
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Creator Routes */}
            <Route
              path="/create"
              element={
                <Layout>
                  <ProtectedRoute>
                    <CreatorDashboard />
                  </ProtectedRoute>
                </Layout>
              }
            />

            <Route
              path="/dashboard"
              element={
                <Layout>
                  <ProtectedRoute>
                    <CreatorDashboard />
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Analytics Dashboard */}
            <Route
              path="/dashboard/analytics"
              element={
                <Layout>
                  <ProtectedRoute>
                    <AnalyticsDashboard />
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Subscription Manager */}
            <Route
              path="/dashboard/subscriptions"
              element={
                <Layout>
                  <ProtectedRoute>
                    <SubscriptionManager />
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/monitoring"
              element={
                <Layout>
                  <ProtectedRoute requireRole="admin">
                    <MonitoringDashboard />
                  </ProtectedRoute>
                </Layout>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
