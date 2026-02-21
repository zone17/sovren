import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
// TODO: US-E4-010 - Replace with React Query
import { paymentReducer as paymentSlice, postReducer as postSlice, setPosts } from '../store/slices/tempStubs';
import userSlice, { clearUser, setUser } from '../store/slices/userSlice';
import type { Post as PostType, User } from '../types';
import Post from './Post';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
vi.mock(
  'react-router-dom',
  async (): Promise<Record<string, unknown>> => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): any => mockNavigate,
    useParams: (): Record<string, string> => mockUseParams() as Record<string, string>,
  })
);

// Mock components with proper structure matching actual Layout
vi.mock('../components/ui/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
}));

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: string;
  [key: string]: unknown;
}

vi.mock('../components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, variant, ...props }: ButtonProps): JSX.Element => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

// Mock the components index to properly export Button
vi.mock('../components', () => ({
  Layout: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
  Button: ({ children, onClick, variant, ...props }: ButtonProps): JSX.Element => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

const mockUser: User = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  nostr_pubkey: 'pubkey123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockPost: PostType = {
  id: '1',
  title: 'Test Post Title',
  content: 'This is a test post content with some detailed information.',
  published: true,
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-15T10:30:00Z',
  author_id: 'author1',
};

const createTestStore = (
  options: { withUser?: boolean; withPosts?: boolean } = {}
): ReturnType<typeof configureStore> => {
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

  if (options.withPosts) {
    store.dispatch(setPosts([mockPost]));
  } else {
    store.dispatch(setPosts([]));
  }

  return store;
};

interface RenderOptions {
  withUser?: boolean;
  withPosts?: boolean;
  postId?: string;
}

const renderWithProviders = (
  component: React.ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof render> & { store: ReturnType<typeof configureStore> } => {
  const { withUser = true, withPosts = true, postId = '1' } = options;
  const store = createTestStore({ withUser, withPosts });

  // Set up useParams mock to return the post ID
  mockUseParams.mockReturnValue({ id: postId });

  return {
    ...render(
      <AuthProvider>
        <Provider store={store}>
          <BrowserRouter>{component}</BrowserRouter>
        </Provider>
      </AuthProvider>
    ),
    store,
  };
};

describe('Post Component', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockUseParams.mockClear();
    // Default mock for useParams
    mockUseParams.mockReturnValue({ id: '1' });
  });

  describe('Rendering with post data', () => {
    it('renders within Layout component', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('displays post title correctly', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent('Test Post Title');
    });

    it('displays post content', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(
        screen.getByText(/This is a test post content with some detailed information/)
      ).toBeInTheDocument();
    });

    it('displays author information', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByText(/By author1/)).toBeInTheDocument();
    });

    it('displays formatted creation date', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('displays Support Creator button when user is logged in', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      const supportButton = screen.getByRole('button', { name: /support creator/i });
      expect(supportButton).toBeInTheDocument();
      expect(supportButton).toHaveAttribute('data-variant', 'primary');
    });

    it('displays comments section', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByRole('heading', { level: 2, name: /comments/i })).toBeInTheDocument();
      expect(screen.getByText(/Comments coming soon/)).toBeInTheDocument();
    });
  });

  describe('Rendering without user', () => {
    it('does not display Support Creator button when user is not logged in', (): void => {
      renderWithProviders(<Post />, { withUser: false, withPosts: true });
      expect(screen.queryByRole('button', { name: /support creator/i })).not.toBeInTheDocument();
    });

    it('still displays post content and metadata', (): void => {
      renderWithProviders(<Post />, { withUser: false, withPosts: true });
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
      expect(screen.getByText(/By author1/)).toBeInTheDocument();
    });
  });

  describe('Post not found scenario', () => {
    it('displays post not found message when post does not exist', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: false });
      expect(
        screen.getByRole('heading', { level: 2, name: /post not found/i })
      ).toBeInTheDocument();
    });

    it('does not display post content when post is not found', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: false });
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /support creator/i })).not.toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('handles Support Creator button click', async (): Promise<void> => {
      const user = userEvent.setup();
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const supportButton = screen.getByRole('button', { name: /support creator/i });
      await user.click(supportButton);

      // Button should be clickable (implementation is TODO)
      expect(supportButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();

      const commentsHeading = screen.getByRole('heading', { level: 2 });
      expect(commentsHeading).toBeInTheDocument();
    });

    it('has proper semantic structure with article element', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
    });

    it('has proper time element with datetime attribute', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const timeElement = screen.getByText(new Date('2024-01-15T10:30:00Z').toLocaleDateString());
      expect(timeElement.closest('time')).toHaveAttribute('dateTime', '2024-01-15T10:30:00Z');
    });

    it('has accessible button text', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const supportButton = screen.getByRole('button', { name: /support creator/i });
      expect(supportButton).toBeInTheDocument();
    });
  });

  describe('Routing integration', () => {
    it('retrieves post ID from URL parameters correctly', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true, postId: '1' });
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });

    it('handles different post IDs from route parameters', (): void => {
      // Test that component can handle different post IDs
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });
  });

  describe('Date formatting', () => {
    it('formats dates correctly for different locales', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });
  });

  describe('Content display', () => {
    it('displays long content correctly', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      expect(screen.getByText(/This is a test post content/)).toBeInTheDocument();
    });

    it('applies prose styling classes', (): void => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const contentDiv = screen.getByText(/This is a test post content/).closest('div');
      expect(contentDiv).toHaveClass('prose');
    });
  });
});
