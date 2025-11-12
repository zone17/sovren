import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/ui/Layout';
import { AuthProvider, ProtectedRoute } from './features/auth';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { AuthErrorBoundary } from './features/auth/ErrorBoundary';
import { ContentErrorBoundary } from './features/content/ErrorBoundary';
import { AnalyticsErrorBoundary } from './features/analytics/ErrorBoundary';
import { DashboardErrorBoundary } from './features/dashboard/ErrorBoundary';
import { SubscriptionsErrorBoundary } from './features/subscriptions/ErrorBoundary';
import { NostrErrorBoundary } from './features/nostr/ErrorBoundary';

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
    <GlobalErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Pages with their own layout (no duplicates) */}
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={
                <AuthErrorBoundary>
                  <Login />
                </AuthErrorBoundary>
              }
            />
            <Route
              path="/signup"
              element={
                <AuthErrorBoundary>
                  <Signup />
                </AuthErrorBoundary>
              }
            />

            {/* 🚀 ONBOARDING ROUTES */}
            <Route
              path="/onboarding"
              element={
                <AuthErrorBoundary>
                  <SovereignOnboarding />
                </AuthErrorBoundary>
              }
            />
            <Route
              path="/onboarding/nostr"
              element={
                <NostrErrorBoundary>
                  <NostrOnboarding />
                </NostrErrorBoundary>
              }
            />
            <Route
              path="/onboarding/lightning"
              element={
                <NostrErrorBoundary>
                  <LightningOnboarding />
                </NostrErrorBoundary>
              }
            />

            {/* 👤 PROFILE DASHBOARD (Shows post-onboarding profile) */}
            <Route
              path="/profile-dashboard"
              element={
                <AuthErrorBoundary>
                  <ProfileDashboard />
                </AuthErrorBoundary>
              }
            />

            {/* Protected Routes that need Layout */}
            <Route
              path="/profile"
              element={
                <Layout>
                  <ProtectedRoute>
                    <AuthErrorBoundary>
                      <Profile />
                    </AuthErrorBoundary>
                  </ProtectedRoute>
                </Layout>
              }
            />

            <Route
              path="/post/:id"
              element={
                <Layout>
                  <ProtectedRoute>
                    <ContentErrorBoundary>
                      <Post />
                    </ContentErrorBoundary>
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
                    <ContentErrorBoundary>
                      <CreatorDashboard />
                    </ContentErrorBoundary>
                  </ProtectedRoute>
                </Layout>
              }
            />

            <Route
              path="/dashboard"
              element={
                <Layout>
                  <ProtectedRoute>
                    <DashboardErrorBoundary>
                      <CreatorDashboard />
                    </DashboardErrorBoundary>
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
                    <AnalyticsErrorBoundary>
                      <AnalyticsDashboard />
                    </AnalyticsErrorBoundary>
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
                    <SubscriptionsErrorBoundary>
                      <SubscriptionManager />
                    </SubscriptionsErrorBoundary>
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
                    <DashboardErrorBoundary>
                      <MonitoringDashboard />
                    </DashboardErrorBoundary>
                  </ProtectedRoute>
                </Layout>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
