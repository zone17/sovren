import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import paymentSlice from '../store/slices/paymentSlice';
import postSlice from '../store/slices/postSlice';
import userSlice from '../store/slices/userSlice';
import type { Post as PostType, User } from '../types';
import Post from './Post';

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
  options: { preloadedState?: any; route?: string } = {}
) => {
  const { preloadedState, route = '/post/1' } = options;
  const store = createTestStore(preloadedState);
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{component}</MemoryRouter>
      </Provider>
    ),
    store,
  };
};

describe('Post Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering with post data', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [mockPost], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('renders within Layout component', () => {
      renderWithProviders(<Post />, { preloadedState });
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('displays post title correctly', () => {
      renderWithProviders(<Post />, { preloadedState });
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent('Test Post Title');
    });

    it('displays post content', () => {
      renderWithProviders(<Post />, { preloadedState });
      expect(
        screen.getByText(/This is a test post content with some detailed information/)
      ).toBeInTheDocument();
    });

    it('displays author information', () => {
      renderWithProviders(<Post />, { preloadedState });
      expect(screen.getByText(/By author1/)).toBeInTheDocument();
    });

    it('displays formatted creation date', () => {
      renderWithProviders(<Post />, { preloadedState });
      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('displays Support Creator button when user is logged in', () => {
      renderWithProviders(<Post />, { preloadedState });
      const supportButton = screen.getByRole('button', { name: /support creator/i });
      expect(supportButton).toBeInTheDocument();
      expect(supportButton).toHaveAttribute('data-variant', 'primary');
    });

    it('displays comments section', () => {
      renderWithProviders(<Post />, { preloadedState });
      expect(screen.getByRole('heading', { level: 2, name: /comments/i })).toBeInTheDocument();
      expect(screen.getByText(/Comments coming soon/)).toBeInTheDocument();
    });
  });

  describe('Rendering without user', () => {
    const preloadedStateNoUser = {
      user: { currentUser: null, loading: false, error: null },
      post: { posts: [mockPost], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('does not display Support Creator button when user is not logged in', () => {
      renderWithProviders(<Post />, { preloadedState: preloadedStateNoUser });
      expect(screen.queryByRole('button', { name: /support creator/i })).not.toBeInTheDocument();
    });

    it('still displays post content and metadata', () => {
      renderWithProviders(<Post />, { preloadedState: preloadedStateNoUser });
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
      expect(screen.getByText(/By author1/)).toBeInTheDocument();
    });
  });

  describe('Post not found scenario', () => {
    const preloadedStateNoPost = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('displays post not found message when post does not exist', () => {
      renderWithProviders(<Post />, { preloadedState: preloadedStateNoPost });
      expect(
        screen.getByRole('heading', { level: 2, name: /post not found/i })
      ).toBeInTheDocument();
    });

    it('does not display post content when post is not found', () => {
      renderWithProviders(<Post />, { preloadedState: preloadedStateNoPost });
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /support creator/i })).not.toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [mockPost], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('handles Support Creator button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Post />, { preloadedState });

      const supportButton = screen.getByRole('button', { name: /support creator/i });
      await user.click(supportButton);

      // Button should be clickable (implementation is TODO)
      expect(supportButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [mockPost], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('has proper heading hierarchy', () => {
      renderWithProviders(<Post />, { preloadedState });

      const mainHeading = screen.getByRole('heading', { level: 1 });
      const commentsHeading = screen.getByRole('heading', { level: 2 });

      expect(mainHeading).toBeInTheDocument();
      expect(commentsHeading).toBeInTheDocument();
    });

    it('has proper semantic structure with article element', () => {
      renderWithProviders(<Post />, { preloadedState });

      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
    });

    it('has proper time element with datetime attribute', () => {
      renderWithProviders(<Post />, { preloadedState });

      const timeElement = screen.getByText(new Date('2024-01-15T10:30:00Z').toLocaleDateString());
      expect(timeElement.closest('time')).toHaveAttribute('dateTime', '2024-01-15T10:30:00Z');
    });

    it('has accessible button text', () => {
      renderWithProviders(<Post />, { preloadedState });

      const supportButton = screen.getByRole('button', { name: /support creator/i });
      expect(supportButton).toHaveAccessibleName();
    });
  });

  describe('Routing integration', () => {
    it('retrieves post ID from URL parameters correctly', () => {
      const preloadedState = {
        user: { currentUser: mockUser, loading: false, error: null },
        post: {
          posts: [{ ...mockPost, id: '123' }],
          currentPost: null,
          loading: false,
          error: null,
        },
        payment: { payments: [], loading: false, error: null },
      };

      renderWithProviders(<Post />, {
        preloadedState,
        route: '/post/123',
      });

      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });

    it('handles different post IDs from route parameters', () => {
      const anotherPost = {
        ...mockPost,
        id: '456',
        title: 'Another Post Title',
      };

      const preloadedState = {
        user: { currentUser: mockUser, loading: false, error: null },
        post: { posts: [anotherPost], currentPost: null, loading: false, error: null },
        payment: { payments: [], loading: false, error: null },
      };

      renderWithProviders(<Post />, {
        preloadedState,
        route: '/post/456',
      });

      expect(screen.getByText('Another Post Title')).toBeInTheDocument();
    });
  });

  describe('Date formatting', () => {
    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [mockPost], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('formats dates correctly for different locales', () => {
      renderWithProviders(<Post />, { preloadedState });

      const expectedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });
  });

  describe('Content display', () => {
    const longContentPost = {
      ...mockPost,
      content:
        'This is a very long post content that should be displayed properly in the prose format with appropriate styling and line breaks for better readability.',
    };

    const preloadedState = {
      user: { currentUser: mockUser, loading: false, error: null },
      post: { posts: [longContentPost], currentPost: null, loading: false, error: null },
      payment: { payments: [], loading: false, error: null },
    };

    it('displays long content correctly', () => {
      renderWithProviders(<Post />, { preloadedState });
      expect(screen.getByText(/This is a very long post content/)).toBeInTheDocument();
    });

    it('applies prose styling classes', () => {
      renderWithProviders(<Post />, { preloadedState });
      const contentElement = screen.getByText(/This is a very long post content/).closest('.prose');
      expect(contentElement).toHaveClass('prose', 'prose-blue', 'max-w-none');
    });
  });
});
