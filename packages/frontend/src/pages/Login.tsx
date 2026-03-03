import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../features/auth';
import { createSignatureMessage } from '@shared/types/nostr/auth';

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
      const message = createSignatureMessage(challenge, timestamp);
      const msgBytes = new TextEncoder().encode(message);
      const msgHashBuffer = await crypto.subtle.digest('SHA-256', msgBytes);
      const hashHex = Array.from(new Uint8Array(msgHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

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
      const message = createSignatureMessage(challenge, timestamp);
      const msgBytes = new TextEncoder().encode(message);
      const msgHashBuffer = await crypto.subtle.digest('SHA-256', msgBytes);
      const hashHex = Array.from(new Uint8Array(msgHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">Sovren</span>
              <span className="ml-2 text-sm text-gray-500">Decentralized Creator Platform</span>
            </Link>
            <div className="flex space-x-4">
              <Link
                to="/signup"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Sovren
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Decentralized authentication with NOSTR
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Sovereign Authentication</h3>
              <p className="text-sm text-blue-700">
                Use your NOSTR keys for true decentralized authentication. Your identity works
                across all NOSTR-compatible platforms.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            )}

            {/* Primary: NIP-07 extension sign-in */}
            {hasExtension !== false && (
              <div className="mb-6">
                <Button
                  onClick={handleSignInClick}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Authenticating...' : 'Sign in with NOSTR extension'}
                </Button>
                {hasExtension === null && (
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    Uses Alby, nos2x, or any NIP-07 browser extension
                  </p>
                )}
              </div>
            )}

            {/* Fallback: manual key entry */}
            {hasExtension === false && (
              <div className="space-y-6">
                <div className="text-sm text-gray-600 text-center">
                  No NOSTR extension detected. Enter your keys manually.
                </div>

                <div>
                  <label
                    htmlFor="publicKey"
                    className="block text-sm font-medium text-gray-700 mb-2"
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
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="npub1... or hex format"
                  />
                </div>

                <div>
                  <label
                    htmlFor="privateKey"
                    className="block text-sm font-medium text-gray-700 mb-2"
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
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="nsec1... or hex format (never sent to server)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Private key stays in your browser and is never sent to our servers
                  </p>
                </div>

                <div>
                  <Button
                    onClick={generateNostrKeys}
                    disabled={isGeneratingKeys}
                    variant="outline"
                    className="w-full mb-4"
                  >
                    {isGeneratingKeys ? 'Generating...' : 'Generate new key pair'}
                  </Button>
                </div>

                <Button
                  onClick={handleManualLogin}
                  disabled={isLoading || !publicKeyInput || !privateKeyInput}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Authenticating...' : 'Sign in with NOSTR keys'}
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => setHasExtension(null)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Try extension sign-in instead
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
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
