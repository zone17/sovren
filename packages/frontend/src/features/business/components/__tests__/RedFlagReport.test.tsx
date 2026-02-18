import React from 'react';
import { render, screen } from '@testing-library/react';
import RedFlagReport from '../RedFlagReport';
import type { RedFlag } from '@shared/types/finance';

// RedFlagReport is a pure presentational component with no hooks to mock.

const highFlag: RedFlag = {
  type: 'exclusivity',
  match: 'exclusive rights in perpetuity',
  severity: 'high',
  suggestion: 'Consider limiting the exclusivity scope and time period.',
};

const mediumFlag: RedFlag = {
  type: 'delayed_payment',
  match: 'payment within 180 days',
  severity: 'medium',
  suggestion: 'Standard payment terms are 30–60 days. Negotiate a shorter window.',
};

const lowFlag: RedFlag = {
  type: 'ip_assignment',
  match: 'assigns all intellectual property',
  severity: 'low',
  suggestion: 'Clarify which specific IP is being assigned.',
};

const allFlags: RedFlag[] = [highFlag, mediumFlag, lowFlag];

describe('RedFlagReport', () => {
  describe('Empty state', () => {
    it('renders the no red flags message when redFlags is empty', () => {
      render(<RedFlagReport redFlags={[]} />);

      expect(screen.getByText('No red flags detected.')).toBeInTheDocument();
    });

    it('shows the always-review disclaimer in the empty state', () => {
      render(<RedFlagReport redFlags={[]} />);

      expect(
        screen.getByText(/Always review with a legal professional/i)
      ).toBeInTheDocument();
    });

    it('empty state has a status role and accessible label', () => {
      render(<RedFlagReport redFlags={[]} />);

      expect(screen.getByRole('status', { name: 'No red flags found' })).toBeInTheDocument();
    });
  });

  describe('Rendering flags', () => {
    it('renders the Red Flag Analysis heading when flags exist', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(screen.getByText('Red Flag Analysis')).toBeInTheDocument();
    });

    it('renders one list item per red flag', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(allFlags.length);
    });

    it('renders the match text for each flag', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(screen.getByText(/"exclusive rights in perpetuity"/)).toBeInTheDocument();
      expect(screen.getByText(/"payment within 180 days"/)).toBeInTheDocument();
      expect(screen.getByText(/"assigns all intellectual property"/)).toBeInTheDocument();
    });

    it('renders the suggestion text for each flag', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(
        screen.getByText('Consider limiting the exclusivity scope and time period.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Standard payment terms are 30–60 days. Negotiate a shorter window.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Clarify which specific IP is being assigned.')
      ).toBeInTheDocument();
    });

    it('renders human-readable label for exclusivity type', () => {
      render(<RedFlagReport redFlags={[highFlag]} />);

      expect(screen.getByText('Exclusivity Clause')).toBeInTheDocument();
    });

    it('renders human-readable label for delayed_payment type', () => {
      render(<RedFlagReport redFlags={[mediumFlag]} />);

      expect(screen.getByText('Delayed Payment Terms')).toBeInTheDocument();
    });

    it('renders human-readable label for ip_assignment type', () => {
      render(<RedFlagReport redFlags={[lowFlag]} />);

      expect(screen.getByText('IP Assignment')).toBeInTheDocument();
    });

    it('renders the severity label for each flag', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(screen.getByText('(high)')).toBeInTheDocument();
      expect(screen.getByText('(medium)')).toBeInTheDocument();
      expect(screen.getByText('(low)')).toBeInTheDocument();
    });
  });

  describe('Severity colors', () => {
    it('high severity flag uses red color classes', () => {
      render(<RedFlagReport redFlags={[highFlag]} />);

      const item = screen.getByRole('listitem');
      expect(item.className).toContain('bg-red-100');
      expect(item.className).toContain('text-red-800');
    });

    it('medium severity flag uses orange color classes', () => {
      render(<RedFlagReport redFlags={[mediumFlag]} />);

      const item = screen.getByRole('listitem');
      expect(item.className).toContain('bg-orange-100');
      expect(item.className).toContain('text-orange-800');
    });

    it('low severity flag uses yellow color classes', () => {
      render(<RedFlagReport redFlags={[lowFlag]} />);

      const item = screen.getByRole('listitem');
      expect(item.className).toContain('bg-yellow-100');
      expect(item.className).toContain('text-yellow-800');
    });
  });

  describe('Severity summary badges', () => {
    it('shows high severity count badge when high flags exist', () => {
      render(<RedFlagReport redFlags={[highFlag, mediumFlag]} />);

      expect(screen.getByText('1 high')).toBeInTheDocument();
    });

    it('shows medium severity count badge when medium flags exist', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(screen.getByText('1 medium')).toBeInTheDocument();
    });

    it('shows low severity count badge when low flags exist', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(screen.getByText('1 low')).toBeInTheDocument();
    });

    it('does not show a high badge when there are no high flags', () => {
      render(<RedFlagReport redFlags={[mediumFlag, lowFlag]} />);

      expect(screen.queryByText(/\d+ high/)).not.toBeInTheDocument();
    });

    it('correctly counts multiple flags of the same severity', () => {
      const twoHighFlags: RedFlag[] = [
        highFlag,
        { ...highFlag, match: 'exclusive perpetual license', type: 'perpetual' },
      ];

      render(<RedFlagReport redFlags={twoHighFlags} />);

      expect(screen.getByText('2 high')).toBeInTheDocument();
    });

    it('shows the correct badge colors for each severity level', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      const highBadge = screen.getByText('1 high');
      expect(highBadge.className).toContain('bg-red-100');
      expect(highBadge.className).toContain('text-red-700');

      const mediumBadge = screen.getByText('1 medium');
      expect(mediumBadge.className).toContain('bg-orange-100');
      expect(mediumBadge.className).toContain('text-orange-700');

      const lowBadge = screen.getByText('1 low');
      expect(lowBadge.className).toContain('bg-yellow-100');
      expect(lowBadge.className).toContain('text-yellow-700');
    });
  });

  describe('Accessibility', () => {
    it('flag list has an accessible label', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      expect(
        screen.getByRole('list', { name: 'Red flags found in contract' })
      ).toBeInTheDocument();
    });

    it('section is labelled by the Red Flag Analysis heading', () => {
      render(<RedFlagReport redFlags={allFlags} />);

      // The section uses aria-labelledby="red-flags-heading"
      expect(screen.getByRole('region', { name: 'Red Flag Analysis' })).toBeInTheDocument();
    });

    it('renders a perpetual flag type with its human-readable label', () => {
      const perpetualFlag: RedFlag = {
        type: 'perpetual',
        match: 'in perpetuity worldwide',
        severity: 'high',
        suggestion: 'Limit the license duration.',
      };

      render(<RedFlagReport redFlags={[perpetualFlag]} />);

      expect(screen.getByText('Perpetual License')).toBeInTheDocument();
    });

    it('handles unknown flag types gracefully by showing the raw type', () => {
      const unknownFlag = {
        type: 'unknown_clause' as RedFlag['type'],
        match: 'some unknown clause',
        severity: 'low' as const,
        suggestion: 'Review carefully.',
      };

      render(<RedFlagReport redFlags={[unknownFlag]} />);

      expect(screen.getByText('unknown_clause')).toBeInTheDocument();
    });
  });
});
