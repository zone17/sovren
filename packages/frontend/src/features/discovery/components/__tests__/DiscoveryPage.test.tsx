import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DiscoveryPage } from '../DiscoveryPage';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('DiscoveryPage', () => {
  describe('Rendering', () => {
    it('renders the page title and description', () => {
      renderWithRouter(<DiscoveryPage />);

      expect(screen.getByText('Discover Creators')).toBeInTheDocument();
      expect(
        screen.getByText(/Find and support creators building on NOSTR/)
      ).toBeInTheDocument();
    });

    it('renders the search input', () => {
      renderWithRouter(<DiscoveryPage />);

      const search = screen.getByPlaceholderText(/Search creators/i);
      expect(search).toBeInTheDocument();
    });

    it('renders category filter buttons', () => {
      renderWithRouter(<DiscoveryPage />);

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Art')).toBeInTheDocument();
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    });

    it('renders sort select', () => {
      renderWithRouter(<DiscoveryPage />);

      expect(screen.getByLabelText('Sort by:')).toBeInTheDocument();
    });

    it('renders creator cards after loading', async () => {
      renderWithRouter(<DiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Sophia')).toBeInTheDocument();
        expect(screen.getByText('Alex Writes')).toBeInTheDocument();
      });
    });

    it('shows loading spinner initially', () => {
      renderWithRouter(<DiscoveryPage />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('filters creators by search query', async () => {
      renderWithRouter(<DiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Sophia')).toBeInTheDocument();
      });

      const search = screen.getByPlaceholderText(/Search creators/i);
      fireEvent.change(search, { target: { value: 'Sophia' } });

      await waitFor(() => {
        expect(screen.getByText('Sophia')).toBeInTheDocument();
        expect(screen.queryByText('Alex Writes')).not.toBeInTheDocument();
      });
    });

    it('filters creators by category', async () => {
      renderWithRouter(<DiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Sophia')).toBeInTheDocument();
      });

      const musicButton = screen.getByText('Music');
      fireEvent.click(musicButton);

      await waitFor(() => {
        expect(screen.getByText('Lightning Music')).toBeInTheDocument();
        expect(screen.queryByText('Sophia')).not.toBeInTheDocument();
      });
    });

    it('shows empty state when no creators match', async () => {
      renderWithRouter(<DiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Sophia')).toBeInTheDocument();
      });

      const search = screen.getByPlaceholderText(/Search creators/i);
      fireEvent.change(search, { target: { value: 'nonexistentcreator12345' } });

      await waitFor(() => {
        expect(screen.getByText('No creators found')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has a labeled search input', () => {
      renderWithRouter(<DiscoveryPage />);

      const search = screen.getByLabelText('Search creators');
      expect(search).toBeInTheDocument();
    });

    it('has a labeled category nav', () => {
      renderWithRouter(<DiscoveryPage />);

      expect(screen.getByRole('navigation', { name: /Creator categories/i })).toBeInTheDocument();
    });

    it('marks active category with aria-pressed', async () => {
      renderWithRouter(<DiscoveryPage />);

      const allButton = screen.getByText('All');
      expect(allButton).toHaveAttribute('aria-pressed', 'true');

      const musicButton = screen.getByText('Music');
      expect(musicButton).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
