import React from 'react';
import { Button } from '../../../components/ui/button';
import { usePaymentFlow } from '../hooks/usePaymentFlow';

interface LightningPaymentFlowProps {
  amountSats: number;
  recipientId: string;
  recipientName: string;
  paymentType: 'subscription' | 'tip' | 'one_time';
  description: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const LightningPaymentFlow: React.FC<LightningPaymentFlowProps> = ({
  amountSats,
  recipientId,
  recipientName,
  paymentType,
  description,
  onSuccess,
  onCancel,
}) => {
  const payment = usePaymentFlow({
    amountSats,
    recipientId,
    paymentType,
    description,
    onSuccess,
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Lightning Payment</h2>
        <p className="text-sm text-gray-500 mt-1">
          {description} for {recipientName}
        </p>
      </div>

      {/* Amount */}
      <div className="text-center mb-6 py-4 bg-gray-50 rounded-lg">
        <p className="text-3xl font-bold text-gray-900">{amountSats.toLocaleString()}</p>
        <p className="text-sm text-gray-500 mt-1">satoshis</p>
      </div>

      {/* Idle state */}
      {payment.status === 'idle' && (
        <div className="space-y-3">
          <Button
            onClick={payment.createInvoice}
            variant="lightning"
            className="w-full"
            aria-label={`Generate Lightning invoice for ${amountSats} sats`}
          >
            Generate Invoice
          </Button>
          {onCancel && (
            <Button onClick={onCancel} variant="ghost" className="w-full">
              Cancel
            </Button>
          )}
        </div>
      )}

      {/* Creating state */}
      {payment.status === 'creating' && (
        <div className="text-center py-4" role="status">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
          <p className="mt-3 text-sm text-gray-600">Creating Lightning invoice...</p>
          <span className="sr-only">Creating invoice</span>
        </div>
      )}

      {/* Pending -- show invoice */}
      {payment.status === 'pending' && payment.paymentRequest && (
        <div className="space-y-4">
          {/* QR Code placeholder */}
          <div
            className="bg-white border-2 border-gray-200 rounded-lg p-4 mx-auto"
            style={{ maxWidth: '200px' }}
            aria-label="Lightning invoice QR code"
          >
            <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl mb-1">&#9889;</p>
                <p className="text-xs text-gray-500">QR Code</p>
              </div>
            </div>
          </div>

          {/* Payment request string */}
          <div>
            <label htmlFor="payment-request" className="block text-xs text-gray-500 mb-1">
              BOLT11 Invoice
            </label>
            <div className="flex gap-2">
              <input
                id="payment-request"
                type="text"
                value={payment.paymentRequest}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs font-mono truncate"
                aria-label="Lightning payment request string"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(payment.paymentRequest || '')}
                aria-label="Copy payment request"
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Timer */}
          {payment.timeRemaining !== null && (
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Expires in{' '}
                <span className="font-mono font-semibold text-gray-900">
                  {formatTime(payment.timeRemaining)}
                </span>
              </p>
            </div>
          )}

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-2 py-2" role="status">
            <div className="animate-pulse h-2 w-2 bg-amber-400 rounded-full" />
            <p className="text-sm text-gray-600">Waiting for payment...</p>
          </div>

          {/* Demo: simulate payment button */}
          {'simulatePayment' in payment && (
            <Button
              onClick={(payment as { simulatePayment: () => void }).simulatePayment}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              (Demo) Simulate Payment
            </Button>
          )}

          <Button onClick={payment.reset} variant="ghost" className="w-full" size="sm">
            Cancel
          </Button>
        </div>
      )}

      {/* Paid */}
      {payment.status === 'paid' && (
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Confirmed</h3>
          <p className="text-sm text-gray-600 mt-1">
            {amountSats.toLocaleString()} sats sent to {recipientName}
          </p>
          <Button onClick={payment.reset} variant="outline" className="mt-4">
            Done
          </Button>
        </div>
      )}

      {/* Expired */}
      {payment.status === 'expired' && (
        <div className="text-center py-4">
          <p className="text-lg font-semibold text-gray-900">Invoice Expired</p>
          <p className="text-sm text-gray-600 mt-1">
            The payment window has closed. Please try again.
          </p>
          <Button onClick={payment.reset} variant="default" className="mt-4">
            Try Again
          </Button>
        </div>
      )}

      {/* Error */}
      {payment.status === 'error' && (
        <div className="text-center py-4" role="alert">
          <p className="text-lg font-semibold text-red-700">Payment Error</p>
          <p className="text-sm text-gray-600 mt-1">{payment.error}</p>
          <Button onClick={payment.reset} variant="default" className="mt-4">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};
