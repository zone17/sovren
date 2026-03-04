import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderCard(creator: CreatorSearchResult = mockCreator) {
  return render(
    <MemoryRouter>
      <CreatorCard creator={creator} />
    </MemoryRouter>
  );
}

describe('CreatorCard', () => {
  describe('Rendering', () => {
    it('renders creator display name and username', () => {
      renderCard();
      expect(screen.getByText('Sophia')).toBeInTheDocument();
      expect(screen.getByText('@sophia_art')).toBeInTheDocument();
    });

    it('renders creator bio', () => {
      renderCard();
      expect(screen.getByText(/Digital illustrator/)).toBeInTheDocument();
    });

    it('renders NIP-05 verified badge when verified', () => {
      renderCard();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('does not render verified badge when not verified', () => {
      renderCard({ ...mockCreator, nip05Verified: false });
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('renders creator stats', () => {
      renderCard();
      expect(screen.getByText(/1,500 followers/)).toBeInTheDocument();
      expect(screen.getByText('45 posts')).toBeInTheDocument();
    });

    it('renders categories and tags', () => {
      renderCard();
      expect(screen.getByText('Art')).toBeInTheDocument();
      expect(screen.getByText('bitcoin')).toBeInTheDocument();
      expect(screen.getByText('illustration')).toBeInTheDocument();
    });

    it('renders avatar initial when no avatar URL', () => {
      renderCard();
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    it('renders avatar image with lazy loading when avatar URL provided', () => {
      renderCard({ ...mockCreator, avatarUrl: 'https://example.com/avatar.jpg' });
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('width', '56');
      expect(img).toHaveAttribute('height', '56');
    });
  });

  describe('View Profile link', () => {
    it('renders View Profile button linking to creator page', () => {
      renderCard();
      const link = screen.getByRole('link', { name: /View Sophia's profile/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/creator/creator-1');
    });
  });

  describe('Accessibility', () => {
    it('has article role with proper label', () => {
      renderCard();
      expect(screen.getByRole('article', { name: /Creator profile: Sophia/i })).toBeInTheDocument();
    });

    it('has labeled tags section', () => {
      renderCard();
      expect(screen.getByLabelText('Creator tags')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles creator with zero followers', () => {
      renderCard({ ...mockCreator, followerCount: 0, contentCount: 0 });
      expect(screen.getByText(/0 followers/)).toBeInTheDocument();
    });

    it('handles creator with empty categories and tags', () => {
      renderCard({ ...mockCreator, categories: [], tags: [] });
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});
