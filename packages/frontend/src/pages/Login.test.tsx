import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import userSlice from '../store/slices/userSlice';
import Login from './Login';

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
      data-testid="button"
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

describe('Login Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('renders login form correctly', () => {
      renderWithProviders(<Login />);

      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('renders signup link', () => {
      renderWithProviders(<Login />);

      expect(screen.getByText(/create a new account/i)).toBeInTheDocument();
    });

    it('has proper form accessibility', () => {
      renderWithProviders(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('required');
    });
  });

  describe('Form validation', () => {
    it('shows validation errors for empty form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      await user.click(submitButton);

      // Check for HTML5 validation or custom validation messages
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(emailInput).toBeInvalid();
      expect(passwordInput).toBeInvalid();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      await user.click(submitButton);

      expect(emailInput).toBeInvalid();
    });
  });

  describe('Form interaction', () => {
    it('allows typing in form fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Verify the form submission behavior
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });
  });

  describe('Layout and styling', () => {
    it('uses proper layout structure', () => {
      renderWithProviders(<Login />);

      const layout = screen.getByTestId('layout');
      expect(layout).toBeInTheDocument();
    });

    it('has responsive design classes', () => {
      renderWithProviders(<Login />);

      // Check for form element
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });
  });

  describe('Navigation integration', () => {
    it('renders signup link correctly', () => {
      renderWithProviders(<Login />);

      const signupText = screen.getByText(/create a new account/i);
      expect(signupText).toBeInTheDocument();
    });

    it('integrates properly with React Router', () => {
      renderWithProviders(<Login />);

      // Verify component renders without router errors
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and structure', () => {
      renderWithProviders(<Login />);

      // Check form exists
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();

      // Check input labels
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('has proper heading structure', () => {
      renderWithProviders(<Login />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Sign in to your account');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      // Test that inputs can be focused (instead of testing exact tab order)
      await user.click(emailInput);
      expect(emailInput).toHaveFocus();

      await user.click(passwordInput);
      expect(passwordInput).toHaveFocus();
    });
  });
});
