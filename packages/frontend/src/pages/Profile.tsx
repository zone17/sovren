import React from 'react';
import { Button } from '../components/ui';
import { useAuth } from '../features/auth';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-500" />
          <h1
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Loading Profile...
          </h1>
        </div>
      </div>
    );
  }

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="glass rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1
              className="text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {user.name || user.email || 'User Profile'}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center">
                {user.role === 'creator' && 'Creator'}
                {user.role === 'supporter' && 'Supporter'}
                {user.role === 'admin' && 'Administrator'}
              </span>
              <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <Button onClick={() => void handleLogout()} variant="outline">
            Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Authentication Details */}
        <div className="glass rounded-lg p-6">
          <h2
            className="text-xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Authentication
          </h2>

          {user.nostr_pubkey ? (
            <div className="space-y-4">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <h3 className="text-lg font-medium text-purple-300">NOSTR Identity</h3>
                </div>
                <p className="text-sm text-purple-300/80 mb-3">
                  You&apos;re using decentralized NOSTR authentication. Your identity is sovereign
                  and portable across all NOSTR-compatible platforms.
                </p>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Public Key (npub)
                  </label>
                  <div className="bg-background p-3 border border-border rounded text-xs font-mono break-all">
                    {user.nostr_pubkey}
                  </div>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-400">
                    Benefits of NOSTR Authentication:
                  </span>
                </div>
                <ul className="mt-2 text-sm text-green-400/80 space-y-1">
                  <li>• True ownership of your identity</li>
                  <li>• Works across all NOSTR apps</li>
                  <li>• No vendor lock-in</li>
                  <li>• Cryptographically secure</li>
                  <li>• Censorship resistant</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <h3 className="text-lg font-medium text-yellow-300">Email Authentication</h3>
                </div>
                <p className="text-sm text-yellow-300/80 mb-2">
                  You&apos;re using traditional email authentication: <strong>{user.email}</strong>
                </p>
                <p className="text-xs text-yellow-400/60">
                  Consider upgrading to NOSTR for better security and portability.
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <h4 className="font-medium text-purple-300 mb-2">Upgrade to NOSTR</h4>
                <p className="text-sm text-purple-300/80 mb-3">
                  Switch to decentralized authentication for true digital sovereignty.
                </p>
                <Button variant="outline" className="text-sm">
                  Connect NOSTR Keys
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Role-Specific Features */}
        <div className="glass rounded-lg p-6">
          <h2
            className="text-xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Features & Capabilities
          </h2>

          {user.role === 'creator' && (
            <div className="space-y-4">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <h3 className="text-lg font-medium text-purple-300">Creator Tools</h3>
                </div>
                <ul className="text-sm text-purple-300/80 space-y-2">
                  <li>Create and publish content</li>
                  <li>Receive Lightning payments</li>
                  <li>Analytics dashboard</li>
                  <li>Manage subscriptions</li>
                  <li>NOSTR content distribution</li>
                </ul>
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <h4 className="font-medium text-green-400 mb-2">Lightning Network</h4>
                <p className="text-sm text-green-400/80 mb-2">
                  Accept instant Bitcoin payments from your supporters.
                </p>
                <Button variant="outline" className="text-sm">
                  Setup Lightning Wallet
                </Button>
              </div>
            </div>
          )}

          {user.role === 'supporter' && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <h3 className="text-lg font-medium text-green-400">Supporter Features</h3>
                </div>
                <ul className="text-sm text-green-400/80 space-y-2">
                  <li>Follow your favorite creators</li>
                  <li>Send Lightning tips</li>
                  <li>Comment and interact</li>
                  <li>Mobile-friendly feed</li>
                  <li>Real-time notifications</li>
                </ul>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <h4 className="font-medium text-purple-300 mb-2">Become a Creator</h4>
                <p className="text-sm text-purple-300/80 mb-2">
                  Ready to start creating content and earning?
                </p>
                <Button variant="outline" className="text-sm">
                  Upgrade to Creator
                </Button>
              </div>
            </div>
          )}

          {user.role === 'admin' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <h3 className="text-lg font-medium text-red-400">Admin Access</h3>
                </div>
                <ul className="text-sm text-red-400/80 space-y-2">
                  <li>System monitoring</li>
                  <li>User management</li>
                  <li>Lightning node status</li>
                  <li>NOSTR relay management</li>
                  <li>Feature flag control</li>
                </ul>
              </div>

              <Button
                variant="default"
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_16px_rgba(139,92,246,0.3)] text-white transition-all duration-150"
              >
                Admin Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Account Settings */}
      <div className="glass rounded-lg p-6 mt-6">
        <h2
          className="text-xl font-semibold text-foreground mb-4"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Account Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="outline">Edit Profile</Button>
          <Button variant="outline">Security Settings</Button>
          <Button variant="outline">Export NOSTR Keys</Button>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="glass rounded-lg p-6 mt-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">Welcome to Sovren</h3>
          <p className="text-muted-foreground mb-4">
            The decentralized creator platform that gives you true ownership and freedom.
          </p>
          <div className="flex justify-center space-x-8 text-sm text-muted-foreground">
            <span>NOSTR Protocol</span>
            <span>Lightning Network</span>
            <span>Self-Sovereign Identity</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-foreground mb-2">Your Lightning Address</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This is how people can send you Bitcoin payments. It&apos;s like an email address for
          money.
        </p>

        <h2 className="text-lg font-medium text-foreground mb-2">Content Creation</h2>
        <p className="text-sm text-muted-foreground">
          Start creating content and building your audience. You&apos;ll earn Bitcoin for every
          like, comment, and support from your followers.
        </p>
      </div>
    </div>
  );
};

export default Profile;
