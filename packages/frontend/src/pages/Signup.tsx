import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { Alert } from '../components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';
import { useAuth } from '../features/auth';

interface NostrKeys {
  publicKey: string;
  privateKey: string;
}

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { generateNostrChallenge, authenticateNostr, signup } = useAuth();

  // Authentication mode
  const [authMode, setAuthMode] = useState<'nostr' | 'email'>('nostr');

  // NOSTR registration
  const [nostrKeys, setNostrKeys] = useState<NostrKeys>({ publicKey: '', privateKey: '' });
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [userRole, setUserRole] = useState<'creator' | 'supporter'>('supporter');

  // Traditional email registration
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // NOSTR key validation
  const [publicKeyError, setPublicKeyError] = useState<string | null>(null);
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Validate NOSTR key format
  const validatePublicKey = (key: string): boolean => {
    if (!key) return true; // Empty is OK (not yet entered)
    const isNpub = key.startsWith('npub1');
    const isHex = /^[0-9a-fA-F]{64}$/.test(key);
    if (!isNpub && !isHex) {
      setPublicKeyError('Please enter a valid NOSTR public key (starts with npub1 or 64-char hex)');
      return false;
    }
    setPublicKeyError(null);
    return true;
  };

  const validatePrivateKey = (key: string): boolean => {
    if (!key) return true;
    const isNsec = key.startsWith('nsec1');
    const isHex = /^[0-9a-fA-F]{64}$/.test(key);
    if (!isNsec && !isHex) {
      setPrivateKeyError('Please enter a valid NOSTR private key (starts with nsec1 or 64-char hex)');
      return false;
    }
    setPrivateKeyError(null);
    return true;
  };

  const isNostrKeysValid = (): boolean => {
    if (!nostrKeys.publicKey || !nostrKeys.privateKey) return false;
    if (publicKeyError || privateKeyError) return false;
    return true;
  };

  // Generate new NOSTR key pair
  const generateNostrKeys = async (): Promise<void> => {
    setIsGeneratingKeys(true);
    try {
      // Generate key pair using NOSTR standards
      const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');

      const privateKey = generateSecretKey();
      const publicKey = getPublicKey(privateKey);

      setNostrKeys({ privateKey: Buffer.from(privateKey).toString('hex'), publicKey });
      setError(null);
    } catch (err) {
      setError('Failed to generate NOSTR keys. Please try again.');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // NOSTR Registration Flow
  const handleNostrSignup = async (): Promise<void> => {
    if (!nostrKeys.publicKey || !nostrKeys.privateKey) {
      setError('Please generate or provide NOSTR keys');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Get authentication challenge
      const challengeResult = await generateNostrChallenge();

      if (challengeResult.error || !challengeResult.challenge) {
        throw new Error(challengeResult.error || 'Failed to get authentication challenge');
      }

      // Step 2: Sign challenge with private key
      const { finalizeEvent } = await import('nostr-tools/pure');
      const timestamp = Math.floor(Date.now() / 1000);

      const event = {
        kind: 1,
        pubkey: nostrKeys.publicKey,
        created_at: timestamp,
        tags: [],
        content: challengeResult.challenge,
      };

      const privateKeyBytes = new Uint8Array(Buffer.from(nostrKeys.privateKey, 'hex'));
      const signedEvent = finalizeEvent(event, privateKeyBytes);

      // Step 3: Authenticate with signed challenge
      const authResult = await authenticateNostr({
        signature: signedEvent.sig,
        pubkey: nostrKeys.publicKey,
        challenge: challengeResult.challenge,
        timestamp: Date.now(),
      });

      if (authResult.error || !authResult.user) {
        throw new Error(authResult.error || 'NOSTR registration failed');
      }

      // Success - redirect to profile
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NOSTR registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Traditional Email Registration
  const handleEmailSignup = async (): Promise<void> => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: userRole,
        terms_accepted: true,
      });

      if (result.error || !result.user) {
        throw new Error(result.error || 'Registration failed');
      }

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-purple-500">Sovren</span>
              <span className="ml-2 text-sm text-muted-foreground">
                Decentralized Creator Platform
              </span>
            </Link>
            <div className="flex space-x-4">
              <Link
                to="/login"
                className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-150"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-extrabold text-foreground font-display">
              Join Sovren
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Sovereign creator platform with true ownership
            </CardDescription>
          </CardHeader>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="glass shadow-lg border-border/50">
            <CardContent className="py-8 px-6">
              {/* Authentication Mode Selector */}
              <div className="mb-6">
                <div className="flex space-x-1 bg-card/50 p-1 rounded-lg border border-border/50">
                  <button
                    onClick={() => setAuthMode('nostr')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                      authMode === 'nostr'
                        ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    NOSTR Keys
                  </button>
                  <button
                    onClick={() => setAuthMode('email')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                      authMode === 'email'
                        ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Email
                  </button>
                </div>
              </div>

              {error && (
                <Alert className="mb-6 border-red-500/20 bg-red-500/10">
                  <div className="text-sm font-medium text-red-400">{error}</div>
                </Alert>
              )}

              {/* NOSTR Registration */}
              {authMode === 'nostr' && (
                <div className="space-y-6">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-4">
                    <h3 className="text-sm font-medium text-purple-300 mb-2">Sovereign Identity</h3>
                    <p className="text-sm text-purple-200/80">
                      Create a decentralized identity that you fully control. Your NOSTR keys work
                      across all compatible platforms.
                    </p>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-3 block">
                      I want to join as a:
                    </Label>
                    <div className="flex space-x-1 bg-card/50 p-1 rounded-lg border border-border/50">
                      <button
                        onClick={() => setUserRole('supporter')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                          userRole === 'supporter'
                            ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Supporter
                      </button>
                      <button
                        onClick={() => setUserRole('creator')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                          userRole === 'creator'
                            ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Creator
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="publicKey"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Public Key (npub...)
                    </Label>
                    <textarea
                      id="publicKey"
                      rows={3}
                      value={nostrKeys.publicKey}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        const val = e.target.value.trim();
                        setNostrKeys({ ...nostrKeys, publicKey: val });
                        validatePublicKey(val);
                      }}
                      className={`block w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm font-mono transition-colors duration-150 ${
                        publicKeyError ? 'border-red-500/50' : 'border-border'
                      }`}
                      placeholder="npub1... or hex format"
                    />
                    {publicKeyError && (
                      <p className="mt-1 text-xs text-red-400">{publicKeyError}</p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="privateKey"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Private Key (nsec...)
                    </Label>
                    <textarea
                      id="privateKey"
                      rows={3}
                      value={nostrKeys.privateKey}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        const val = e.target.value.trim();
                        setNostrKeys({ ...nostrKeys, privateKey: val });
                        validatePrivateKey(val);
                      }}
                      className={`block w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm font-mono transition-colors duration-150 ${
                        privateKeyError ? 'border-red-500/50' : 'border-border'
                      }`}
                      placeholder="nsec1... or hex format (kept locally, never sent to server)"
                    />
                    {privateKeyError ? (
                      <p className="mt-1 text-xs text-red-400">{privateKeyError}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Private key stays in your browser and is never sent to our servers
                      </p>
                    )}
                  </div>

                  <div>
                    <Button
                      onClick={generateNostrKeys}
                      disabled={isGeneratingKeys}
                      variant="outline"
                      className="w-full mb-4 border-purple-500/30 hover:border-purple-500/50 transition-colors duration-150"
                    >
                      {isGeneratingKeys ? (
                        <span className="flex items-center justify-center">
                          <Spinner size="sm" className="mr-2" />
                          Generating...
                        </span>
                      ) : (
                        'Generate New Keys'
                      )}
                    </Button>
                    {isGeneratingKeys && (
                      <p className="text-sm text-purple-400 text-center">Generating keys...</p>
                    )}
                  </div>

                  <Button
                    onClick={handleNostrSignup}
                    disabled={isLoading || !isNostrKeysValid()}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <Spinner size="sm" className="mr-2" />
                        Creating Account...
                      </span>
                    ) : (
                      'Create Account with NOSTR'
                    )}
                  </Button>
                </div>
              )}

              {/* Email Registration */}
              {authMode === 'email' && (
                <div className="space-y-6">
                  {/* Role Selection */}
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-3 block">
                      I want to join as a:
                    </Label>
                    <div className="flex space-x-1 bg-card/50 p-1 rounded-lg border border-border/50">
                      <button
                        onClick={() => setUserRole('supporter')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                          userRole === 'supporter'
                            ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Supporter
                      </button>
                      <button
                        onClick={() => setUserRole('creator')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                          userRole === 'creator'
                            ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Creator
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                    />
                  </div>

                  <Button
                    onClick={handleEmailSignup}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <Spinner size="sm" className="mr-2" />
                        Creating Account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </div>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-purple-400 hover:text-purple-300 transition-colors duration-150"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Signup;
