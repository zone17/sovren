import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../features/auth';

interface NostrKeys {
  publicKey: string;
  privateKey: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { generateNostrChallenge, authenticateNostr, login } = useAuth();

  // Authentication mode
  const [authMode, setAuthMode] = useState<'nostr' | 'email'>('nostr');

  // NOSTR authentication
  const [nostrKeys, setNostrKeys] = useState<NostrKeys>({ publicKey: '', privateKey: '' });
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  // Traditional email authentication
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🔑 Generate new NOSTR key pair
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

  // 🌐 NOSTR Authentication Flow
  const handleNostrLogin = async (): Promise<void> => {
    if (!nostrKeys.publicKey || !nostrKeys.privateKey) {
      setError('Please provide or generate NOSTR keys');
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
      });

      if (authResult.error || !authResult.user) {
        throw new Error(authResult.error || 'NOSTR authentication failed');
      }

      // Success - redirect to profile
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NOSTR authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 📧 Traditional Email Authentication
  const handleEmailLogin = async (): Promise<void> => {
    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await login({ email, password });

      if (result.error || !result.user) {
        throw new Error(result.error || 'Login failed');
      }

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">Sovren</span>
              <span className="ml-2 text-sm text-gray-500">⚡ Decentralized Creator Platform</span>
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
            {/* Authentication Mode Selector */}
            <div className="mb-6">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setAuthMode('nostr')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    authMode === 'nostr'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🌐 NOSTR Keys
                </button>
                <button
                  onClick={() => setAuthMode('email')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    authMode === 'email'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📧 Email
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* NOSTR Authentication */}
            {authMode === 'nostr' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">
                    🔐 Sovereign Authentication
                  </h3>
                  <p className="text-sm text-blue-700">
                    Use your NOSTR keys for true decentralized authentication. Your identity works
                    across all NOSTR-compatible platforms.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="publicKey"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Public Key (npub...)
                  </label>
                  <textarea
                    id="publicKey"
                    rows={3}
                    value={nostrKeys.publicKey}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNostrKeys({ ...nostrKeys, publicKey: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="npub1... or hex format"
                  />
                </div>

                <div>
                  <label
                    htmlFor="privateKey"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Private Key (nsec...)
                  </label>
                  <textarea
                    id="privateKey"
                    rows={3}
                    value={nostrKeys.privateKey}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNostrKeys({ ...nostrKeys, privateKey: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="nsec1... or hex format (kept locally, never sent to server)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    🔒 Private key stays in your browser and is never sent to our servers
                  </p>
                </div>

                <div>
                  <Button
                    onClick={generateNostrKeys}
                    disabled={isGeneratingKeys}
                    variant="outline"
                    className="w-full mb-4"
                  >
                    🔑 Generate New Keys
                  </Button>
                  {isGeneratingKeys && (
                    <p className="text-sm text-blue-600 text-center">Generating keys...</p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-xs text-yellow-800">
                    New to NOSTR?{' '}
                    <button
                      onClick={generateNostrKeys}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Generate keys to get started
                    </button>
                  </p>
                </div>

                <Button
                  onClick={handleNostrLogin}
                  disabled={isLoading || !nostrKeys.publicKey || !nostrKeys.privateKey}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Authenticating...' : '🌐 Sign In with NOSTR'}
                </Button>
              </div>
            )}

            {/* Email Authentication */}
            {authMode === 'email' && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                </div>

                <Button
                  onClick={handleEmailLogin}
                  disabled={isLoading || !email || !password}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Signing in...' : '📧 Sign In with Email'}
                </Button>
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
