import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import InvoiceEditor from '../InvoiceEditor';

// --- Hook mocks ---
const mockUseCreateBusinessInvoice = jest.fn();
const mockUseGeneratePaymentLink = jest.fn();

jest.mock('../../hooks/useBusinessInvoices', () => ({
  useCreateBusinessInvoice: () => mockUseCreateBusinessInvoice(),
  useGeneratePaymentLink: () => mockUseGeneratePaymentLink(),
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

const idlePaymentLinkMutation = {
  mutate: defaultMutateFn,
  isPending: false,
};

const defaultProps = {
  onSaved: jest.fn(),
  onCancel: jest.fn(),
};

// --- Tests ---
describe('InvoiceEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreateBusinessInvoice.mockReturnValue(idleCreateMutation);
    mockUseGeneratePaymentLink.mockReturnValue(idlePaymentLinkMutation);
  });

  describe('Rendering', () => {
    it('renders the New Invoice heading', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('New Invoice')).toBeInTheDocument();
    });

    it('renders the Client Name input', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
    });

    it('renders the Line Items fieldset', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('group', { name: 'Line Items' })).toBeInTheDocument();
    });

    it('renders a single empty line item row by default', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Line item 1 description')).toBeInTheDocument();
      expect(screen.getByLabelText('Line item 1 quantity')).toBeInTheDocument();
      expect(screen.getByLabelText('Line item 1 unit price in sats')).toBeInTheDocument();
    });

    it('renders the Add line item button', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('+ Add line item')).toBeInTheDocument();
    });

    it('renders the total display showing 0 sats initially', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('0 sats')).toBeInTheDocument();
    });

    it('renders the Due Date input', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Due Date')).toBeInTheDocument();
    });

    it('renders the Recurring select with all options', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      const select = screen.getByLabelText('Recurring') as HTMLSelectElement;
      const optionTexts = Array.from(select.options).map((o) => o.text);

      expect(optionTexts).toContain('One-time');
      expect(optionTexts).toContain('Weekly');
      expect(optionTexts).toContain('Bi-weekly');
      expect(optionTexts).toContain('Monthly');
      expect(optionTexts).toContain('Quarterly');
    });

    it('renders the Save Invoice button', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Save Invoice' })).toBeInTheDocument();
    });

    it('renders the Cancel button when onCancel is provided', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not render Cancel button when onCancel is not provided', () => {
      render(<InvoiceEditor />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  describe('Adding line items', () => {
    it('adds a second line item row when Add line item is clicked', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('+ Add line item'));

      expect(screen.getByLabelText('Line item 2 description')).toBeInTheDocument();
      expect(screen.getByLabelText('Line item 2 quantity')).toBeInTheDocument();
    });

    it('adds multiple line items correctly', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('+ Add line item'));
      fireEvent.click(screen.getByText('+ Add line item'));

      expect(screen.getByLabelText('Line item 3 description')).toBeInTheDocument();
    });
  });

  describe('Removing line items', () => {
    it('disables the remove button when there is only one line item', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Remove line item 1')).toBeDisabled();
    });

    it('enables the remove button when there are multiple line items', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('+ Add line item'));

      expect(screen.getByLabelText('Remove line item 1')).not.toBeDisabled();
    });

    it('removes the correct line item when Remove is clicked', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('+ Add line item'));

      // Fill in descriptions to distinguish them
      fireEvent.change(screen.getByLabelText('Line item 1 description'), {
        target: { value: 'First item' },
      });
      fireEvent.change(screen.getByLabelText('Line item 2 description'), {
        target: { value: 'Second item' },
      });

      fireEvent.click(screen.getByLabelText('Remove line item 1'));

      expect(screen.queryByDisplayValue('First item')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Second item')).toBeInTheDocument();
    });
  });

  describe('Total calculation', () => {
    it('calculates total as quantity * unitPriceSats for a single item', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Line item 1 quantity'), {
        target: { value: '2' },
      });
      fireEvent.change(screen.getByLabelText('Line item 1 unit price in sats'), {
        target: { value: '5000' },
      });

      // 2 * 5000 = 10000 sats
      expect(screen.getByText('10,000 sats')).toBeInTheDocument();
    });

    it('calculates total correctly across multiple line items', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Line item 1 quantity'), {
        target: { value: '1' },
      });
      fireEvent.change(screen.getByLabelText('Line item 1 unit price in sats'), {
        target: { value: '3000' },
      });

      fireEvent.click(screen.getByText('+ Add line item'));

      fireEvent.change(screen.getByLabelText('Line item 2 quantity'), {
        target: { value: '2' },
      });
      fireEvent.change(screen.getByLabelText('Line item 2 unit price in sats'), {
        target: { value: '2000' },
      });

      // 1*3000 + 2*2000 = 7000
      expect(screen.getByText('7,000 sats')).toBeInTheDocument();
    });

    it('total is updated live as aria-live polite', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      // The total span has aria-live="polite" per component source
      const totalEl = screen.getByText('0 sats');
      expect(totalEl).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Save Invoice', () => {
    it('disables Save Invoice when client name is empty', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      // Total is 0 and client is empty
      expect(screen.getByRole('button', { name: 'Save Invoice' })).toBeDisabled();
    });

    it('disables Save Invoice when total is 0', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Client Name'), {
        target: { value: 'Acme Corp' },
      });

      // Total is still 0
      expect(screen.getByRole('button', { name: 'Save Invoice' })).toBeDisabled();
    });

    it('enables Save Invoice when client name and non-zero total are set', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Acme Corp' } });
      fireEvent.change(screen.getByLabelText('Line item 1 quantity'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Line item 1 unit price in sats'), {
        target: { value: '5000' },
      });

      expect(screen.getByRole('button', { name: 'Save Invoice' })).not.toBeDisabled();
    });

    it('calls createMutation.mutate with correct payload on save', () => {
      const mutate = jest.fn();
      mockUseCreateBusinessInvoice.mockReturnValue({ ...idleCreateMutation, mutate });

      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Acme Corp' } });
      fireEvent.change(screen.getByLabelText('Line item 1 description'), {
        target: { value: 'Design work' },
      });
      fireEvent.change(screen.getByLabelText('Line item 1 quantity'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Line item 1 unit price in sats'), {
        target: { value: '5000' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Invoice' }));

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: 'Acme Corp',
          totalSats: 5000,
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              description: 'Design work',
              quantity: 1,
              unitPriceSats: 5000,
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('shows Saving... on button while create mutation is pending', () => {
      mockUseCreateBusinessInvoice.mockReturnValue({ ...idleCreateMutation, isPending: true });

      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows error alert when create mutation fails', () => {
      mockUseCreateBusinessInvoice.mockReturnValue({ ...idleCreateMutation, isError: true });

      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save invoice');
    });

    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(<InvoiceEditor {...defaultProps} onCancel={onCancel} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Payment link generation', () => {
    it('does not show Generate Payment Link button before invoice is saved', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(
        screen.queryByRole('button', { name: /Generate Payment Link/ })
      ).not.toBeInTheDocument();
    });

    it('shows Generate Payment Link button after invoice is saved', () => {
      let saveSuccessCallback: ((res: { data: { id: string } }) => void) | null = null;

      const mutate = jest.fn(
        (
          _data: unknown,
          opts: { onSuccess: (res: { data: { id: string } }) => void }
        ) => {
          saveSuccessCallback = opts.onSuccess;
        }
      );

      mockUseCreateBusinessInvoice.mockReturnValue({ ...idleCreateMutation, mutate });

      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Acme Corp' } });
      fireEvent.change(screen.getByLabelText('Line item 1 quantity'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Line item 1 unit price in sats'), {
        target: { value: '5000' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Invoice' }));

      // Wrap in act because onSuccess triggers setSavedId state update.
      act(() => {
        saveSuccessCallback!({ data: { id: 'invoice-123' } });
      });

      expect(
        screen.getByRole('button', { name: /Generate Payment Link/i })
      ).toBeInTheDocument();
    });

    it('shows payment link section when payment link is generated', () => {
      let paymentSuccessCallback: (
        (res: { data: { lnurlPay: string; qrCode: string } }) => void
      ) | null = null;

      const payMutate = jest.fn(
        (
          _id: string,
          opts: { onSuccess: (res: { data: { lnurlPay: string; qrCode: string } }) => void }
        ) => {
          paymentSuccessCallback = opts.onSuccess;
        }
      );

      let saveSuccessCallback: ((res: { data: { id: string } }) => void) | null = null;
      const saveMutate = jest.fn(
        (
          _data: unknown,
          opts: { onSuccess: (res: { data: { id: string } }) => void }
        ) => {
          saveSuccessCallback = opts.onSuccess;
        }
      );

      mockUseCreateBusinessInvoice.mockReturnValue({
        ...idleCreateMutation,
        mutate: saveMutate,
      });
      mockUseGeneratePaymentLink.mockReturnValue({
        ...idlePaymentLinkMutation,
        mutate: payMutate,
      });

      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      // Save the invoice
      fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'Client' } });
      fireEvent.change(screen.getByLabelText('Line item 1 quantity'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Line item 1 unit price in sats'), {
        target: { value: '1000' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Invoice' }));

      // Wrap in act because onSuccess triggers setSavedId state update.
      act(() => {
        saveSuccessCallback!({ data: { id: 'inv-999' } });
      });

      // Generate payment link
      fireEvent.click(screen.getByRole('button', { name: /Generate Payment Link/i }));

      // Wrap in act because onSuccess triggers setPaymentLink state update.
      act(() => {
        paymentSuccessCallback!({ data: { lnurlPay: 'lnurl1test', qrCode: 'data:image/png;base64' } });
      });

      expect(screen.getByText('Payment Link Generated')).toBeInTheDocument();
      expect(screen.getByLabelText('LNURL payment link')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('Client Name input is associated with its label', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
    });

    it('line item description inputs have accessible labels', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Line item 1 description')).toBeInTheDocument();
    });

    it('Save Invoice button has aria-busy when pending', () => {
      mockUseCreateBusinessInvoice.mockReturnValue({ ...idleCreateMutation, isPending: true });

      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      const saveBtn = screen.getByRole('button', { name: 'Saving...' });
      expect(saveBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('Due Date input is associated with its label', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Due Date')).toBeInTheDocument();
    });

    it('Recurring select is associated with its label', () => {
      render(<InvoiceEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Recurring')).toBeInTheDocument();
    });
  });
});
