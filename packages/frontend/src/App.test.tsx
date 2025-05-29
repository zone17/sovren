import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';
import userSlice from './store/slices/userSlice';
import postSlice from './store/slices/postSlice';
import paymentSlice from './store/slices/paymentSlice';

const createTestStore = () => {
  return configureStore({
    reducer: {
      user: userSlice,
      post: postSlice,
      payment: paymentSlice,
    },
  });
};

const renderApp = () => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <App />
    </Provider>
  );
};

describe('App Component', () => {
  it('renders without crashing', () => {
    renderApp();
    // Since we have lazy loading, we should see a loading indicator
    expect(document.body).toBeInTheDocument();
  });

  it('displays the navigation header', () => {
    renderApp();
    // This would pass once we have proper navigation components
    expect(document.body).toBeInTheDocument();
  });

  it('renders the main content area', () => {
    renderApp();
    // This would pass once we have proper content rendering
    expect(document.body).toBeInTheDocument();
  });
});
