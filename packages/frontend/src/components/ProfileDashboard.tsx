import {
  CheckCircle,
  Copy,
  ExternalLink,
  Key,
  Settings,
  Shield,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface UserProfile {
  nostrKeys: {
    npub: string;
    pubkey: string;
  };
  lightningWallet: {
    name: string;
    type: 'custodial' | 'self-custodial' | 'browser';
    difficulty: string;
    setupComplete: boolean;
    integratedAt: string;
  } | null;
  userType: 'creator' | 'supporter';
  onboardingCompletedAt: string;
}

const ProfileDashboard: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    // Load profile from localStorage (in production would be from API)
    const savedProfile = localStorage.getItem('sovren_user_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        // Validate shape before using — corrupted data should not crash the app
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.nostrKeys &&
          typeof parsed.nostrKeys.npub === 'string' &&
          typeof parsed.nostrKeys.pubkey === 'string' &&
          typeof parsed.userType === 'string' &&
          typeof parsed.onboardingCompletedAt === 'string'
        ) {
          setProfile(parsed as UserProfile);
        } else {
          // Invalid shape — clear corrupted data
          localStorage.removeItem('sovren_user_profile');
        }
      } catch {
        // Corrupted JSON — clear bad data and show empty state
        localStorage.removeItem('sovren_user_profile');
      }
    }
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-premium-900 via-premium-800 to-sovereign-900 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-4 font-display">No Profile Found</h2>
            <p className="text-muted-foreground mb-6">
              Complete the sovereign onboarding to create your profile.
            </p>
            <Button
              onClick={() => (window.location.href = '/onboarding')}
              className="bg-gradient-to-r from-sovereign-500 to-lightning-600"
            >
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-premium-900 via-premium-800 to-sovereign-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-6 bg-gradient-to-br from-sovereign-500 to-lightning-600 rounded-2xl">
              <User className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-lightning-200 to-sovereign-200 bg-clip-text text-transparent font-display">
            Your Sovereign Profile
          </h1>
          <p className="text-xl text-muted-foreground mt-4">
            Your digital identity and payment setup
          </p>
        </div>

        {/* Profile Cards */}
        <div className="max-w-4xl mx-auto space-y-8">
          {/* User Type Card */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Shield className="mr-3 h-6 w-6 text-sovereign-400" />
                Account Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge
                    className={`text-lg px-4 py-2 ${
                      profile.userType === 'creator'
                        ? 'bg-lightning-500 text-white'
                        : 'bg-sovereign-500 text-white'
                    }`}
                  >
                    {profile.userType === 'creator' ? 'Creator' : 'Supporter'}
                  </Badge>
                  <p className="text-muted-foreground mt-2">
                    {profile.userType === 'creator'
                      ? 'Monetize content with Bitcoin payments'
                      : 'Support creators with instant Lightning tips'}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* NOSTR Identity Card */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Key className="mr-3 h-6 w-6 text-sovereign-400" />
                NOSTR Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-sovereign-500/10 rounded-lg border border-sovereign-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sovereign-200 font-medium">Public Key (npub)</span>
                  <Badge className="bg-green-500 text-white">Verified</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-2 bg-black/20 rounded text-sm text-green-300 break-all">
                    {profile.nostrKeys.npub}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(profile.nostrKeys.npub, 'npub')}
                  >
                    {copiedField === 'npub' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this with others to let them find you on NOSTR
                </p>
              </div>

              <div className="flex space-x-4">
                <Button variant="outline" className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on NOSTR
                </Button>
                <Button variant="outline" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Keys
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lightning Wallet Card */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Zap className="mr-3 h-6 w-6 text-lightning-400" />
                Lightning Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.lightningWallet ? (
                <div className="space-y-4">
                  <div className="p-4 bg-lightning-500/10 rounded-lg border border-lightning-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lightning-200 font-medium text-lg">
                          {profile.lightningWallet.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {profile.lightningWallet.type} • {profile.lightningWallet.difficulty}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-500 text-white mb-1">Connected</Badge>
                        <p className="text-xs text-muted-foreground">
                          Since{' '}
                          {new Date(profile.lightningWallet.integratedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-green-500/10 p-3 rounded border border-green-500/20">
                        <div className="text-green-400 text-sm font-medium">Status</div>
                        <div className="text-white">Ready for payments</div>
                      </div>
                      <div className="bg-lightning-500/10 p-3 rounded border border-lightning-500/20">
                        <div className="text-lightning-400 text-sm font-medium">Type</div>
                        <div className="text-white capitalize">{profile.lightningWallet.type}</div>
                      </div>
                      <div className="bg-purple-500/10 p-3 rounded border border-purple-500/20">
                        <div className="text-purple-400 text-sm font-medium">Difficulty</div>
                        <div className="text-white">{profile.lightningWallet.difficulty}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <Button className="flex-1 bg-lightning-500 hover:bg-lightning-600">
                      <Wallet className="h-4 w-4 mr-2" />
                      Open Wallet
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Settings className="h-4 w-4 mr-2" />
                      Wallet Settings
                    </Button>
                  </div>

                  {profile.userType === 'creator' && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-lightning-500/10 to-sovereign-500/10 rounded-lg border border-lightning-500/20">
                      <h4 className="text-white font-medium mb-2">Creator Features</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" size="sm">
                          Payment Links
                        </Button>
                        <Button variant="outline" size="sm">
                          Revenue Analytics
                        </Button>
                        <Button variant="outline" size="sm">
                          Fan Funding
                        </Button>
                        <Button variant="outline" size="sm">
                          Instant Tips
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">No Lightning Wallet Connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect a Lightning wallet to enable Bitcoin payments
                  </p>
                  <Button className="bg-lightning-500 hover:bg-lightning-600">
                    <Zap className="h-4 w-4 mr-2" />
                    Setup Lightning Wallet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col">
                  <ExternalLink className="h-6 w-6 mb-2" />
                  <span className="text-xs">Share Profile</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Shield className="h-6 w-6 mb-2" />
                  <span className="text-xs">Security</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Settings className="h-6 w-6 mb-2" />
                  <span className="text-xs">Settings</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Zap className="h-6 w-6 mb-2" />
                  <span className="text-xs">Test Payment</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileDashboard;
