import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import Signup from './Signup';

// Mock the auth service
vi.mock('../lib/auth', () => ({
  authService: {
    signup: vi.fn(),
    generateNostrChallenge: vi.fn(),
    authenticateNostr: vi.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{component}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Signup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the main heading', () => {
      renderWithProviders(<Signup />);

      const heading = screen.getByText('Join Sovren');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Join Sovren');
    });

    it('renders NOSTR key generation button', () => {
      renderWithProviders(<Signup />);

      // Should have Generate New Keys button (NOSTR-only signup)
      expect(screen.getByText('Generate New Keys')).toBeInTheDocument();
    });

    it('renders Independent Identity section', () => {
      renderWithProviders(<Signup />);

      // New design uses "Independent Identity" instead of "Sovereign Identity"
      expect(screen.getByText('Independent Identity')).toBeInTheDocument();
    });

    it('renders role selection', () => {
      renderWithProviders(<Signup />);

      expect(screen.getByText('I want to join as a:')).toBeInTheDocument();
      expect(screen.getByText('Supporter')).toBeInTheDocument();
      expect(screen.getByText('Creator')).toBeInTheDocument();
    });

    it('does not render email signup tab (removed)', () => {
      renderWithProviders(<Signup />);

      // Email signup tab has been removed — only NOSTR signup is available
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('generates NOSTR keys when button is clicked', async (): Promise<void> => {
      renderWithProviders(<Signup />);

      const generateButton = screen.getByText('Generate New Keys');
      fireEvent.click(generateButton);

      // Should show loading state (button becomes disabled)
      await waitFor(() => {
        expect(generateButton).toBeDisabled();
      });
    });
  });
});
