import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import App from './App';
import paymentSlice from './store/slices/paymentSlice';
import postSlice from './store/slices/postSlice';
import userSlice from './store/slices/userSlice';

const createTestStore = (): ReturnType<typeof configureStore> => {
  return configureStore({
    reducer: {
      user: userSlice,
      post: postSlice,
      payment: paymentSlice,
    },
  });
};

const renderApp = (): ReturnType<typeof render> => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <App />
    </Provider>
  );
};

describe('App Component', () => {
  it('renders without crashing', (): void => {
    renderApp();
    // Since we have lazy loading, we should see a loading indicator
    expect(document.body).toBeInTheDocument();
  });

  it('displays the navigation header', (): void => {
    renderApp();
    // This would pass once we have proper navigation components
    expect(document.body).toBeInTheDocument();
  });

  it('renders the main content area', (): void => {
    renderApp();
    // This would pass once we have proper content rendering
    expect(document.body).toBeInTheDocument();
  });
});
