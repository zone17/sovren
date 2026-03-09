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

      const heading = screen.getByRole('heading', { name: 'Join Sovren' });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Join Sovren');
    });

    it('renders all form elements', () => {
      renderWithProviders(<Signup />);

      // Check for authentication mode selector (no emojis in new design)
      expect(screen.getByText('NOSTR Keys')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();

      // Check for NOSTR-specific elements (default mode)
      expect(screen.getByText('Sovereign Identity')).toBeInTheDocument();
      // Generate button shows in NOSTR mode
      expect(screen.getByText('Generate New Keys')).toBeInTheDocument();
    });

    it('switches between authentication modes', () => {
      renderWithProviders(<Signup />);

      // Switch to email mode
      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      // Check for email form elements
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
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
