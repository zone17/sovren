import React, { useEffect, useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { QRCode } from '../ui/qrcode';

export interface LightningWalletManagerProps {
  /**
   * User ID
   */
  userId: string;

  /**
   * CSS class for the component
   */
  className?: string;
}

interface WalletInfo {
  balance: number;
  connectedNode?: string;
  lastActivity?: number;
}

export const LightningWalletManager: React.FC<LightningWalletManagerProps> = ({
  userId,
  className = '',
}) => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [nodeAddress, setNodeAddress] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('1000');
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch wallet info on component mount
  useEffect(() => {
    const fetchWalletInfo = async () => {
      try {
        // In a real implementation, this would call your backend API
        // For now, we'll simulate a network request
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mock wallet info
        setWalletInfo({
          balance: 250000, // 250k sats
          connectedNode: '03e5b39e7494f3741103652d74276c4218efc5497642b86f2d9e2bc1c5e0d0d758',
          lastActivity: Date.now() - 3600000, // 1 hour ago
        });
      } catch (error) {
        console.error('Failed to fetch wallet info:', error);
        toast({
          title: 'Error',
          description: 'Failed to load wallet information',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWalletInfo();
  }, [toast, userId]);

  // Format balance display
  const formatBalance = (balance: number) => {
    if (balance >= 1000000) {
      return `${(balance / 1000000).toFixed(2)} M sats`;
    } else if (balance >= 1000) {
      return `${(balance / 1000).toFixed(1)} K sats`;
    } else {
      return `${balance} sats`;
    }
  };

  // Connect to a Lightning node
  const connectNode = async () => {
    if (!nodeAddress) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Lightning node address',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsConnecting(true);

      // In a real implementation, this would call your backend API
      // For now, we'll simulate a network request
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update wallet info with connected node
      setWalletInfo((prev) =>
        prev
          ? {
              ...prev,
              connectedNode: nodeAddress,
            }
          : null
      );

      toast({
        title: 'Success',
        description: 'Connected to Lightning node',
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to connect to node:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to Lightning node',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Generate a Lightning invoice
  const generateInvoice = async () => {
    try {
      // In a real implementation, this would call your backend API
      // For now, we'll simulate a network request
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock invoice
      const mockInvoice =
        'lnbc1500n1pj4d0fzpp5v3j8jj4fs8sd80lllcz7hd0mwsw6m5ew63u4aqj9nkw64xus8t6sdqqcqzpgxqyz5vqsp5usw0d4djmqdj0xd4jcfj7z8dz3t6g3h0eg6f3x0lkucm3jl5aq4q9qyyssqn2k3lx86m3245lj2qkwmq8975g58h8l4pzjd8gkmuwmwvx9nrj9wt0f3d73xz0lwtj7fuhk5khf4r2a9ykht3kx8edlj8hdnvgvgpf5hz75';
      setInvoice(mockInvoice);
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate Lightning invoice',
        variant: 'destructive',
      });
    }
  };

  // Send a Lightning payment
  const sendPayment = async () => {
    if (!sendAddress) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Lightning invoice',
        variant: 'destructive',
      });
      return;
    }

    try {
      // In a real implementation, this would call your backend API
      // For now, we'll simulate a network request
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update wallet info with reduced balance
      const amount = parseInt(sendAmount) || 1000;
      setWalletInfo((prev) =>
        prev
          ? {
              ...prev,
              balance: prev.balance - amount,
              lastActivity: Date.now(),
            }
          : null
      );

      toast({
        title: 'Success',
        description: 'Lightning payment sent successfully',
        variant: 'default',
      });

      // Reset send form
      setSendAddress('');
      setSendAmount('');
      setShowSend(false);
    } catch (error) {
      console.error('Failed to send payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to send Lightning payment',
        variant: 'destructive',
      });
    }
  };

  // Copy invoice to clipboard
  const copyInvoice = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice);
      toast({
        title: 'Copied',
        description: 'Lightning invoice copied to clipboard',
        variant: 'default',
      });
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Lightning Wallet</CardTitle>
        <CardDescription>Manage your Bitcoin Lightning wallet</CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : walletInfo ? (
          <div className="space-y-6">
            {/* Balance */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Available Balance</div>
              <div className="text-3xl font-bold">{formatBalance(walletInfo.balance)}</div>
            </div>

            {/* Node Connection */}
            <div>
              <div className="text-sm font-medium mb-2">Connected Node</div>
              {walletInfo.connectedNode ? (
                <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono break-all">
                  {walletInfo.connectedNode}
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter node address"
                    value={nodeAddress}
                    onChange={(e) => setNodeAddress(e.target.value)}
                  />
                  <Button onClick={connectNode} disabled={isConnecting}>
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
              )}
            </div>

            {/* Receive Section */}
            {showReceive && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Receive Bitcoin</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowReceive(false);
                      setInvoice(null);
                    }}
                  >
                    Close
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Amount (sats)"
                      type="number"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                    />
                    <Button onClick={generateInvoice}>Generate</Button>
                  </div>

                  {invoice && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="p-2 bg-white rounded-lg">
                          <QRCode
                            value={`lightning:${invoice}`}
                            size={200}
                            level="M"
                            includeMargin={true}
                          />
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button onClick={copyInvoice} className="w-full">
                          Copy Invoice
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Send Section */}
            {showSend && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Send Bitcoin</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSend(false);
                      setSendAddress('');
                      setSendAmount('');
                    }}
                  >
                    Close
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">Lightning Invoice</label>
                    <Input
                      placeholder="lnbc..."
                      value={sendAddress}
                      onChange={(e) => setSendAddress(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">Amount (sats)</label>
                    <Input
                      placeholder="Amount"
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                  </div>

                  <Button onClick={sendPayment} className="w-full">
                    Send Payment
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Failed to load wallet information</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        )}
      </CardContent>

      {walletInfo && !showReceive && !showSend && (
        <CardFooter className="flex space-x-2">
          <Button onClick={() => setShowReceive(true)} className="flex-1">
            Receive
          </Button>
          <Button onClick={() => setShowSend(true)} className="flex-1">
            Send
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
