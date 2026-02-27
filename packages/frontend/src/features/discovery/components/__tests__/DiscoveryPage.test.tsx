import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DiscoveryPage } from '../DiscoveryPage';
import type { CreatorSearchResult } from '../../types';

const mockUpdateFilters = vi.fn();
const mockSetPage = vi.fn();
const mockRefetch = vi.fn();

const mockCreators: CreatorSearchResult[] = [
  {
    id: '1',
    displayName: 'Sophia',
    username: 'sophia_art',
    avatarUrl: null,
    bio: 'Digital illustrator',
    nip05Verified: true,
    categories: ['Art'],
    tags: ['bitcoin'],
    followerCount: 1500,
    contentCount: 45,
    verified: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    displayName: 'Alex',
    username: 'alex_writes',
    avatarUrl: null,
    bio: 'Writer and podcaster',
    nip05Verified: false,
    categories: ['Writing'],
    tags: ['nostr'],
    followerCount: 800,
    contentCount: 30,
    verified: false,
    createdAt: '2024-02-01T00:00:00Z',
  },
];

const defaultHookReturn = {
  creators: mockCreators,
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  filters: { sortBy: 'relevance' as const },
  updateFilters: mockUpdateFilters,
  page: 1,
  setPage: mockSetPage,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: mockRefetch,
};

vi.mock('../../hooks/useDiscovery', () => ({
  useDiscovery: vi.fn(() => defaultHookReturn),
}));

import { useDiscovery } from '../../hooks/useDiscovery';
const mockUseDiscovery = vi.mocked(useDiscovery);

const renderPage = () =>
  render(
    <BrowserRouter>
      <DiscoveryPage />
    </BrowserRouter>
  );

describe('DiscoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDiscovery.mockReturnValue(defaultHookReturn);
  });

  describe('Rendering', () => {
    it('renders page title and description', () => {
      renderPage();
      expect(screen.getByText('Discover Creators')).toBeInTheDocument();
      expect(screen.getByText(/Find and support creators building on NOSTR/)).toBeInTheDocument();
    });

    it('renders search input', () => {
      renderPage();
      expect(screen.getByPlaceholderText(/Search creators/i)).toBeInTheDocument();
    });

    it('renders category filter buttons', () => {
      renderPage();
      const nav = screen.getByRole('navigation', { name: /Creator categories/i });
      expect(nav).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getAllByText('Art').length).toBeGreaterThanOrEqual(1);
    });

    it('renders sort select', () => {
      renderPage();
      expect(screen.getByLabelText('Sort by:')).toBeInTheDocument();
    });

    it('renders creator cards', () => {
      renderPage();
      expect(screen.getByText('Sophia')).toBeInTheDocument();
      expect(screen.getByText('Alex')).toBeInTheDocument();
    });
  });

  describe('Loading and error states', () => {
    it('shows loading spinner when loading', () => {
      mockUseDiscovery.mockReturnValue({ ...defaultHookReturn, isLoading: true, creators: [] });
      renderPage();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows error state with retry button', () => {
      mockUseDiscovery.mockReturnValue({
        ...defaultHookReturn,
        error: new Error('Network error'),
        creators: [],
      });
      renderPage();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Try Again'));
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows empty state when no creators found', () => {
      mockUseDiscovery.mockReturnValue({ ...defaultHookReturn, creators: [] });
      renderPage();
      expect(screen.getByText('No creators found')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls updateFilters on search input change', () => {
      renderPage();
      const search = screen.getByPlaceholderText(/Search creators/i);
      fireEvent.change(search, { target: { value: 'test' } });
      expect(mockUpdateFilters).toHaveBeenCalledWith({ query: 'test' });
    });

    it('calls updateFilters on category click', () => {
      renderPage();
      fireEvent.click(screen.getByText('Music'));
      expect(mockUpdateFilters).toHaveBeenCalledWith({ category: 'Music' });
    });

    it('clears category filter when All clicked', () => {
      mockUseDiscovery.mockReturnValue({
        ...defaultHookReturn,
        filters: { sortBy: 'relevance', category: 'Music' },
      });
      renderPage();
      fireEvent.click(screen.getByText('All'));
      expect(mockUpdateFilters).toHaveBeenCalledWith({ category: undefined });
    });

    it('calls updateFilters on sort change', () => {
      renderPage();
      fireEvent.change(screen.getByLabelText('Sort by:'), { target: { value: 'followers' } });
      expect(mockUpdateFilters).toHaveBeenCalledWith({ sortBy: 'followers' });
    });

    it('shows Load More button when more pages available', () => {
      mockUseDiscovery.mockReturnValue({
        ...defaultHookReturn,
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      });
      renderPage();
      fireEvent.click(screen.getByText('Load More'));
      expect(mockSetPage).toHaveBeenCalledWith(2);
    });
  });

  describe('Accessibility', () => {
    it('has a labeled search input', () => {
      renderPage();
      expect(screen.getByLabelText('Search creators')).toBeInTheDocument();
    });

    it('has a labeled category nav', () => {
      renderPage();
      expect(screen.getByRole('navigation', { name: /Creator categories/i })).toBeInTheDocument();
    });

    it('marks active category with aria-pressed', () => {
      renderPage();
      expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Music')).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
