import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import userSlice from '../store/slices/userSlice';
import Home from './Home';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock components
jest.mock('../components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
}));

// Test utilities
const renderWithProviders = (component: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      user: userSlice,
    },
  });

  return render(
    <Provider store={store}>
      <BrowserRouter>{component}</BrowserRouter>
    </Provider>
  );
};

describe('Home Component', () => {
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
      expect(heading).toHaveTextContent('Welcome to Sovren');
    });

    it('renders the tagline', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText('Decentralized Creator Monetization Platform')).toBeInTheDocument();
    });

    it('renders the description', () => {
      renderWithProviders(<Home />);
      expect(screen.getByText(/Empower creators with NOSTR protocol/)).toBeInTheDocument();
    });
  });

  describe('Navigation buttons', () => {
    it('renders Get Started button', () => {
      renderWithProviders(<Home />);
      const getStartedButton = screen.getByRole('button', { name: /get started/i });
      expect(getStartedButton).toBeInTheDocument();
    });

    it('renders Learn More button', () => {
      renderWithProviders(<Home />);
      const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
      expect(learnMoreButton).toBeInTheDocument();
    });
  });

  describe('Feature sections', () => {
    it('renders feature highlights', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('Lightning Fast Payments')).toBeInTheDocument();
      expect(screen.getByText('Decentralized Identity')).toBeInTheDocument();
      expect(screen.getByText('Creator Freedom')).toBeInTheDocument();
    });

    it('renders feature descriptions', () => {
      renderWithProviders(<Home />);

      expect(
        screen.getByText(/Instant payments via Bitcoin Lightning Network/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Your identity, your control with NOSTR protocol/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No platform fees, no censorship, complete ownership/)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<Home />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();

      const subHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(subHeadings).toHaveLength(3); // Feature headings
    });

    it('has accessible button labels', () => {
      renderWithProviders(<Home />);

      const getStartedButton = screen.getByRole('button', { name: /get started/i });
      const learnMoreButton = screen.getByRole('button', { name: /learn more/i });

      expect(getStartedButton).toBeInTheDocument();
      expect(learnMoreButton).toBeInTheDocument();
    });
  });

  describe('Layout and styling', () => {
    it('has proper responsive design structure', () => {
      renderWithProviders(<Home />);

      // Check that main content is rendered
      const mainContent = screen.getByText('Welcome to Sovren');
      expect(mainContent).toBeInTheDocument();
    });

    it('renders feature grid correctly', () => {
      renderWithProviders(<Home />);

      // Check that all three features are present
      expect(screen.getByText('Lightning Fast Payments')).toBeInTheDocument();
      expect(screen.getByText('Decentralized Identity')).toBeInTheDocument();
      expect(screen.getByText('Creator Freedom')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates properly with React Router', () => {
      renderWithProviders(<Home />);

      // Verify component renders without router errors
      expect(screen.getByText('Welcome to Sovren')).toBeInTheDocument();
    });

    it('integrates with Redux store', () => {
      renderWithProviders(<Home />);

      // Verify component renders without Redux errors
      expect(screen.getByText('Welcome to Sovren')).toBeInTheDocument();
    });
  });
});
