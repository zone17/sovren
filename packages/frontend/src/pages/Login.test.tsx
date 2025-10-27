import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import Login from './Login';

// Mock the auth service
jest.mock('../lib/auth', () => ({
  authService: {
    login: jest.fn(),
    generateNostrChallenge: jest.fn(),
    authenticateNostr: jest.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement): void => {
  render(
    <BrowserRouter>
      <AuthProvider>{component}</AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      // Check for authentication mode tabs
      expect(screen.getByText('🌐 NOSTR Keys')).toBeInTheDocument();
      expect(screen.getByText('📧 Email')).toBeInTheDocument();
    });

    it('shows NOSTR authentication by default', () => {
      renderWithProviders(<Login />);

      // Check for NOSTR-specific elements (default mode)
      expect(screen.getByText('🔐 Sovereign Authentication')).toBeInTheDocument();
      expect(screen.getByLabelText('Public Key (npub...)')).toBeInTheDocument();
      expect(screen.getByLabelText('Private Key (nsec...)')).toBeInTheDocument();
    });

    it('switches to email mode when clicked', () => {
      renderWithProviders(<Login />);

      // Switch to email mode
      const emailTab = screen.getByText('📧 Email');
      fireEvent.click(emailTab);

      // Check for email form elements
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
      expect(screen.getByText('🔐 Sovereign Authentication')).toBeInTheDocument();

      // Switch to email
      const emailTab = screen.getByText('📧 Email');
      fireEvent.click(emailTab);

      // Should show email form
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();

      // Switch back to NOSTR
      const nostrTab = screen.getByText('🌐 NOSTR Keys');
      fireEvent.click(nostrTab);

      // Should show NOSTR form again
      expect(screen.getByText('🔐 Sovereign Authentication')).toBeInTheDocument();
    });

    it('handles NOSTR key input', () => {
      renderWithProviders(<Login />);

      const publicKeyInput = screen.getByLabelText('Public Key (npub...)');
      const privateKeyInput = screen.getByLabelText('Private Key (nsec...)');

      fireEvent.change(publicKeyInput, { target: { value: 'npub1test123' } });
      fireEvent.change(privateKeyInput, { target: { value: 'nsec1test123' } });

      expect(publicKeyInput).toHaveValue('npub1test123');
      expect(privateKeyInput).toHaveValue('nsec1test123');
    });

    it('generates new NOSTR keys when generate button is clicked', async (): Promise<void> => {
      renderWithProviders(<Login />);

      const generateButton = screen.getByText('🎲 Generate New Keys');
      fireEvent.click(generateButton);

      // Should show loading state
      await waitFor(() => {
        expect(generateButton).toBeDisabled();
      });
    });
  });

  describe('Form Validation', () => {
    it('disables NOSTR sign in button when keys are missing', () => {
      renderWithProviders(<Login />);

      const signInButton = screen.getByText('🌐 Sign In with NOSTR');
      expect(signInButton).toBeDisabled();
    });

    it('enables NOSTR sign in button when keys are provided', () => {
      renderWithProviders(<Login />);

      const publicKeyInput = screen.getByLabelText('Public Key (npub...)');
      const privateKeyInput = screen.getByLabelText('Private Key (nsec...)');

      fireEvent.change(publicKeyInput, { target: { value: 'npub1test123' } });
      fireEvent.change(privateKeyInput, { target: { value: 'nsec1test123' } });

      const signInButton = screen.getByText('🌐 Sign In with NOSTR');
      expect(signInButton).not.toBeDisabled();
    });

    it('disables email sign in button when credentials are missing', () => {
      renderWithProviders(<Login />);

      // Switch to email mode
      const emailTab = screen.getByText('📧 Email');
      fireEvent.click(emailTab);

      const signInButton = screen.getByText('📧 Sign In with Email');
      expect(signInButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWithProviders(<Login />);

      // NOSTR mode labels
      expect(screen.getByLabelText('Public Key (npub...)')).toHaveAttribute('id', 'publicKey');
      expect(screen.getByLabelText('Private Key (nsec...)')).toHaveAttribute('id', 'privateKey');

      // Switch to email mode
      const emailTab = screen.getByText('📧 Email');
      fireEvent.click(emailTab);

      // Email mode labels
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
