import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RevenueAnalytics } from '../RevenueAnalytics';

// Mock apiClient — RevenueAnalytics now fetches from real API
vi.mock('@/services/api/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      totalRevenueSats: 150000,
      mrrSats: 45000,
      subscriberCount: 47,
      avgPaymentSats: 3250,
      churnRate: 0.08,
      avgLifetimeValueSats: 42000,
      revenueByTier: [
        { tierName: 'Basic', revenueSats: 52500, subscribers: 28 },
        { tierName: 'Premium', revenueSats: 82500, subscribers: 15 },
        { tierName: 'Tips', revenueSats: 15000, subscribers: 4 },
      ],
      revenueByDay: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        revenueSats: 5000 + Math.floor(Math.random() * 10000),
        transactions: 3,
      })),
    }),
  },
}));

describe('RevenueAnalytics', () => {
  describe('Rendering', () => {
    it('renders the component title', async () => {
      render(<RevenueAnalytics />);
      await waitFor(() => {
        expect(screen.getByText('Revenue Analytics')).toBeInTheDocument();
      });
    });

    it('renders timeframe selection buttons', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('7 Days')).toBeInTheDocument();
        expect(screen.getByText('30 Days')).toBeInTheDocument();
        expect(screen.getByText('90 Days')).toBeInTheDocument();
      });
    });

    it('shows loading skeleton initially', () => {
      render(<RevenueAnalytics />);

      // Should show skeleton cards during loading
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders metric cards after loading', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
        expect(screen.getByText('Monthly Recurring')).toBeInTheDocument();
        expect(screen.getByText('Active Subscribers')).toBeInTheDocument();
        expect(screen.getByText('Churn Rate')).toBeInTheDocument();
      });
    });

    it('renders revenue chart after loading', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
      });
    });

    it('renders tier breakdown after loading', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Revenue by Tier')).toBeInTheDocument();
        expect(screen.getByText('Basic')).toBeInTheDocument();
        expect(screen.getByText('Premium')).toBeInTheDocument();
        expect(screen.getByText('Tips')).toBeInTheDocument();
      });
    });
  });

  describe('Interactions', () => {
    it('switches timeframe when clicking period buttons', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });

      const sevenDaysBtn = screen.getByText('7 Days');
      fireEvent.click(sevenDaysBtn);

      // Should show loading again then new data
      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });
    });

    it('highlights selected timeframe', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('30 Days')).toBeInTheDocument();
      });

      const thirtyDaysBtn = screen.getByText('30 Days');
      // 30 Days is default selected
      expect(thirtyDaysBtn).toHaveAttribute('aria-checked', 'true');

      const sevenDaysBtn = screen.getByText('7 Days');
      expect(sevenDaysBtn).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Accessibility', () => {
    it('has a labeled timeframe selection group', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(
          screen.getByRole('radiogroup', { name: /Timeframe selection/i })
        ).toBeInTheDocument();
      });
    });

    it('timeframe buttons have radio role and aria-checked', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('radio');
        expect(buttons.length).toBe(3);
      });
    });

    it('tier progress bars have progressbar role', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('renders additional metrics section', async () => {
      render(<RevenueAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Avg. Payment')).toBeInTheDocument();
        expect(screen.getByText('Avg. Lifetime Value')).toBeInTheDocument();
      });
    });
  });
});
