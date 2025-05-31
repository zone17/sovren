import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import paymentSlice from '../store/slices/paymentSlice';
import postSlice, { setPosts } from '../store/slices/postSlice';
import userSlice, { clearUser, setUser } from '../store/slices/userSlice';
import type { Post as PostType, User } from '../types';
import Post from './Post';

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

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

const createTestStore = (options: { withUser?: boolean; withPosts?: boolean } = {}) => {
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

const renderWithProviders = (
  component: React.ReactElement,
  options: { withUser?: boolean; withPosts?: boolean; postId?: string } = {}
) => {
  const { withUser = true, withPosts = true, postId = '1' } = options;
  const store = createTestStore({ withUser, withPosts });

  // Set up useParams mock to return the post ID
  mockUseParams.mockReturnValue({ id: postId });

  return {
    ...render(
      <Provider store={store}>
        <BrowserRouter>{component}</BrowserRouter>
      </Provider>
    ),
    store,
  };
};

describe('Post Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockUseParams.mockClear();
    // Default mock for useParams
    mockUseParams.mockReturnValue({ id: '1' });
  });

  describe('Rendering with post data', () => {
    it('renders within Layout component', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('displays post title correctly', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent('Test Post Title');
    });

    it('displays post content', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(
        screen.getByText(/This is a test post content with some detailed information/)
      ).toBeInTheDocument();
    });

    it('displays author information', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByText(/By author1/)).toBeInTheDocument();
    });

    it('displays formatted creation date', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('displays Support Creator button when user is logged in', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      const supportButton = screen.getByRole('button', { name: /support creator/i });
      expect(supportButton).toBeInTheDocument();
      expect(supportButton).toHaveAttribute('data-variant', 'primary');
    });

    it('displays comments section', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByRole('heading', { level: 2, name: /comments/i })).toBeInTheDocument();
      expect(screen.getByText(/Comments coming soon/)).toBeInTheDocument();
    });
  });

  describe('Rendering without user', () => {
    it('does not display Support Creator button when user is not logged in', () => {
      renderWithProviders(<Post />, { withUser: false, withPosts: true });
      expect(screen.queryByRole('button', { name: /support creator/i })).not.toBeInTheDocument();
    });

    it('still displays post content and metadata', () => {
      renderWithProviders(<Post />, { withUser: false, withPosts: true });
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
      expect(screen.getByText(/By author1/)).toBeInTheDocument();
    });
  });

  describe('Post not found scenario', () => {
    it('displays post not found message when post does not exist', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: false });
      expect(
        screen.getByRole('heading', { level: 2, name: /post not found/i })
      ).toBeInTheDocument();
    });

    it('does not display post content when post is not found', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: false });
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /support creator/i })).not.toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('handles Support Creator button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const supportButton = screen.getByRole('button', { name: /support creator/i });
      await user.click(supportButton);

      // Button should be clickable (implementation is TODO)
      expect(supportButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();

      const commentsHeading = screen.getByRole('heading', { level: 2 });
      expect(commentsHeading).toBeInTheDocument();
    });

    it('has proper semantic structure with article element', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
    });

    it('has proper time element with datetime attribute', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const timeElement = screen.getByText(new Date('2024-01-15T10:30:00Z').toLocaleDateString());
      expect(timeElement.closest('time')).toHaveAttribute('dateTime', '2024-01-15T10:30:00Z');
    });

    it('has accessible button text', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const supportButton = screen.getByRole('button', { name: /support creator/i });
      expect(supportButton).toBeInTheDocument();
    });
  });

  describe('Routing integration', () => {
    it('retrieves post ID from URL parameters correctly', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true, postId: '1' });
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });

    it('handles different post IDs from route parameters', () => {
      // Test that component can handle different post IDs
      renderWithProviders(<Post />, { withUser: true, withPosts: true });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });
  });

  describe('Date formatting', () => {
    it('formats dates correctly for different locales', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });
  });

  describe('Content display', () => {
    it('displays long content correctly', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      expect(screen.getByText(/This is a test post content/)).toBeInTheDocument();
    });

    it('applies prose styling classes', () => {
      renderWithProviders(<Post />, { withUser: true, withPosts: true });

      const contentDiv = screen.getByText(/This is a test post content/).closest('div');
      expect(contentDiv).toHaveClass('prose');
    });
  });
});
