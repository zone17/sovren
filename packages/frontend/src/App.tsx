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
import { CreatorNetworkErrorBoundary } from './features/creator-network/ErrorBoundary';

// 🎯 **LAZY LOADING**
const Home = React.lazy(() => import('./pages/Home').then(module => ({ default: module.default })));
const Login = React.lazy(() =>
  import('./pages/Login').then(module => ({ default: module.default }))
);
const Signup = React.lazy(() =>
  import('./pages/Signup').then(module => ({ default: module.default }))
);
const Profile = React.lazy(() =>
  import('./pages/Profile').then(module => ({ default: module.default }))
);
const Post = React.lazy(() => import('./pages/Post').then(module => ({ default: module.default })));
const CreatorDashboard = React.lazy(() =>
  import('./pages/CreatorDashboard').then(module => ({ default: module.default }))
);
const AnalyticsDashboard = React.lazy(() =>
  import('./features/analytics/components/CreatorDashboard').then(module => ({
    default: module.CreatorDashboard,
  }))
);
const SubscriptionManager = React.lazy(() =>
  import('./features/subscriptions/components/SubscriptionManager').then(module => ({
    default: module.SubscriptionManager,
  }))
);
const MonitoringDashboard = React.lazy(() =>
  import('./features/dashboard/components/MonitoringDashboard').then(module => ({
    default: module.default,
  }))
);
const NotFound = React.lazy(() =>
  import('./pages/NotFound').then(module => ({ default: module.default }))
);

// 🚀 **ONBOARDING COMPONENTS**
const SovereignOnboarding = React.lazy(() =>
  import('./components/onboarding/SovereignOnboarding').then(module => ({
    default: module.default,
  }))
);
const NostrOnboarding = React.lazy(() =>
  import('./components/onboarding/NostrOnboarding').then(module => ({
    default: module.default,
  }))
);
const LightningOnboarding = React.lazy(() =>
  import('./components/onboarding/LightningOnboarding').then(module => ({
    default: module.default,
  }))
);
const ProfileDashboard = React.lazy(() =>
  import('./components/ProfileDashboard').then(module => ({
    default: module.default,
  }))
);

// Discovery & Creator Profile
const DiscoveryPage = React.lazy(() =>
  import('./features/discovery/components/DiscoveryPage').then(module => ({
    default: module.DiscoveryPage,
  }))
);
const CreatorProfilePage = React.lazy(() =>
  import('./pages/CreatorProfile').then(module => ({
    default: module.default,
  }))
);

// Revenue Analytics
const RevenueAnalytics = React.lazy(() =>
  import('./features/analytics/components/RevenueAnalytics').then(module => ({
    default: module.RevenueAnalytics,
  }))
);

// Content Detail (public — comments section)
const ContentDetail = React.lazy(() =>
  import('./pages/ContentDetail').then(module => ({ default: module.default }))
);

// Business Manager
const BusinessManagerDashboard = React.lazy(() =>
  import('./features/business/components/BusinessManagerDashboard').then(module => ({
    default: module.BusinessManagerDashboard,
  }))
);

// Creator Network (Community Hub)
const CreatorNetworkDashboard = React.lazy(() =>
  import('./features/creator-network/components/CreatorNetworkDashboard').then(module => ({
    default: module.default,
  }))
);

// Settings, Terms, Privacy, Help pages
const Settings = React.lazy(() =>
  import('./pages/Settings').then(module => ({ default: module.default }))
);
const Terms = React.lazy(() =>
  import('./pages/Terms').then(module => ({ default: module.default }))
);
const Privacy = React.lazy(() =>
  import('./pages/Privacy').then(module => ({ default: module.default }))
);
const Help = React.lazy(() => import('./pages/Help').then(module => ({ default: module.default })));
const ContentPolicy = React.lazy(() =>
  import('./pages/ContentPolicy').then(module => ({ default: module.default }))
);

// Phase 7: Creator Safety Net
const WellnessDashboard = React.lazy(() =>
  import('./features/wellness/components/WellnessDashboard').then(module => ({
    default: module.WellnessDashboard,
  }))
);
const ShieldDashboard = React.lazy(() =>
  import('./features/content-shield/components/ShieldDashboard').then(module => ({
    default: module.ShieldDashboard,
  }))
);

function App(): React.ReactElement {
  const LoadingSpinner = () => (
    <div className='flex justify-center items-center h-64'>
      <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500'></div>
    </div>
  );

  return (
    <ErrorBoundary level='page' name='Application'>
      <AuthProvider>
        <Routes>
          {/* Pages with their own layout (no duplicates) */}
          <Route
            path='/'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Home />
              </Suspense>
            }
          />
          <Route
            path='/login'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AuthErrorBoundary>
                  <Login />
                </AuthErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path='/signup'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AuthErrorBoundary>
                  <Signup />
                </AuthErrorBoundary>
              </Suspense>
            }
          />

          {/* ONBOARDING ROUTES */}
          <Route
            path='/onboarding'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AuthErrorBoundary>
                  <SovereignOnboarding />
                </AuthErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path='/onboarding/nostr'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <NostrErrorBoundary>
                  <NostrOnboarding />
                </NostrErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path='/onboarding/lightning'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <NostrErrorBoundary>
                  <LightningOnboarding />
                </NostrErrorBoundary>
              </Suspense>
            }
          />

          {/* PROFILE DASHBOARD (Shows post-onboarding profile) */}
          <Route
            path='/profile-dashboard'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AuthErrorBoundary>
                  <ProfileDashboard />
                </AuthErrorBoundary>
              </Suspense>
            }
          />

          {/* Protected Routes that need Layout */}
          <Route
            path='/profile'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AuthErrorBoundary>
                      <Profile />
                    </AuthErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          <Route
            path='/post/:id'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ContentErrorBoundary>
                      <Post />
                    </ContentErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Creator Routes */}
          <Route
            path='/create'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ContentErrorBoundary>
                      <CreatorDashboard />
                    </ContentErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          <Route
            path='/dashboard'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DashboardErrorBoundary>
                      <CreatorDashboard />
                    </DashboardErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Analytics Dashboard */}
          <Route
            path='/dashboard/analytics'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AnalyticsErrorBoundary>
                      <AnalyticsDashboard />
                    </AnalyticsErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Subscription Manager */}
          <Route
            path='/dashboard/subscriptions'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <SubscriptionsErrorBoundary>
                      <SubscriptionManager />
                    </SubscriptionsErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Discovery (Public) */}
          <Route
            path='/discover'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <DiscoveryPage />
                </Suspense>
              </Layout>
            }
          />

          {/* Creator Profile (Public) */}
          <Route
            path='/creator/:id'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <CreatorProfilePage />
                </Suspense>
              </Layout>
            }
          />

          {/* Content Detail (Public — comments section) */}
          <Route
            path='/content/:id'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <ContentErrorBoundary>
                    <ContentDetail />
                  </ContentErrorBoundary>
                </Suspense>
              </Layout>
            }
          />

          {/* Revenue Analytics */}
          <Route
            path='/dashboard/revenue'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AnalyticsErrorBoundary>
                      <RevenueAnalytics />
                    </AnalyticsErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Wellness Dashboard — creators only, show access denied for supporters */}
          <Route
            path='/wellness'
            element={
              <Layout>
                <ProtectedRoute requireRole='creator' showAccessDenied={true}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <WellnessErrorBoundary>
                      <WellnessDashboard />
                    </WellnessErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Content Shield Dashboard */}
          <Route
            path='/shield'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ContentShieldErrorBoundary>
                      <ShieldDashboard />
                    </ContentShieldErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Community Hub (Creator Network) */}
          <Route
            path='/community'
            element={
              <Layout>
                <ProtectedRoute requireRole='creator' showAccessDenied={true}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <CreatorNetworkErrorBoundary>
                      <CreatorNetworkDashboard />
                    </CreatorNetworkErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Business Manager — creators only */}
          <Route
            path='/business'
            element={
              <Layout>
                <ProtectedRoute requireRole='creator' showAccessDenied={true}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BusinessErrorBoundary>
                      <BusinessManagerDashboard />
                    </BusinessErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Admin Routes */}
          <Route
            path='/monitoring'
            element={
              <Layout>
                <ProtectedRoute requireRole='admin'>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DashboardErrorBoundary>
                      <MonitoringDashboard />
                    </DashboardErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Settings (Protected) */}
          <Route
            path='/settings'
            element={
              <Layout>
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary level='page' name='Settings'>
                      <Settings />
                    </ErrorBoundary>
                  </Suspense>
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Terms of Service (Public) */}
          <Route
            path='/terms'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <Terms />
                </Suspense>
              </Layout>
            }
          />

          {/* Privacy Policy (Public) */}
          <Route
            path='/privacy'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <Privacy />
                </Suspense>
              </Layout>
            }
          />

          {/* Help (Public) */}
          <Route
            path='/help'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <Help />
                </Suspense>
              </Layout>
            }
          />

          {/* Content Policy (Public) */}
          <Route
            path='/content-policy'
            element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <ContentPolicy />
                </Suspense>
              </Layout>
            }
          />

          {/* 404 catch-all */}
          <Route
            path='*'
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
