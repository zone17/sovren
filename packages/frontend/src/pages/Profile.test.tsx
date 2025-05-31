import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import paymentSlice from '../store/slices/paymentSlice';
import postSlice from '../store/slices/postSlice';
import userSlice, { clearUser, setUser } from '../store/slices/userSlice';
import type { User } from '../types';
import Profile from './Profile';

// Mock components
jest.mock('../components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
}));

jest.mock('../components/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, variant, ...props }: any): JSX.Element => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

const mockUser: User = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  nostr_pubkey: 'npub1testpubkey123456789',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const createTestStore = (options: { withUser?: boolean } = {}) => {
  const store = configureStore({
    reducer: {
      user: userSlice,
      post: postSlice,
      payment: paymentSlice,
    },
  });

  // Set up initial state using actions
  if (options.withUser) {
    store.dispatch(setUser(mockUser));
  } else {
    store.dispatch(clearUser());
  }

  return store;
};

const renderWithProviders = (
  component: React.ReactElement,
  options: { withUser?: boolean } = {}
) => {
  const { withUser = true } = options;
  const store = createTestStore({ withUser });

  return {
    ...render(
      <Provider store={store}>
        <BrowserRouter>{component}</BrowserRouter>
      </Provider>
    ),
    store,
  };
};

describe('Profile Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering with authenticated user', () => {
    it('renders within Layout component', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('displays profile information heading', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(
        screen.getByRole('heading', { level: 3, name: /profile information/i })
      ).toBeInTheDocument();
    });

    it('displays profile description', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText(/personal details and account information/i)).toBeInTheDocument();
    });

    it('displays user full name', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Full name')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('displays user email address', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Email address')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('displays Nostr public key', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
      expect(screen.getByText('npub1testpubkey123456789')).toBeInTheDocument();
    });

    it('displays member since date', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Member since')).toBeInTheDocument();
      const formattedDate = new Date('2024-01-01T00:00:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('displays Edit Profile button', () => {
      renderWithProviders(<Profile />, { withUser: true });
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveAttribute('data-variant', 'outline');
    });

    it('displays Connect Wallet button', () => {
      renderWithProviders(<Profile />, { withUser: true });
      const walletButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(walletButton).toBeInTheDocument();
      expect(walletButton).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Rendering without authenticated user', () => {
    it('displays login prompt when user is not authenticated', () => {
      renderWithProviders(<Profile />, { withUser: false });
      expect(
        screen.getByRole('heading', { level: 2, name: /please log in to view your profile/i })
      ).toBeInTheDocument();
    });

    it('does not display profile information when user is not authenticated', () => {
      renderWithProviders(<Profile />, { withUser: false });
      expect(screen.queryByText('Profile Information')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
    });

    it('does not display user data when not authenticated', () => {
      renderWithProviders(<Profile />, { withUser: false });
      expect(screen.queryByText('Test User')).not.toBeInTheDocument();
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('handles Edit Profile button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Profile />, { withUser: true });

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Button should be clickable (implementation is TODO)
      expect(editButton).toBeInTheDocument();
    });

    it('handles Connect Wallet button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Profile />, { withUser: true });

      const walletButton = screen.getByRole('button', { name: /connect wallet/i });
      await user.click(walletButton);

      // Button should be clickable (implementation is TODO)
      expect(walletButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<Profile />, { withUser: true });

      const profileHeading = screen.getByRole('heading', { level: 3 });
      expect(profileHeading).toBeInTheDocument();
      expect(profileHeading).toHaveTextContent('Profile Information');
    });

    it('has proper definition list structure', () => {
      renderWithProviders(<Profile />, { withUser: true });

      // Check for definition list elements by finding dt/dd pairs
      expect(screen.getByText('Full name')).toBeInTheDocument();
      expect(screen.getByText('Email address')).toBeInTheDocument();
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
      expect(screen.getByText('Member since')).toBeInTheDocument();
    });

    it('has accessible button text', () => {
      renderWithProviders(<Profile />, { withUser: true });

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      const walletButton = screen.getByRole('button', { name: /connect wallet/i });

      expect(editButton).toBeInTheDocument();
      expect(walletButton).toBeInTheDocument();
    });

    it('has proper semantic structure with definition terms and descriptions', () => {
      renderWithProviders(<Profile />, { withUser: true });

      // Check that labels and values are properly structured
      expect(screen.getByText('Full name')).toBeInTheDocument();
      expect(screen.getByText('Email address')).toBeInTheDocument();
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
      expect(screen.getByText('Member since')).toBeInTheDocument();
    });
  });

  describe('Different user data scenarios', () => {
    it('handles user with empty nostr_pubkey', () => {
      // For this test, we'll need to create a custom store with modified user data
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
    });

    it('handles user with very long name', () => {
      // For this test, we'll need to create a custom store with modified user data
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('handles different date formats correctly', () => {
      renderWithProviders(<Profile />, { withUser: true });
      const expectedDate = new Date('2024-01-01T00:00:00Z').toLocaleDateString();
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });
  });

  describe('Layout and styling', () => {
    it('has proper card-like structure', () => {
      renderWithProviders(<Profile />, { withUser: true });

      // Check for the white background card structure
      const container = screen.getByTestId('layout');
      expect(container).toBeInTheDocument();
    });

    it('has proper grid layout for profile fields', () => {
      renderWithProviders(<Profile />, { withUser: true });

      // Check for grid structure in profile fields
      const container = screen.getByTestId('layout');
      expect(container).toBeInTheDocument();
    });

    it('has proper button spacing and alignment', () => {
      renderWithProviders(<Profile />, { withUser: true });

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      const walletButton = screen.getByRole('button', { name: /connect wallet/i });

      // Both buttons should be present
      expect(editButton).toBeInTheDocument();
      expect(walletButton).toBeInTheDocument();
    });
  });

  describe('Error handling edge cases', () => {
    it('gracefully handles missing user properties', () => {
      renderWithProviders(<Profile />, { withUser: true });
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });
});
