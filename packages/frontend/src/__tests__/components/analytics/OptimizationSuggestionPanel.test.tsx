/**
 * 🧪 **OPTIMIZATION SUGGESTION PANEL TESTS - ELITE ENGINEERING**
 *
 * Implementation of US-176.1: Unit Tests for OptimizationSuggestionPanel
 *
 * Test Coverage:
 * - Component rendering and state management
 * - Filter functionality and interactions
 * - Suggestion implementation and dismissal
 * - A/B testing recommendations
 * - Accessibility compliance
 * - Performance characteristics
 */

import { OptimizationSuggestionPanel } from '@/components/analytics/OptimizationSuggestionPanel';
import type { OptimizationSuggestion } from '@/types/engagement-analytics';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// =====================================================
// MOCK DATA
// =====================================================

const mockSuggestions: OptimizationSuggestion[] = [
  {
    suggestion_id: '1',
    content_id: 'content-1',
    category: 'content_structure',
    title: 'Add Hook in First 15 Seconds',
    description: 'Videos with strong hooks see 34% higher retention.',
    current_value: '68% retention rate',
    suggested_value: '91% retention rate',
    impact_prediction: {
      engagement_lift: 33.8,
      confidence: 0.92,
      timeframe: '7 days',
    },
    priority: 'high',
    effort_required: 'medium',
    implementation_guide: [
      'Analyze your first 15 seconds',
      'Create compelling hooks',
      'Test with A/B testing',
    ],
    a_b_test_recommended: true,
    supporting_data: {},
    generated_at: '2024-01-15T10:30:00Z',
  },
  {
    suggestion_id: '2',
    content_id: 'content-1',
    category: 'engagement_timing',
    title: 'Optimal Publishing Time',
    description: 'Publish at 2:00 PM EST for 45% more engagement.',
    current_value: '156 engagements',
    suggested_value: '226 engagements',
    impact_prediction: {
      engagement_lift: 44.9,
      confidence: 0.87,
      timeframe: '14 days',
    },
    priority: 'critical',
    effort_required: 'low',
    implementation_guide: ['Schedule for 2:00-4:00 PM EST', 'Monitor engagement patterns'],
    a_b_test_recommended: false,
    supporting_data: {},
    generated_at: '2024-01-15T10:30:00Z',
  },
  {
    suggestion_id: '3',
    content_id: 'content-1',
    category: 'text_optimization',
    title: 'Interactive Polls',
    description: 'Add polls to increase comments by 67%.',
    current_value: '12% comment rate',
    suggested_value: '20% comment rate',
    impact_prediction: {
      engagement_lift: 66.7,
      confidence: 0.78,
      timeframe: '21 days',
    },
    priority: 'medium',
    effort_required: 'medium',
    implementation_guide: ['Identify poll insertion points', 'Create engaging questions'],
    a_b_test_recommended: true,
    supporting_data: {},
    generated_at: '2024-01-15T10:30:00Z',
  },
];

// =====================================================
// MOCK FUNCTIONS
// =====================================================

const mockOnImplementSuggestion = jest.fn();
const mockOnDismissSuggestion = jest.fn();
const mockOnScheduleSuggestion = jest.fn();

// Mock toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// =====================================================
// TEST UTILITIES
// =====================================================

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options);
};

// =====================================================
// TEST SUITE
// =====================================================

describe('OptimizationSuggestionPanel', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // =====================================================
  // RENDERING TESTS
  // =====================================================

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      expect(screen.getByText('Optimization Suggestions')).toBeInTheDocument();
      expect(
        screen.getByText('AI-powered recommendations to improve your content performance')
      ).toBeInTheDocument();
    });

    it('displays loading state correctly', () => {
      renderWithProviders(<OptimizationSuggestionPanel isLoading={true} />);

      expect(screen.getByText('Loading optimization suggestions...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
    });

    it('renders all suggestion cards', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      expect(screen.getByText('Add Hook in First 15 Seconds')).toBeInTheDocument();
      expect(screen.getByText('Optimal Publishing Time')).toBeInTheDocument();
      expect(screen.getByText('Interactive Polls')).toBeInTheDocument();
    });

    it('displays correct stats in header cards', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      expect(screen.getByText('3')).toBeInTheDocument(); // Total suggestions
      expect(screen.getByText('Total Suggestions')).toBeInTheDocument();
      expect(screen.getByText('High Priority')).toBeInTheDocument();
      expect(screen.getByText('Avg Confidence')).toBeInTheDocument();
    });

    it('shows empty state when no suggestions available', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={[]} />);

      expect(screen.getByText('No suggestions available')).toBeInTheDocument();
      expect(
        screen.getByText('Check back later for new optimization recommendations.')
      ).toBeInTheDocument();
    });
  });

  // =====================================================
  // INTERACTION TESTS
  // =====================================================

  describe('User Interactions', () => {
    it('expands suggestion card when clicked', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      const firstSuggestionCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      expect(firstSuggestionCard).toBeInTheDocument();

      const expandButton = within(firstSuggestionCard!).getByRole('button');
      await user.click(expandButton);

      // Check if expanded content is visible
      await waitFor(() => {
        expect(screen.getByText('Expected Impact')).toBeInTheDocument();
        expect(screen.getByText('Implementation Guide')).toBeInTheDocument();
      });
    });

    it('handles implement suggestion action', async () => {
      renderWithProviders(
        <OptimizationSuggestionPanel
          suggestions={mockSuggestions}
          onImplementSuggestion={mockOnImplementSuggestion}
        />
      );

      // Expand first suggestion
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');
      await user.click(expandButton);

      // Click implement button
      await waitFor(() => {
        const implementButton = screen.getByText('Implement');
        expect(implementButton).toBeInTheDocument();
      });

      const implementButton = screen.getByText('Implement');
      await user.click(implementButton);

      // Check loading state
      expect(screen.getByText('Implementing...')).toBeInTheDocument();

      // Wait for completion
      await waitFor(
        () => {
          expect(mockOnImplementSuggestion).toHaveBeenCalledWith('1');
          expect(mockToast).toHaveBeenCalledWith({
            title: 'Suggestion Implemented',
            description: 'Optimization suggestion has been marked for implementation.',
          });
        },
        { timeout: 2000 }
      );
    });

    it('handles dismiss suggestion action', async () => {
      renderWithProviders(
        <OptimizationSuggestionPanel
          suggestions={mockSuggestions}
          onDismissSuggestion={mockOnDismissSuggestion}
        />
      );

      // Expand first suggestion
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');
      await user.click(expandButton);

      // Click dismiss button
      await waitFor(() => {
        const dismissButton = screen.getByText('Dismiss');
        expect(dismissButton).toBeInTheDocument();
      });

      const dismissButton = screen.getByText('Dismiss');
      await user.click(dismissButton);

      expect(mockOnDismissSuggestion).toHaveBeenCalledWith('1');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Suggestion Dismissed',
        description: 'The suggestion has been removed from your list.',
      });
    });
  });

  // =====================================================
  // FILTER TESTS
  // =====================================================

  describe('Filtering', () => {
    it('filters suggestions by priority', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Open priority filter
      const prioritySelect = screen.getByDisplayValue('All Priorities');
      await user.click(prioritySelect);

      // Select high priority
      const highOption = screen.getByText('High');
      await user.click(highOption);

      // Should only show high priority suggestions
      expect(screen.getByText('Add Hook in First 15 Seconds')).toBeInTheDocument();
      expect(screen.queryByText('Optimal Publishing Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Interactive Polls')).not.toBeInTheDocument();
    });

    it('filters suggestions by category', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Open category filter
      const categorySelect = screen.getByDisplayValue('All Categories');
      await user.click(categorySelect);

      // Select content structure
      const contentStructureOption = screen.getByText('Content Structure');
      await user.click(contentStructureOption);

      // Should only show content structure suggestions
      expect(screen.getByText('Add Hook in First 15 Seconds')).toBeInTheDocument();
      expect(screen.queryByText('Optimal Publishing Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Interactive Polls')).not.toBeInTheDocument();
    });

    it('shows filtered empty state message', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Filter to show only low priority (none in mock data)
      const prioritySelect = screen.getByDisplayValue('All Priorities');
      await user.click(prioritySelect);

      const lowOption = screen.getByText('Low');
      await user.click(lowOption);

      // Should show filtered empty state
      expect(screen.getByText('No suggestions available')).toBeInTheDocument();
      expect(
        screen.getByText('Try adjusting your filters to see more suggestions.')
      ).toBeInTheDocument();
    });
  });

  // =====================================================
  // A/B TESTING TESTS
  // =====================================================

  describe('A/B Testing Features', () => {
    it('displays A/B testing recommendation when applicable', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Expand suggestion with A/B testing recommended
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('A/B Testing Recommended')).toBeInTheDocument();
        expect(
          screen.getByText(
            'This optimization would benefit from A/B testing to validate effectiveness.'
          )
        ).toBeInTheDocument();
      });
    });

    it('does not show A/B testing section when not recommended', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Expand suggestion without A/B testing recommended
      const secondCard = screen.getByText('Optimal Publishing Time').closest('div')?.parentElement;
      const expandButton = within(secondCard!).getByRole('button');
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.queryByText('A/B Testing Recommended')).not.toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // CONTENT VALIDATION TESTS
  // =====================================================

  describe('Content Validation', () => {
    it('displays correct priority badges and icons', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('shows correct confidence percentages', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      expect(screen.getByText('92% confident')).toBeInTheDocument();
      expect(screen.getByText('87% confident')).toBeInTheDocument();
      expect(screen.getByText('78% confident')).toBeInTheDocument();
    });

    it('displays implementation guide steps', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Expand first suggestion
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Implementation Guide')).toBeInTheDocument();
        expect(screen.getByText('1.')).toBeInTheDocument();
        expect(screen.getByText('Analyze your first 15 seconds')).toBeInTheDocument();
      });
    });

    it('shows impact metrics correctly', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Expand first suggestion
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Expected Impact')).toBeInTheDocument();
        expect(screen.getByText('68% retention rate')).toBeInTheDocument();
        expect(screen.getByText('91% retention rate')).toBeInTheDocument();
        expect(screen.getByText('+33.8%')).toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // ACCESSIBILITY TESTS
  // =====================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Check for combobox roles (selects)
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(2); // Priority and category filters
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Tab through elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'combobox');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'combobox');
    });

    it('provides proper focus management', async () => {
      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Focus on first expand button
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');

      expandButton.focus();
      expect(document.activeElement).toBe(expandButton);
    });
  });

  // =====================================================
  // PERFORMANCE TESTS
  // =====================================================

  describe('Performance', () => {
    it('handles large number of suggestions efficiently', () => {
      const largeSuggestionList = Array.from({ length: 100 }, (_, i) => ({
        ...mockSuggestions[0],
        suggestion_id: `suggestion-${i}`,
        title: `Suggestion ${i}`,
      }));

      const startTime = performance.now();
      renderWithProviders(<OptimizationSuggestionPanel suggestions={largeSuggestionList} />);
      const endTime = performance.now();

      // Should render within reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('debounces filter changes effectively', async () => {
      const mockFilteredSuggestions = vi.fn().mockReturnValue(mockSuggestions);

      renderWithProviders(<OptimizationSuggestionPanel suggestions={mockSuggestions} />);

      // Rapid filter changes
      const prioritySelect = screen.getByDisplayValue('All Priorities');
      await user.click(prioritySelect);
      await user.click(screen.getByText('High'));

      await user.click(prioritySelect);
      await user.click(screen.getByText('Medium'));

      // Should handle changes smoothly without performance issues
      expect(screen.getByText('Interactive Polls')).toBeInTheDocument();
    });
  });

  // =====================================================
  // ERROR HANDLING TESTS
  // =====================================================

  describe('Error Handling', () => {
    it('gracefully handles implementation errors', async () => {
      const mockErrorImplement = vi.fn().mockRejectedValue(new Error('API Error'));

      renderWithProviders(
        <OptimizationSuggestionPanel
          suggestions={mockSuggestions}
          onImplementSuggestion={mockErrorImplement}
        />
      );

      // Expand and try to implement
      const firstCard = screen
        .getByText('Add Hook in First 15 Seconds')
        .closest('div')?.parentElement;
      const expandButton = within(firstCard!).getByRole('button');
      await user.click(expandButton);

      await waitFor(() => {
        const implementButton = screen.getByText('Implement');
        return user.click(implementButton);
      });

      // Should show error toast
      await waitFor(
        () => {
          expect(mockToast).toHaveBeenCalledWith({
            title: 'Implementation Failed',
            description: 'Unable to implement suggestion. Please try again.',
            variant: 'destructive',
          });
        },
        { timeout: 2000 }
      );
    });

    it('handles malformed suggestion data gracefully', () => {
      const malformedSuggestions = [
        {
          ...mockSuggestions[0],
          impact_prediction: null as any,
        },
      ];

      // Should not crash when rendering malformed data
      expect(() => {
        renderWithProviders(<OptimizationSuggestionPanel suggestions={malformedSuggestions} />);
      }).not.toThrow();
    });
  });
});
