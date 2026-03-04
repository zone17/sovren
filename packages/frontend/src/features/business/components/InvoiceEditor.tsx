import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useCreateBusinessInvoice, useGeneratePaymentLink } from '../hooks/useBusinessInvoices';
import type { LineItem, RecurringInterval } from '@shared/types/finance';

interface InvoiceEditorProps {
  onSaved?: (invoiceId: string) => void;
  onCancel?: () => void;
}

const EMPTY_LINE_ITEM: LineItem = { description: '', quantity: 1, unitPriceSats: 0 };

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ onSaved, onCancel }) => {
  const createMutation = useCreateBusinessInvoice();
  const paymentLinkMutation = useGeneratePaymentLink();

  const [clientName, setClientName] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [dueDate, setDueDate] = useState('');
  const [recurringInterval, setRecurringInterval] = useState<RecurringInterval | ''>('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<{ lnurlPay: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const totalSats = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceSats, 0);

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!clientName.trim() || totalSats <= 0) return;
    createMutation.mutate(
      {
        clientName,
        lineItems,
        dueDate: dueDate || undefined,
        recurringInterval: recurringInterval || undefined,
      },
      {
        onSuccess: (res) => {
          setSavedId(res.data.id);
          onSaved?.(res.data.id);
        },
      }
    );
  };

  const handleGeneratePaymentLink = () => {
    if (!savedId) return;
    paymentLinkMutation.mutate(savedId, {
      onSuccess: (res) => setPaymentLink({ lnurlPay: res.data.lnurlPay }),
    });
  };

  // Derive QR from paymentLink — safe on unmount (Kieran EDGE-1 fix)
  useEffect(() => {
    if (!paymentLink) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(paymentLink.lnurlPay, { width: 200 })
      .then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentLink]);

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-gray-900">New Invoice</h3>

      {/* Client name */}
      <div>
        <label htmlFor="client-name" className="block text-sm font-medium text-gray-700">
          Client Name
        </label>
        <input
          id="client-name"
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Client or company name"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
      </div>

      {/* Line items */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Line Items</legend>
        <div className="mt-2 space-y-2">
          {lineItems.map((item, index) => (
            <div key={index} className="flex gap-2 items-start">
              <input
                type="text"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                aria-label={`Line item ${index + 1} description`}
              />
              <input
                type="number"
                min="1"
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                aria-label={`Line item ${index + 1} quantity`}
              />
              <input
                type="number"
                min="0"
                className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Price (sats)"
                value={item.unitPriceSats || ''}
                onChange={(e) => updateLineItem(index, 'unitPriceSats', Number(e.target.value))}
                aria-label={`Line item ${index + 1} unit price in sats`}
              />
              <button
                type="button"
                className="mt-1 text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                onClick={() => removeLineItem(index)}
                disabled={lineItems.length <= 1}
                aria-label={`Remove line item ${index + 1}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          onClick={addLineItem}
        >
          + Add line item
        </button>
      </fieldset>

      {/* Total */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Total</span>
        <span className="text-lg font-bold text-gray-900" aria-live="polite">
          {totalSats.toLocaleString()} sats
        </span>
      </div>

      {/* Optional fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="due-date" className="block text-sm font-medium text-gray-700">
            Due Date
          </label>
          <input
            id="due-date"
            type="date"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="recurring" className="block text-sm font-medium text-gray-700">
            Recurring
          </label>
          <select
            id="recurring"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={recurringInterval}
            onChange={(e) => setRecurringInterval(e.target.value as RecurringInterval | '')}
          >
            <option value="">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
          onClick={handleSave}
          disabled={createMutation.isPending || !clientName.trim() || totalSats <= 0}
          aria-busy={createMutation.isPending}
        >
          {createMutation.isPending ? 'Saving...' : 'Save Invoice'}
        </button>

        {savedId && (
          <button
            type="button"
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            onClick={handleGeneratePaymentLink}
            disabled={paymentLinkMutation.isPending}
            aria-busy={paymentLinkMutation.isPending}
          >
            {paymentLinkMutation.isPending ? 'Generating...' : 'Generate Payment Link (LNURL)'}
          </button>
        )}

        {onCancel && (
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Payment link display */}
      {paymentLink && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">Payment Link Generated</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={paymentLink.lnurlPay}
              className="flex-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-mono text-gray-700 focus:outline-none"
              aria-label="LNURL payment link"
            />
            <button
              type="button"
              className="rounded-md border border-green-300 px-3 py-1.5 text-xs text-green-700 hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 transition-colors"
              onClick={() => navigator.clipboard.writeText(paymentLink.lnurlPay)}
              aria-label="Copy payment link"
            >
              Copy
            </button>
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR code for Lightning payment"
              className="w-48 h-48 rounded-md border border-green-200"
            />
          )}
        </div>
      )}

      {createMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          Failed to save invoice. Please try again.
        </p>
      )}
    </div>
  );
};

export default InvoiceEditor;
