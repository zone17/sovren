import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import paymentSlice from '../store/slices/paymentSlice';
import postSlice from '../store/slices/postSlice';
import userSlice from '../store/slices/userSlice';
import type { User } from '../types';
import Profile from './Profile';

// Mock Layout component
jest.mock('../components/Layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>;
  };
});

// Mock Button component
jest.mock('../components/Button', () => {
  return function MockButton({ children, onClick, variant, ...props }: any) {
    return (
      <button onClick={onClick} data-variant={variant} {...props}>
        {children}
      </button>
    );
  };
});

const mockUser: User = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  nostr_pubkey: 'npub1testpubkey123456789',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const createTestStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      user: userSlice,
      post: postSlice,
      payment: paymentSlice,
    },
    preloadedState,
  });
};

const renderWithProviders = (
  component: React.ReactElement,
  options: { preloadedState?: any } = {}
) => {
  const { preloadedState } = options;
  const store = createTestStore(preloadedState);
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter>{component}</MemoryRouter>
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
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('renders within Layout component', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('displays profile information heading', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(
        screen.getByRole('heading', { level: 3, name: /profile information/i })
      ).toBeInTheDocument();
    });

    it('displays profile description', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText(/personal details and account information/i)).toBeInTheDocument();
    });

    it('displays user full name', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText('Full name')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('displays user email address', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText('Email address')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('displays Nostr public key', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
      expect(screen.getByText('npub1testpubkey123456789')).toBeInTheDocument();
    });

    it('displays member since date', () => {
      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText('Member since')).toBeInTheDocument();
      const formattedDate = new Date('2024-01-01T00:00:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('displays Edit Profile button', () => {
      renderWithProviders(<Profile />, { preloadedState });
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveAttribute('data-variant', 'outline');
    });

    it('displays Connect Wallet button', () => {
      renderWithProviders(<Profile />, { preloadedState });
      const walletButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(walletButton).toBeInTheDocument();
      expect(walletButton).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Rendering without authenticated user', () => {
    const preloadedStateNoUser = {
      user: { currentUser: null, loading: false, error: null },
      post: { posts: [], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('displays login prompt when user is not authenticated', () => {
      renderWithProviders(<Profile />, { preloadedState: preloadedStateNoUser });
      expect(
        screen.getByRole('heading', { level: 2, name: /please log in to view your profile/i })
      ).toBeInTheDocument();
    });

    it('does not display profile information when user is not authenticated', () => {
      renderWithProviders(<Profile />, { preloadedState: preloadedStateNoUser });
      expect(screen.queryByText('Profile Information')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
    });

    it('does not display user data when not authenticated', () => {
      renderWithProviders(<Profile />, { preloadedState: preloadedStateNoUser });
      expect(screen.queryByText('Test User')).not.toBeInTheDocument();
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('handles Edit Profile button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Profile />, { preloadedState });

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Button should be clickable (implementation is TODO)
      expect(editButton).toBeInTheDocument();
    });

    it('handles Connect Wallet button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Profile />, { preloadedState });

      const walletButton = screen.getByRole('button', { name: /connect wallet/i });
      await user.click(walletButton);

      // Button should be clickable (implementation is TODO)
      expect(walletButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('has proper heading hierarchy', () => {
      renderWithProviders(<Profile />, { preloadedState });

      const profileHeading = screen.getByRole('heading', { level: 3 });
      expect(profileHeading).toBeInTheDocument();
      expect(profileHeading).toHaveTextContent('Profile Information');
    });

    it('has proper definition list structure', () => {
      renderWithProviders(<Profile />, { preloadedState });

      // Check for definition list elements
      const definitionList = screen.getByRole('list');
      expect(definitionList.tagName).toBe('DL');
    });

    it('has accessible button text', () => {
      renderWithProviders(<Profile />, { preloadedState });

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      const walletButton = screen.getByRole('button', { name: /connect wallet/i });

      expect(editButton).toHaveAccessibleName();
      expect(walletButton).toHaveAccessibleName();
    });

    it('has proper semantic structure with definition terms and descriptions', () => {
      renderWithProviders(<Profile />, { preloadedState });

      // Check that labels and values are properly structured
      expect(screen.getByText('Full name')).toBeInTheDocument();
      expect(screen.getByText('Email address')).toBeInTheDocument();
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
      expect(screen.getByText('Member since')).toBeInTheDocument();
    });
  });

  describe('Different user data scenarios', () => {
    it('handles user with empty nostr_pubkey', () => {
      const userWithoutNostr = {
        ...mockUser,
        nostr_pubkey: '',
      };

      const preloadedState = {
        user: { currentUser: userWithoutNostr, loading: false, error: null },
        post: { posts: [], currentPost: null, loading: false, error: null },
        payment: { payments: [], loading: false, error: null },
      };

      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText('Nostr Public Key')).toBeInTheDocument();
      // Should still render the field even if empty
    });

    it('handles user with very long name', () => {
      const userWithLongName = {
        ...mockUser,
        name: 'This is a very long user name that might wrap to multiple lines',
      };

      const preloadedState = {
        user: { currentUser: userWithLongName, loading: false, error: null },
        post: { posts: [], currentPost: null, loading: false, error: null },
        payment: { payments: [], loading: false, error: null },
      };

      renderWithProviders(<Profile />, { preloadedState });
      expect(
        screen.getByText('This is a very long user name that might wrap to multiple lines')
      ).toBeInTheDocument();
    });

    it('handles different date formats correctly', () => {
      const userWithDifferentDate = {
        ...mockUser,
        created_at: '2023-12-25T15:30:45Z',
      };

      const preloadedState = {
        user: { currentUser: userWithDifferentDate, loading: false, error: null },
        post: { posts: [], currentPost: null, loading: false, error: null },
        payment: { payments: [], loading: false, error: null },
      };

      renderWithProviders(<Profile />, { preloadedState });
      const expectedDate = new Date('2023-12-25T15:30:45Z').toLocaleDateString();
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });
  });

  describe('Layout and styling', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('has proper card-like structure', () => {
      renderWithProviders(<Profile />, { preloadedState });

      // Check for the white background card structure
      const container = screen.getByTestId('layout');
      const cardElement = container.querySelector('.bg-white.shadow');
      expect(cardElement).toBeInTheDocument();
    });

    it('has proper grid layout for profile fields', () => {
      renderWithProviders(<Profile />, { preloadedState });

      // Check for grid structure in profile fields
      const container = screen.getByTestId('layout');
      const gridElements = container.querySelectorAll('.sm\\:grid');
      expect(gridElements.length).toBeGreaterThan(0);
    });

    it('has proper button spacing and alignment', () => {
      renderWithProviders(<Profile />, { preloadedState });

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      const walletButton = screen.getByRole('button', { name: /connect wallet/i });

      // Buttons should be in the same container
      const buttonContainer = editButton.closest('.space-x-4');
      expect(buttonContainer).toContain(walletButton);
    });
  });

  describe('Error handling edge cases', () => {
    it('gracefully handles missing user properties', () => {
      const incompleteUser = {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        // Missing other properties but component should still render
      } as User;

      const preloadedState = {
        user: { currentUser: incompleteUser, loading: false, error: null },
        post: { posts: [], currentPost: null, loading: false, error: null },
        payment: { payments: [], loading: false, error: null },
      };

      renderWithProviders(<Profile />, { preloadedState });
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });
});
