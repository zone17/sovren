import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import Login from './Login';

// Mock the auth service
vi.mock('../lib/auth', () => ({
  authService: {
    login: vi.fn(),
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

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the main heading', () => {
      renderWithProviders(<Login />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Sign in to Sovren');
    });

    it('renders authentication mode selector', () => {
      renderWithProviders(<Login />);

      expect(screen.getByText('NOSTR Keys')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('shows NOSTR authentication by default', () => {
      renderWithProviders(<Login />);

      expect(screen.getByText('Sovereign Authentication')).toBeInTheDocument();
    });

    it('switches to email mode when clicked', () => {
      renderWithProviders(<Login />);

      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('renders signup link correctly', () => {
      renderWithProviders(<Login />);

      expect(screen.getByText('Create account')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('allows switching between authentication modes', () => {
      renderWithProviders(<Login />);

      // Default should be NOSTR
      expect(screen.getByText('Sovereign Authentication')).toBeInTheDocument();

      // Switch to email
      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      // Should show email form
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();

      // Switch back to NOSTR
      const nostrTab = screen.getByText('NOSTR Keys');
      fireEvent.click(nostrTab);

      // Should show NOSTR form again
      expect(screen.getByText('Sovereign Authentication')).toBeInTheDocument();
    });

    it('handles email input', () => {
      renderWithProviders(<Login />);

      // Switch to email mode
      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });
  });

  describe('Form Validation', () => {
    it('disables email sign in button when credentials are missing', () => {
      renderWithProviders(<Login />);

      // Switch to email mode
      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      const signInButton = screen.getByText('Sign in with Email');
      expect(signInButton).toBeDisabled();
    });

    it('enables email sign in button when credentials are provided', () => {
      renderWithProviders(<Login />);

      // Switch to email mode
      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const signInButton = screen.getByText('Sign in with Email');
      expect(signInButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels for email mode', () => {
      renderWithProviders(<Login />);

      // Switch to email mode
      const emailTab = screen.getByText('Email');
      fireEvent.click(emailTab);

      expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    it('has proper heading structure', () => {
      renderWithProviders(<Login />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Sign in to Sovren');
    });
  });
});
