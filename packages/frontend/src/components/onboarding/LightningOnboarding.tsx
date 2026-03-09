import {
  AlertTriangle,
  ArrowRight,
  Bitcoin,
  CheckCircle,
  Clock,
  Copy,
  Crown,
  DollarSign,
  Download,
  ExternalLink,
  QrCode,
  Shield,
  Smartphone,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface LightningWallet {
  type: 'custodial' | 'self-custodial' | 'browser';
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  setupTime: string;
  features: string[];
  downloadUrl?: string;
  webUrl?: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
}

const LightningOnboarding: React.FC = () => {
  // Onboarding state
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedWallet, setSelectedWallet] = useState<LightningWallet | null>(null);
  const [testAmount, setTestAmount] = useState('1000'); // sats
  const [paymentRequest, setPaymentRequest] = useState('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lightning wallet options
  const walletOptions: LightningWallet[] = [
    {
      type: 'custodial',
      name: 'Wallet of Satoshi',
      description: 'Perfect for beginners - no setup required',
      icon: Smartphone,
      difficulty: 'Beginner',
      setupTime: '30 seconds',
      features: ['Instant setup', 'No channel management', 'Mobile-first', 'Custodial'],
      downloadUrl: 'https://www.walletofsatoshi.com/',
    },
    {
      type: 'custodial',
      name: 'Strike',
      description: 'Easy fiat-to-Bitcoin with Lightning',
      icon: Zap,
      difficulty: 'Beginner',
      setupTime: '2 minutes',
      features: ['Fiat integration', 'KYC required', 'US/Global', 'Auto-convert'],
      downloadUrl: 'https://strike.me/',
    },
    {
      type: 'self-custodial',
      name: 'Phoenix',
      description: 'Self-custodial with automatic channel management',
      icon: Shield,
      difficulty: 'Intermediate',
      setupTime: '5 minutes',
      features: ['Self-custodial', 'Auto channels', 'Mobile', 'Your keys'],
      downloadUrl: 'https://phoenix.acinq.co/',
    },
    {
      type: 'browser',
      name: 'Alby',
      description: 'Browser extension for web payments',
      icon: ExternalLink,
      difficulty: 'Intermediate',
      setupTime: '3 minutes',
      features: ['Browser extension', 'Web payments', 'NOSTR integration', 'Developer-friendly'],
      downloadUrl: 'https://getalby.com/',
    },
  ];

  // Onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Lightning Network Onboarding',
      description: 'Experience instant Bitcoin payments',
      icon: Zap,
      completed: false,
    },
    {
      id: 'choose-wallet',
      title: 'Choose Your Wallet',
      description: 'Select the perfect Lightning wallet for you',
      icon: Wallet,
      completed: !!selectedWallet,
    },
    {
      id: 'setup-wallet',
      title: 'Setup Your Wallet',
      description: 'Follow wallet-specific instructions',
      icon: Smartphone,
      completed: false,
    },
    {
      id: 'test-payment',
      title: 'Test Payment',
      description: 'Make your first Lightning payment',
      icon: Bitcoin,
      completed: paymentCompleted,
    },
    {
      id: 'complete',
      title: 'Lightning Ready!',
      description: "You're ready for instant Bitcoin payments",
      icon: Crown,
      completed: false,
    },
  ];

  // Generate test invoice
  const generateTestInvoice = async () => {
    setIsGeneratingInvoice(true);
    setError(null);

    try {
      // Simulate invoice generation (in real app, this would call Lightning service)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock Lightning invoice
      const mockInvoice = `lnbc${testAmount}u1p3xnhl2pp5jptserfk3zk4qy42tlucycrfwxhydvlemu9pqr93tuzlv9cc7g3sdqsvfhkcap3xyhx7un8cqzpgxqzjcsp5f8c52y2stc300gl6s4xswtjpc37hrnnr3c9wvtgjfuvqmpm35evq9qyyssqy4lgd8tj637qcjp05rdpxxykjenthxftej7a2zzmwrmrl70fyj9hvj0rewhzj7jfyuwkwycg8jpz6fc77u2dw5qzs8m5yl5l3rqm8qs9qrrsq`;

      setPaymentRequest(mockInvoice);
      setInvoiceGenerated(true);
    } catch (err) {
      setError('Failed to generate test invoice');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Copy invoice to clipboard
  const copyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(paymentRequest);
    } catch (err) {
      console.error('Failed to copy invoice:', err);
    }
  };

  // Simulate payment completion
  const simulatePayment = () => {
    setPaymentCompleted(true);
    setCurrentStep(4);
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-amber-500/20 rounded-2xl">
                <Zap className="h-12 w-12 text-amber-400" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">
                Welcome to Lightning Network
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Experience instant, low-cost Bitcoin payments. Lightning Network makes Bitcoin
                payments as fast as sending a text message.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="glass-dark border-border/50">
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Instant</h3>
                  <p className="text-sm text-muted-foreground">Payments in milliseconds</p>
                </CardContent>
              </Card>

              <Card className="glass-dark border-border/50">
                <CardContent className="p-6 text-center">
                  <DollarSign className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Low Cost</h3>
                  <p className="text-sm text-muted-foreground">Fees under 1 cent</p>
                </CardContent>
              </Card>

              <Card className="glass-dark border-border/50">
                <CardContent className="p-6 text-center">
                  <Bitcoin className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Bitcoin Native</h3>
                  <p className="text-sm text-muted-foreground">Real Bitcoin, instant settlement</p>
                </CardContent>
              </Card>
            </div>

            <Button
              onClick={() => setCurrentStep(1)}
              className="mt-8 px-8 py-4 text-lg bg-amber-500 hover:bg-amber-600"
            >
              Get Started with Lightning
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        );

      case 1: // Choose Wallet
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-amber-500/20 rounded-xl">
                  <Wallet className="h-8 w-8 text-amber-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">
                Choose Your Lightning Wallet
              </h2>
              <p className="text-muted-foreground">
                Select the wallet that best fits your needs and experience level.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {walletOptions.map((wallet, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedWallet?.name === wallet.name
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedWallet(wallet)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div
                        className={`p-3 rounded-lg ${
                          wallet.type === 'custodial'
                            ? 'bg-green-500/20'
                            : wallet.type === 'self-custodial'
                              ? 'bg-purple-500/20'
                              : 'bg-purple-500/20'
                        }`}
                      >
                        <wallet.icon className="h-6 w-6 text-white" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white">{wallet.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {wallet.difficulty}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">{wallet.description}</p>

                        <div className="flex items-center text-xs text-muted-foreground mb-3">
                          <Clock className="h-3 w-3 mr-1" />
                          Setup: {wallet.setupTime}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {wallet.features.slice(0, 3).map((feature, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedWallet && (
              <div className="text-center pt-4">
                <Button
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600"
                >
                  Setup {selectedWallet.name}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        );

      case 2: // Setup Wallet
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/20 rounded-xl">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">
                Setup {selectedWallet?.name}
              </h2>
              <p className="text-muted-foreground">
                Follow these steps to get your Lightning wallet ready.
              </p>
            </div>

            {selectedWallet && (
              <div className="space-y-6">
                <Alert className="border-amber-500/20 bg-amber-500/10">
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription className="text-foreground">
                    <strong>Setup Time:</strong> {selectedWallet.setupTime}
                    <br />
                    <strong>Difficulty:</strong> {selectedWallet.difficulty}
                  </AlertDescription>
                </Alert>

                <Card className="glass-dark">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-white mb-4">Step-by-Step Instructions:</h3>

                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-sm font-semibold">
                          1
                        </div>
                        <div>
                          <p className="text-white font-medium">Download the app</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedWallet.type === 'browser'
                              ? 'Install the browser extension from the official store'
                              : 'Download from App Store or Google Play Store'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-sm font-semibold">
                          2
                        </div>
                        <div>
                          <p className="text-white font-medium">Create your wallet</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedWallet.type === 'custodial'
                              ? 'Sign up with email or phone number'
                              : 'Generate and backup your seed phrase securely'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-sm font-semibold">
                          3
                        </div>
                        <div>
                          <p className="text-white font-medium">Fund your wallet</p>
                          <p className="text-sm text-muted-foreground">
                            Add Bitcoin to start making Lightning payments
                          </p>
                        </div>
                      </div>

                      {selectedWallet.type === 'self-custodial' && (
                        <div className="flex items-start space-x-3">
                          <div className="flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-sm font-semibold">
                            4
                          </div>
                          <div>
                            <p className="text-white font-medium">Open Lightning channels</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedWallet.name === 'Phoenix'
                                ? 'Phoenix will automatically manage channels for you'
                                : 'Open channels to start making Lightning payments'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-4 mt-6">
                      <Button
                        onClick={() => window.open(selectedWallet.downloadUrl, '_blank')}
                        className="flex-1 bg-amber-500 hover:bg-amber-600"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download {selectedWallet.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Alert className="border-yellow-500/20 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-yellow-100">
                    <strong>Security Reminder:</strong>
                    <br />
                    {selectedWallet.type === 'custodial'
                      ? 'Custodial wallets hold your Bitcoin. Start with small amounts.'
                      : 'Self-custodial wallets give you full control. Backup your seed phrase!'}
                  </AlertDescription>
                </Alert>

                <div className="text-center">
                  <Button onClick={() => setCurrentStep(3)} variant="outline" className="px-8 py-3">
                    I've Set Up My Wallet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Test Payment
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-amber-500/20 rounded-xl">
                  <Bitcoin className="h-8 w-8 text-amber-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">
                Test Your First Payment
              </h2>
              <p className="text-muted-foreground">
                Make a small test payment to verify everything works perfectly.
              </p>
            </div>

            <div className="space-y-6">
              <Card className="glass-dark">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-white mb-4">Generate Test Invoice</h3>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Test Amount (sats)</Label>
                      <Input
                        type="number"
                        value={testAmount}
                        onChange={(e) => setTestAmount(e.target.value)}
                        className="mt-2"
                        placeholder="1000"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        ≈ ${(parseInt(testAmount) * 0.0003).toFixed(2)} USD
                      </p>
                    </div>

                    <Button
                      onClick={generateTestInvoice}
                      disabled={isGeneratingInvoice || invoiceGenerated}
                      className="w-full bg-amber-500 hover:bg-amber-600"
                    >
                      {isGeneratingInvoice ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Generating Invoice...
                        </>
                      ) : invoiceGenerated ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Invoice Generated
                        </>
                      ) : (
                        <>
                          <QrCode className="mr-2 h-4 w-4" />
                          Generate Test Invoice
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {invoiceGenerated && (
                <Card className="glass-dark">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-white mb-4">Payment Invoice</h3>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-white">Lightning Invoice</Label>
                        <div className="flex mt-2">
                          <Input value={paymentRequest} readOnly className="font-mono text-xs" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyInvoice}
                            className="ml-2"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Alert className="border-amber-500/20 bg-amber-500/10">
                        <Zap className="h-4 w-4" />
                        <AlertDescription className="text-foreground">
                          <strong>How to pay:</strong>
                          <br />
                          1. Open your Lightning wallet
                          <br />
                          2. Scan the QR code or paste the invoice
                          <br />
                          3. Confirm the payment
                        </AlertDescription>
                      </Alert>

                      <div className="text-center">
                        <Button
                          onClick={simulatePayment}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Simulate Payment Success
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {error && (
              <Alert className="border-red-500/20 bg-red-500/10">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 4: // Complete
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl">
                <Crown className="h-12 w-12 text-white" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">
                Lightning Network Ready!
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Congratulations! You're now ready to send and receive instant Bitcoin payments.
                Welcome to the future of money.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <Card className="glass-dark border-border/50">
                <CardContent className="p-6 text-center">
                  <Zap className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Instant Payments</h3>
                  <p className="text-sm text-muted-foreground">Send Bitcoin in milliseconds</p>
                </CardContent>
              </Card>

              <Card className="glass-dark border-border/50">
                <CardContent className="p-6 text-center">
                  <DollarSign className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Micropayments</h3>
                  <p className="text-sm text-muted-foreground">Pay for content, tips, and more</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 mt-8">
              <Button
                onClick={() => (window.location.href = '/dashboard')}
                className="px-8 py-4 text-lg bg-gradient-to-r from-amber-500 to-amber-600 mr-4"
              >
                Start Using Lightning
                <Zap className="ml-2 h-5 w-5" />
              </Button>

              <Button
                onClick={() => setCurrentStep(0)}
                variant="outline"
                className="px-8 py-4 text-lg"
              >
                Try Another Wallet
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    index <= currentStep
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-amber-500' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">{steps[currentStep]?.title}</h3>
            <p className="text-sm text-muted-foreground">{steps[currentStep]?.description}</p>
          </div>
        </div>

        {/* Main Content */}
        <Card className="max-w-4xl mx-auto glass-dark border-border/50">
          <CardContent className="p-8">{renderStep()}</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LightningOnboarding;
