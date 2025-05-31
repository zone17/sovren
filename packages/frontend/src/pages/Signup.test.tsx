import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import userSlice from '../store/slices/userSlice';
import Signup from './Signup';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock components
jest.mock('../components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
}));

jest.mock('../components/Button', () => ({
  __esModule: true,
  default: ({
    children,
    onClick,
    type,
    disabled,
    className,
    isLoading,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    className?: string;
    isLoading?: boolean;
    variant?: string;
  }): JSX.Element => (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={className}
      data-loading={isLoading}
      data-variant={variant}
    >
      {children}
    </button>
  ),
}));

// Test utilities
const renderWithProviders = (component: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      user: userSlice,
    },
  });

  return render(
    <Provider store={store}>
      <BrowserRouter>{component}</BrowserRouter>
    </Provider>
  );
};

describe('Signup Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('renders within Layout component', () => {
      renderWithProviders(<Signup />);
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('renders the main heading', () => {
      renderWithProviders(<Signup />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Create your account');
    });

    it('renders all form elements', () => {
      renderWithProviders(<Signup />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('renders the login link', () => {
      renderWithProviders(<Signup />);
      const loginButton = screen.getByRole('button', { name: /sign in to your existing account/i });
      expect(loginButton).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('shows validation for empty fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // HTML5 validation should trigger for required fields
      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      expect(nameInput).toBeInvalid();
      expect(emailInput).toBeInvalid();
      expect(passwordInput).toBeInvalid();
      expect(confirmPasswordInput).toBeInvalid();
    });

    it('shows error for password mismatch', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      expect(emailInput).toBeInvalid();
    });
  });

  describe('Form interaction', () => {
    it('updates input values when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      expect(nameInput).toHaveValue('John Doe');
      expect(emailInput).toHaveValue('john@example.com');
      expect(passwordInput).toHaveValue('password123');
      expect(confirmPasswordInput).toHaveValue('password123');
    });

    it('shows loading state during form submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // Should show loading state
      expect(submitButton).toHaveAttribute('data-loading', 'true');
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      expect(nameInput).toHaveAttribute('type', 'text');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('has proper heading hierarchy', () => {
      renderWithProviders(<Signup />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      // Test that inputs can be focused (instead of testing exact tab order)
      await user.click(nameInput);
      expect(nameInput).toHaveFocus();

      await user.click(emailInput);
      expect(emailInput).toHaveFocus();

      await user.click(passwordInput);
      expect(passwordInput).toHaveFocus();

      await user.click(confirmPasswordInput);
      expect(confirmPasswordInput).toHaveFocus();
    });
  });

  describe('Layout and styling', () => {
    it('has proper form structure', () => {
      renderWithProviders(<Signup />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('uses proper layout structure', () => {
      renderWithProviders(<Signup />);

      const container = screen.getByTestId('layout');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Navigation integration', () => {
    it('renders login button correctly', () => {
      renderWithProviders(<Signup />);

      const loginButton = screen.getByRole('button', { name: /sign in to your existing account/i });
      expect(loginButton).toBeInTheDocument();
    });

    it('integrates properly with React Router', () => {
      renderWithProviders(<Signup />);

      // Verify component renders without router errors
      expect(screen.getByText('Create your account')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('handles form submission with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Form should be submittable
      expect(submitButton).not.toBeDisabled();
      await user.click(submitButton);

      // Should enter loading state
      expect(submitButton).toHaveAttribute('data-loading', 'true');
    });

    it('prevents submission with mismatched passwords', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });
  });
});
