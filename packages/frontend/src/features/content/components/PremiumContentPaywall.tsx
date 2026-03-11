import React, { useCallback, useState } from 'react';
import { useAppSelector } from '../../../store';
import type { ContentItem } from '../../../types/content';
import { Spinner } from '../../../components/ui/spinner';
import { formatSats } from '../../../shared/utils/formatSats';

// Simple icons without external dependencies
const LockIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const ZapIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface PremiumContentPaywallProps {
  content: ContentItem;
  onPaymentComplete?: () => void;
}

export const PremiumContentPaywall: React.FC<PremiumContentPaywallProps> = ({
  content,
  onPaymentComplete,
}) => {
  const { currentUser } = useAppSelector((state) => state.user);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState(content.price_sats || 1000);

  const handlePayment = useCallback(async () => {
    if (!currentUser?.nostr_pubkey) {
      setPaymentError('Please sign in to access premium content');
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      // TODO(payment-engineer): Implement real Lightning invoice generation and payment flow.
      // Endpoint: POST /api/v1/payments/invoices { contentId, amountSats }
      // On success: poll GET /api/v1/payments/invoices/:id until settled, then call onPaymentComplete().
      setPaymentError(
        'Lightning payments are coming soon. Check back shortly to unlock this content.'
      );
    } finally {
      setIsProcessingPayment(false);
    }
  }, [content.id, content.title, selectedAmount, currentUser?.nostr_pubkey, onPaymentComplete]);

  const predefinedAmounts = [
    content.price_sats || 1000,
    (content.price_sats || 1000) * 2,
    (content.price_sats || 1000) * 5,
  ];

  return (
    <div className="max-w-md mx-auto bg-card rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-white/20 rounded-full">
            <LockIcon />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Premium Content</h2>
        <p className="text-purple-100">Support the creator to unlock this exclusive content</p>
      </div>

      {/* Content Preview */}
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground mb-2">{content.title}</h3>
        {content.description && (
          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{content.description}</p>
        )}

        {/* What you get */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">What you'll get:</h4>
          <div className="flex items-center text-sm text-muted-foreground">
            <CheckIcon />
            <span className="ml-2">Full access to premium content</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <CheckIcon />
            <span className="ml-2">Support independent creator</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <CheckIcon />
            <span className="ml-2">Instant Lightning Network payment</span>
          </div>
        </div>
      </div>

      {/* Payment Section */}
      <div className="px-6 py-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Choose amount to support:
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {predefinedAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount)}
                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  selectedAmount === amount
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-card text-foreground border-border hover:bg-accent'
                }`}
              >
                {formatSats(amount, { abbreviate: true })}
              </button>
            ))}
          </div>

          {/* Custom amount input */}
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              min="1"
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Custom amount"
            />
            <span className="text-sm text-muted-foreground">sats</span>
          </div>
        </div>

        {/* Error message */}
        {paymentError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{paymentError}</p>
          </div>
        )}

        {/* Payment button */}
        <button
          onClick={handlePayment}
          disabled={isProcessingPayment || selectedAmount < 1}
          className={`w-full flex items-center justify-center px-4 py-3 rounded-md font-medium text-white transition-colors ${
            isProcessingPayment || selectedAmount < 1
              ? 'bg-muted cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
          }`}
        >
          {isProcessingPayment ? (
            <>
              <Spinner size="sm" className="mr-2 border-white border-t-transparent" />
              Processing...
            </>
          ) : (
            <>
              <ZapIcon />
              <span className="ml-2">
                Pay {formatSats(selectedAmount, { abbreviate: true })} with Lightning
              </span>
            </>
          )}
        </button>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center mt-3">
          Secure instant payment via Bitcoin Lightning Network
        </p>
      </div>
    </div>
  );
};

export default PremiumContentPaywall;
