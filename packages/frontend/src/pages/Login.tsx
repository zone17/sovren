import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../features/auth';
import { createSignatureMessage } from '@shared/types/nostr/auth';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { generateNostrChallenge, authenticateNostr } = useAuth();

  // Key entry — hex or nsec
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

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
      setPrivateKeyInput(Buffer.from(privateKey).toString('hex'));
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
        hexPrivate = Buffer.from(privateKeyBytes).toString('hex');
      } else {
        hexPrivate = privateKeyInput;
        privateKeyBytes = new Uint8Array(Buffer.from(hexPrivate, 'hex'));
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

  return (
    <div className="min-h-screen bg-background">
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
                to="/signup"
                className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-150"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground font-display">
            Sign in to Sovren
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Decentralized authentication with NOSTR
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="glass py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-4 mb-6">
              <h3 className="text-sm font-medium text-purple-300 mb-2">Sovereign Authentication</h3>
              <p className="text-sm text-purple-200/80">
                Use your NOSTR keys for true decentralized authentication. Your identity works
                across all NOSTR-compatible platforms.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-md bg-red-500/10 border border-red-500/20 p-4">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-400">{error}</h3>
                </div>
              </div>
            )}

            {/* Primary: NIP-07 extension sign-in */}
            {hasExtension !== false && (
              <div className="mb-6">
                <Button
                  onClick={handleSignInClick}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500/30 border-t-purple-500 mr-2" />
                      Authenticating...
                    </span>
                  ) : (
                    'Sign in with NOSTR extension'
                  )}
                </Button>
                {hasExtension === null && (
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    Uses Alby, nos2x, or any NIP-07 browser extension
                  </p>
                )}
              </div>
            )}

            {/* Fallback: manual key entry */}
            {hasExtension === false && (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground text-center">
                  No NOSTR extension detected. Enter your keys manually.
                </div>

                <div>
                  <label
                    htmlFor="publicKey"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Public Key (npub or hex)
                  </label>
                  <textarea
                    id="publicKey"
                    rows={3}
                    value={publicKeyInput}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setPublicKeyInput(e.target.value)
                    }
                    className="block w-full px-3 py-2 border border-border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm font-mono transition-colors duration-150"
                    placeholder="npub1... or hex format"
                  />
                </div>

                <div>
                  <label
                    htmlFor="privateKey"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Private Key (nsec or hex)
                  </label>
                  <textarea
                    id="privateKey"
                    rows={3}
                    value={privateKeyInput}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setPrivateKeyInput(e.target.value)
                    }
                    className="block w-full px-3 py-2 border border-border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm font-mono transition-colors duration-150"
                    placeholder="nsec1... or hex format (never sent to server)"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Private key stays in your browser and is never sent to our servers
                  </p>
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
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500/30 border-t-purple-500 mr-2" />
                        Generating...
                      </span>
                    ) : (
                      'Generate new key pair'
                    )}
                  </Button>
                </div>

                <Button
                  onClick={handleManualLogin}
                  disabled={isLoading || !publicKeyInput || !privateKeyInput}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all duration-150"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500/30 border-t-purple-500 mr-2" />
                      Authenticating...
                    </span>
                  ) : (
                    'Sign in with NOSTR keys'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => setHasExtension(null)}
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors duration-150"
                  >
                    Try extension sign-in instead
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-purple-400 hover:text-purple-300 transition-colors duration-150"
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
