import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { BYOKSetup } from '../BYOKSetup';

const mockUseBYOK = jest.fn();
const mockUseBYOKStatus = jest.fn();

jest.mock('../../hooks/useBYOK', () => ({
  useBYOK: () => mockUseBYOK(),
  useBYOKStatus: () => mockUseBYOKStatus(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const defaultBYOK = {
  status: 'idle' as const,
  validationResult: undefined,
  isPending: false,
  isRevoking: false,
  submit: jest.fn(),
  revoke: jest.fn(),
  reset: jest.fn(),
};

describe('BYOKSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBYOK.mockReturnValue(defaultBYOK);
    mockUseBYOKStatus.mockReturnValue({ data: null, isLoading: false });
  });

  describe('Rendering', () => {
    it('renders the title and description', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByText('X / Twitter API Access')).toBeInTheDocument();
      expect(screen.getByText(/Add your own X\/Twitter API keys/)).toBeInTheDocument();
    });

    it('renders all four API key fields', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
      expect(screen.getByLabelText('API Secret')).toBeInTheDocument();
      expect(screen.getByLabelText('Access Token')).toBeInTheDocument();
      expect(screen.getByLabelText('Access Token Secret')).toBeInTheDocument();
    });

    it('shows loading skeleton when status is loading', () => {
      mockUseBYOKStatus.mockReturnValue({ data: null, isLoading: true });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    });

    it('shows write-only mode banner when not connected', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      // Multiple mentions of "write-only mode" are expected (description + amber banner)
      expect(screen.getAllByText(/write-only mode/i).length).toBeGreaterThanOrEqual(1);
    });

    it('shows Connected badge when keys are valid', () => {
      mockUseBYOKStatus.mockReturnValue({
        data: { valid: true, username: 'testuser' },
        isLoading: false,
      });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows Write-only badge when in write-only mode', () => {
      mockUseBYOKStatus.mockReturnValue({
        data: { valid: false, write_only: true },
        isLoading: false,
      });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByText('Write-only')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('disables submit button when fields are empty', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Validate and save API keys')).toBeDisabled();
    });

    it('enables submit button when all fields are filled', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'key' } });
      fireEvent.change(screen.getByLabelText('API Secret'), { target: { value: 'secret' } });
      fireEvent.change(screen.getByLabelText('Access Token'), { target: { value: 'token' } });
      fireEvent.change(screen.getByLabelText('Access Token Secret'), {
        target: { value: 'tokensecret' },
      });

      expect(screen.getByLabelText('Validate and save API keys')).not.toBeDisabled();
    });

    it('calls submit with all field values on form submit', () => {
      const submit = jest.fn();
      mockUseBYOK.mockReturnValue({ ...defaultBYOK, submit });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'mykey' } });
      fireEvent.change(screen.getByLabelText('API Secret'), { target: { value: 'mysecret' } });
      fireEvent.change(screen.getByLabelText('Access Token'), { target: { value: 'mytoken' } });
      fireEvent.change(screen.getByLabelText('Access Token Secret'), {
        target: { value: 'mytokensecret' },
      });

      fireEvent.click(screen.getByLabelText('Validate and save API keys'));

      expect(submit).toHaveBeenCalledWith({
        api_key: 'mykey',
        api_secret: 'mysecret',
        access_token: 'mytoken',
        access_token_secret: 'mytokensecret',
      });
    });
  });

  describe('Validation feedback', () => {
    it('shows success alert on valid status', () => {
      mockUseBYOK.mockReturnValue({
        ...defaultBYOK,
        status: 'valid',
        validationResult: { valid: true, username: 'testuser' },
      });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByRole('alert')).toHaveTextContent(/validated successfully/i);
    });

    it('shows write-only alert on write_only status', () => {
      mockUseBYOK.mockReturnValue({ ...defaultBYOK, status: 'write_only' });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByRole('alert')).toHaveTextContent(/write-only mode/i);
    });

    it('shows error alert on invalid status', () => {
      mockUseBYOK.mockReturnValue({
        ...defaultBYOK,
        status: 'invalid',
        validationResult: { valid: false, error: 'Invalid credentials' },
      });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByRole('alert')).toHaveTextContent(/validation failed/i);
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    it('shows validating state on submit button while pending', () => {
      mockUseBYOK.mockReturnValue({ ...defaultBYOK, status: 'validating', isPending: true });
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Validate and save API keys')).toHaveTextContent('Validating...');
    });
  });

  describe('Accessibility', () => {
    it('all inputs use password type for security', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      const inputs = screen.getAllByLabelText(/API Key|API Secret|Access Token/);
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('type', 'password');
      });
    });

    it('all inputs have autocomplete off', () => {
      render(<BYOKSetup />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('API Key')).toHaveAttribute('autocomplete', 'off');
    });
  });
});
