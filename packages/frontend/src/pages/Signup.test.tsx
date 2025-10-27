import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import Signup from './Signup';

// Mock the auth service
jest.mock('../lib/auth', () => ({
  authService: {
    signup: jest.fn(),
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

describe('Signup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the main heading', () => {
      renderWithProviders(<Signup />);

      const heading = screen.getByRole('heading', { level: 3, name: 'Join Sovren' });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Join Sovren');
    });

    it('renders all form elements', () => {
      renderWithProviders(<Signup />);

      // Check for authentication mode selector
      expect(screen.getByText('🌐 NOSTR Keys')).toBeInTheDocument();
      expect(screen.getByText('📧 Email')).toBeInTheDocument();

      // Check for NOSTR-specific elements (default mode)
      expect(screen.getByText('🔐 Sovereign Identity')).toBeInTheDocument();
      expect(screen.getByText('Generate Your NOSTR Keys')).toBeInTheDocument();
    });

    it('switches between authentication modes', () => {
      renderWithProviders(<Signup />);

      // Switch to email mode
      const emailTab = screen.getByText('📧 Email');
      fireEvent.click(emailTab);

      // Check for email form elements
      expect(screen.getByLabelText('Full name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('generates NOSTR keys when button is clicked', async (): Promise<void> => {
      renderWithProviders(<Signup />);

      const generateButton = screen.getByText('🎲 Generate My NOSTR Keys');
      fireEvent.click(generateButton);

      // Should show loading state
      await waitFor(() => {
        expect(generateButton).toBeDisabled();
      });
    });
  });
});
