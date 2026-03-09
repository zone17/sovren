import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import Profile from './Profile';

// Test user types
type TestUser = {
  id: string;
  name?: string;
  username?: string;
  email: string;
  nostr_pubkey?: string;
  role: 'creator' | 'supporter' | 'admin';
  permissions: string[];
  created_at: Date;
  lastLogin: Date;
};

// Mock user data
const mockCreatorUser: TestUser = {
  id: '1',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  nostr_pubkey: 'npub1testpubkey123456789abcdef',
  role: 'creator',
  permissions: ['read', 'write'],
  created_at: new Date('2023-12-31'),
  lastLogin: new Date('2024-01-01T00:00:00Z'),
};

const mockSupporterUser: TestUser = {
  id: '2',
  name: 'Supporter User',
  username: 'supporter',
  email: 'supporter@example.com',
  role: 'supporter',
  permissions: ['read'],
  created_at: new Date('2023-12-01T00:00:00Z'),
  lastLogin: new Date('2024-01-01T00:00:00Z'),
};

const mockAdminUser: TestUser = {
  id: '3',
  name: 'Admin User',
  username: 'admin',
  email: 'admin@example.com',
  nostr_pubkey: 'npub1adminpubkey123456789abcdef',
  role: 'admin',
  permissions: ['read', 'write', 'admin'],
  created_at: new Date('2023-11-01T00:00:00Z'),
  lastLogin: new Date('2024-01-01T00:00:00Z'),
};

const mockEmailUser: TestUser = {
  id: '4',
  name: 'Email User',
  username: 'emailuser',
  email: 'email@example.com',
  role: 'creator',
  permissions: ['read', 'write'],
  created_at: new Date('2023-10-01T00:00:00Z'),
  lastLogin: new Date('2024-01-01T00:00:00Z'),
};

// Mock logout function
const mockLogout = vi.fn();

// Current user for test context switching
let currentTestUser: TestUser = mockCreatorUser;

// Mock the entire AuthContext module with correct path
vi.mock('../features/auth/services/AuthContext', () => {
  const originalModule = vi.importActual('../features/auth/services/AuthContext');

  return {
    ...originalModule,
    useAuth: vi.fn(() => ({
      user: currentTestUser,
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      signup: vi.fn(),
      logout: mockLogout,
      authenticateNostr: vi.fn(),
      generateNostrChallenge: vi.fn(),
      refreshToken: vi.fn(),
      updateProfile: vi.fn(),
      verifyEmail: vi.fn(),
      resetPassword: vi.fn(),
    })),
    AuthProvider: ({ children }: { children: React.ReactNode }) => {
      return React.createElement('div', { 'data-testid': 'mock-auth-provider' }, children);
    },
  };
});

// Elite render function with AuthProvider wrapper
const renderWithTestWrapper = (user: TestUser = mockCreatorUser): void => {
  currentTestUser = user;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Profile />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Profile Component', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    currentTestUser = mockCreatorUser;
  });

  describe('User Information Display', () => {
    it('renders user name as main heading', () => {
      renderWithTestWrapper();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Test User');
    });

    it('displays user role', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Creator')).toBeInTheDocument();
    });

    it('shows member since date', () => {
      renderWithTestWrapper();

      expect(screen.getByText(/Member since/i)).toBeInTheDocument();
    });

    it('displays logout button', () => {
      renderWithTestWrapper();

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      expect(logoutButton).toBeInTheDocument();
    });
  });

  describe('NOSTR Authentication Display', () => {
    it('shows NOSTR identity section when user has nostr_pubkey', () => {
      renderWithTestWrapper();

      expect(screen.getByText('NOSTR Identity')).toBeInTheDocument();
      expect(screen.getByText(/using decentralized NOSTR authentication/)).toBeInTheDocument();
    });

    it('displays the public key', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Public Key (npub)')).toBeInTheDocument();
      expect(screen.getByText('npub1testpubkey123456789abcdef')).toBeInTheDocument();
    });

    it('shows NOSTR benefits list', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Benefits of NOSTR Authentication:')).toBeInTheDocument();
      expect(screen.getByText('• True ownership of your identity')).toBeInTheDocument();
      expect(screen.getByText('• Works across all NOSTR apps')).toBeInTheDocument();
      expect(screen.getByText('• No vendor lock-in')).toBeInTheDocument();
    });

    it('shows Lightning Network setup for creators', () => {
      renderWithTestWrapper();

      // Lightning Network appears in both creator tools and platform info sections
      expect(screen.getAllByText('Lightning Network').length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText('Accept instant Bitcoin payments from your supporters.')
      ).toBeInTheDocument();

      const setupButton = screen.getByRole('button', { name: 'Setup Lightning Wallet' });
      expect(setupButton).toBeInTheDocument();
    });
  });

  describe('Role-Specific Features', () => {
    it('shows creator features when user is a creator', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Creator Tools')).toBeInTheDocument();
      expect(screen.getByText('Create and publish content')).toBeInTheDocument();
      expect(screen.getByText('Receive Lightning payments')).toBeInTheDocument();
      expect(screen.getByText('Analytics dashboard')).toBeInTheDocument();
    });
  });

  describe('Account Settings', () => {
    it('displays account settings section', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Account Settings')).toBeInTheDocument();
    });

    it('shows settings action buttons', () => {
      renderWithTestWrapper();

      expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Security Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export NOSTR Keys' })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles logout button click', async (): Promise<void> => {
      renderWithTestWrapper();

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('handles Lightning wallet setup button click', () => {
      renderWithTestWrapper();

      const setupButton = screen.getByRole('button', { name: 'Setup Lightning Wallet' });
      fireEvent.click(setupButton);

      expect(setupButton).toBeInTheDocument();
    });

    it('handles edit profile button click', () => {
      renderWithTestWrapper();

      const editButton = screen.getByRole('button', { name: 'Edit Profile' });
      fireEvent.click(editButton);

      expect(editButton).toBeInTheDocument();
    });
  });

  describe('Platform Information', () => {
    it('displays Sovren welcome section', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Welcome to Sovren')).toBeInTheDocument();
      expect(
        screen.getByText(
          'The decentralized creator platform that gives you true ownership and freedom.'
        )
      ).toBeInTheDocument();
    });

    it('shows platform technologies', () => {
      renderWithTestWrapper();

      expect(screen.getByText('NOSTR Protocol')).toBeInTheDocument();
      expect(screen.getAllByText('Lightning Network').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Self-Sovereign Identity')).toBeInTheDocument();
    });

    it('displays Lightning address information', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Your Lightning Address')).toBeInTheDocument();
      expect(
        screen.getByText(
          "This is how people can send you Bitcoin payments. It's like an email address for money."
        )
      ).toBeInTheDocument();
    });

    it('shows content creation guidance', () => {
      renderWithTestWrapper();

      expect(screen.getByText('Content Creation')).toBeInTheDocument();
      expect(
        screen.getByText(
          "Start creating content and building your audience. You'll earn Bitcoin for every like, comment, and support from your followers."
        )
      ).toBeInTheDocument();
    });
  });
});

// Test different user roles
describe('Profile Component - Different Roles', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('shows supporter features for supporter role', () => {
    renderWithTestWrapper(mockSupporterUser);

    expect(screen.getByText('Supporter')).toBeInTheDocument();
  });

  it('shows admin features for admin role', () => {
    renderWithTestWrapper(mockAdminUser);

    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });
});

// Test email authentication fallback
describe('Profile Component - Email Authentication', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('shows email authentication when no NOSTR key', () => {
    renderWithTestWrapper(mockEmailUser);

    expect(screen.getByText('Email Authentication')).toBeInTheDocument();
    expect(screen.getByText(/using traditional email authentication/)).toBeInTheDocument();
    expect(screen.getByText('email@example.com')).toBeInTheDocument();
  });
});
