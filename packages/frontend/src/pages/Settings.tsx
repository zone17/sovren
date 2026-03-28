import React, { useState } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuthStatus } from '../features/auth';

const Settings: React.FC = () => {
  useDocumentTitle('Settings');
  const { user } = useAuthStatus();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [paymentNotifications, setPaymentNotifications] = useState(true);
  const [contentNotifications, setContentNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would call an API to save the profile
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your profile, wallet configuration, and notification preferences.
        </p>
      </div>

      {saved && (
        <div role="alert" className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
          Settings saved successfully.
        </div>
      )}

      {/* Profile Section */}
      <section aria-labelledby="profile-heading">
        <div className="glass-dark rounded-2xl border border-white/5 p-6 sm:p-8">
          <h2 id="profile-heading" className="text-xl font-semibold text-foreground mb-6">Profile</h2>
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-foreground mb-2">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all duration-150"
                placeholder="Your display name"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all duration-150 resize-none"
                placeholder="Tell the world about yourself..."
              />
              <p className="mt-1 text-xs text-muted-foreground">{bio.length}/300 characters</p>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all duration-150 shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
            >
              Save Profile
            </button>
          </form>
        </div>
      </section>

      {/* Wallet Configuration */}
      <section aria-labelledby="wallet-heading">
        <div className="glass-dark rounded-2xl border border-white/5 p-6 sm:p-8">
          <h2 id="wallet-heading" className="text-xl font-semibold text-foreground mb-6">Wallet Configuration</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div>
                <p className="text-sm font-medium text-foreground">NOSTR Public Key</p>
                <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                  {user?.nostr_pubkey || 'Not connected'}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ${user?.nostr_pubkey ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                {user?.nostr_pubkey ? 'Connected' : 'Not Set'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div>
                <p className="text-sm font-medium text-foreground">Lightning Wallet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure your Lightning wallet for receiving payments
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                Configure
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section aria-labelledby="notifications-heading">
        <div className="glass-dark rounded-2xl border border-white/5 p-6 sm:p-8">
          <h2 id="notifications-heading" className="text-xl font-semibold text-foreground mb-6">Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Email Notifications</p>
                <p className="text-xs text-muted-foreground mt-1">Receive updates via email</p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 rounded border-border text-purple-500 focus:ring-purple-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Payment Notifications</p>
                <p className="text-xs text-muted-foreground mt-1">Get notified when you receive sats</p>
              </div>
              <input
                type="checkbox"
                checked={paymentNotifications}
                onChange={(e) => setPaymentNotifications(e.target.checked)}
                className="w-4 h-4 rounded border-border text-purple-500 focus:ring-purple-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Content Notifications</p>
                <p className="text-xs text-muted-foreground mt-1">Updates on new posts from creators you follow</p>
              </div>
              <input
                type="checkbox"
                checked={contentNotifications}
                onChange={(e) => setContentNotifications(e.target.checked)}
                className="w-4 h-4 rounded border-border text-purple-500 focus:ring-purple-500"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
