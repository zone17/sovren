import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Copy,
  Crown,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Heart,
  HelpCircle,
  Key,
  Rocket,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SovrenIconPNG from '../../assets/icons/Sovren-icon.png';
import { useAuth } from '../../features/auth';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
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

interface LightningWallet {
  type: 'custodial' | 'self-custodial' | 'browser';
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  setupTime: string;
  features: string[];
  downloadUrl: string;
  recommended?: boolean;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  category: 'intro' | 'nostr' | 'lightning' | 'complete';
}

// SovrenIcon uses a PNG with extra transparent padding, so we wrap it in a div matching the stepper icon box size
// and scale up the image to visually match the Lucide SVG icons. This ensures perfect alignment and brand consistency.
const SovrenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`flex items-center justify-center h-full w-full overflow-visible ${className || ''}`}
  >
    <img src={SovrenIconPNG} alt='Sovren Logo' className='object-contain w-full h-full scale-125' />
  </div>
);

const SovereignOnboarding: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  // Onboarding state
  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<'creator' | 'supporter' | null>(null);
  const [nostrKeys, setNostrKeys] = useState<NostrKeys | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<LightningWallet | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [understandsSecurity, setUnderstandsSecurity] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [walletSetupComplete, setWalletSetupComplete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [username, setUsername] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [displayName, setDisplayName] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bio, setBio] = useState('');

  // Lightning wallet recommendations
  const walletOptions: LightningWallet[] = [
    {
      type: 'custodial',
      name: 'Wallet of Satoshi',
      description: 'Perfect for beginners - zero setup friction',
      icon: Smartphone,
      difficulty: 'Beginner',
      setupTime: '30 seconds',
      features: ['Instant setup', 'No channels', 'Mobile-first', 'Zero friction'],
      downloadUrl: 'https://www.walletofsatoshi.com/',
      recommended: true,
    },
    {
      type: 'browser',
      name: 'Alby',
      description: 'Best for web creators - NOSTR integrated',
      icon: ExternalLink,
      difficulty: 'Beginner',
      setupTime: '2 minutes',
      features: ['Browser extension', 'NOSTR support', 'Web payments', 'Creator-friendly'],
      downloadUrl: 'https://getalby.com/',
      recommended: true,
    },
    {
      type: 'self-custodial',
      name: 'Phoenix',
      description: 'Self-custody with automatic channels',
      icon: Shield,
      difficulty: 'Intermediate',
      setupTime: '5 minutes',
      features: ['Your keys', 'Auto channels', 'Mobile', 'Advanced'],
      downloadUrl: 'https://phoenix.acinq.co/',
    },
    {
      type: 'custodial',
      name: 'Strike',
      description: 'Fiat integration with Lightning',
      icon: Zap,
      difficulty: 'Beginner',
      setupTime: '3 minutes',
      features: ['Fiat ramps', 'KYC required', 'Global', 'Banking'],
      downloadUrl: 'https://strike.me/',
    },
  ];

  // Onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Digital Sovereignty',
      description: 'Begin your journey to true freedom',
      icon: Crown,
      completed: false,
      category: 'intro',
    },
    {
      id: 'choose-path',
      title: 'Choose Your Path',
      description: 'Creator or supporter experience',
      icon: Star,
      completed: !!userType,
      category: 'intro',
    },
    {
      id: 'nostr-identity',
      title: 'Create Your Identity',
      description: 'Generate your sovereign NOSTR keys',
      icon: Key,
      completed: !!nostrKeys,
      category: 'nostr',
    },
    {
      id: 'secure-keys',
      title: 'Secure Your Keys',
      description: 'Backup your digital identity safely',
      icon: Shield,
      completed: backupConfirmed && understandsSecurity,
      category: 'nostr',
    },
    {
      id: 'lightning-wallet',
      title: 'Lightning Wallet',
      description: 'Set up instant Bitcoin payments',
      icon: Zap,
      completed: !!selectedWallet,
      category: 'lightning',
    },
    {
      id: 'verify-setup',
      title: 'Verify Everything',
      description: 'Test your sovereign setup',
      icon: CheckCircle,
      completed: false,
      category: 'complete',
    },
    {
      id: 'complete',
      title: 'Welcome to Sovren!',
      description: 'Your sovereign journey begins',
      icon: Sparkles,
      completed: false,
      category: 'complete',
    },
  ];

  // Generate NOSTR keys with bech32 encoding
  const generateNostrKeys = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');
      const { nip19 } = await import('nostr-tools');

      const privateKey = generateSecretKey();
      const publicKey = getPublicKey(privateKey);

      const npub = nip19.npubEncode(publicKey);
      const nsec = nip19.nsecEncode(privateKey);

      // Convert to hex strings for storage
      const privateKeyHex =
        typeof privateKey === 'string'
          ? privateKey
          : Array.from(new Uint8Array(privateKey))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
      const publicKeyHex =
        typeof publicKey === 'string'
          ? publicKey
          : Array.from(new Uint8Array(publicKey))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');

      setNostrKeys({
        publicKey: publicKeyHex,
        privateKey: privateKeyHex,
        npub,
        nsec,
      });

      // Auto-advance to next step
      setTimeout(() => setCurrentStep(3), 500);
    } catch (err) {
      setError(
        `Failed to generate NOSTR keys: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
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

  // Download keys as secure JSON
  const downloadKeys = () => {
    if (!nostrKeys) return;

    const keyData = {
      publicKey: nostrKeys.npub,
      privateKey: nostrKeys.nsec,
      createdAt: new Date().toISOString(),
      platform: 'Sovren',
      userType: userType,
      warning: 'CRITICAL: Keep your private key (nsec) absolutely secure! Never share it!',
      instructions: 'Import these keys into any NOSTR client to access your sovereign identity.',
    };

    const blob = new Blob([JSON.stringify(keyData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sovren-sovereign-identity-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Complete sovereign setup
  const completeSovereignSetup = async () => {
    if (!nostrKeys) return;

    setIsAuthenticating(true);
    setError(null);

    try {
      // Generate challenge
      const challengeResult = await auth.generateNostrChallenge();
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
        tags: [
          ['t', 'sovren-onboarding'],
          ['t', userType || 'supporter'],
        ],
        content: `Just completed sovereign onboarding on Sovren! NOSTR identity verified and Lightning wallet ready. The future of digital freedom starts now! #Sovren #NOSTR #Lightning #Sovereignty`,
      };

      // Convert hex string to Uint8Array for signing
      const privateKeyBytes = new Uint8Array(
        nostrKeys.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      const signedEvent = finalizeEvent(event, privateKeyBytes);

      // Save Lightning wallet info to user profile
      const userProfile = {
        nostrKeys: {
          npub: nostrKeys.npub,
          pubkey: nostrKeys.publicKey,
        },
        lightningWallet: selectedWallet
          ? {
              name: selectedWallet.name,
              type: selectedWallet.type,
              difficulty: selectedWallet.difficulty,
              setupComplete: true,
              integratedAt: new Date().toISOString(),
            }
          : null,
        userType: userType,
        onboardingCompletedAt: new Date().toISOString(),
      };

      // Store in localStorage for demo (in production would be in database)
      localStorage.setItem('sovren_user_profile', JSON.stringify(userProfile));

      // Authenticate with Sovren
      const authResult = await auth.authenticateNostr({
        signature: signedEvent.sig,
        pubkey: nostrKeys.publicKey,
        challenge: challengeResult.challenge,
        timestamp: Date.now(),
      });

      if (authResult.error) {
        throw new Error(authResult.error);
      }

      // Success! Move to final step
      setCurrentStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup verification failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Get recommended wallet for user type
  const getRecommendedWallet = () => {
    if (userType === 'creator') {
      return walletOptions.find(w => w.name === 'Alby') || walletOptions[0];
    }
    return walletOptions.find(w => w.name === 'Wallet of Satoshi') || walletOptions[0];
  };

  // Add handler functions above the renderStep or main return
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save username, displayName, bio to Sovren profile and publish as NOSTR profile event (future implementation)
    setCurrentStep(currentStep + 1);
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const skipProfileStep = () => {
    setCurrentStep(currentStep + 1);
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            {/* Main Hero Content */}
            <div className='relative flex flex-col items-center justify-center'>
              {/* Brand Icon */}
              <div className='flex justify-center mb-6'>
                <div className='relative group'>
                  <div className='p-1 transition-transform duration-500 transform shadow-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 rounded-2xl shadow-amber-500/40 group-hover:scale-105'>
                    <SovrenIcon className='block object-contain w-24 h-24 sm:w-32 sm:h-32 drop-shadow-lg' />
                  </div>
                  <div className='absolute inset-0 transition-all duration-500 bg-gradient-to-br from-amber-400/30 to-orange-600/30 rounded-2xl blur-lg group-hover:blur-xl -z-10'></div>
                </div>
              </div>

              {/* Typography Hierarchy */}
              <div className='space-y-3'>
                <h1 className='pb-1 text-3xl font-black tracking-tight text-transparent sm:text-4xl md:text-5xl bg-gradient-to-r from-amber-200 via-orange-300 to-amber-400 bg-clip-text leading-[1.1] font-display'>
                  Welcome to True Digital Sovereignty
                </h1>
                <p className='max-w-xl mx-auto text-base font-light leading-relaxed text-center sm:text-lg text-muted-foreground'>
                  Break free from Big Tech control. Own your identity, control your money, and
                  experience the internet as it was meant to be — Sovren.
                </p>
              </div>
            </div>

            {/* Feature Grid */}
            <div className='grid w-full max-w-5xl grid-cols-1 gap-6 mt-12 md:grid-cols-3'>
              {/* Card 1 */}
              <Card className='relative overflow-hidden transition-all duration-500 border shadow-lg group glass-dark border-border/50 hover:border-amber-500/50 rounded-xl'>
                <CardContent className='relative z-10 p-6 text-center'>
                  <div className='p-3 mx-auto mb-4 transition-transform duration-300 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg w-fit group-hover:scale-110'>
                    <Globe className='w-8 h-8 mx-auto text-amber-300' />
                  </div>
                  <h3 className='mb-2 text-lg font-bold text-white transition-colors group-hover:text-amber-200'>
                    Own Your Identity
                  </h3>
                  <p className='text-sm leading-relaxed text-muted-foreground'>
                    NOSTR gives you complete control.
                  </p>
                </CardContent>
              </Card>
              {/* Card 2 */}
              <Card className='relative overflow-hidden transition-all duration-500 border shadow-lg group glass-dark border-border/50 hover:border-violet-500/50 rounded-xl'>
                <CardContent className='relative z-10 p-6 text-center'>
                  <div className='p-3 mx-auto mb-4 transition-transform duration-300 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg w-fit group-hover:scale-110'>
                    <Zap className='w-8 h-8 mx-auto text-violet-300' />
                  </div>
                  <h3 className='mb-2 text-lg font-bold text-white transition-colors group-hover:text-violet-200'>
                    Control Your Money
                  </h3>
                  <p className='text-sm leading-relaxed text-muted-foreground'>
                    Instant, low-cost Bitcoin payments.
                  </p>
                </CardContent>
              </Card>
              {/* Card 3 */}
              <Card className='relative overflow-hidden transition-all duration-500 border shadow-lg group glass-dark border-border/50 hover:border-emerald-500/50 rounded-xl'>
                <CardContent className='relative z-10 p-6 text-center'>
                  <div className='p-3 mx-auto mb-4 transition-transform duration-300 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-lg w-fit group-hover:scale-110'>
                    <Shield className='w-8 h-8 mx-auto text-emerald-300' />
                  </div>
                  <h3 className='mb-2 text-lg font-bold text-white transition-colors group-hover:text-emerald-200'>
                    Censorship Resistant
                  </h3>
                  <p className='text-sm leading-relaxed text-muted-foreground'>
                    No deplatforming, just pure freedom.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <div className='mt-12'>
              <Button
                onClick={() => setCurrentStep(1)}
                className='relative px-8 py-4 text-lg font-bold transition-all duration-500 transform shadow-xl group bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 rounded-xl hover:scale-105'
              >
                <span className='relative z-10 flex items-center'>
                  Begin Your Sovren Journey
                  <ArrowRight className='w-5 h-5 ml-3 transition-transform duration-300 group-hover:translate-x-1' />
                </span>
                <div className='absolute inset-0 transition-all duration-500 bg-gradient-to-r from-amber-400/20 to-orange-500/20 rounded-xl blur-md group-hover:blur-lg -z-10'></div>
              </Button>
            </div>
          </div>
        );

      case 1: // Choose Path
        return (
          <div className='space-y-12'>
            {/* Elite Header */}
            <div className='mb-16 text-center'>
              <div className='flex justify-center mb-10'>
                <div className='relative group'>
                  <div className='p-8 transition-transform duration-500 shadow-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-violet-600 rounded-3xl shadow-violet-500/40 group-hover:scale-105'>
                    <Star className='w-16 h-16 text-white drop-shadow-lg' />
                  </div>
                  <div className='absolute inset-0 transition-all duration-500 bg-gradient-to-br from-violet-500/30 to-purple-600/30 rounded-3xl blur-2xl group-hover:blur-3xl'></div>
                </div>
              </div>

              <h2 className='mb-8 text-4xl font-black leading-tight text-transparent md:text-6xl bg-gradient-to-r from-violet-200 via-purple-300 to-violet-400 bg-clip-text font-display'>
                Choose Your
                <br />
                <span className='text-transparent bg-gradient-to-r from-purple-300 via-violet-400 to-purple-500 bg-clip-text'>
                  Sovren Path
                </span>
              </h2>

              <p className='max-w-3xl mx-auto text-xl font-light leading-relaxed md:text-2xl text-muted-foreground'>
                Are you here to{' '}
                <span className='font-semibold text-violet-300'>create and monetize content</span>,
                or to{' '}
                <span className='font-semibold text-purple-300'>
                  support your favorite creators
                </span>
                ?
              </p>
            </div>

            {/* Elite User Type Cards */}
            <div className='grid max-w-6xl grid-cols-1 gap-10 mx-auto lg:grid-cols-2'>
              <Card
                className={`
                  group relative cursor-pointer transition-all duration-500 overflow-hidden rounded-3xl border-2
                  ${
                    userType === 'creator'
                      ? 'border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-orange-500/10 shadow-2xl shadow-amber-500/25 scale-105'
                      : 'border-border/50 bg-secondary hover:border-amber-500/50 hover:bg-gradient-to-br hover:from-amber-500/10 hover:to-orange-500/5 hover:scale-102 hover:shadow-xl hover:shadow-amber-500/15'
                  }
                `}
                onClick={() => setUserType('creator')}
              >
                {userType === 'creator' && (
                  <div className='absolute top-4 right-4 p-2 bg-amber-500/30 rounded-full border border-amber-500/50 shadow-lg'>
                    <CheckCircle className='w-6 h-6 text-amber-200' />
                  </div>
                )}
                {/* Background Glow */}
                <div className='absolute inset-0 transition-opacity duration-500 opacity-0 bg-gradient-to-br from-amber-500/10 to-orange-500/5 group-hover:opacity-100'></div>

                <CardContent className='relative z-10 p-12 text-center'>
                  <div className='flex items-center justify-center w-24 h-24 mx-auto mb-10 transition-all duration-500 shadow-2xl bg-gradient-to-br from-amber-400 to-orange-500 rounded-4xl shadow-amber-500/30 group-hover:scale-110 group-hover:rotate-3'>
                    <Rocket className='text-white h-14 w-14' />
                  </div>

                  <h3 className='mb-6 text-3xl font-bold text-white transition-colors md:text-4xl group-hover:text-amber-200'>
                    I&apos;m a Creator
                  </h3>

                  <p className='mb-8 text-lg leading-relaxed transition-colors text-muted-foreground group-hover:text-muted-foreground'>
                    <span className='font-semibold text-amber-300'>Monetize your content</span> with
                    Bitcoin, build your Sovren audience, and never worry about
                    <span className='font-semibold text-orange-300'> deplatforming</span> again.
                  </p>

                  <div className='flex flex-wrap justify-center gap-3'>
                    <Badge className='px-4 py-2 text-sm font-medium bg-amber-500/25 text-amber-200 border-amber-500/40 hover:bg-amber-500/35'>
                      Lightning Payments
                    </Badge>
                    <Badge className='px-4 py-2 text-sm font-medium text-orange-200 bg-orange-500/25 border-orange-500/40 hover:bg-orange-500/35'>
                      NOSTR Publishing
                    </Badge>
                    <Badge className='px-4 py-2 text-sm font-medium bg-amber-500/25 text-amber-200 border-amber-500/40 hover:bg-amber-500/35'>
                      Creator Tools
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`
                  group relative cursor-pointer transition-all duration-500 overflow-hidden rounded-3xl border-2
                  ${
                    userType === 'supporter'
                      ? 'border-violet-500/60 bg-gradient-to-br from-violet-500/15 to-purple-500/10 shadow-2xl shadow-violet-500/25 scale-105'
                      : 'border-border/50 bg-secondary hover:border-violet-500/50 hover:bg-gradient-to-br hover:from-violet-500/10 hover:to-purple-500/5 hover:scale-102 hover:shadow-xl hover:shadow-violet-500/15'
                  }
                `}
                onClick={() => setUserType('supporter')}
              >
                {userType === 'supporter' && (
                  <div className='absolute top-4 right-4 p-2 bg-violet-500/30 rounded-full border border-violet-500/50 shadow-lg'>
                    <CheckCircle className='w-6 h-6 text-violet-200' />
                  </div>
                )}
                {/* Background Glow */}
                <div className='absolute inset-0 transition-opacity duration-500 opacity-0 bg-gradient-to-br from-violet-500/10 to-purple-500/5 group-hover:opacity-100'></div>

                <CardContent className='relative z-10 p-12 text-center'>
                  <div className='flex items-center justify-center w-24 h-24 mx-auto mb-10 transition-all duration-500 shadow-2xl bg-gradient-to-br from-violet-400 to-purple-500 rounded-4xl shadow-violet-500/30 group-hover:scale-110 group-hover:-rotate-3'>
                    <Heart className='text-white h-14 w-14' />
                  </div>

                  <h3 className='mb-6 text-3xl font-bold text-white transition-colors md:text-4xl group-hover:text-violet-200'>
                    I&apos;m a Supporter
                  </h3>

                  <p className='mb-8 text-lg leading-relaxed transition-colors text-muted-foreground group-hover:text-muted-foreground'>
                    <span className='font-semibold text-violet-300'>
                      Support your favorite creators
                    </span>{' '}
                    directly with Bitcoin, discover amazing content, and be part of the
                    <span className='font-semibold text-purple-300'>Sovren economy</span>.
                  </p>

                  <div className='flex flex-wrap justify-center gap-3'>
                    <Badge className='px-4 py-2 text-sm font-medium bg-violet-500/25 text-violet-200 border-violet-500/40 hover:bg-violet-500/35'>
                      Instant Tips
                    </Badge>
                    <Badge className='px-4 py-2 text-sm font-medium text-purple-200 bg-purple-500/25 border-purple-500/40 hover:bg-purple-500/35'>
                      Content Discovery
                    </Badge>
                    <Badge className='px-4 py-2 text-sm font-medium bg-violet-500/25 text-violet-200 border-violet-500/40 hover:bg-violet-500/35'>
                      Creator Support
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Elite Continue Button */}
            {userType && (
              <div className='mt-16 text-center'>
                <Button
                  onClick={() => setCurrentStep(2)}
                  className={`
                    group relative px-12 py-6 text-xl font-bold rounded-2xl transition-all duration-500 transform hover:scale-105
                    ${
                      userType === 'creator'
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 shadow-2xl shadow-amber-500/30 hover:shadow-3xl hover:shadow-amber-500/40'
                        : 'bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600 hover:from-violet-400 hover:via-purple-400 hover:to-violet-500 shadow-2xl shadow-violet-500/30 hover:shadow-3xl hover:shadow-violet-500/40'
                    }
                  `}
                >
                  <span className='relative z-10 flex items-center text-white'>
                    Continue as {userType === 'creator' ? 'Creator' : 'Supporter'}
                    <ArrowRight className='w-6 h-6 ml-3 transition-transform duration-300 group-hover:translate-x-2' />
                  </span>
                  <div
                    className={`
                      absolute inset-0 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500
                      ${
                        userType === 'creator'
                          ? 'bg-gradient-to-r from-amber-400/20 to-orange-500/20'
                          : 'bg-gradient-to-r from-violet-400/20 to-purple-500/20'
                      }
                    `}
                  ></div>
                </Button>
              </div>
            )}
          </div>
        );

      case 2: // NOSTR Identity
        return (
          <div className='space-y-8'>
            <div className='mb-8 text-center'>
              <div className='flex justify-center mb-6'>
                <div className='p-6 bg-primary/20 rounded-2xl'>
                  <Key className='w-10 h-10 text-primary' />
                </div>
              </div>
              <h2 className='mb-4 text-3xl font-bold text-white font-display'>
                Create Your Sovereign Identity
              </h2>
              <p className='max-w-2xl mx-auto text-lg text-muted-foreground'>
                Your NOSTR keys are your digital identity. Generated locally, owned by you, forever.
              </p>
            </div>

            <Alert className='max-w-3xl mx-auto border-primary/20 bg-primary/10'>
              <HelpCircle className='w-5 h-5' />
              <AlertDescription className='text-foreground'>
                <strong>What makes this special?</strong>
                <br />
                Unlike social media accounts that can be banned or deleted, your NOSTR identity is
                cryptographically yours. No company can take it away from you.
              </AlertDescription>
            </Alert>

            <div className='max-w-2xl mx-auto'>
              <Card className='glass-dark bg-card/50 border-border/50'>
                <CardContent className='p-8 text-center'>
                  <div className='space-y-6'>
                    <div className='p-4 bg-amber-500/20 rounded-xl'>
                      <Sparkles className='w-8 h-8 mx-auto mb-3 text-amber-400' />
                      <h3 className='mb-2 text-xl font-semibold text-white'>
                        Zero-Friction Key Generation
                      </h3>
                      <p className='text-muted-foreground'>
                        One click to generate your sovereign identity. No forms, no verification, no
                        waiting.
                      </p>
                    </div>

                    <Button
                      onClick={generateNostrKeys}
                      disabled={isGenerating || !!nostrKeys}
                      className='w-full py-4 text-lg bg-primary hover:bg-primary/90'
                    >
                      {isGenerating ? (
                        <>
                          <div className='w-6 h-6 mr-3 border-b-2 border-white rounded-full animate-spin' />
                          Generating Your Sovereign Identity...
                        </>
                      ) : nostrKeys ? (
                        <>
                          <CheckCircle className='w-6 h-6 mr-3' />
                          Identity Created Successfully!
                        </>
                      ) : (
                        <>
                          <Sparkles className='w-6 h-6 mr-3' />
                          Generate My Sovereign Identity
                        </>
                      )}
                    </Button>

                    {nostrKeys && (
                      <div className='text-center'>
                        <p className='font-medium text-green-400'>
                          Your sovereign identity is ready! Let's secure it...
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {error && (
              <Alert className='max-w-2xl mx-auto border-red-500/20 bg-red-500/10'>
                <AlertDescription className='text-red-400'>{error}</AlertDescription>
              </Alert>
            )}

            {/* Navigation */}
            <div className='flex justify-between max-w-2xl pt-6 mx-auto'>
              <Button
                onClick={() => setCurrentStep(currentStep - 1)}
                className='flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 text-white font-bold shadow-lg hover:from-amber-500 hover:to-orange-500 transition-all duration-300 text-base gap-2'
                style={{ minWidth: 120 }}
              >
                <ArrowLeft className='w-5 h-5' />
                Back
              </Button>
              {nostrKeys && (
                <Button
                  onClick={() => setCurrentStep(3)}
                  className='flex items-center bg-primary hover:bg-primary/90'
                >
                  Secure My Keys
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Button>
              )}
            </div>
          </div>
        );

      case 3: // Secure Keys
        return (
          <div className='space-y-8'>
            <div className='mb-8 text-center'>
              <div className='flex justify-center mb-6'>
                <div className='p-6 bg-primary/20 rounded-2xl'>
                  <Shield className='w-10 h-10 text-primary' />
                </div>
              </div>
              <h2 className='mb-4 text-3xl font-bold text-white font-display'>
                Secure Your Sovereign Identity
              </h2>
              <p className='max-w-2xl mx-auto text-lg text-muted-foreground'>
                Your keys, your identity. Let's make sure they're safely backed up.
              </p>
            </div>

            {nostrKeys && (
              <div className='max-w-3xl mx-auto space-y-6'>
                <Card className='glass-dark bg-card/50 border-border/50'>
                  <CardContent className='p-8'>
                    <h3 className='mb-6 text-xl font-semibold text-white'>
                      Your Sovereign Identity Keys
                    </h3>

                    <div className='space-y-6'>
                      {/* Public Key */}
                      <div>
                        <Label className='text-lg font-medium text-white'>
                          Public Key (npub) - Your Username
                        </Label>
                        <p className='mb-3 text-sm text-muted-foreground'>
                          Share this freely - it's how others find and verify you
                        </p>
                        <div className='flex'>
                          <Input
                            value={nostrKeys.npub}
                            readOnly
                            className='font-mono text-sm bg-green-500/10 border-green-500/20'
                          />
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => copyToClipboard(nostrKeys.npub, 'npub')}
                            className='ml-2'
                          >
                            {copiedField === 'npub' ? (
                              <CheckCircle className='w-4 h-4 text-green-500' />
                            ) : (
                              <Copy className='w-4 h-4' />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Private Key */}
                      <div>
                        <Label className='text-lg font-medium text-white'>
                          Private Key (nsec) - Your Master Password
                        </Label>
                        <p className='mb-3 text-sm text-red-300'>
                          NEVER share this! It's your digital identity's master key
                        </p>
                        <div className='flex'>
                          <Input
                            type={showPrivateKey ? 'text' : 'password'}
                            value={nostrKeys.nsec}
                            readOnly
                            className='font-mono text-sm bg-red-500/10 border-red-500/20'
                          />
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setShowPrivateKey(!showPrivateKey)}
                            className='ml-2'
                          >
                            {showPrivateKey ? (
                              <EyeOff className='w-4 h-4' />
                            ) : (
                              <Eye className='w-4 h-4' />
                            )}
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => copyToClipboard(nostrKeys.nsec, 'nsec')}
                            className='ml-2'
                          >
                            {copiedField === 'nsec' ? (
                              <CheckCircle className='w-4 h-4 text-green-500' />
                            ) : (
                              <Copy className='w-4 h-4' />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Download Button */}
                      <div className='pt-4 text-center'>
                        <Button onClick={downloadKeys} className='bg-primary hover:bg-primary/90'>
                          <Download className='w-4 h-4 mr-2' />
                          Download Secure Backup
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Security Confirmations */}
                <Card className='bg-yellow-500/10 border-yellow-500/20'>
                  <CardContent className='p-6'>
                    <h4 className='mb-4 text-lg font-semibold text-yellow-100'>
                      Security Checklist
                    </h4>
                    <div className='space-y-4'>
                      <div className='flex items-start space-x-3'>
                        <input
                          type='checkbox'
                          id='backup'
                          checked={backupConfirmed}
                          onChange={e => setBackupConfirmed(e.target.checked)}
                          className='mt-1 border-border rounded'
                        />
                        <Label htmlFor='backup' className='text-yellow-100 cursor-pointer'>
                          I have safely downloaded and stored my private key (nsec) backup
                        </Label>
                      </div>

                      <div className='flex items-start space-x-3'>
                        <input
                          type='checkbox'
                          id='security'
                          checked={understandsSecurity}
                          onChange={e => setUnderstandsSecurity(e.target.checked)}
                          className='mt-1 border-border rounded'
                        />
                        <Label htmlFor='security' className='text-yellow-100 cursor-pointer'>
                          I understand that losing my private key means losing my sovereign identity
                          forever
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {backupConfirmed && understandsSecurity && (
                  <div className='text-center'>
                    <Button
                      onClick={() => setCurrentStep(4)}
                      className='px-10 py-4 text-lg bg-primary hover:bg-primary/90'
                    >
                      Identity Secured - Setup Lightning
                      <ArrowRight className='w-5 h-5 ml-2' />
                    </Button>
                  </div>
                )}

                {/* Navigation */}
                <div className='flex justify-between max-w-2xl pt-6 mx-auto'>
                  <Button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className='flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 text-white font-bold shadow-lg hover:from-amber-500 hover:to-orange-500 transition-all duration-300 text-base gap-2'
                    style={{ minWidth: 120 }}
                  >
                    <ArrowLeft className='w-5 h-5' />
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 4: // Lightning Wallet
        return (
          <div className='space-y-8'>
            <div className='mb-8 text-center'>
              <div className='flex justify-center mb-6'>
                <div className='p-6 bg-amber-500/20 rounded-2xl'>
                  <Zap className='w-10 h-10 text-amber-400' />
                </div>
              </div>
              <h2 className='mb-4 text-3xl font-bold text-white font-display'>
                Setup Lightning Payments
              </h2>
              <p className='max-w-2xl mx-auto text-lg text-muted-foreground'>
                Enable instant Bitcoin payments to{' '}
                {userType === 'creator' ? 'monetize your content' : 'support creators'}.
              </p>
            </div>

            {/* Recommended wallet for user type */}
            <div className='max-w-3xl mx-auto'>
              <Alert className='mb-8 border-amber-500/20 bg-amber-500/10'>
                <Star className='w-5 h-5' />
                <AlertDescription className='text-foreground'>
                  <strong>
                    Recommended for {userType === 'creator' ? 'Creators' : 'Supporters'}:
                  </strong>
                  <br />
                  We've pre-selected the best wallet for your use case, but you can choose any
                  option below.
                </AlertDescription>
              </Alert>

              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                {walletOptions.map((wallet, index) => {
                  const isRecommended = wallet.name === getRecommendedWallet()?.name;
                  return (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all duration-200 ${
                        selectedWallet?.name === wallet.name
                          ? 'border-primary bg-primary/10 scale-105'
                          : isRecommended
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border/50 hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedWallet(wallet)}
                    >
                      <CardContent className='p-6'>
                        <div className='flex items-start space-x-4'>
                          <div
                            className={`p-3 rounded-lg ${
                              wallet.type === 'custodial'
                                ? 'bg-green-500/20'
                                : wallet.type === 'self-custodial'
                                  ? 'bg-purple-500/20'
                                  : 'bg-purple-500/20'
                            }`}
                          >
                            <wallet.icon className='w-6 h-6 text-white' />
                          </div>

                          <div className='flex-1'>
                            <div className='flex items-center justify-between mb-2'>
                              <h3 className='font-semibold text-white'>{wallet.name}</h3>
                              <div className='flex space-x-1'>
                                {isRecommended && (
                                  <Badge className='text-xs text-white bg-primary'>
                                    Recommended
                                  </Badge>
                                )}
                                <Badge variant='secondary' className='text-xs'>
                                  {wallet.difficulty}
                                </Badge>
                              </div>
                            </div>

                            <p className='mb-3 text-sm text-muted-foreground'>
                              {wallet.description}
                            </p>

                            <div className='flex items-center mb-3 text-xs text-muted-foreground'>
                              <Clock className='w-3 h-3 mr-1' />
                              Setup: {wallet.setupTime}
                            </div>

                            <div className='flex flex-wrap gap-1'>
                              {wallet.features.slice(0, 3).map((feature, i) => (
                                <Badge key={i} variant='outline' className='text-xs'>
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {selectedWallet && (
                <div className='mt-8 text-center'>
                  <div className='mb-4'>
                    <Button
                      onClick={() => window.open(selectedWallet.downloadUrl, '_blank')}
                      className='mr-4 bg-amber-500 hover:bg-amber-600'
                    >
                      <Download className='w-4 h-4 mr-2' />
                      Download {selectedWallet.name}
                    </Button>
                    <Button
                      onClick={() => {
                        setWalletSetupComplete(true);
                        setCurrentStep(5);
                      }}
                      variant='outline'
                    >
                      I've Set Up My Wallet
                      <ArrowRight className='w-4 h-4 ml-2' />
                    </Button>
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    Download the wallet, set it up, then continue to verify everything works!
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 5: // Verify Setup
        return (
          <div className='space-y-8'>
            <div className='mb-8 text-center'>
              <div className='flex justify-center mb-6'>
                <div className='p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl'>
                  <CheckCircle className='w-10 h-10 text-white' />
                </div>
              </div>
              <h2 className='mb-4 text-3xl font-bold text-white font-display'>
                Verify Your Sovereign Setup
              </h2>
              <p className='max-w-2xl mx-auto text-lg text-muted-foreground'>
                Let's verify your NOSTR identity and celebrate your sovereignty!
              </p>
            </div>

            <div className='max-w-2xl mx-auto'>
              <Card className='glass-dark bg-card/50 border-border/50'>
                <CardContent className='p-8'>
                  <div className='space-y-6'>
                    <div className='text-center'>
                      <h3 className='mb-4 text-xl font-semibold text-white'>Setup Summary</h3>

                      <div className='space-y-4'>
                        <div className='flex items-center justify-between p-4 border rounded-lg bg-green-500/10 border-green-500/20'>
                          <div className='flex items-center'>
                            <CheckCircle className='w-5 h-5 mr-3 text-green-500' />
                            <span className='text-white'>NOSTR Identity</span>
                          </div>
                          <Badge className='text-white bg-green-500'>Ready</Badge>
                        </div>

                        <div className='flex items-center justify-between p-4 border rounded-lg bg-green-500/10 border-green-500/20'>
                          <div className='flex items-center'>
                            <CheckCircle className='w-5 h-5 mr-3 text-green-500' />
                            <span className='text-white'>Keys Secured</span>
                          </div>
                          <Badge className='text-white bg-green-500'>Backed Up</Badge>
                        </div>

                        <div className='flex items-center justify-between p-4 border rounded-lg bg-green-500/10 border-green-500/20'>
                          <div className='flex items-center'>
                            <CheckCircle className='w-5 h-5 mr-3 text-green-500' />
                            <div>
                              <span className='font-medium text-white'>Lightning Wallet</span>
                              <p className='text-sm text-green-300'>
                                {selectedWallet?.name} - Ready for payments
                              </p>
                            </div>
                          </div>
                          <Badge className='text-white bg-green-500'>{selectedWallet?.type}</Badge>
                        </div>
                      </div>
                    </div>

                    <Alert className='border-amber-500/20 bg-amber-500/10'>
                      <Sparkles className='w-4 h-4' />
                      <AlertDescription className='text-foreground'>
                        <strong>Final Step:</strong>
                        <br />
                        We'll create your first NOSTR event to verify your identity and announce
                        your sovereignty to the world!
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={completeSovereignSetup}
                      disabled={isAuthenticating}
                      className='w-full py-4 text-lg bg-primary hover:bg-primary/90'
                    >
                      {isAuthenticating ? (
                        <>
                          <div className='w-5 h-5 mr-2 border-b-2 border-white rounded-full animate-spin' />
                          Verifying Sovereignty...
                        </>
                      ) : (
                        <>
                          <CheckCircle className='w-5 h-5 mr-2' />
                          Verify & Announce My Sovereignty
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {error && (
              <Alert className='max-w-2xl mx-auto shadow-lg border-red-500/50 bg-red-500/20'>
                <AlertDescription className='text-base font-medium text-red-100'>
                  <strong className='text-red-200'>Verification Error:</strong> {error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 6: // Welcome Sovereign
        return (
          <div className='space-y-8 text-center'>
            <div className='flex justify-center mb-8'>
              <div className='p-8 bg-primary/20 rounded-3xl shadow-hero animate-pulse'>
                <Rocket className='w-16 h-16 text-primary' />
              </div>
            </div>

            <div className='space-y-6'>
              <h1 className='text-4xl font-black text-transparent md:text-5xl bg-gradient-to-r from-amber-200 via-primary to-purple-200 bg-clip-text font-display'>
                Welcome to Sovereignty!
              </h1>
              <p className='max-w-3xl mx-auto text-xl leading-relaxed text-muted-foreground'>
                Congratulations! You now have a sovereign digital identity and Lightning payments.
                You're part of the revolution toward true digital freedom.
              </p>
            </div>

            <div className='grid max-w-4xl grid-cols-1 gap-6 mx-auto mt-12 md:grid-cols-3'>
              <Card className='glass-dark border-border/50'>
                <CardContent className='p-8 text-center'>
                  <Key className='w-12 h-12 mx-auto mb-4 text-primary' />
                  <h3 className='mb-3 text-xl font-bold text-white'>Your Identity</h3>
                  <p className='text-muted-foreground'>
                    Sovereign NOSTR identity that no one can take away
                  </p>
                </CardContent>
              </Card>

              <Card className='glass-dark border-border/50'>
                <CardContent className='p-8 text-center'>
                  <Zap className='w-12 h-12 mx-auto mb-4 text-amber-400' />
                  <h3 className='mb-3 text-xl font-bold text-white'>Instant Payments</h3>
                  <p className='text-muted-foreground'>Lightning-fast Bitcoin transactions</p>
                </CardContent>
              </Card>

              <Card className='glass-dark border-border/50'>
                <CardContent className='p-8 text-center'>
                  <Crown className='w-12 h-12 mx-auto mb-4 text-primary' />
                  <h3 className='mb-3 text-xl font-bold text-white'>True Freedom</h3>
                  <p className='text-muted-foreground'>Censorship-resistant digital sovereignty</p>
                </CardContent>
              </Card>
            </div>

            <div className='mt-12 space-y-6'>
              <Button
                onClick={() => navigate('/profile-dashboard')}
                className='px-12 py-6 mr-4 text-xl font-bold bg-primary hover:bg-primary/90 shadow-hero'
              >
                View My Sovereign Profile
                <Crown className='w-6 h-6 ml-3' />
              </Button>

              <div className='text-center'>
                <p className='mb-4 text-muted-foreground'>Share your sovereignty journey:</p>
                <div className='flex justify-center space-x-4'>
                  <Button variant='outline' size='sm'>
                    Share on NOSTR
                  </Button>
                  <Button variant='outline' size='sm'>
                    Tell Friends
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className='relative min-h-screen overflow-hidden bg-background'>
      {/* Elite Background Effects */}
      <div className='absolute inset-0 bg-grid-pattern opacity-5'></div>
      <div className='absolute w-64 h-64 rounded-full top-1/4 left-1/4 md:w-96 md:h-96 bg-gradient-to-r from-violet-600/20 to-purple-600/20 blur-3xl'></div>
      <div className='absolute w-64 h-64 rounded-full bottom-1/4 right-1/4 md:w-96 md:h-96 bg-gradient-to-r from-amber-500/20 to-orange-600/20 blur-3xl'></div>

      <div className='relative z-10'>
        <div className='container px-4 py-4 mx-auto sm:px-6 lg:px-8 xl:px-12 2xl:px-16 sm:py-6 lg:py-8 xl:py-12 2xl:py-16'>
          {/* Elite Responsive Progress Indicator */}
          <div className='max-w-sm mx-auto mb-6 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl sm:mb-8 lg:mb-12 xl:mb-16 2xl:mb-20'>
            <div className='relative'>
              {/* Progress Track */}
              <div className='absolute top-6 sm:top-8 lg:top-10 xl:top-12 2xl:top-14 left-0 right-0 h-0.5 sm:h-1 lg:h-1.5 bg-gradient-to-r from-muted via-border to-muted'></div>

              {/* Combined Steps Container */}
              <div className='relative z-10 flex items-start justify-evenly pb-0 overflow-x-auto'>
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className='flex flex-col items-center text-center flex-shrink-0 px-1 group sm:px-2 lg:px-3 min-w-0 max-w-20 sm:max-w-24 lg:max-w-28 xl:max-w-32 2xl:max-w-36'
                  >
                    {/* Icon */}
                    <div
                      className={`
                        relative flex items-center justify-center
                        w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 xl:w-20 xl:h-20 2xl:w-24 2xl:h-24
                        rounded-xl sm:rounded-2xl lg:rounded-3xl border-2 lg:border-3
                        transition-all duration-500 ease-out mb-3
                        ${
                          index <= currentStep
                            ? index === currentStep
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-400/50 text-white shadow-lg lg:shadow-xl xl:shadow-2xl shadow-amber-500/25'
                              : 'bg-gradient-to-br from-emerald-400 to-green-500 border-emerald-400/50 text-white shadow-md lg:shadow-lg shadow-emerald-500/25'
                            : 'bg-secondary border-muted text-muted-foreground backdrop-blur-sm'
                        }
                      `}
                    >
                      {index < currentStep ? (
                        <CheckCircle className='w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12' />
                      ) : index === 0 ? (
                        <div className='flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 xl:w-18 xl:h-18 2xl:w-20 2xl:h-20'>
                          <img
                            src={SovrenIconPNG}
                            alt='Sovren Logo'
                            className='w-[300%] h-[300%] object-contain'
                          />
                        </div>
                      ) : (
                        <step.icon className='w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12' />
                      )}
                      {index === currentStep && (
                        <div className='absolute inset-0 rounded-xl sm:rounded-2xl lg:rounded-3xl bg-gradient-to-br from-amber-400/30 to-orange-500/30 blur-md lg:blur-lg -z-10'></div>
                      )}
                    </div>

                    {/* Title */}
                    <div
                      className={`
                        text-xs sm:text-sm font-bold transition-colors duration-300 leading-snug
                        ${index <= currentStep ? 'text-white' : 'text-muted-foreground'}
                      `}
                    >
                      <span className='block sm:hidden'>{step.title.split(' ')[0]}</span>
                      <span className='hidden sm:block'>{step.title}</span>
                    </div>

                    {/* Description */}
                    <div
                      className={`
                        text-xs mt-1 font-light leading-normal transition-colors duration-300 hidden md:block
                        ${index === currentStep ? 'text-amber-300' : index < currentStep ? 'text-emerald-300' : 'text-muted-foreground'}
                      `}
                    >
                      {step.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Elite Responsive Main Content Container */}
          <Card className='max-w-sm mx-auto overflow-hidden border shadow-xl sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl glass-dark bg-card/50 backdrop-blur-xl border-border/50 lg:shadow-2xl xl:shadow-3xl shadow-black/20 rounded-xl lg:rounded-2xl xl:rounded-3xl'>
            <div className='absolute inset-0 pointer-events-none bg-gradient-to-br from-secondary/30 via-transparent to-secondary/30'></div>
            <CardContent className='relative z-10 p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16 2xl:p-20'>
              {renderStep()}
            </CardContent>
          </Card>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .bg-grid-pattern {
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 50px 50px;
          }
        `,
        }}
      />
    </div>
  );
};

export default SovereignOnboarding;
