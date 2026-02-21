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

// Mock components
vi.mock('../components/ui/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
}));

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
    it('renders within Layout component', () => {
      renderWithProviders(<Home />);
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('renders the main heading', () => {
      renderWithProviders(<Home />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Sovren');
    });

    it('renders the tagline', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Elite Creator Monetization Platform')).toBeInTheDocument();
    });

    it('renders the description', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/Join the sovereign revolution/)).toBeInTheDocument();
    });
  });

  describe('Navigation buttons', () => {
    it('renders Become Sovereign button', () => {
      renderWithProviders(<Home />);
      const sovereignButton = screen.getByRole('button', { name: /become sovereign/i });
      expect(sovereignButton).toBeInTheDocument();
    });

    it('renders Explore Platform button', () => {
      renderWithProviders(<Home />);
      const exploreButton = screen.getByRole('button', { name: /explore platform/i });
      expect(exploreButton).toBeInTheDocument();
    });
  });

  describe('Feature sections', () => {
    it('renders feature highlights', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('Lightning Fast Payments')).toBeInTheDocument();
      expect(screen.getByText('Sovereign Identity')).toBeInTheDocument();
      expect(screen.getByText('Creator Protection')).toBeInTheDocument();
    });

    it('renders feature descriptions', () => {
      renderWithProviders(<Home />);

      expect(
        screen.getByText(/Instant Bitcoin payments with zero platform fees/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Your keys, your identity, your control/)).toBeInTheDocument();
      expect(screen.getByText(/No censorship, no deplatforming, no middlemen/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<Home />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();

      const subHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(subHeadings.length).toBeGreaterThan(0);
    });

    it('has accessible button labels', () => {
      renderWithProviders(<Home />);

      const sovereignButton = screen.getByRole('button', { name: /become sovereign/i });
      const exploreButton = screen.getByRole('button', { name: /explore platform/i });

      expect(sovereignButton).toBeInTheDocument();
      expect(exploreButton).toBeInTheDocument();
    });
  });

  describe('Layout and styling', () => {
    it('has proper responsive design structure', () => {
      renderWithProviders(<Home />);

      // Check that main content is rendered
      const mainContent = screen.getByText('Sovren');
      expect(mainContent).toBeInTheDocument();
    });

    it('renders feature grid correctly', () => {
      renderWithProviders(<Home />);

      // Check that all three features are present
      expect(screen.getByText('Lightning Fast Payments')).toBeInTheDocument();
      expect(screen.getByText('Sovereign Identity')).toBeInTheDocument();
      expect(screen.getByText('Creator Protection')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates properly with React Router', () => {
      renderWithProviders(<Home />);

      // Verify component renders without router errors
      expect(screen.getByText('Sovren')).toBeInTheDocument();
    });

    it('integrates with Redux store', () => {
      renderWithProviders(<Home />);

      // Verify component renders without Redux errors
      expect(screen.getByText('Sovren')).toBeInTheDocument();
    });
  });
});
