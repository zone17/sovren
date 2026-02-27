import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CreatorCard } from '../CreatorCard';
import type { CreatorSearchResult } from '../../types';

const mockCreator: CreatorSearchResult = {
  id: 'creator-1',
  displayName: 'Sophia',
  username: 'sophia_art',
  avatarUrl: null,
  bio: 'Digital illustrator creating art about the Bitcoin future.',
  nip05Verified: true,
  categories: ['Art'],
  tags: ['bitcoin', 'illustration'],
  followerCount: 1500,
  contentCount: 45,
  verified: true,
  createdAt: '2024-01-01T00:00:00Z',
};

const renderWithRouter = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('CreatorCard', () => {
  describe('Rendering', () => {
    it('renders creator display name and username', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Sophia')).toBeInTheDocument();
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
      const unverified = { ...mockCreator, nip05Verified: false };
      renderWithRouter(<CreatorCard creator={unverified} />);
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('renders creator stats', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText(/1,500 followers/)).toBeInTheDocument();
      expect(screen.getByText('45 posts')).toBeInTheDocument();
    });

    it('renders categories and tags', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Art')).toBeInTheDocument();
      expect(screen.getByText('bitcoin')).toBeInTheDocument();
      expect(screen.getByText('illustration')).toBeInTheDocument();
    });

    it('renders avatar initial when no avatar URL', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    it('renders avatar image when avatar URL provided', () => {
      const withAvatar = { ...mockCreator, avatarUrl: 'https://example.com/avatar.jpg' };
      renderWithRouter(<CreatorCard creator={withAvatar} />);
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });
  });

  describe('Coming Soon button', () => {
    it('renders disabled Coming Soon button instead of View Profile', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      const button = screen.getByRole('button', { name: /coming soon/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('does not render View Profile button', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.queryByRole('button', { name: /View Profile/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has article role with proper label', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByRole('article', { name: /Creator profile: Sophia/i })).toBeInTheDocument();
    });

    it('has labeled tags section', () => {
      renderWithRouter(<CreatorCard creator={mockCreator} />);
      expect(screen.getByLabelText('Creator tags')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles creator with zero followers', () => {
      const zeroFollowers = { ...mockCreator, followerCount: 0, contentCount: 0 };
      renderWithRouter(<CreatorCard creator={zeroFollowers} />);
      expect(screen.getByText(/0 followers/)).toBeInTheDocument();
    });

    it('handles creator with empty categories and tags', () => {
      const empty = { ...mockCreator, categories: [], tags: [] };
      renderWithRouter(<CreatorCard creator={empty} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});
