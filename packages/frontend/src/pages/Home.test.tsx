import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import userSlice from '../store/slices/userSlice';
import Home from './Home';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock(
  'react-router-dom',
  async (): Promise<Record<string, unknown>> => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): any => mockNavigate,
  })
);

// Test utilities with AuthProvider wrapper
const renderWithProviders = (component: React.ReactElement): ReturnType<typeof render> => {
  const store = configureStore({
    reducer: {
      user: userSlice,
    },
  });

  return render(
    <AuthProvider>
      <Provider store={store}>
        <BrowserRouter>{component}</BrowserRouter>
      </Provider>
    </AuthProvider>
  );
};

describe('Home Component - Code of Craft Standards', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('renders without errors', () => {
      expect(() => renderWithProviders(<Home />)).not.toThrow();
    });

    it('renders the main heading', () => {
      renderWithProviders(<Home />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Unleash Your Creative Sovereignty');
    });

    it('renders the subheading', () => {
      renderWithProviders(<Home />);
      expect(
        screen.getByText(/Monetize your audience\. Own your platform/i)
      ).toBeInTheDocument();
    });

    it('renders NOSTR & Lightning badge in footer', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/Powered by NOSTR & Lightning Network/i)).toBeInTheDocument();
    });
  });

  describe('Navigation buttons', () => {
    it('renders Start Your Sovren Journey button', () => {
      renderWithProviders(<Home />);
      const btn = screen.getByRole('button', { name: /Start Your Sovren Journey/i });
      expect(btn).toBeInTheDocument();
    });

    it('renders See How Sovren Works button', () => {
      renderWithProviders(<Home />);
      const btn = screen.getByRole('button', { name: /See How Sovren Works/i });
      expect(btn).toBeInTheDocument();
    });
  });

  describe('Benefits sections', () => {
    it('renders True Ownership benefit', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('True Ownership')).toBeInTheDocument();
    });

    it('renders Bitcoin Monetization benefit', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Bitcoin Monetization')).toBeInTheDocument();
    });

    it('renders Elite Community benefit', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Elite Community')).toBeInTheDocument();
    });

    it('renders Why Sovren? heading', () => {
      renderWithProviders(<Home />);
      expect(screen.getByRole('heading', { level: 2, name: /Why Sovren\?/i })).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    it('renders the open source description text', () => {
      renderWithProviders(<Home />);
      expect(
        screen.getByText(/Built by creators, for creators/i)
      ).toBeInTheDocument();
    });

    it('renders no deplatforming bullet', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/No deplatforming. No middlemen./i)).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates properly with React Router', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Unleash Your Creative Sovereignty')).toBeInTheDocument();
    });

    it('integrates with Redux store', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Unleash Your Creative Sovereignty')).toBeInTheDocument();
    });
  });
});
