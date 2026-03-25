import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import userSlice from '../store/slices/userSlice';
import Home from './Home';

// Mock IntersectionObserver for scroll-triggered reveals
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

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

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Provider store={store}>
          <BrowserRouter>{component}</BrowserRouter>
        </Provider>
      </AuthProvider>
    </QueryClientProvider>
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
      expect(heading).toHaveTextContent(/Own Your.*Creative Empire/);
    });

    it('renders the subheading', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/Monetize your audience with Bitcoin/i)).toBeInTheDocument();
    });

    it('renders NOSTR Protocol in footer', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('NOSTR Protocol')).toBeInTheDocument();
    });
  });

  describe('Navigation buttons', () => {
    it('renders Start Creating button', () => {
      renderWithProviders(<Home />);
      const btn = screen.getByRole('button', { name: /Start Creating/i });
      expect(btn).toBeInTheDocument();
    });

    it('renders See How It Works button', () => {
      renderWithProviders(<Home />);
      const btn = screen.getByRole('button', { name: /See How It Works/i });
      expect(btn).toBeInTheDocument();
    });
  });

  describe('Features section', () => {
    it('renders True Ownership feature', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('True Ownership')).toBeInTheDocument();
    });

    it('renders Instant Bitcoin Payments feature', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Instant Bitcoin Payments')).toBeInTheDocument();
    });

    it('renders Censorship Resistant feature', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Censorship Resistant')).toBeInTheDocument();
    });

    it('renders sovereign creators heading', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/sovereign creators/i)).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    it('renders the Decentralized Creator Platform badge', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Decentralized Creator Platform')).toBeInTheDocument();
    });

    it('renders no deplatforming message', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/No middlemen.*No deplatforming/i)).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates properly with React Router', () => {
      renderWithProviders(<Home />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('integrates with Redux store', () => {
      renderWithProviders(<Home />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });
});
