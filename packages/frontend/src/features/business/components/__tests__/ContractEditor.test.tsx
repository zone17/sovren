import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import ContractEditor from '../ContractEditor';

// --- Hook mocks ---
const mockUseContractTemplate = jest.fn();
const mockUseCreateContract = jest.fn();
const mockUseAnalyzeContract = jest.fn();

jest.mock('../../hooks/useContracts', () => ({
  useContractTemplate: () => mockUseContractTemplate(),
  useCreateContract: () => mockUseCreateContract(),
  useAnalyzeContract: () => mockUseAnalyzeContract(),
}));

// --- Helpers ---
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const defaultMutateFn = jest.fn();

const idleCreateMutation = {
  mutate: defaultMutateFn,
  isPending: false,
  isError: false,
};

const idleAnalyzeMutation = {
  mutate: defaultMutateFn,
  isPending: false,
};

const sampleTemplate = {
  id: 'tmpl-1',
  name: 'Sponsorship Agreement',
  category: 'sponsorship',
  templateText: 'This agreement is between [CREATOR] and [BRAND].',
  redFlags: [],
  createdAt: '2024-01-01T00:00:00Z',
};

const sampleRedFlags = [
  {
    type: 'exclusivity' as const,
    match: 'exclusive rights',
    severity: 'high' as const,
    suggestion: 'Consider limiting the exclusivity scope.',
  },
];

const defaultProps = {
  templateId: 'tmpl-1',
  onSaved: jest.fn(),
  onCancel: jest.fn(),
};

// --- Tests ---
describe('ContractEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseContractTemplate.mockReturnValue({ data: sampleTemplate, isLoading: false });
    mockUseCreateContract.mockReturnValue(idleCreateMutation);
    mockUseAnalyzeContract.mockReturnValue(idleAnalyzeMutation);
  });

  describe('Rendering', () => {
    it('shows loading skeleton while template is loading', () => {
      mockUseContractTemplate.mockReturnValue({ data: undefined, isLoading: true });

      const { container } = render(<ContractEditor {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows not found message when template is missing', () => {
      mockUseContractTemplate.mockReturnValue({ data: undefined, isLoading: false });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Template not found.')).toBeInTheDocument();
    });

    it('renders template name and category when template loads', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Sponsorship Agreement')).toBeInTheDocument();
      expect(screen.getByText(/sponsorship contract/i)).toBeInTheDocument();
    });

    it('renders the Counterparty Name input', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Counterparty Name')).toBeInTheDocument();
    });

    it('renders the contract text editor pre-filled with template text', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      const editor = screen.getByLabelText('Contract text editor') as HTMLTextAreaElement;
      expect(editor.value).toBe(sampleTemplate.templateText);
    });

    it('renders the Analyze for Red Flags button', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Analyze for Red Flags' })).toBeInTheDocument();
    });

    it('renders the Save Contract button', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Save Contract' })).toBeInTheDocument();
    });

    it('renders the Cancel button when onCancel is provided', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not render Cancel button when onCancel is not provided', () => {
      render(<ContractEditor templateId="tmpl-1" />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  describe('Save Contract', () => {
    it('disables Save Contract when counterparty is empty', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      // Contract text is pre-filled, but counterparty is empty
      expect(screen.getByRole('button', { name: 'Save Contract' })).toBeDisabled();
    });

    it('disables Save Contract when contract text is empty', () => {
      // Template with empty text
      mockUseContractTemplate.mockReturnValue({
        data: { ...sampleTemplate, templateText: '' },
        isLoading: false,
      });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Counterparty Name'), {
        target: { value: 'Acme Corp' },
      });

      expect(screen.getByRole('button', { name: 'Save Contract' })).toBeDisabled();
    });

    it('enables Save Contract when both counterparty and contract text are filled', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Counterparty Name'), {
        target: { value: 'Acme Corp' },
      });

      expect(screen.getByRole('button', { name: 'Save Contract' })).not.toBeDisabled();
    });

    it('calls createMutation.mutate with templateId, counterparty, and filledText', () => {
      const mutate = jest.fn();
      mockUseCreateContract.mockReturnValue({ ...idleCreateMutation, mutate });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Counterparty Name'), {
        target: { value: 'Acme Corp' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Contract' }));

      expect(mutate).toHaveBeenCalledWith(
        {
          templateId: 'tmpl-1',
          counterparty: 'Acme Corp',
          filledText: sampleTemplate.templateText,
        },
        expect.any(Object)
      );
    });

    it('shows Saving... on button while save mutation is pending', () => {
      mockUseCreateContract.mockReturnValue({ ...idleCreateMutation, isPending: true });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Counterparty Name'), {
        target: { value: 'Acme Corp' },
      });

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows error alert when save mutation fails', () => {
      mockUseCreateContract.mockReturnValue({ ...idleCreateMutation, isError: true });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save contract');
    });

    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(<ContractEditor {...defaultProps} onCancel={onCancel} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Red flag analysis', () => {
    it('disables Analyze button when contract text is empty', () => {
      mockUseContractTemplate.mockReturnValue({
        data: { ...sampleTemplate, templateText: '' },
        isLoading: false,
      });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Analyze for Red Flags' })).toBeDisabled();
    });

    it('enables Analyze button when contract text is present', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Analyze for Red Flags' })).not.toBeDisabled();
    });

    it('calls analyzeMutation.mutate with the current contract text', () => {
      const mutate = jest.fn();
      mockUseAnalyzeContract.mockReturnValue({ ...idleAnalyzeMutation, mutate });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Analyze for Red Flags' }));

      expect(mutate).toHaveBeenCalledWith(
        sampleTemplate.templateText,
        expect.any(Object)
      );
    });

    it('shows Analyzing... on button while analysis is pending', () => {
      mockUseAnalyzeContract.mockReturnValue({ ...idleAnalyzeMutation, isPending: true });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });

    it('disables Analyze button while analysis is pending', () => {
      mockUseAnalyzeContract.mockReturnValue({ ...idleAnalyzeMutation, isPending: true });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      // Button text changes to "Analyzing..."
      expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();
    });

    it('shows red flag report after successful analysis', () => {
      let analyzeSuccessCallback: ((res: { data: typeof sampleRedFlags }) => void) | null = null;

      const mutate = jest.fn((_text: string, opts: { onSuccess: (res: { data: typeof sampleRedFlags }) => void }) => {
        analyzeSuccessCallback = opts.onSuccess;
      });

      mockUseAnalyzeContract.mockReturnValue({ ...idleAnalyzeMutation, mutate });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Analyze for Red Flags' }));

      // Simulate success callback — wrap in act because it triggers state updates.
      act(() => {
        analyzeSuccessCallback!({ data: sampleRedFlags });
      });

      expect(screen.getByText('Red Flag Analysis')).toBeInTheDocument();
    });

    it('does not show red flag report before analysis is run', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.queryByText('Red Flag Analysis')).not.toBeInTheDocument();
    });
  });

  describe('Contract text editing', () => {
    it('updates contract text when user edits the textarea', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      const editor = screen.getByLabelText('Contract text editor') as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: 'Updated contract text.' } });

      expect(editor.value).toBe('Updated contract text.');
    });

    it('updates counterparty field when user types', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      const input = screen.getByLabelText('Counterparty Name') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'My Brand' } });

      expect(input.value).toBe('My Brand');
    });
  });

  describe('Accessibility', () => {
    it('Counterparty Name input is associated with its label', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Counterparty Name')).toBeInTheDocument();
    });

    it('Contract text editor has an accessible label', () => {
      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Contract text editor')).toBeInTheDocument();
    });

    it('Analyze button has aria-busy when pending', () => {
      mockUseAnalyzeContract.mockReturnValue({ ...idleAnalyzeMutation, isPending: true });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      const analyzeBtn = screen.getByRole('button', { name: 'Analyzing...' });
      expect(analyzeBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('Save button has aria-busy when pending', () => {
      mockUseCreateContract.mockReturnValue({ ...idleCreateMutation, isPending: true });

      render(<ContractEditor {...defaultProps} />, { wrapper: createWrapper() });

      const saveBtn = screen.getByRole('button', { name: 'Saving...' });
      expect(saveBtn).toHaveAttribute('aria-busy', 'true');
    });
  });
});
