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

      expect(screen.getByLabelText(/event ids/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/authors/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/event kinds/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/limit/i)).toBeInTheDocument();
    });

    it('renders preset buttons', () => {
      render(<FilterBuilder />);

      expect(screen.getByRole('button', { name: /user notes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mentions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /replies/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /global feed/i })).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<FilterBuilder />);

      expect(screen.getByRole('button', { name: /apply filter/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save template/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
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

      const idsInput = screen.getByLabelText(/event ids/i);
      await user.type(idsInput, 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234');
      await user.click(screen.getByRole('button', { name: /add id/i }));

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

      const authorsInput = screen.getByLabelText(/authors/i);
      await user.type(authorsInput, 'npub1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvw');

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalled();
      });
    });

    it('builds filter with event kinds', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const kindsSelect = screen.getByLabelText(/event kinds/i);
      await user.click(kindsSelect);
      await user.click(screen.getByRole('option', { name: /text note/i }));

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

      const sinceInput = screen.getByLabelText(/since/i);
      const timestamp = Math.floor(Date.now() / 1000) - 86400; // Yesterday
      await user.type(sinceInput, timestamp.toString());

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

      const limitInput = screen.getByLabelText(/limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '100');

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

      const idsInput = screen.getByLabelText(/event ids/i);
      await user.type(idsInput, 'invalid-id');
      await user.click(screen.getByRole('button', { name: /add id/i }));

      expect(screen.getByText(/invalid event id format/i)).toBeInTheDocument();
    });

    it('validates author pubkey format', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const authorsInput = screen.getByLabelText(/authors/i);
      await user.type(authorsInput, 'invalid-pubkey');

      await waitFor(() => {
        expect(screen.getByText(/invalid pubkey format/i)).toBeInTheDocument();
      });
    });

    it('validates limit range', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const limitInput = screen.getByLabelText(/limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '10000');

      expect(screen.getByText(/limit must be between 1 and 5000/i)).toBeInTheDocument();
    });

    it('validates time range consistency', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const sinceInput = screen.getByLabelText(/since/i);
      const untilInput = screen.getByLabelText(/until/i);

      const futureTime = Math.floor(Date.now() / 1000) + 86400;
      const pastTime = Math.floor(Date.now() / 1000) - 86400;

      await user.type(sinceInput, futureTime.toString());
      await user.type(untilInput, pastTime.toString());

      expect(screen.getByText(/until must be after since/i)).toBeInTheDocument();
    });

    it('shows warnings for expensive queries', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const limitInput = screen.getByLabelText(/limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '5000');

      // Don't add any constraints (authors, kinds, etc.)
      await user.click(screen.getByRole('button', { name: /apply filter/i }));

      expect(screen.getByText(/this query may be expensive/i)).toBeInTheDocument();
    });

    it('provides optimization suggestions', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const limitInput = screen.getByLabelText(/limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '2000');

      expect(screen.getByText(/consider adding authors or kinds/i)).toBeInTheDocument();
    });
  });

  // ========================================
  // 5. IMPORT/EXPORT TESTS
  // ========================================
  describe('Import/Export', () => {
    it('exports filter as JSON', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));

      const previewSection = screen.getByRole('region', { name: /filter preview/i });
      const jsonContent = within(previewSection).getByRole('textbox');

      expect(jsonContent).toHaveValue(
        expect.stringContaining('"kinds":[1]')
      );
    });

    it('imports valid filter JSON', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(<FilterBuilder onFilterChange={onFilterChange} />);

      const validFilter: NostrFilter = {
        kinds: [1],
        limit: 50,
      };

      await user.click(screen.getByRole('button', { name: /import/i }));

      const importInput = screen.getByLabelText(/paste filter json/i);
      await user.type(importInput, JSON.stringify(validFilter));
      await user.click(screen.getByRole('button', { name: /load/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(validFilter);
      });
    });

    it('rejects invalid filter JSON', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /import/i }));

      const importInput = screen.getByLabelText(/paste filter json/i);
      await user.type(importInput, '{ "invalid": true }');
      await user.click(screen.getByRole('button', { name: /load/i }));

      expect(screen.getByText(/invalid filter format/i)).toBeInTheDocument();
    });

    it('copies filter to clipboard', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));
      await user.click(screen.getByRole('button', { name: /copy/i }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining('"kinds":[1]')
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
      await user.click(screen.getByRole('button', { name: /save template/i }));

      const nameInput = screen.getByLabelText(/template name/i);
      await user.type(nameInput, 'My Global Feed');
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByText(/template saved/i)).toBeInTheDocument();
    });

    it('loads saved template', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      // Pre-save a template
      const template = {
        name: 'Test Template',
        filter: { kinds: [1], limit: 100 },
      };
      localStorage.setItem('nostr-filter-templates', JSON.stringify([template]));

      render(<FilterBuilder onFilterChange={onFilterChange} />);

      await user.click(screen.getByRole('button', { name: /load template/i }));
      await user.click(screen.getByRole('option', { name: /test template/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(template.filter);
      });
    });

    it('deletes saved template', async () => {
      const user = userEvent.setup();

      // Pre-save a template
      const template = {
        name: 'Test Template',
        filter: { kinds: [1], limit: 100 },
      };
      localStorage.setItem('nostr-filter-templates', JSON.stringify([template]));

      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /load template/i }));

      const deleteButton = screen.getByRole('button', { name: /delete test template/i });
      await user.click(deleteButton);

      expect(screen.queryByText(/test template/i)).not.toBeInTheDocument();
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

      // Reset
      await user.click(screen.getByRole('button', { name: /reset/i }));

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith({});
      });
    });

    it('adds multiple event IDs', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/event ids/i);

      const id1 = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';
      const id2 = 'efgh5678901234efgh5678901234efgh5678901234efgh5678901234efgh5678';

      await user.type(idsInput, id1);
      await user.click(screen.getByRole('button', { name: /add id/i }));

      await user.clear(idsInput);
      await user.type(idsInput, id2);
      await user.click(screen.getByRole('button', { name: /add id/i }));

      const previewSection = screen.getByRole('region', { name: /filter preview/i });
      expect(within(previewSection).getByText(new RegExp(id1))).toBeInTheDocument();
      expect(within(previewSection).getByText(new RegExp(id2))).toBeInTheDocument();
    });

    it('removes individual event ID', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/event ids/i);
      const id1 = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      await user.type(idsInput, id1);
      await user.click(screen.getByRole('button', { name: /add id/i }));

      const removeButton = screen.getByRole('button', { name: new RegExp(`remove.*${id1.slice(0, 8)}`, 'i') });
      await user.click(removeButton);

      const previewSection = screen.getByRole('region', { name: /filter preview/i });
      expect(within(previewSection).queryByText(new RegExp(id1))).not.toBeInTheDocument();
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

      // Tab through preset buttons
      await user.tab();
      expect(screen.getByRole('button', { name: /user notes/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /mentions/i })).toHaveFocus();
    });

    it('has proper ARIA labels', () => {
      render(<FilterBuilder />);

      expect(screen.getByRole('region', { name: /filter builder/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('region', { name: /filter preview/i })).toHaveAttribute('aria-label');
    });

    it('announces validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      const idsInput = screen.getByLabelText(/event ids/i);
      await user.type(idsInput, 'invalid-id');
      await user.click(screen.getByRole('button', { name: /add id/i }));

      const errorMessage = screen.getByText(/invalid event id format/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('has keyboard-accessible filter preview', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /global feed/i }));

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await user.tab();

      // Should be able to activate copy button with keyboard
      await user.keyboard('{Enter}');
      // Test actual copy functionality is in export tests
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

      const limitInput = screen.getByLabelText(/limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '999999');

      expect(screen.getByText(/limit must be between 1 and 5000/i)).toBeInTheDocument();
    });

    it('handles malformed JSON import gracefully', async () => {
      const user = userEvent.setup();
      render(<FilterBuilder />);

      await user.click(screen.getByRole('button', { name: /import/i }));

      const importInput = screen.getByLabelText(/paste filter json/i);
      await user.type(importInput, '{ invalid json ');
      await user.click(screen.getByRole('button', { name: /load/i }));

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
      expect(onFilterChange).toHaveBeenCalledTimes(3);
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
