import React, { useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { QRCode } from '../ui/qrcode';
import { Spinner } from '../ui/spinner';
import { lightningApi, LightningApiError } from '../../lib/api/lightningApi';

export interface LightningPaymentButtonProps {
  /**
   * Amount in satoshis
   */
  amount: number;

  /**
   * Creator ID for the payment recipient
   */
  creatorId?: string;

  /**
   * Description for the payment
   */
  description?: string;

  /**
   * Button text
   */
  buttonText?: string;

  /**
   * CSS class for the button
   */
  className?: string;

  /**
   * Callback when payment is successful
   */
  onSuccess?: (paymentHash: string) => void;

  /**
   * Callback when payment fails
   */
  onError?: (error: string) => void;

  /**
   * Callback when payment is canceled
   */
  onCancel?: () => void;

  /**
   * Disable the button
   */
  disabled?: boolean;

  /**
   * Variant of the button
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

  /**
   * Size of the button
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const LightningPaymentButton: React.FC<LightningPaymentButtonProps> = ({
  amount,
  creatorId,
  description = 'Payment to Sovren',
  buttonText = 'Pay with Lightning',
  className = '',
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  variant = 'default',
  size = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [currentPaymentHash, setCurrentPaymentHash] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const { toast } = useToast();

  // Function to create a Lightning invoice
  const createInvoice = async () => {
    try {
      setIsLoading(true);

      // Call backend API to create Lightning invoice
      const invoice = await lightningApi.createInvoice({
        amount,
        creatorId,
        description,
        expirySeconds: 3600, // 1 hour expiry
      });

      setPaymentRequest(invoice.paymentRequest);
      setCurrentPaymentHash(invoice.paymentHash);
      setPaymentStatus('pending');

      // Start polling for payment status
      pollPaymentStatus(invoice.paymentHash);
    } catch (error) {
      console.error('Failed to create invoice:', error);
      setPaymentStatus('failed');

      const errorMessage =
        error instanceof LightningApiError ? error.message : 'Failed to create Lightning invoice';

      onError?.(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to poll for payment status
  const pollPaymentStatus = async (paymentHash: string) => {
    try {
      // Poll backend API for payment status updates (max 60 seconds)
      const settledInvoice = await lightningApi.pollPaymentStatus(
        paymentHash,
        2000, // Poll every 2 seconds
        30 // Max 30 attempts (60 seconds total)
      );

      setPaymentStatus('success');
      onSuccess?.(settledInvoice.paymentHash);
      toast({
        title: 'Payment Successful',
        description: 'Your Lightning payment has been received',
        variant: 'default',
      });

      // Close the dialog after a short delay
      setTimeout(() => setIsOpen(false), 2000);
    } catch (error) {
      console.error('Failed to check payment status:', error);
      setPaymentStatus('failed');

      const errorMessage =
        error instanceof LightningApiError ? error.message : 'Failed to verify payment';

      onError?.(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Function to handle dialog open
  const handleOpen = async () => {
    setIsOpen(true);
    setPaymentStatus(null);
    setPaymentRequest(null);
    setCurrentPaymentHash(null);
    await createInvoice();
  };

  // Function to handle dialog close
  const handleClose = () => {
    if (paymentStatus !== 'success') {
      onCancel?.();
    }
    setIsOpen(false);
  };

  // Function to copy payment request to clipboard
  const copyToClipboard = () => {
    if (paymentRequest) {
      navigator.clipboard.writeText(paymentRequest);
      toast({
        title: 'Copied',
        description: 'Lightning invoice copied to clipboard',
        variant: 'default',
      });
    }
  };

  // Function to open in wallet if WebLN is available
  const openInWallet = async () => {
    if (!paymentRequest || !currentPaymentHash) return;

    // Check if WebLN is available
    if (typeof window !== 'undefined' && 'webln' in window) {
      try {
        // @ts-ignore - WebLN types not available
        await window.webln.enable();
        // @ts-ignore - WebLN types not available
        await window.webln.sendPayment(paymentRequest);

        // Payment successful - verify with backend
        const invoice = await lightningApi.checkInvoiceStatus(currentPaymentHash);

        if (invoice.settled) {
          setPaymentStatus('success');
          onSuccess?.(currentPaymentHash);
          toast({
            title: 'Payment Successful',
            description: 'Your Lightning payment has been sent',
            variant: 'default',
          });

          // Close the dialog after a short delay
          setTimeout(() => setIsOpen(false), 2000);
        } else {
          // Payment sent but not yet confirmed
          toast({
            title: 'Payment Sent',
            description: 'Waiting for confirmation...',
            variant: 'default',
          });
        }
      } catch (error) {
        console.error('WebLN payment failed:', error);
        toast({
          title: 'Payment Failed',
          description: 'Failed to send payment via wallet',
          variant: 'destructive',
        });
      }
    } else {
      // WebLN not available
      toast({
        title: 'Wallet Not Found',
        description: 'No Lightning wallet detected in your browser',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        className={className}
        disabled={disabled}
        variant={variant}
        size={size}
      >
        {buttonText}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lightning Payment</DialogTitle>
            <DialogDescription>
              Pay {amount} sats for {description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Spinner size="lg" />
                <p className="mt-4 text-sm text-gray-500">Generating invoice...</p>
              </div>
            ) : paymentRequest ? (
              <>
                <div className="p-2 bg-white rounded-lg">
                  <QRCode
                    value={`lightning:${paymentRequest}`}
                    size={256}
                    level="M"
                    includeMargin={true}
                  />
                </div>

                <div className="w-full text-center">
                  <p className="text-sm font-medium">
                    {paymentStatus === 'pending' && 'Waiting for payment...'}
                    {paymentStatus === 'success' && 'Payment received!'}
                    {paymentStatus === 'failed' && 'Payment failed!'}
                  </p>
                </div>

                <div className="flex flex-col w-full space-y-2">
                  <Button onClick={openInWallet} disabled={paymentStatus === 'success'}>
                    Open in Wallet
                  </Button>
                  <Button onClick={copyToClipboard} variant="outline">
                    Copy Invoice
                  </Button>
                </div>
              </>
            ) : paymentStatus === 'failed' ? (
              <div className="text-center">
                <p className="text-red-500">Failed to generate invoice</p>
                <Button onClick={createInvoice} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
