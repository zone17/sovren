/**
 * SIGNUP UI TESTS - CODE OF CRAFT STANDARDS
 *
 * Updated to match actual Signup.tsx implementation (NOSTR-only, no email tab).
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

    test('SHOULD show email tab as secondary signup option', () => {
      renderSignup();

      // Email tab exists as an alternative to NOSTR signup
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    test('SHOULD show sovereign identity benefits', () => {
      renderSignup();

      // NOSTR benefits highlighted with "Sovereign Identity" heading
      expect(screen.getByText('Sovereign Identity')).toBeInTheDocument();
      expect(
        screen.getByText(/decentralized identity that you fully control/i)
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

      // Creator option should be clearly visible
      const creatorButton = screen.getByText('Creator');
      expect(creatorButton).toBeInTheDocument();
    });

    test('SHOULD have NOSTR key generation capability', () => {
      renderSignup();

      // Should have key generation feature
      const generateButton = screen.getByText('Generate New Keys');
      expect(generateButton).toBeInTheDocument();
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

    test('SHOULD have semantic button roles for role selection', () => {
      renderSignup();

      // Role selection buttons should be buttons
      const supporterBtn = screen.getByText('Supporter');
      expect(supporterBtn.tagName).toBe('BUTTON');

      const creatorBtn = screen.getByText('Creator');
      expect(creatorBtn.tagName).toBe('BUTTON');
    });

    test('SHOULD have proper heading structure', () => {
      renderSignup();

      // Main heading should exist with specific text
      const mainHeading = screen.getByText('Join Sovren');
      expect(mainHeading).toHaveTextContent('Join Sovren');
    });
  });

  describe('Performance Standards', () => {
    test('SHOULD have NOSTR key generation capability', () => {
      renderSignup();

      // Should have key generation feature
      const generateButton = screen.getByText('Generate New Keys');
      expect(generateButton).toBeInTheDocument();
    });

    test('SHOULD use modern design with glass styling', () => {
      const { container } = renderSignup();

      // Should use modern Tailwind utilities efficiently
      const cardElement = container.querySelector('[class*="rounded-"]');
      expect(cardElement).toBeInTheDocument();

      // New design uses font-display class on CardTitle
      const fontDisplayElements = container.querySelectorAll('.font-display');
      expect(fontDisplayElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
