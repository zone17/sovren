import {
  ArrowRight,
  CheckCircle,
  Copy,
  Crown,
  Download,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  Key,
  Lock,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../features/auth';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface NostrKeys {
  publicKey: string;
  privateKey: string;
  npub: string;
  nsec: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
}

const NostrOnboarding: React.FC = () => {
  const { generateNostrChallenge, authenticateNostr } = useAuth();

  // Onboarding state
  const [currentStep, setCurrentStep] = useState(0);
  const [nostrKeys, setNostrKeys] = useState<NostrKeys | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [understandsSecurity, setUnderstandsSecurity] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  // Handle profile form submission
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Profile data would be saved here in a full implementation
    setCurrentStep(2);
  };

  // Skip profile step
  const skipProfileStep = () => {
    setCurrentStep(2);
  };

  // Onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Sovereign Identity',
      description: 'Experience true digital freedom with NOSTR',
      icon: Crown,
      completed: false,
    },
    {
      id: 'generate',
      title: 'Generate Your Keys',
      description: 'Create your unique digital identity',
      icon: Key,
      completed: !!nostrKeys,
    },
    {
      id: 'backup',
      title: 'Secure Your Keys',
      description: 'Backup your keys safely',
      icon: Shield,
      completed: backupConfirmed,
    },
    {
      id: 'verify',
      title: 'Verify Identity',
      description: 'Sign your first NOSTR event',
      icon: CheckCircle,
      completed: false,
    },
    {
      id: 'complete',
      title: 'Welcome to Sovren!',
      description: 'Your sovereign journey begins',
      icon: Sparkles,
      completed: false,
    },
  ];

  // Generate NOSTR key pair with bech32 encoding
  const generateKeys = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');
      const { nip19 } = await import('nostr-tools');

      const privateKey = generateSecretKey();
      const publicKey = getPublicKey(privateKey);

      // Convert to bech32 format (npub/nsec)
      const npub = nip19.npubEncode(publicKey);
      const nsec = nip19.nsecEncode(privateKey);

      setNostrKeys({
        publicKey,
        privateKey: Buffer.from(privateKey).toString('hex'),
        npub,
        nsec,
      });

      setCurrentStep(2); // Move to backup step
    } catch (err) {
      setError('Failed to generate NOSTR keys. Please try again.');
      console.error('Key generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy to clipboard with feedback
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download keys as JSON file
  const downloadKeys = () => {
    if (!nostrKeys) return;

    const keyData = {
      publicKey: nostrKeys.npub,
      privateKey: nostrKeys.nsec,
      createdAt: new Date().toISOString(),
      platform: 'Sovren',
      warning: 'Keep your private key (nsec) secure and never share it!',
    };

    const blob = new Blob([JSON.stringify(keyData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sovren-nostr-keys-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Complete NOSTR authentication
  const completeAuthentication = async () => {
    if (!nostrKeys) return;

    setIsAuthenticating(true);
    setError(null);

    try {
      // Generate challenge
      const challengeResult = await generateNostrChallenge();
      if (challengeResult.error || !challengeResult.challenge) {
        throw new Error(challengeResult.error || 'Failed to get challenge');
      }

      // Sign challenge
      const { finalizeEvent } = await import('nostr-tools/pure');
      const timestamp = Math.floor(Date.now() / 1000);

      const event = {
        kind: 1,
        pubkey: nostrKeys.publicKey,
        created_at: timestamp,
        tags: [],
        content: `Welcome to Sovren! Authenticating at ${new Date().toISOString()}`,
      };

      const privateKeyBytes = new Uint8Array(Buffer.from(nostrKeys.privateKey, 'hex'));
      const signedEvent = finalizeEvent(event, privateKeyBytes);

      // Authenticate
      const authResult = await authenticateNostr({
        signature: signedEvent.sig,
        pubkey: nostrKeys.publicKey,
        challenge: challengeResult.challenge,
        timestamp: Date.now(),
      });

      if (authResult.error) {
        throw new Error(authResult.error);
      }

      setCurrentStep(4); // Move to completion
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-primary/20 rounded-2xl">
                <Crown className="h-12 w-12 text-primary" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">
                Welcome to True Digital Sovereignty
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                NOSTR gives you complete control over your digital identity. No big tech, no
                censorship, no deplatforming - just pure, sovereign communication.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="glass-dark">
                <CardContent className="p-6 text-center">
                  <Globe className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Decentralized</h3>
                  <p className="text-sm text-muted-foreground">No single point of failure</p>
                </CardContent>
              </Card>

              <Card className="glass-dark">
                <CardContent className="p-6 text-center">
                  <Lock className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Censorship Resistant</h3>
                  <p className="text-sm text-muted-foreground">Your voice, your rules</p>
                </CardContent>
              </Card>

              <Card className="glass-dark">
                <CardContent className="p-6 text-center">
                  <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Self-Sovereign</h3>
                  <p className="text-sm text-muted-foreground">You own your identity</p>
                </CardContent>
              </Card>
            </div>

            <Button
              onClick={() => setCurrentStep(1)}
              className="mt-8 px-8 py-4 text-lg bg-primary hover:bg-primary/90"
            >
              Begin Your Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        );

      case 1: // Generate Keys
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-purple-500/20 rounded-xl">
                  <Key className="h-8 w-8 text-purple-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">
                Generate Your NOSTR Keys
              </h2>
              <p className="text-muted-foreground">
                Your keys are your identity. They're generated locally and never leave your device.
              </p>
            </div>

            <Alert className="border-primary/20 bg-primary/10">
              <HelpCircle className="h-4 w-4" />
              <AlertDescription className="text-foreground">
                <strong>What are NOSTR keys?</strong>
                <br />
                Your public key is like your username - share it freely. Your private key is like
                your password - keep it secret!
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <Button
                onClick={generateKeys}
                disabled={isGenerating}
                className="px-8 py-4 text-lg bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Generating Keys...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate My Keys
                  </>
                )}
              </Button>
            </div>

            {error && (
              <Alert className="border-red-500/20 bg-red-500/10">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 2: // Backup Keys
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/20 rounded-xl">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">Secure Your Keys</h2>
              <p className="text-muted-foreground">
                Save your keys safely. Without them, you'll lose access to your identity.
              </p>
            </div>

            {nostrKeys && (
              <div className="space-y-4">
                {/* Public Key */}
                <div>
                  <Label className="text-white font-medium">
                    Public Key (npub) - Safe to Share
                  </Label>
                  <div className="flex mt-2">
                    <Input value={nostrKeys.npub} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(nostrKeys.npub, 'npub')}
                      className="ml-2"
                    >
                      {copiedField === 'npub' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Private Key */}
                <div>
                  <Label className="text-white font-medium">
                    Private Key (nsec) - Keep Secret!
                  </Label>
                  <div className="flex mt-2">
                    <Input
                      type={showPrivateKey ? 'text' : 'password'}
                      value={nostrKeys.nsec}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="ml-2"
                    >
                      {showPrivateKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(nostrKeys.nsec, 'nsec')}
                      className="ml-2"
                    >
                      {copiedField === 'nsec' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Download Button */}
                <div className="text-center pt-4">
                  <Button onClick={downloadKeys} variant="outline" className="mr-4">
                    <Download className="mr-2 h-4 w-4" />
                    Download Keys
                  </Button>
                </div>

                {/* Security Confirmations */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="backup"
                      checked={backupConfirmed}
                      onChange={(e) => setBackupConfirmed(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="backup" className="text-sm text-muted-foreground">
                      I have safely backed up my private key (nsec)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="security"
                      checked={understandsSecurity}
                      onChange={(e) => setUnderstandsSecurity(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="security" className="text-sm text-muted-foreground">
                      I understand that losing my private key means losing my identity
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={() => setCurrentStep(3)}
                  disabled={!backupConfirmed || !understandsSecurity}
                  className="w-full mt-6 bg-primary hover:bg-primary/90"
                >
                  Continue to Verification
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        );

      case 3: // Verify Identity
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/20 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-display">
                Verify Your Identity
              </h2>
              <p className="text-muted-foreground">
                Sign your first NOSTR event to prove you control your keys.
              </p>
            </div>

            <Alert className="border-purple-500/20 bg-purple-500/10">
              <Zap className="h-4 w-4" />
              <AlertDescription className="text-foreground">
                <strong>What's happening?</strong>
                <br />
                We'll create a cryptographic signature that proves you own your private key, without
                ever revealing it.
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <Button
                onClick={completeAuthentication}
                disabled={isAuthenticating}
                className="px-8 py-4 text-lg bg-primary hover:bg-primary/90"
              >
                {isAuthenticating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Signing Event...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Sign & Verify
                  </>
                )}
              </Button>
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
              <div className="p-6 bg-gradient-to-br from-purple-500 to-primary rounded-2xl">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">Welcome to Sovren!</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Congratulations! You now have a sovereign digital identity. You're ready to
                experience true digital freedom.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <Card className="glass-dark">
                <CardContent className="p-6 text-center">
                  <Zap className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Lightning Wallet</h3>
                  <p className="text-sm text-muted-foreground">Set up instant Bitcoin payments</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card className="glass-dark">
                <CardContent className="p-6 text-center">
                  <Globe className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Creator Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Start monetizing your content</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Explore
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Button
              onClick={() => (window.location.href = '/dashboard')}
              className="mt-8 px-8 py-4 text-lg bg-gradient-to-r from-purple-500 to-primary"
            >
              Enter Sovren
              <Crown className="ml-2 h-5 w-5" />
            </Button>
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
                      ? 'bg-primary border-primary text-white'
                      : 'border-gray-600 text-gray-400'
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
                      index < currentStep ? 'bg-primary' : 'bg-gray-600'
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
        <Card className="max-w-4xl mx-auto glass-dark backdrop-blur-sm border-border/50">
          <CardContent className="p-8">
            {renderStep()}
            {currentStep === 1 && (
              <div className="space-y-6 text-center">
                <h2 className="text-2xl font-bold text-white mb-2 font-display">
                  Choose Your Sovren Username
                </h2>
                <p className="text-base text-muted-foreground mb-4">
                  Pick a unique username for your Sovren/NOSTR identity. This helps others find and
                  connect with you. You can also add a display name, bio, and avatar.
                </p>
                <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <Label className="text-white font-medium">Username</Label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="^[a-zA-Z0-9_]+$"
                      className="mt-2 text-lg font-semibold"
                      placeholder="your_username"
                    />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Display Name (optional)</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                      className="mt-2"
                      placeholder="Your Name"
                    />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Bio (optional)</Label>
                    <Input
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={160}
                      className="mt-2"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  {/* Avatar upload can be added here if supported */}
                  <div className="flex flex-col sm:flex-row gap-4 mt-6 justify-center">
                    <Button
                      type="submit"
                      className="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg transition-all duration-300"
                    >
                      Save Profile
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={skipProfileStep}
                      className="px-8 py-3 border-2 border-border text-muted-foreground bg-secondary rounded-xl hover:border-primary hover:text-primary hover:bg-primary/10 transition-all duration-300"
                    >
                      Skip for Now
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NostrOnboarding;
