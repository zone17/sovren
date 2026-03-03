import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import ErrorBoundary from './monitoring/ErrorBoundary';
import { initMonitoring } from './monitoring/simpleMonitoring';
import { initSentry } from './monitoring/sentry';
import { reportWebVitals } from './monitoring/web-vitals';
import { store } from './store';

// Initialize Sentry first (before React renders)
initSentry();

// Initialize simple monitoring (breadcrumbs, local error tracking)
initMonitoring();

// Create QueryClient with optimized configuration for analytics
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 0,
    },
  },
});

// Add global error handler for unhandled promise rejections
if (typeof globalThis !== 'undefined' && globalThis.window) {
  globalThis.window.addEventListener('unhandledrejection', (event) => {
    // eslint-disable-next-line no-console
    globalThis.console?.error('Unhandled promise rejection:', event.reason);
    // Our simple monitoring handles this automatically
  });
}

// Report Web Vitals (LCP, FID/INP, CLS) to Sentry performance
reportWebVitals();

const rootElement = globalThis.document?.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary level="global" name="Application">
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <App />
            </BrowserRouter>
            {import.meta.env.NODE_ENV === 'development' && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </QueryClientProvider>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
