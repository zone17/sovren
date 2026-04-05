import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';
import { useAuth } from '../features/auth';
import { createSignatureMessage } from '@shared/types/nostr/auth';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { generateNostrChallenge, authenticateNostr, login } = useAuth();

  // Authentication mode
  const [authMode, setAuthMode] = useState<'nostr' | 'email'>('nostr');

  // Key entry — hex or nsec
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  // Email login
  const [emailCredentials, setEmailCredentials] = useState({ email: '', password: '' });

  // NOSTR key validation
  const [publicKeyError, setPublicKeyError] = useState<string | null>(null);
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);

  const validatePublicKey = (key: string): boolean => {
    if (!key) return true;
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
      setPrivateKeyError(
        'Please enter a valid NOSTR private key (starts with nsec1 or 64-char hex)'
      );
      return false;
    }
    setPrivateKeyError(null);
    return true;
  };

  const isManualKeysValid = (): boolean => {
    if (!publicKeyInput || !privateKeyInput) return false;
    if (publicKeyError || privateKeyError) return false;
    return true;
  };

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExtension, setHasExtension] = useState<boolean | null>(null);

  // Generate a new NOSTR key pair
  const generateNostrKeys = async (): Promise<void> => {
    setIsGeneratingKeys(true);
    try {
      const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');
      const privateKey = generateSecretKey();
      const publicKey = getPublicKey(privateKey);
      setPrivateKeyInput(
        Array.from(new Uint8Array(privateKey))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
      );
      privateKey.fill(0); // Zero key material after hex conversion
      setPublicKeyInput(publicKey);
      setError(null);
    } catch (err) {
      setError('Failed to generate NOSTR keys. Please try again.');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // Sign in via NIP-07 browser extension
  const handleExtensionLogin = async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const nostrExt = (
        window as unknown as {
          nostr?: {
            getPublicKey: () => Promise<string>;
            signEvent: (event: Record<string, unknown>) => Promise<Record<string, unknown>>;
          };
        }
      ).nostr;
      if (!nostrExt) {
        setHasExtension(false);
        setIsLoading(false);
        return;
      }

      setHasExtension(true);

      // Step 1: Get pubkey from extension
      const hexPubkey = await nostrExt.getPublicKey();

      // Step 2: Get challenge from backend
      const challengeResult = await generateNostrChallenge();
      if (challengeResult.error || !challengeResult.challenge) {
        throw new Error(challengeResult.error || 'Failed to get authentication challenge');
      }

      const { challenge, timestamp: serverTimestamp } = challengeResult;
      const timestamp = serverTimestamp ?? Math.floor(Date.now() / 1000);

      // Step 3: Build message hash per backend contract
      const hashHex = await sha256Hex(createSignatureMessage(challenge, timestamp));

      // Step 4: Build NIP-42 event and sign via extension
      const unsignedEvent = {
        kind: 22242,
        pubkey: hexPubkey,
        created_at: timestamp,
        tags: [['challenge', challenge]],
        content: hashHex,
      };
      const signedEvent = (await nostrExt.signEvent(unsignedEvent)) as Record<string, unknown>;

      // Step 5: Authenticate
      const authResult = await authenticateNostr({
        signature: signedEvent.sig as string,
        pubkey: hexPubkey,
        challenge,
        timestamp,
        event: signedEvent,
      });

      if (authResult.error || !authResult.user) {
        throw new Error(authResult.error || 'NOSTR authentication failed');
      }

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NOSTR authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in via manually entered keys (hex or nsec)
  const handleManualLogin = async (): Promise<void> => {
    if (!publicKeyInput || !privateKeyInput) {
      setError('Please provide both public and private keys');
      return;
    }

    setError(null);
    setIsLoading(true);

    let privateKeyBytes: Uint8Array | null = null;

    try {
      const { finalizeEvent } = await import('nostr-tools/pure');
      const { decode: nip19Decode } = await import('nostr-tools/nip19');

      // Decode private key — support nsec and hex
      let hexPrivate: string;
      let hexPubkey: string;

      if (privateKeyInput.startsWith('nsec')) {
        const decoded = nip19Decode(privateKeyInput);
        if (decoded.type !== 'nsec') throw new Error('Invalid nsec key');
        privateKeyBytes = decoded.data as Uint8Array;
        hexPrivate = Array.from(privateKeyBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        hexPrivate = privateKeyInput;
        privateKeyBytes = new Uint8Array(
          hexPrivate.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );
      }

      // Decode public key — support npub and hex
      if (publicKeyInput.startsWith('npub')) {
        const decoded = nip19Decode(publicKeyInput);
        if (decoded.type !== 'npub') throw new Error('Invalid npub key');
        hexPubkey = decoded.data as string;
      } else {
        hexPubkey = publicKeyInput;
      }

      // Get challenge from backend
      const challengeResult = await generateNostrChallenge();
      if (challengeResult.error || !challengeResult.challenge) {
        throw new Error(challengeResult.error || 'Failed to get authentication challenge');
      }

      const { challenge, timestamp: serverTimestamp } = challengeResult;
      const timestamp = serverTimestamp ?? Math.floor(Date.now() / 1000);

      // Build message hash
      const hashHex = await sha256Hex(createSignatureMessage(challenge, timestamp));

      // Build and sign NIP-42 event
      const eventData = {
        kind: 22242,
        pubkey: hexPubkey,
        created_at: timestamp,
        tags: [['challenge', challenge]],
        content: hashHex,
      };
      const signedEvent = finalizeEvent(eventData, privateKeyBytes);

      // Zero private key bytes after signing
      privateKeyBytes.fill(0);
      privateKeyBytes = null;

      // Clear state
      setPrivateKeyInput('');

      // Authenticate
      const authResult = await authenticateNostr({
        signature: signedEvent.sig,
        pubkey: hexPubkey,
        challenge,
        timestamp,
        event: signedEvent as unknown as Record<string, unknown>,
      });

      if (authResult.error || !authResult.user) {
        throw new Error(authResult.error || 'NOSTR authentication failed');
      }

      navigate('/profile');
    } catch (err) {
      // Zero key on error too
      if (privateKeyBytes) {
        privateKeyBytes.fill(0);
      }
      setError(err instanceof Error ? err.message : 'NOSTR authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for NIP-07 extension on first button click
  const handleSignInClick = async (): Promise<void> => {
    const nostrExt = (window as unknown as { nostr?: unknown }).nostr;
    if (nostrExt) {
      await handleExtensionLogin();
    } else {
      setHasExtension(false);
    }
  };

  // Email login handler
  const handleEmailLogin = async (): Promise<void> => {
    if (!emailCredentials.email || !emailCredentials.password) {
      setError('Please enter your email and password');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await login({
        email: emailCredentials.email,
        password: emailCredentials.password,
      });

      if (result.error || !result.user) {
        throw new Error(result.error || 'Email login failed');
      }

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setEmailCredentials(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className='min-h-screen bg-background'>
      <div className='border-b border-border bg-card/80 backdrop-blur-sm'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            <Link to='/' className='flex items-center'>
              <span className='text-2xl font-bold text-purple-500'>Sovren</span>
              <span className='ml-2 text-sm text-muted-foreground'>
                Decentralized Creator Platform
              </span>
            </Link>
            <div className='flex space-x-4'>
              <Link
                to='/signup'
                className='text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-150'
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className='min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
        <div className='sm:mx-auto sm:w-full sm:max-w-md'>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-foreground font-display'>
            Sign in to Sovren
          </h2>
          <p className='mt-2 text-center text-sm text-muted-foreground'>
            Decentralized creator platform with true ownership
          </p>
        </div>

        <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
          <div className='glass py-8 px-4 shadow-lg sm:rounded-lg sm:px-10'>
            {/* Authentication Mode Selector */}
            <div className='mb-6'>
              <div
                role='tablist'
                className='flex space-x-1 bg-card/50 p-1 rounded-lg border border-border/50'
              >
                <button
                  role='tab'
                  aria-selected={authMode === 'nostr'}
                  onClick={() => {
                    setAuthMode('nostr');
                    setError(null);
                  }}
                  className={`flex-1 min-h-[44px] py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
                    authMode === 'nostr'
                      ? 'bg-purple-500/20 text-purple-400 shadow-sm border border-purple-500/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  NOSTR Keys
                </button>
                <button
                  role='tab'
                  aria-selected={authMode === 'email'}
                  onClick={() => {
                    setAuthMode('email');
                    setError(null);
                  }}
                  className={`flex-1 min-h-[44px] py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
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
              <div className='mb-6 rounded-md bg-red-500/10 border border-red-500/20 p-4'>
                <div className='ml-3'>
                  <h3 className='text-sm font-medium text-red-400'>{error}</h3>
                </div>
              </div>
            )}

            {/* NOSTR Login */}
            {authMode === 'nostr' && (
              <div className='space-y-6'>
                <div className='bg-purple-500/10 border border-purple-500/20 rounded-md p-4'>
                  <h3 className='text-sm font-medium text-purple-300 mb-2'>
                    Sovereign Authentication
                  </h3>
                  <p className='text-sm text-purple-200/80'>
                    Use your NOSTR keys for true decentralized authentication. Your identity works
                    across all NOSTR-compatible platforms.
                  </p>
                </div>

                {/* Primary: NIP-07 extension sign-in */}
                {hasExtension !== false && (
                  <div>
                    <Button
                      onClick={handleSignInClick}
                      disabled={isLoading}
                      className='w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150'
                    >
                      {isLoading ? (
                        <span className='flex items-center justify-center'>
                          <Spinner size='sm' className='mr-2' />
                          Authenticating...
                        </span>
                      ) : (
                        'Sign in with NOSTR extension'
                      )}
                    </Button>
                    {hasExtension === null && (
                      <p className='mt-2 text-xs text-muted-foreground text-center'>
                        Uses Alby, nos2x, or any NIP-07 browser extension
                      </p>
                    )}
                  </div>
                )}

                {/* Fallback: manual key entry */}
                {hasExtension === false && (
                  <div className='space-y-6'>
                    <div className='text-sm text-muted-foreground text-center'>
                      No NOSTR extension detected. Enter your keys manually.
                    </div>

                    <div>
                      <Label
                        htmlFor='publicKey'
                        className='block text-sm font-medium text-foreground mb-2'
                      >
                        Public Key (npub...)
                      </Label>
                      <textarea
                        id='publicKey'
                        rows={3}
                        value={publicKeyInput}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                          const val = e.target.value.trim();
                          setPublicKeyInput(val);
                          validatePublicKey(val);
                        }}
                        className={`block w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm font-mono transition-colors duration-150 ${
                          publicKeyError ? 'border-red-500/50' : 'border-border'
                        }`}
                        placeholder='npub1... or hex format'
                      />
                      {publicKeyError && (
                        <p className='mt-1 text-xs text-red-400'>{publicKeyError}</p>
                      )}
                    </div>

                    <div>
                      <Label
                        htmlFor='privateKey'
                        className='block text-sm font-medium text-foreground mb-2'
                      >
                        Private Key (nsec...)
                      </Label>
                      <textarea
                        id='privateKey'
                        rows={3}
                        value={privateKeyInput}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                          const val = e.target.value.trim();
                          setPrivateKeyInput(val);
                          validatePrivateKey(val);
                        }}
                        className={`block w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm font-mono transition-colors duration-150 ${
                          privateKeyError ? 'border-red-500/50' : 'border-border'
                        }`}
                        placeholder='nsec1... or hex format (never sent to server)'
                      />
                      {privateKeyError ? (
                        <p className='mt-1 text-xs text-red-400'>{privateKeyError}</p>
                      ) : (
                        <p className='mt-1 text-xs text-muted-foreground'>
                          Private key stays in your browser and is never sent to our servers
                        </p>
                      )}
                    </div>

                    <div>
                      <Button
                        onClick={generateNostrKeys}
                        disabled={isGeneratingKeys}
                        variant='outline'
                        className='w-full mb-4 border-purple-500/30 hover:border-purple-500/50 transition-colors duration-150'
                      >
                        {isGeneratingKeys ? (
                          <span className='flex items-center justify-center'>
                            <Spinner size='sm' className='mr-2' />
                            Generating...
                          </span>
                        ) : (
                          'Generate new key pair'
                        )}
                      </Button>
                    </div>

                    <Button
                      onClick={handleManualLogin}
                      disabled={isLoading || !isManualKeysValid()}
                      className='w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150'
                    >
                      {isLoading ? (
                        <span className='flex items-center justify-center'>
                          <Spinner size='sm' className='mr-2' />
                          Authenticating...
                        </span>
                      ) : (
                        'Sign in with NOSTR keys'
                      )}
                    </Button>

                    <div className='text-center'>
                      <button
                        onClick={() => setHasExtension(null)}
                        className='text-sm text-purple-400 hover:text-purple-300 transition-colors duration-150'
                      >
                        Try extension sign-in instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Email Login */}
            {authMode === 'email' && (
              <div className='space-y-6'>
                <div>
                  <Label htmlFor='email'>Email address</Label>
                  <Input
                    id='email'
                    name='email'
                    type='email'
                    autoComplete='email'
                    required
                    value={emailCredentials.email}
                    onChange={handleEmailChange}
                    placeholder='Enter your email'
                  />
                </div>

                <div>
                  <Label htmlFor='password'>Password</Label>
                  <Input
                    id='password'
                    name='password'
                    type='password'
                    autoComplete='current-password'
                    required
                    value={emailCredentials.password}
                    onChange={handleEmailChange}
                    placeholder='Enter your password'
                  />
                </div>

                <Button
                  onClick={handleEmailLogin}
                  disabled={isLoading || !emailCredentials.email || !emailCredentials.password}
                  className='w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150'
                >
                  {isLoading ? (
                    <span className='flex items-center justify-center'>
                      <Spinner size='sm' className='mr-2' />
                      Signing in...
                    </span>
                  ) : (
                    'Sign in with Email'
                  )}
                </Button>
              </div>
            )}

            <div className='mt-6 text-center'>
              <p className='text-sm text-muted-foreground'>
                Don't have an account?{' '}
                <Link
                  to='/signup'
                  className='font-medium text-purple-400 hover:text-purple-300 transition-colors duration-150'
                >
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
