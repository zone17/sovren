import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxFilterBar } from '../InboxFilterBar';
import type { InboxFilters } from '../../types/inbox';

const defaultFilters: Pick<InboxFilters, 'platform' | 'sentiment' | 'priority' | 'status'> = {
  platform: 'all',
  sentiment: 'all',
  priority: 'all',
  status: 'all',
};

describe('InboxFilterBar', () => {
  describe('Rendering', () => {
    it('renders all four filter selects', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      expect(screen.getByLabelText('Filter by platform')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by sentiment')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by priority')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by read status')).toBeInTheDocument();
    });

    it('displays current filter values', () => {
      const onChange = vi.fn();
      render(
        <InboxFilterBar
          filters={{ ...defaultFilters, platform: 'twitter', sentiment: 'positive' }}
          onChange={onChange}
        />
      );

      expect(screen.getByDisplayValue('X (Twitter)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Positive')).toBeInTheDocument();
    });

    it('shows all platform options', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      const platformSelect = screen.getByLabelText('Filter by platform');
      const options = Array.from((platformSelect as HTMLSelectElement).options).map(
        (o) => o.text
      );

      expect(options).toContain('All Platforms');
      expect(options).toContain('X (Twitter)');
      expect(options).toContain('YouTube');
      expect(options).toContain('Bluesky');
      expect(options).toContain('Mastodon');
      expect(options).toContain('NOSTR');
    });
  });

  describe('Interactions', () => {
    it('calls onChange with platform update when platform filter changes', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Filter by platform'), {
        target: { value: 'twitter' },
      });

      expect(onChange).toHaveBeenCalledWith({ platform: 'twitter' });
    });

    it('calls onChange with sentiment update when sentiment filter changes', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Filter by sentiment'), {
        target: { value: 'positive' },
      });

      expect(onChange).toHaveBeenCalledWith({ sentiment: 'positive' });
    });

    it('calls onChange with priority update when priority filter changes', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Filter by priority'), {
        target: { value: 'high' },
      });

      expect(onChange).toHaveBeenCalledWith({ priority: 'high' });
    });

    it('calls onChange with status update when status filter changes', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Filter by read status'), {
        target: { value: 'unread' },
      });

      expect(onChange).toHaveBeenCalledWith({ status: 'unread' });
    });
  });

  describe('Accessibility', () => {
    it('has a group role with accessible label', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      expect(screen.getByRole('group', { name: 'Inbox message filters' })).toBeInTheDocument();
    });

    it('each select has an accessible label', () => {
      const onChange = vi.fn();
      render(<InboxFilterBar filters={defaultFilters} onChange={onChange} />);

      expect(screen.getByLabelText('Filter by platform')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by sentiment')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by priority')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by read status')).toBeInTheDocument();
    });
  });
});
