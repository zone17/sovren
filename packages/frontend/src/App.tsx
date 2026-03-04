import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/ui/Layout';
import { AuthProvider, ProtectedRoute } from './features/auth';
import { ErrorBoundary } from './monitoring/ErrorBoundary';
import { AuthErrorBoundary } from './features/auth/ErrorBoundary';
import { ContentErrorBoundary } from './features/content/ErrorBoundary';
import { AnalyticsErrorBoundary } from './features/analytics/ErrorBoundary';
import { DashboardErrorBoundary } from './features/dashboard/ErrorBoundary';
import { SubscriptionsErrorBoundary } from './features/subscriptions/ErrorBoundary';
import { NostrErrorBoundary } from './features/nostr/ErrorBoundary';
import { WellnessErrorBoundary } from './features/wellness/ErrorBoundary';
import { ContentShieldErrorBoundary } from './features/content-shield/ErrorBoundary';
import { BusinessErrorBoundary } from './features/business/ErrorBoundary';

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

// Discovery & Creator Profile
const DiscoveryPage = React.lazy(() =>
  import('./features/discovery/components/DiscoveryPage').then((module) => ({
    default: module.DiscoveryPage,
  }))
);
const CreatorProfilePage = React.lazy(() =>
  import('./pages/CreatorProfile').then((module) => ({
    default: module.default,
  }))
);

// Revenue Analytics
const RevenueAnalytics = React.lazy(() =>
  import('./features/analytics/components/RevenueAnalytics').then((module) => ({
    default: module.RevenueAnalytics,
  }))
);

// Business Manager
const BusinessManagerDashboard = React.lazy(() =>
  import('./features/business/components/BusinessManagerDashboard').then((module) => ({
    default: module.BusinessManagerDashboard,
  }))
);

// Phase 7: Creator Safety Net
const WellnessDashboard = React.lazy(() =>
  import('./features/wellness/components/WellnessDashboard').then((module) => ({
    default: module.WellnessDashboard,
  }))
);
const ShieldDashboard = React.lazy(() =>
  import('./features/content-shield/components/ShieldDashboard').then((module) => ({
    default: module.ShieldDashboard,
  }))
);

function App(): React.ReactElement {
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <ErrorBoundary level="page" name="Application">
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

            {/* Discovery (Public) */}
            <Route
              path="/discover"
              element={
                <Layout>
                  <DiscoveryPage />
                </Layout>
              }
            />

            {/* Creator Profile (Public) */}
            <Route
              path="/creator/:id"
              element={
                <Layout>
                  <CreatorProfilePage />
                </Layout>
              }
            />

            {/* Revenue Analytics */}
            <Route
              path="/dashboard/revenue"
              element={
                <Layout>
                  <ProtectedRoute>
                    <AnalyticsErrorBoundary>
                      <RevenueAnalytics />
                    </AnalyticsErrorBoundary>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Wellness Dashboard — creators only, show access denied for supporters */}
            <Route
              path="/wellness"
              element={
                <Layout>
                  <ProtectedRoute requireRole="creator" showAccessDenied={true}>
                    <WellnessErrorBoundary>
                      <WellnessDashboard />
                    </WellnessErrorBoundary>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Content Shield Dashboard */}
            <Route
              path="/shield"
              element={
                <Layout>
                  <ProtectedRoute>
                    <ContentShieldErrorBoundary>
                      <ShieldDashboard />
                    </ContentShieldErrorBoundary>
                  </ProtectedRoute>
                </Layout>
              }
            />

            {/* Business Manager — creators only */}
            <Route
              path="/business"
              element={
                <Layout>
                  <ProtectedRoute requireRole="creator" showAccessDenied={true}>
                    <BusinessErrorBoundary>
                      <Suspense
                        fallback={<div className="animate-pulse h-48 rounded bg-gray-100" />}
                      >
                        <BusinessManagerDashboard />
                      </Suspense>
                    </BusinessErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
