import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CreatorCard } from '../CreatorCard';
import type { DiscoveryCreator } from '../../types';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockCreator: DiscoveryCreator = {
  id: 'creator-1',
  display_name: 'Sophia',
  username: 'sophia_art',
  avatar_url: '',
  bio: 'Digital illustrator creating art about the Bitcoin future.',
  nip05_verified: true,
  stats: { follower_count: 1500, post_count: 45, total_supporters: 200 },
  subscription_tiers: [
    { id: 'tier-1', name: 'Basic', price_sats: 1000, features: ['Weekly posts'] },
    { id: 'tier-2', name: 'Premium', price_sats: 5000, features: ['All content'] },
  ],
  tags: ['art', 'bitcoin'],
  featured_content_title: 'The Future of Digital Art',
};

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('CreatorCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('renders creator display name', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Sophia')).toBeInTheDocument();
    });

    it('renders creator username', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('@sophia_art')).toBeInTheDocument();
    });

    it('renders creator bio', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText(/Digital illustrator/)).toBeInTheDocument();
    });

    it('renders NIP-05 verified badge when verified', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('does not render verified badge when not verified', () => {
      const unverified = { ...mockCreator, nip05_verified: false };
      renderWithRouter(<CreatorCard creator={unverified} />);
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('renders creator stats', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText(/1,500 followers/)).toBeInTheDocument();
      expect(screen.getByText('45 posts')).toBeInTheDocument();
      expect(screen.getByText('200 supporters')).toBeInTheDocument();
    });

    it('renders tags', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('art')).toBeInTheDocument();
      expect(screen.getByText('bitcoin')).toBeInTheDocument();
    });

    it('renders lowest tier price', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('1,000 sats/mo')).toBeInTheDocument();
    });

    it('renders featured content title', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('The Future of Digital Art')).toBeInTheDocument();
    });

    it('renders avatar initial', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      // Avatar shows first letter
      const avatar = screen.getByText('S');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('navigates to creator profile on View Profile click', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);

      const viewButton = screen.getByRole('button', { name: /View Sophia's profile/i });
      fireEvent.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/creator/creator-1');
    });
  });

  describe('Accessibility', () => {
    it('has article role with proper label', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(
        screen.getByRole('article', { name: /Creator profile: Sophia/i })
      ).toBeInTheDocument();
    });

    it('has labeled tags section', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByLabelText('Creator tags')).toBeInTheDocument();
    });

    it('has labeled View Profile button', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(
        screen.getByRole('button', { name: /View Sophia's profile/i })
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles creator with no featured content', () => {
      const noFeatured = { ...mockCreator, featured_content_title: undefined };
      renderWithRouter(<CreatorCard creator={noFeatured} />);
      expect(screen.queryByText('Featured')).not.toBeInTheDocument();
    });

    it('handles creator with no tiers', () => {
      const noTiers = { ...mockCreator, subscription_tiers: [] };
      renderWithRouter(<CreatorCard creator={noTiers} />);
      expect(screen.queryByText(/sats\/mo/)).not.toBeInTheDocument();
    });

    it('handles creator with zero followers', () => {
      const zeroFollowers = {
        ...mockCreator,
        stats: { follower_count: 0, post_count: 0, total_supporters: 0 },
      };
      renderWithRouter(<CreatorCard creator={zeroFollowers} />);
      expect(screen.getByText(/0 followers/)).toBeInTheDocument();
    });
  });
});
