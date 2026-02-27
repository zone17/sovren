import React from 'react';
import { render, screen } from '@testing-library/react';
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

describe('CreatorCard', () => {
  describe('Rendering', () => {
    it('renders creator display name and username', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Sophia')).toBeInTheDocument();
      expect(screen.getByText('@sophia_art')).toBeInTheDocument();
    });

    it('renders creator bio', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText(/Digital illustrator/)).toBeInTheDocument();
    });

    it('renders NIP-05 verified badge when verified', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('does not render verified badge when not verified', () => {
      const unverified = { ...mockCreator, nip05Verified: false };
      render(<CreatorCard creator={unverified} />);
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('renders creator stats', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText(/1,500 followers/)).toBeInTheDocument();
      expect(screen.getByText('45 posts')).toBeInTheDocument();
    });

    it('renders categories and tags', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('Art')).toBeInTheDocument();
      expect(screen.getByText('bitcoin')).toBeInTheDocument();
      expect(screen.getByText('illustration')).toBeInTheDocument();
    });

    it('renders avatar initial when no avatar URL', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    it('renders avatar image with lazy loading when avatar URL provided', () => {
      const withAvatar = { ...mockCreator, avatarUrl: 'https://example.com/avatar.jpg' };
      render(<CreatorCard creator={withAvatar} />);
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('width', '56');
      expect(img).toHaveAttribute('height', '56');
    });
  });

  describe('Coming Soon button', () => {
    it('renders disabled Coming Soon button', () => {
      render(<CreatorCard creator={mockCreator} />);
      const button = screen.getByRole('button', { name: /coming soon/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has article role with proper label', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByRole('article', { name: /Creator profile: Sophia/i })).toBeInTheDocument();
    });

    it('has labeled tags section', () => {
      render(<CreatorCard creator={mockCreator} />);
      expect(screen.getByLabelText('Creator tags')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles creator with zero followers', () => {
      const zeroFollowers = { ...mockCreator, followerCount: 0, contentCount: 0 };
      render(<CreatorCard creator={zeroFollowers} />);
      expect(screen.getByText(/0 followers/)).toBeInTheDocument();
    });

    it('handles creator with empty categories and tags', () => {
      const empty = { ...mockCreator, categories: [], tags: [] };
      render(<CreatorCard creator={empty} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});
