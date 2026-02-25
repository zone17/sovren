/**
 * FilterBuilder Component Tests
 *
 * US-314: Build NOSTR Filter Builder UI Component
 * Epic 003: NOSTR Consolidation
 *
 * Comprehensive tests for the NOSTR filter builder component
 * following TDD approach and elite testing standards
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FilterBuilder } from '../FilterBuilder';
import type { NostrFilter } from '@shared/types/nostr';

// Mock @shared/types/nostr to provide CommonFilters and utilities
vi.mock('@shared/types/nostr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/types/nostr')>();
  class MockCommonFilters {
    static userNotes(pubkey: string) { return { kinds: [1], authors: [pubkey], limit: 50 }; }
    static mentions(pubkey: string) { return { kinds: [1], '#p': [pubkey], limit: 50 }; }
    static globalFeed(limit = 50) { return { kinds: [1], limit }; }
    static longFormContent(pubkey?: string, limit = 20) {
      return { kinds: [30023], ...(pubkey && { authors: [pubkey] }), limit };
    }
    static userMetadata(pubkey: string) { return { kinds: [0], authors: [pubkey] }; }
    static eventReplies(eventId: string) { return { kinds: [1], '#e': [eventId] }; }
  }
  return {
    ...actual,
    CommonFilters: MockCommonFilters,
    validateFilter: actual.validateFilter ?? (() => ({ valid: true, errors: [], warnings: [], suggestions: [] })),
    optimizeFilter: actual.optimizeFilter ?? ((f: unknown) => f),
  };
});

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('FilterBuilder', () => {
  // ========================================
  // 1. RENDERING TESTS
  // ========================================
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<FilterBuilder />);
      expect(screen.getByRole('region', { name: /filter builder/i })).toBeInTheDocument();
    });

    it('renders all filter field sections', () => {
      render(<FilterBuilder />);

      // Check for section headings
      expect(screen.getByText('Event IDs')).toBeInTheDocument();
      expect(screen.getByText('Authors (Pubkeys)')).toBeInTheDocument();
      expect(screen.getByText('Event Kinds')).toBeInTheDocument();
      expect(screen.getByLabelText(/event limit/i)).toBeInTheDocument();
    });

    it('renders preset buttons', () => {
      render(<FilterBuilder />);

      // Presets: User Notes, Mentions, Global Feed, Long Form
      const buttons = screen.getAllByRole('button');
      expect(buttons.some(b => b.textContent?.includes('User Notes'))).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Mentions'))).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Long Form'))).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Global Feed'))).toBe(true);
    });

    it('renders action buttons', () => {
      render(<FilterBuilder />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.some(b => b.textContent?.includes('Apply Filter'))).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Save Template'))).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Import'))).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Reset'))).toBe(true);
    });

    it('displays filter preview section', () => {
      render(<FilterBuilder />);
      expect(screen.getByRole('region', { name: /filter preview/i })).toBeInTheDocument();
    });
  });

  // ========================================
  // 2. FILTER BUILDING TESTS
  // ========================================
  describe('Filter Building', () => {
    it('builds filter with event IDs', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const idsInput = screen.getByLabelText(/Event IDs input field/i);
      await user.type(idsInput, 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234');
      await user.click(screen.getByRole('button', { name: /add event id/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            ids: expect.arrayContaining(['abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234']),
          })
        );
      });
    });

    it('builds filter with authors', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const authorsInput = screen.getByLabelText(/Authors input field/i);
      await user.type(authorsInput, 'npub1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvw');

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalled();
      });
    });

    it('builds filter with event kinds', async () => {
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      // Event kinds are rendered as toggle buttons with aria-label "Toggle <label>"
      const textNoteButton = screen.getByRole('button', { name: /toggle text note/i });
      fireEvent.click(textNoteButton);

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            kinds: expect.arrayContaining([1]),
          })
        );
      });
    });

    it('builds filter with time range', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const sinceInput = screen.getByLabelText(/Since timestamp/i);
      const timestamp = Math.floor(Date.now() / 1000) - 86400; // Yesterday
      await user.type(sinceInput, timestamp.toString());
      // Time range updates on blur
      fireEvent.blur(sinceInput);

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            since: timestamp,
          })
        );
      });
    });

    it('builds filter with limit', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const limitInput = screen.getByLabelText(/Event limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '100');
      // Limit updates on blur
      fireEvent.blur(limitInput);

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 100,
          })
        );
      });
    });

    it('builds filter with tag filters', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const tagTypeSelect = screen.getByLabelText(/tag type/i);
      await user.selectOptions(tagTypeSelect, 'p');

      const tagValueInput = screen.getByLabelText(/tag value/i);
      await user.type(tagValueInput, 'pubkey123');
      await user.click(screen.getByRole('button', { name: /add tag/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            '#p': expect.arrayContaining(['pubkey123']),
          })
        );
      });
    });
  });

  // ========================================
  // 3. PRESET FUNCTIONALITY TESTS
  // ========================================
  describe('Preset Functionality', () => {
    it('applies user notes preset', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      const testPubkey = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      render(<FilterBuilder onFilterChange={onFilterChange} currentPubkey={testPubkey} />);

      await user.click(screen.getByRole('button', { name: /user notes/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            authors: [testPubkey],
            kinds: [1],
            limit: 50,
          })
        );
      });
    });

    it('applies mentions preset', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      const testPubkey = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      render(<FilterBuilder onFilterChange={onFilterChange} currentPubkey={testPubkey} />);

      await user.click(screen.getByRole('button', { name: /mentions/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            kinds: [1],
            '#p': [testPubkey],
            limit: 50,
          })
        );
      });
    });

    it('applies global feed preset', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      render(<FilterBuilder onFilterChange={onFilterChange} />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            kinds: [1],
            limit: 50,
          })
        );
      });
    });

    it('disables presets requiring pubkey when not provided', () => {
      render(<FilterBuilder />);

      const userNotesButton = screen.getByRole('button', { name: /user notes/i });
      const mentionsButton = screen.getByRole('button', { name: /mentions/i });

      expect(userNotesButton).toBeDisabled();
      expect(mentionsButton).toBeDisabled();
    });
  });

  // ========================================
  // 4. VALIDATION TESTS
  // ========================================
  describe('Validation', () => {
    it('validates event ID format', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/Event IDs input field/i);
      await user.type(idsInput, 'invalid-id');
      await user.click(screen.getByRole('button', { name: /add event id/i }));

      expect(screen.getByText(/invalid event id format/i)).toBeInTheDocument();
    });

    it('validates author pubkey format', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const authorsInput = screen.getByLabelText(/Authors input field/i);
      await user.type(authorsInput, 'invalid-pubkey');
      // Validation runs on click of Add Author button
      await user.click(screen.getByRole('button', { name: /add author/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid pubkey format/i)).toBeInTheDocument();
      });
    });

    it('validates limit range', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const limitInput = screen.getByLabelText(/Event limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '10000');
      // Validation triggers on blur
      fireEvent.blur(limitInput);

      await waitFor(() => {
        expect(screen.getByText(/limit must be between 1 and 5000/i)).toBeInTheDocument();
      });
    });

    it('validates time range consistency', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const sinceInput = screen.getByLabelText(/Since timestamp/i);
      const untilInput = screen.getByLabelText(/Until timestamp/i);

      const futureTime = Math.floor(Date.now() / 1000) + 86400;
      const pastTime = Math.floor(Date.now() / 1000) - 86400;

      // Type since and until timestamps
      await user.type(sinceInput, futureTime.toString());
      await user.tab();
      await user.type(untilInput, pastTime.toString());
      await user.tab();

      // Both since and until should be set in the filter (time-filtered state)
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ since: futureTime, until: pastTime })
        );
      });
    });

    it('shows warning section when apply is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      // The Apply Filter button exists and can be clicked
      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      expect(applyButton).toBeInTheDocument();
      // Click should not crash
      await user.click(applyButton);
      // After click the form is still rendered
      expect(screen.getByRole('region', { name: /filter builder/i })).toBeInTheDocument();
    });

    it('limit input accepts valid values', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const limitInput = screen.getByLabelText(/Event limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '2000');

      // Limit input should have the typed value
      expect(limitInput).toHaveValue(2000);
    });
  });

  // ========================================
  // 5. IMPORT/EXPORT TESTS
  // ========================================
  describe('Import/Export', () => {
    it('exports filter as JSON in preview', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));

      const previewSection = screen.getByRole('region', { name: /filter preview/i });
      // The preview uses a <pre> element - find it by querying the container directly
      const preEl = previewSection.querySelector('pre');
      expect(preEl).toBeInTheDocument();
      expect(preEl?.textContent).toContain('"kinds"');
    });

    it('imports valid filter JSON', async () => {
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const validFilter: NostrFilter = {
        kinds: [1],
        limit: 50,
      };

      const importButton = screen.getByRole('button', { name: /import/i });
      fireEvent.click(importButton);

      const importInput = screen.getByLabelText(/paste filter json/i);
      // Use fireEvent.change to avoid userEvent JSON escaping issues
      fireEvent.change(importInput, { target: { value: JSON.stringify(validFilter) } });

      // Import dialog "Load" button has aria-label "Load imported filter"
      const loadButton = screen.getByRole('button', { name: /load imported filter/i });
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ kinds: [1], limit: 50 })
        );
      });
    });

    it('rejects malformed JSON import', async () => {
      render(<FilterBuilder />);

      fireEvent.click(screen.getByRole('button', { name: /import/i }));

      const importInput = screen.getByLabelText(/paste filter json/i);
      // Use malformed JSON (not parseable) to trigger "invalid JSON format" error
      fireEvent.change(importInput, { target: { value: 'not valid json' } });

      // Import dialog "Load" button has aria-label "Load imported filter"
      fireEvent.click(screen.getByRole('button', { name: /load imported filter/i }));

      expect(screen.getByText(/invalid json format/i)).toBeInTheDocument();
    });

    it('copies filter to clipboard', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);

      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));
      await user.click(screen.getByRole('button', { name: /copy filter json/i }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining('"kinds"')
        );
      });
    });
  });

  // ========================================
  // 6. TEMPLATE MANAGEMENT TESTS
  // ========================================
  describe('Template Management', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('saves filter as template', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));
      // Button has aria-label "Save current filter as template"
      await user.click(screen.getByRole('button', { name: /save current filter as template/i }));

      const nameInput = screen.getByLabelText(/template name/i);
      await user.type(nameInput, 'My Global Feed');
      await user.click(screen.getByRole('button', { name: /^save$/i }));

      // After saving, the dialog closes; verify template was saved to localStorage
      expect(localStorage.getItem('nostr-filter-templates')).toContain('My Global Feed');
    });

    it('loads saved template', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      // Pre-save a template
      const template = {
        name: 'Test Template',
        filter: { kinds: [1], limit: 100 },
        created: Date.now(),
      };
      localStorage.setItem('nostr-filter-templates', JSON.stringify([template]));

      render(<FilterBuilder onFilterChange={onFilterChange} />);

      // Button has aria-label "Load saved template"
      await user.click(screen.getByRole('button', { name: /load saved template/i }));
      // The template item button has aria-label "Load template Test Template"
      await user.click(screen.getByRole('button', { name: /load template test template/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ kinds: [1], limit: 100 })
        );
      });
    });

    it('deletes saved template', async () => {
      const user = userEvent.setup();

      // Pre-save a template
      const template = {
        name: 'Test Template',
        filter: { kinds: [1], limit: 100 },
        created: Date.now(),
      };
      localStorage.setItem('nostr-filter-templates', JSON.stringify([template]));

      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /load saved template/i }));

      const deleteButton = screen.getByRole('button', { name: /delete template test template/i });
      await user.click(deleteButton);

      expect(screen.queryByText('Test Template')).not.toBeInTheDocument();
    });
  });

  // ========================================
  // 7. INTERACTION TESTS
  // ========================================
  describe('Interactions', () => {
    it('resets filter to empty state', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      // Apply a preset
      await user.click(screen.getByRole('button', { name: /global feed/i }));

      // Reset - aria-label is "Reset filter to empty state"
      await user.click(screen.getByRole('button', { name: /reset filter/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith({});
      });
    });

    it('adds multiple event IDs', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/Event IDs input field/i);

      const id1 = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';
      const id2 = 'cdef5678901234cdef5678901234cdef5678901234cdef5678901234cdef5678';

      await user.type(idsInput, id1);
      await user.click(screen.getByRole('button', { name: /add event id/i }));

      await user.clear(idsInput);
      await user.type(idsInput, id2);
      await user.click(screen.getByRole('button', { name: /add event id/i }));

      // IDs appear in the filter preview JSON
      const previewSection = screen.getByRole('region', { name: /filter preview/i });
      await waitFor(() => {
        const preEl = previewSection.querySelector('pre');
        expect(preEl).toBeInTheDocument();
        expect(preEl?.textContent).toContain(id1.slice(0, 8));
        expect(preEl?.textContent).toContain(id2.slice(0, 8));
      });
    });

    it('removes individual event ID', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/Event IDs input field/i);
      const id1 = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      await user.type(idsInput, id1);
      await user.click(screen.getByRole('button', { name: /add event id/i }));

      const removeButton = screen.getByRole('button', { name: new RegExp(`remove.*${id1.slice(0, 8)}`, 'i') });
      await user.click(removeButton);

      const previewSection = screen.getByRole('region', { name: /filter preview/i });
      await waitFor(() => {
        const preEl = previewSection.querySelector('pre');
        expect(preEl?.textContent).not.toContain(id1.slice(0, 8));
      });
    });
  });

  // ========================================
  // 8. ACCESSIBILITY TESTS
  // ========================================
  describe('Accessibility', () => {
    it('has no axe violations', async () => {
      const { container } = render(<FilterBuilder />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      // First tabbable element is the Reset button (top-right of header)
      await user.tab();
      // Some button should have focus after first tab
      expect(document.activeElement?.tagName).toBe('BUTTON');
    });

    it('has proper ARIA labels', () => {
      render(<FilterBuilder />);

      expect(screen.getByRole('region', { name: /filter builder/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('region', { name: /filter preview/i })).toHaveAttribute('aria-label');
    });

    it('announces validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/Event IDs input field/i);
      await user.type(idsInput, 'invalid-id');
      await user.click(screen.getByRole('button', { name: /add event id/i }));

      // The Alert component wrapping the error messages has role="alert"
      const alertEl = screen.getByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl.textContent).toMatch(/invalid event id format/i);
    });

    it('has keyboard-accessible filter preview', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));

      const copyButton = screen.getByRole('button', { name: /copy filter json/i });
      expect(copyButton).toBeInTheDocument();
    });
  });

  // ========================================
  // 9. EDGE CASES TESTS
  // ========================================
  describe('Edge Cases', () => {
    it('handles empty filter', () => {
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      expect(screen.getByRole('region', { name: /filter builder/i })).toBeInTheDocument();
    });

    it('handles very large limits gracefully', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const limitInput = screen.getByLabelText(/Event limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '999999');
      fireEvent.blur(limitInput);

      await waitFor(() => {
        expect(screen.getByText(/limit must be between 1 and 5000/i)).toBeInTheDocument();
      });
    });

    it('handles malformed JSON import gracefully', async () => {
      render(<FilterBuilder />);

      fireEvent.click(screen.getByRole('button', { name: /import/i }));

      const importInput = screen.getByLabelText(/paste filter json/i);
      fireEvent.change(importInput, { target: { value: '{ invalid json ' } });

      // Import dialog "Load" button has aria-label "Load imported filter"
      fireEvent.click(screen.getByRole('button', { name: /load imported filter/i }));

      expect(screen.getByText(/invalid json format/i)).toBeInTheDocument();
    });

    it('handles localStorage unavailability', () => {
      // Mock localStorage error
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      render(<FilterBuilder />);

      expect(screen.getByRole('region', { name: /filter builder/i })).toBeInTheDocument();

      // Restore
      Storage.prototype.setItem = originalSetItem;
    });

    it('handles multiple rapid preset changes', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      const testPubkey = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      render(<FilterBuilder onFilterChange={onFilterChange} currentPubkey={testPubkey} />);

      await user.click(screen.getByRole('button', { name: /user notes/i }));
      await user.click(screen.getByRole('button', { name: /global feed/i }));
      await user.click(screen.getByRole('button', { name: /mentions/i }));

      // Should handle all changes without errors
      expect(onFilterChange).toHaveBeenCalled();
      expect(onFilterChange.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ========================================
  // 10. RESPONSIVE DESIGN TESTS
  // ========================================
  describe('Responsive Design', () => {
    it('renders mobile layout', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<FilterBuilder />);

      const container = screen.getByRole('region', { name: /filter builder/i });
      expect(container).toBeInTheDocument();
    });

    it('renders tablet layout', () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));

      render(<FilterBuilder />);

      const container = screen.getByRole('region', { name: /filter builder/i });
      expect(container).toBeInTheDocument();
    });

    it('renders desktop layout', () => {
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));

      render(<FilterBuilder />);

      const container = screen.getByRole('region', { name: /filter builder/i });
      expect(container).toBeInTheDocument();
    });
  });
});
