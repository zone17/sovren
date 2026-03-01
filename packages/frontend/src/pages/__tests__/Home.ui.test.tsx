/**
 * HOME PAGE TESTS - CODE OF CRAFT STANDARDS
 *
 * Updated to match actual Home.tsx implementation.
 */
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../features/auth';
import Home from '../Home';

const renderHome = () => {
  return render(
    <AuthProvider>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </AuthProvider>
  );
};

describe('Home Page - Sovren Creator Platform', () => {
  describe('Hero Section', () => {
    test('SHOULD display main heading about creative sovereignty', () => {
      renderHome();
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Unleash Your Creative Sovereignty');
    });

    test('SHOULD show platform description subtitle', () => {
      renderHome();
      expect(screen.getByText(/Monetize your audience\. Own your platform/i)).toBeInTheDocument();
    });

    test('SHOULD have NOSTR & Lightning badge in footer', () => {
      renderHome();
      expect(screen.getByText(/Powered by NOSTR & Lightning Network/i)).toBeInTheDocument();
    });

    test('SHOULD display no deplatforming message', () => {
      renderHome();
      expect(screen.getByText(/No deplatforming. No middlemen./i)).toBeInTheDocument();
    });

    test('SHOULD display instant Bitcoin payouts bullet', () => {
      renderHome();
      expect(screen.getByText(/Instant Bitcoin payouts/i)).toBeInTheDocument();
    });
  });

  describe('Call to Action Buttons', () => {
    test('SHOULD have Start Your Sovren Journey primary button', () => {
      renderHome();
      const button = screen.getByRole('button', { name: /Start Your Sovren Journey/i });
      expect(button).toBeInTheDocument();
    });

    test('SHOULD have See How Sovren Works secondary button', () => {
      renderHome();
      const button = screen.getByRole('button', { name: /See How Sovren Works/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Benefits Section', () => {
    test('SHOULD display Why Sovren heading', () => {
      renderHome();
      expect(screen.getByRole('heading', { level: 2, name: /Why Sovren\?/i })).toBeInTheDocument();
    });

    test('SHOULD highlight True Ownership benefit', () => {
      renderHome();
      expect(screen.getByText('True Ownership')).toBeInTheDocument();
    });

    test('SHOULD show Bitcoin Monetization benefit', () => {
      renderHome();
      expect(screen.getByText('Bitcoin Monetization')).toBeInTheDocument();
    });

    test('SHOULD display Elite Community benefit', () => {
      renderHome();
      expect(screen.getByText('Elite Community')).toBeInTheDocument();
    });

    test('SHOULD show ownership description', () => {
      renderHome();
      expect(
        screen.getByText(/You control your audience, your content, and your revenue/i)
      ).toBeInTheDocument();
    });

    test('SHOULD show Bitcoin payment description', () => {
      renderHome();
      expect(screen.getByText(/Get paid instantly, anywhere in the world/i)).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    test('SHOULD show copyright info', () => {
      renderHome();
      expect(screen.getByText(/Sovren.*All rights reserved/i)).toBeInTheDocument();
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

    test('SHOULD have proper h3 headings for benefits', () => {
      renderHome();
      const h3Headings = screen.getAllByRole('heading', { level: 3 });
      expect(h3Headings.length).toBeGreaterThanOrEqual(3);
    });
  });
});
