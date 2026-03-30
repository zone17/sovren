/**
 * HOME PAGE TESTS - CODE OF CRAFT STANDARDS
 *
 * Updated to match actual Home.tsx implementation (design system overhaul).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../features/auth';
import Home from '../Home';

// Mock IntersectionObserver for scroll-triggered reveals
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

const renderHome = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Home />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Home Page - Sovren Creator Platform', () => {
  describe('Hero Section', () => {
    test('SHOULD display main heading about creative empire', () => {
      renderHome();
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent(/Own Your.*Creative Empire/);
    });

    test('SHOULD show platform description subtitle', () => {
      renderHome();
      expect(screen.getByText(/Monetize your audience with Bitcoin/i)).toBeInTheDocument();
    });

    test('SHOULD have NOSTR mention on page', () => {
      renderHome();
      // NOSTR appears in the features section and footer, not the hero subtitle
      expect(screen.getByText(/Your content lives on NOSTR/i)).toBeInTheDocument();
    });

    test('SHOULD display no deplatforming message', () => {
      renderHome();
      expect(screen.getByText(/No middlemen.*No deplatforming/i)).toBeInTheDocument();
    });

    test('SHOULD display Decentralized Creator Platform badge', () => {
      renderHome();
      expect(screen.getByText('Decentralized Creator Platform')).toBeInTheDocument();
    });
  });

  describe('Call to Action Buttons', () => {
    test('SHOULD have Start Creating primary button', () => {
      renderHome();
      const buttons = screen.getAllByRole('button', { name: /Start Creating/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    test('SHOULD have See How It Works secondary button', () => {
      renderHome();
      const button = screen.getByRole('button', { name: /See How It Works/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Features Section', () => {
    test('SHOULD display sovereign creators heading', () => {
      renderHome();
      expect(screen.getByText(/sovereign creators/i)).toBeInTheDocument();
    });

    test('SHOULD highlight True Ownership feature', () => {
      renderHome();
      expect(screen.getByText('True Ownership')).toBeInTheDocument();
    });

    test('SHOULD show Instant Bitcoin Payments feature', () => {
      renderHome();
      expect(screen.getByText('Instant Bitcoin Payments')).toBeInTheDocument();
    });

    test('SHOULD display Censorship Resistant feature', () => {
      renderHome();
      expect(screen.getByText('Censorship Resistant')).toBeInTheDocument();
    });

    test('SHOULD show ownership description', () => {
      renderHome();
      expect(screen.getByText(/Your content lives on NOSTR/i)).toBeInTheDocument();
    });

    test('SHOULD show Bitcoin payment description', () => {
      renderHome();
      expect(screen.getByText(/Get paid via Lightning Network/i)).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    test('SHOULD show copyright info', () => {
      renderHome();
      const currentYear = new Date().getFullYear().toString();
      // Footer renders: "© {year} Sovren. All rights reserved."
      expect(screen.getByText(new RegExp(`${currentYear}.*Sovren`))).toBeInTheDocument();
    });
  });

  describe('Technical Quality', () => {
    test('SHOULD render without errors', () => {
      expect(() => renderHome()).not.toThrow();
    });

    test('SHOULD have accessible button labels', () => {
      renderHome();
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });

    test('SHOULD have proper h3 headings for features', () => {
      renderHome();
      const h3Headings = screen.getAllByRole('heading', { level: 3 });
      expect(h3Headings.length).toBeGreaterThanOrEqual(3);
    });
  });
});
