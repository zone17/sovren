/**
 * SIGNUP UI TESTS - CODE OF CRAFT STANDARDS
 *
 * Updated to match actual Signup.tsx implementation (design system overhaul).
 */
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../features/auth';
import Signup from '../Signup';

// Mock store
const mockStore = configureStore({
  reducer: {
    user: (state = { user: null, loading: false, error: null }) => state,
  },
});

const renderSignup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Provider store={mockStore}>
            <Signup />
          </Provider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Signup UI/UX Quality Tests - Code of Craft', () => {
  describe('Modern Component Usage', () => {
    test('SHOULD use modern Card components for signup form', () => {
      const { container } = renderSignup();

      // Should have modern Card styling with rounded corners and borders
      const cardElement = container.querySelector('[class*="rounded-"][class*="border"]');
      expect(cardElement).toBeInTheDocument();
    });

    test('SHOULD have professional visual hierarchy', () => {
      renderSignup();

      // Main title should be prominent
      const title = screen.getByText('Join Sovren');
      expect(title).toHaveClass('text-3xl', 'font-extrabold');

      // Description should be visible
      const description = screen.getByText(/sovereign creator platform/i);
      expect(description).toBeInTheDocument();
    });

    test('SHOULD use modern authentication tabs', () => {
      renderSignup();

      // Authentication mode tabs (no emojis in new design)
      const nostrTab = screen.getByText('NOSTR Keys');
      const emailTab = screen.getByText('Email');

      expect(nostrTab).toBeInTheDocument();
      expect(emailTab).toBeInTheDocument();
    });

    test('SHOULD show sovereign identity benefits', () => {
      renderSignup();

      // NOSTR benefits should be highlighted (no emoji prefix in new design)
      expect(screen.getByText('Sovereign Identity')).toBeInTheDocument();
      expect(
        screen.getByText(/Create a decentralized identity that you fully control/i)
      ).toBeInTheDocument();
    });
  });

  describe('Creator-Focused UX', () => {
    test('SHOULD have professional visual hierarchy', () => {
      renderSignup();

      // Main title should be prominent
      const title = screen.getByText('Join Sovren');
      expect(title).toHaveClass('text-3xl', 'font-extrabold');

      // Description should be visible
      const description = screen.getByText(/sovereign creator platform/i);
      expect(description).toBeInTheDocument();
    });

    test('SHOULD emphasize creator role prominently', () => {
      renderSignup();

      // Creator option should be clearly visible (no emoji in new design)
      const creatorButton = screen.getByText('Creator');
      expect(creatorButton).toBeInTheDocument();
    });

    test('SHOULD have clear NOSTR benefits for creators', () => {
      renderSignup();

      // NOSTR mode should be default (creator-focused)
      const nostrTab = screen.getByText('NOSTR Keys');
      // New design uses purple styling for active tab
      expect(nostrTab).toHaveClass('text-purple-400');

      // Should explain sovereign identity benefits
      const sovereignText = screen.getByText(/sovereign identity/i);
      expect(sovereignText).toBeInTheDocument();
    });
  });

  describe('Accessibility Standards', () => {
    test('SHOULD have proper role selection', () => {
      renderSignup();

      // Role selection should be available
      expect(screen.getByText('I want to join as a:')).toBeInTheDocument();
      expect(screen.getByText('Supporter')).toBeInTheDocument();
      expect(screen.getByText('Creator')).toBeInTheDocument();
    });

    test('SHOULD have semantic button roles', () => {
      renderSignup();

      // Authentication mode buttons should be buttons
      const nostrTab = screen.getByText('NOSTR Keys');
      expect(nostrTab.tagName).toBe('BUTTON');

      const emailTab = screen.getByText('Email');
      expect(emailTab.tagName).toBe('BUTTON');
    });

    test('SHOULD have proper heading structure', () => {
      renderSignup();

      // Main heading should exist with specific text
      const mainHeading = screen.getByRole('heading', { level: 3, name: 'Join Sovren' });
      expect(mainHeading).toHaveTextContent('Join Sovren');
    });
  });

  describe('Performance Standards', () => {
    test('SHOULD have NOSTR key generation capability', () => {
      renderSignup();

      // Should have key generation feature (no emoji in new design)
      const generateButton = screen.getByText('Generate New Keys');
      expect(generateButton).toBeInTheDocument();
    });

    test('SHOULD use modern design with glass styling', () => {
      const { container } = renderSignup();

      // Should use modern Tailwind utilities efficiently
      const cardElement = container.querySelector('[class*="rounded-"]');
      expect(cardElement).toBeInTheDocument();

      // New design uses inline fontFamily style on CardTitle
      const styledElements = container.querySelectorAll('[style]');
      expect(styledElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
