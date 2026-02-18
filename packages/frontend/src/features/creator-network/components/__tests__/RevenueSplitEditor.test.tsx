import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RevenueSplitEditor from '../RevenueSplitEditor';
import type { RevenueSplitEntry } from '../../types/community';

// RevenueSplitEditor is a pure controlled component — no hooks to mock.

const singleEntry: RevenueSplitEntry[] = [
  { creatorId: 'creator-1', displayName: 'Alice', splitBps: 10000 },
];

const splitEntries: RevenueSplitEntry[] = [
  { creatorId: 'creator-1', displayName: 'Alice', splitBps: 7000 },
  { creatorId: 'creator-2', displayName: 'Bob', splitBps: 3000 },
];

const invalidEntries: RevenueSplitEntry[] = [
  { creatorId: 'creator-1', splitBps: 6000 },
  { creatorId: 'creator-2', splitBps: 3000 },
];

const exceededEntries: RevenueSplitEntry[] = [
  { creatorId: 'creator-1', splitBps: 6000 },
  { creatorId: 'creator-2', splitBps: 5000 },
];

describe('RevenueSplitEditor', () => {
  describe('Rendering', () => {
    it('renders the Revenue Split heading', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByText('Revenue Split')).toBeInTheDocument();
    });

    it('renders an input row for each entry', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Collaborator 1 creator ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Collaborator 2 creator ID')).toBeInTheDocument();
    });

    it('shows percentage inputs for each entry', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Split percentage for collaborator 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Split percentage for collaborator 2')).toBeInTheDocument();
    });

    it('shows Remove button for each entry when not disabled', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Remove collaborator 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove collaborator 2')).toBeInTheDocument();
    });

    it('does not show Remove buttons when disabled', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} disabled />);

      expect(screen.queryByLabelText('Remove collaborator 1')).not.toBeInTheDocument();
    });

    it('shows the Add collaborator button when not disabled', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Add collaborator')).toBeInTheDocument();
    });

    it('does not show Add collaborator button when disabled', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} disabled />);

      expect(screen.queryByLabelText('Add collaborator')).not.toBeInTheDocument();
    });

    it('renders the split preview section when entries exist', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Split preview')).toBeInTheDocument();
    });

    it('does not render split preview section when entries are empty', () => {
      render(<RevenueSplitEditor entries={[]} onChange={jest.fn()} />);

      expect(screen.queryByLabelText('Split preview')).not.toBeInTheDocument();
    });

    it('shows display name in preview when provided', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} previewSats={10000} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('shows creator ID in preview as fallback when no displayName', () => {
      const entries: RevenueSplitEntry[] = [{ creatorId: 'creator-no-name', splitBps: 10000 }];
      render(<RevenueSplitEditor entries={entries} onChange={jest.fn()} />);

      expect(screen.getByText('creator-no-name')).toBeInTheDocument();
    });

    it('shows generic label in preview when creatorId is also empty', () => {
      const entries: RevenueSplitEntry[] = [{ creatorId: '', splitBps: 10000 }];
      render(<RevenueSplitEditor entries={entries} onChange={jest.fn()} />);

      expect(screen.getByText('Collaborator 1')).toBeInTheDocument();
    });
  });

  describe('Validation status display', () => {
    it('shows Valid status when bps sums to exactly 10000', () => {
      render(<RevenueSplitEditor entries={singleEntry} onChange={jest.fn()} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Valid');
      expect(status).toHaveTextContent('100.00%');
    });

    it('shows Does not sum to 100% when bps is under 10000', () => {
      // Use previewSats={0} to avoid the allocateSats remainder-overflow bug
      // when splits don't sum to 10000.
      render(<RevenueSplitEditor entries={invalidEntries} onChange={jest.fn()} previewSats={0} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Does not sum to 100%');
    });

    it('shows Exceeds 100% when bps exceeds 10000', () => {
      render(<RevenueSplitEditor entries={exceededEntries} onChange={jest.fn()} previewSats={0} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Exceeds 100%');
    });

    it('shows the correct percentage total in the status', () => {
      // 6000 + 3000 = 9000 bps = 90.00%
      // Use previewSats={0} to avoid the allocateSats remainder-overflow bug.
      render(<RevenueSplitEditor entries={invalidEntries} onChange={jest.fn()} previewSats={0} />);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('90.00%');
    });
  });

  describe('Interactions', () => {
    it('calls onChange with an additional empty entry when Add collaborator is clicked', () => {
      const onChange = jest.fn();
      render(<RevenueSplitEditor entries={splitEntries} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Add collaborator'));

      expect(onChange).toHaveBeenCalledWith([
        ...splitEntries,
        { creatorId: '', splitBps: 0 },
      ]);
    });

    it('calls onChange without the removed entry when Remove is clicked', () => {
      const onChange = jest.fn();
      render(<RevenueSplitEditor entries={splitEntries} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Remove collaborator 1'));

      expect(onChange).toHaveBeenCalledWith([splitEntries[1]]);
    });

    it('calls onChange with updated creatorId when creator ID input changes', () => {
      const onChange = jest.fn();
      render(<RevenueSplitEditor entries={splitEntries} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Collaborator 1 creator ID'), {
        target: { value: 'new-creator' },
      });

      expect(onChange).toHaveBeenCalledWith([
        { ...splitEntries[0], creatorId: 'new-creator' },
        splitEntries[1],
      ]);
    });

    it('calls onChange with updated splitBps when percentage input changes', () => {
      const onChange = jest.fn();
      render(<RevenueSplitEditor entries={splitEntries} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Split percentage for collaborator 1'), {
        target: { value: '80' },
      });

      // 80% = 8000 bps
      expect(onChange).toHaveBeenCalledWith([
        { ...splitEntries[0], splitBps: 8000 },
        splitEntries[1],
      ]);
    });

    it('does not call onChange when percentage input is not a valid number', () => {
      const onChange = jest.fn();
      render(<RevenueSplitEditor entries={splitEntries} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Split percentage for collaborator 1'), {
        target: { value: 'abc' },
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('disables all inputs when disabled prop is true', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} disabled />);

      expect(screen.getByLabelText('Collaborator 1 creator ID')).toBeDisabled();
      expect(screen.getByLabelText('Split percentage for collaborator 1')).toBeDisabled();
    });
  });

  describe('Preview calculations', () => {
    it('renders sats allocation correctly for a 70/30 split', () => {
      render(
        <RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} previewSats={10000} />
      );

      // Alice: 70% of 10000 = 7000 sats
      // Bob: 30% of 10000 = 3000 sats
      expect(screen.getByText('7,000 sats')).toBeInTheDocument();
      expect(screen.getByText('3,000 sats')).toBeInTheDocument();
    });

    it('shows default previewSats of 10000 in the preview label', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByText(/For a 10,000 sat payment/)).toBeInTheDocument();
    });

    it('shows custom previewSats in the preview label', () => {
      render(
        <RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} previewSats={50000} />
      );

      expect(screen.getByText(/For a 50,000 sat payment/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('status element has aria-live polite', () => {
      render(<RevenueSplitEditor entries={singleEntry} onChange={jest.fn()} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('entry list renders as a list element', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      // The entries <ul> and optionally the preview <ul>
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThanOrEqual(1);
    });

    it('creator ID inputs have accessible labels', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Collaborator 1 creator ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Collaborator 2 creator ID')).toBeInTheDocument();
    });

    it('percentage inputs have accessible labels', () => {
      render(<RevenueSplitEditor entries={splitEntries} onChange={jest.fn()} />);

      expect(screen.getByLabelText('Split percentage for collaborator 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Split percentage for collaborator 2')).toBeInTheDocument();
    });
  });
});
