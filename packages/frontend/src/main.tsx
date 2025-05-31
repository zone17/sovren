import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import MonitoringDashboard from './components/MonitoringDashboard';
import './index.css';
import ErrorBoundary from './monitoring/ErrorBoundary';
import { initMonitoring } from './monitoring/simpleMonitoring';
import { store } from './store';

// Initialize monitoring
initMonitoring();

// Initialize performance monitoring
console.log('🔍 Performance monitoring initialized');

// Add global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Our simple monitoring handles this automatically
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary level="page" name="Application">
      <Provider store={store}>
        <BrowserRouter>
          <App />
          <MonitoringDashboard />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
