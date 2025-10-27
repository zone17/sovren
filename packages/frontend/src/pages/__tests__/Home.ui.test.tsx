/**
 * 🏠 **HOME PAGE TESTS - CODE OF CRAFT STANDARDS**
 *
 * Elite Engineering: Tests match actual content exactly
 * Following systematic methodology from Button component recovery
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

describe('🏠 Home Page - Elite Creator Platform', () => {
  describe('🎨 Hero Section', () => {
    test('SHOULD display main heading Sovren', () => {
      renderHome();
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Sovren');
    });

    test('SHOULD show elite creator platform subtitle', () => {
      renderHome();
      expect(screen.getByText('Elite Creator Monetization Platform')).toBeInTheDocument();
    });

    test('SHOULD have NOSTR & Lightning badge', () => {
      renderHome();
      expect(screen.getByText(/Powered by NOSTR & Lightning Network/i)).toBeInTheDocument();
    });

    test('SHOULD display sovereign revolution message', () => {
      renderHome();
      expect(screen.getByText(/Join the sovereign revolution/i)).toBeInTheDocument();
    });
  });

  describe('🚀 Call to Action Buttons', () => {
    test('SHOULD have Become Sovereign primary button', () => {
      renderHome();
      const button = screen.getByRole('button', { name: /become sovereign/i });
      expect(button).toBeInTheDocument();
    });

    test('SHOULD have Explore Platform secondary button', () => {
      renderHome();
      const button = screen.getByRole('button', { name: /explore platform/i });
      expect(button).toBeInTheDocument();
    });

    test('SHOULD have Join the Elite CTA button', () => {
      renderHome();
      const button = screen.getByRole('button', { name: /join the elite/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('📊 Elite Stats', () => {
    test('SHOULD display elite creator count', () => {
      renderHome();
      expect(screen.getByText('10,000+')).toBeInTheDocument();
    });

    test('SHOULD show revenue growth stat', () => {
      renderHome();
      expect(screen.getByText('300%')).toBeInTheDocument();
    });

    test('SHOULD display global reach', () => {
      renderHome();
      expect(screen.getByText('65+')).toBeInTheDocument();
    });
  });

  describe('⚡ Feature Section', () => {
    test('SHOULD highlight Lightning Fast Payments', () => {
      renderHome();
      expect(screen.getByText('Lightning Fast Payments')).toBeInTheDocument();
    });

    test('SHOULD show Sovereign Identity feature', () => {
      renderHome();
      expect(screen.getByText('Sovereign Identity')).toBeInTheDocument();
    });

    test('SHOULD display Creator Protection', () => {
      renderHome();
      expect(screen.getByText('Creator Protection')).toBeInTheDocument();
    });

    test('SHOULD have feature badges', () => {
      renderHome();
      expect(screen.getByText('Instant')).toBeInTheDocument();
      expect(screen.getByText('Sovereign')).toBeInTheDocument();
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });
  });

  describe('👑 Creator Kingdom CTA', () => {
    test('SHOULD display creator kingdom heading', () => {
      renderHome();
      expect(screen.getByText(/Ready to Rule Your/i)).toBeInTheDocument();
      expect(screen.getByText(/Creator Kingdom/i)).toBeInTheDocument();
    });

    test('SHOULD mention elite creators', () => {
      renderHome();
      expect(screen.getByText(/Join the elite creators/i)).toBeInTheDocument();
    });
  });

  describe('🎯 Technical Quality', () => {
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
  });
});
