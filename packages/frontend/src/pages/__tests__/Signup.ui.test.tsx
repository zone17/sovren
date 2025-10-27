/**
 * 🎨 **SIGNUP UI TESTS - CODE OF CRAFT STANDARDS**
 *
 * Elite Engineering: Updated to match actual component implementation
 * Following systematic methodology from successful recoveries
 */
import { configureStore } from '@reduxjs/toolkit';
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

// Mock auth service - removed since we're using real AuthProvider
// jest.mock('../../features/auth', () => ({
//   useAuth: () => ({
//     generateNostrChallenge: jest.fn(),
//     authenticateNostr: jest.fn(),
//     signup: jest.fn(),
//   }),
// }));

const renderSignup = () => {
  return render(
    <AuthProvider>
      <Provider store={mockStore}>
        <BrowserRouter>
          <Signup />
        </BrowserRouter>
      </Provider>
    </AuthProvider>
  );
};

describe('🎨 Signup UI/UX Quality Tests - Code of Craft', () => {
  describe('🔥 Modern Component Usage', () => {
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

      // Authentication mode tabs
      const nostrTab = screen.getByText('🌐 NOSTR Keys');
      const emailTab = screen.getByText('📧 Email');

      expect(nostrTab).toBeInTheDocument();
      expect(emailTab).toBeInTheDocument();
    });

    test('SHOULD show sovereign identity benefits', () => {
      renderSignup();

      // NOSTR benefits should be highlighted
      expect(screen.getByText('🔐 Sovereign Identity')).toBeInTheDocument();
      expect(screen.getByText(/Create a NOSTR identity that you own forever/)).toBeInTheDocument();
    });
  });

  describe('✨ Creator-Focused UX', () => {
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
      const creatorButton = screen.getByText('✨ Creator');
      expect(creatorButton).toBeInTheDocument();
    });

    test('SHOULD have clear NOSTR benefits for creators', () => {
      renderSignup();

      // NOSTR mode should be default (creator-focused)
      const nostrTab = screen.getByText('🌐 NOSTR Keys');
      expect(nostrTab).toHaveClass('bg-white', 'text-blue-600');

      // Should explain sovereign identity benefits
      const sovereignText = screen.getByText(/sovereign identity/i);
      expect(sovereignText).toBeInTheDocument();
    });
  });

  describe('🚀 Accessibility Standards', () => {
    test('SHOULD have proper role selection', () => {
      renderSignup();

      // Role selection should be available
      expect(screen.getByText('I want to join as a:')).toBeInTheDocument();
      expect(screen.getByText('💚 Supporter')).toBeInTheDocument();
      expect(screen.getByText('✨ Creator')).toBeInTheDocument();
    });

    test('SHOULD have semantic button roles', () => {
      renderSignup();

      // Authentication mode buttons should be buttons
      const nostrTab = screen.getByText('🌐 NOSTR Keys');
      expect(nostrTab.tagName).toBe('BUTTON');

      const emailTab = screen.getByText('📧 Email');
      expect(emailTab.tagName).toBe('BUTTON');
    });

    test('SHOULD have proper heading structure', () => {
      renderSignup();

      // Main heading should exist with specific text
      const mainHeading = screen.getByRole('heading', { level: 3, name: 'Join Sovren' });
      expect(mainHeading).toHaveTextContent('Join Sovren');
    });
  });

  describe('⚡ Performance Standards', () => {
    test('SHOULD have NOSTR key generation capability', () => {
      renderSignup();

      // Should have key generation feature
      const generateButton = screen.getByText('🎲 Generate My NOSTR Keys');
      expect(generateButton).toBeInTheDocument();
    });

    test('SHOULD use efficient modern design', () => {
      const { container } = renderSignup();

      // Should use modern Tailwind utilities efficiently
      const cardElement = container.querySelector('[class*="rounded-"]');
      expect(cardElement).toBeInTheDocument();

      // Should not have inline styling
      const inlineStyledElements = container.querySelectorAll('[style]');
      expect(inlineStyledElements.length).toBe(0);
    });
  });
});
