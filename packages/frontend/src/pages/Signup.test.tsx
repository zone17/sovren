import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import paymentSlice from '../store/slices/paymentSlice';
import postSlice from '../store/slices/postSlice';
import userSlice from '../store/slices/userSlice';
import Signup from './Signup';

// Mock Layout component
jest.mock('../components/Layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>;
  };
});

// Mock Button component
jest.mock('../components/Button', () => {
  return function MockButton({ children, onClick, disabled, isLoading, ...props }: any) {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        data-loading={isLoading}
        {...props}
      >
        {children}
      </button>
    );
  };
});

const createTestStore = (): ReturnType<typeof configureStore> => {
  return configureStore({
    reducer: {
      user: userSlice,
      post: postSlice,
      payment: paymentSlice,
    },
  });
};

const renderWithProviders = (component: React.ReactElement) => {
  const store = createTestStore();
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter>{component}</MemoryRouter>
      </Provider>
    ),
    store,
  };
};

describe('Signup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders within Layout component', () => {
      renderWithProviders(<Signup />);
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('renders the main heading', () => {
      renderWithProviders(<Signup />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Create Account');
    });

    it('renders the form description', () => {
      renderWithProviders(<Signup />);
      expect(
        screen.getByText('Join Sovren and start monetizing your content.')
      ).toBeInTheDocument();
    });

    it('renders all form elements', () => {
      renderWithProviders(<Signup />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('renders the login link', () => {
      renderWithProviders(<Signup />);
      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Form validation', () => {
    it('shows validation errors for empty fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('shows validation error for invalid email format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('shows validation error for short password', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123');
      await user.type(confirmPasswordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('shows validation error for password mismatch', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('clears validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      // Trigger validation error
      await user.click(submitButton);
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      // Start typing to clear error
      await user.type(nameInput, 'Test User');
      await waitFor(() => {
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form interaction', () => {
    it('updates input values when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
      expect(passwordInput.value).toBe('password123');
      expect(confirmPasswordInput.value).toBe('password123');
    });

    it('shows loading state during form submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // Should show loading state
      expect(submitButton).toHaveAttribute('data-loading', 'true');
    });

    it('disables form during submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      expect(nameInput).toHaveAttribute('type', 'text');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('has proper heading hierarchy', () => {
      renderWithProviders(<Signup />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      // Tab navigation should work
      await user.tab();
      expect(nameInput).toHaveFocus();

      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(confirmPasswordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Layout and styling', () => {
    it('has proper form structure', () => {
      renderWithProviders(<Signup />);

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      const formGroups = form.querySelectorAll('.space-y-6');
      expect(formGroups.length).toBeGreaterThan(0);
    });

    it('centers the form on the page', () => {
      renderWithProviders(<Signup />);

      const container = screen.getByTestId('layout');
      const formContainer = container.querySelector('.min-h-screen');
      expect(formContainer).toBeInTheDocument();
    });
  });

  describe('Navigation integration', () => {
    it('renders login link correctly', () => {
      renderWithProviders(<Signup />);

      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('integrates properly with React Router', () => {
      renderWithProviders(<Signup />);

      // Verify links are rendered as proper anchor tags
      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink.tagName).toBe('A');
    });
  });

  describe('Form submission', () => {
    it('handles form submission with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Form should be submittable
      expect(submitButton).not.toBeDisabled();
      await user.click(submitButton);

      // Should enter loading state
      expect(submitButton).toHaveAttribute('data-loading', 'true');
    });

    it('prevents submission with invalid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });
  });

  describe('Password strength indication', () => {
    it('handles password input correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const passwordInput = screen.getByLabelText(/^password$/i);

      await user.type(passwordInput, 'strongpassword123');

      expect(passwordInput).toHaveValue('strongpassword123');
    });
  });

  describe('Error handling', () => {
    it('displays general error messages appropriately', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Signup />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // The component should handle and display errors appropriately
      await waitFor(() => {
        // Check that the form submission was attempted
        expect(submitButton).toHaveAttribute('data-loading', 'true');
      });
    });
  });
});
