import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  RefreshCw,
  Shield,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// 🔍 NIP-05 Verification Types
interface NIP05VerificationRecord {
  id: string;
  user_id: string;
  nostr_pubkey: string;
  nip05_identifier: string;
  domain: string;
  local_part: string;
  verification_status: 'pending' | 'verified' | 'failed' | 'expired' | 'revoked';
  verification_method: 'http' | 'dns' | 'manual';
  verification_data: Record<string, any>;
  verified_at?: string;
  expires_at?: string;
  last_checked_at: string;
  check_count: number;
  failure_reason?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  domain_info?: {
    is_trusted: boolean;
    verification_methods_supported: string[];
  };
  status_info?: {
    is_expired: boolean;
    needs_refresh: boolean;
  };
}

interface DomainStats {
  domain: string;
  total_verifications: number;
  verified_count: number;
  pending_count: number;
  failed_count: number;
  verification_methods: {
    http: number;
    dns: number;
    manual: number;
  };
  last_verification: string;
}

interface NIP05ManagerProps {
  onVerificationCreated?: (verification: NIP05VerificationRecord) => void;
  onVerificationRevoked?: (verificationId: string) => void;
  className?: string;
}

/**
 * 🔍 Elite NIP-05 Manager Component
 * WHY: Comprehensive NIP-05 verification management with domain validation
 */
export const NIP05Manager: React.FC<NIP05ManagerProps> = ({
  onVerificationCreated,
  onVerificationRevoked,
  className = '',
}) => {
  const [verifications, setVerifications] = useState<NIP05VerificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<NIP05VerificationRecord | null>(
    null
  );
  const [domainStats, setDomainStats] = useState<DomainStats | null>(null);

  // Create verification form state
  const [newIdentifier, setNewIdentifier] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'http' | 'dns' | 'manual'>('http');
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  // 🔄 Load Verifications
  const loadVerifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/nip05/verifications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load verifications');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Verification loading failed');
      }

      setVerifications(result.data.verifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 🆕 Create Verification
  const handleCreateVerification = async () => {
    try {
      setIsCreating(true);
      setError(null);

      // Validate identifier format
      if (!newIdentifier.includes('@') || newIdentifier.split('@').length !== 2) {
        throw new Error('Invalid NIP-05 format. Use: localpart@domain.com');
      }

      const response = await fetch('/api/nip05/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nip05_identifier: newIdentifier.toLowerCase().trim(),
          verification_method: verificationMethod,
          metadata: {
            created_via: 'nip05_manager',
            user_agent: window.navigator.userAgent,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Verification creation failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Verification creation failed');
      }

      // Reset form and reload
      setNewIdentifier('');
      setVerificationMethod('http');
      setShowCreateDialog(false);
      await loadVerifications();

      onVerificationCreated?.(result.data.verification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  // 🔄 Refresh Verification
  const handleRefreshVerification = async (verificationId: string) => {
    try {
      setIsRefreshing(verificationId);
      setError(null);

      const response = await fetch('/api/nip05/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ verification_id: verificationId }),
      });

      if (!response.ok) {
        throw new Error('Verification refresh failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Verification refresh failed');
      }

      // Reload verifications
      await loadVerifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification refresh failed');
    } finally {
      setIsRefreshing(null);
    }
  };

  // 🚫 Revoke Verification
  const handleRevokeVerification = async () => {
    if (!selectedVerification) return;

    try {
      const response = await fetch(`/api/nip05/verifications/${selectedVerification.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'User requested revocation',
        }),
      });

      if (!response.ok) {
        throw new Error('Verification revocation failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Verification revocation failed');
      }

      // Reset state and reload
      setShowRevokeDialog(false);
      setSelectedVerification(null);
      await loadVerifications();

      onVerificationRevoked?.(selectedVerification.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification revocation failed');
    }
  };

  // 📊 Load Domain Stats
  const loadDomainStats = async (domain: string) => {
    try {
      const response = await fetch(`/api/nip05/domains/${domain}/stats`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDomainStats(result.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load domain stats:', err);
    }
  };

  // 🎨 Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-muted text-foreground border-border">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <X className="h-3 w-3 mr-1" />
            Revoked
          </Badge>
        );
      default:
        return <Badge className="bg-muted text-foreground border-border">{status}</Badge>;
    }
  };

  // 🎨 Method Badge Helper
  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'http':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            <Globe className="h-3 w-3 mr-1" />
            HTTP
          </Badge>
        );
      case 'dns':
        return (
          <Badge variant="outline" className="text-purple-600 border-purple-200">
            <Shield className="h-3 w-3 mr-1" />
            DNS
          </Badge>
        );
      case 'manual':
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-200">
            Manual
          </Badge>
        );
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  // 📋 Copy to Clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await window.navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  // 🚀 Initialize Component
  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading NIP-05 verifications...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 📊 Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Verified</p>
                <p className="text-2xl font-bold">
                  {verifications.filter((v) => v.verification_status === 'verified').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold">
                  {verifications.filter((v) => v.verification_status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Failed</p>
                <p className="text-2xl font-bold">
                  {verifications.filter((v) => v.verification_status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="text-2xl font-bold">{verifications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🔍 Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>NIP-05 Verifications</span>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={loadVerifications} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                Add Verification
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Verifications List */}
          <div className="space-y-4">
            {verifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-medium mb-2">No NIP-05 Verifications</h3>
                <p className="mb-4">
                  Create your first NIP-05 verification to establish your NOSTR identity.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>Create Verification</Button>
              </div>
            ) : (
              verifications.map((verification) => (
                <VerificationCard
                  key={verification.id}
                  verification={verification}
                  onRefresh={() => handleRefreshVerification(verification.id)}
                  onRevoke={() => {
                    setSelectedVerification(verification);
                    setShowRevokeDialog(true);
                  }}
                  onLoadDomainStats={loadDomainStats}
                  onCopyToClipboard={copyToClipboard}
                  isRefreshing={isRefreshing === verification.id}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Domain Stats */}
      {domainStats && (
        <Card>
          <CardHeader>
            <CardTitle>Domain Statistics: {domainStats.domain}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Verifications</p>
                <p className="text-2xl font-bold">{domainStats.total_verifications}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold text-green-600">{domainStats.verified_count}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{domainStats.pending_count}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{domainStats.failed_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🆕 Create Verification Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create NIP-05 Verification</DialogTitle>
            <DialogDescription>
              Verify your NOSTR identity with a NIP-05 identifier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="identifier">NIP-05 Identifier</Label>
              <Input
                id="identifier"
                placeholder="username@domain.com"
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: localpart@domain.com (e.g., alice@example.com)
              </p>
            </div>
            <div>
              <Label htmlFor="method">Verification Method</Label>
              <Select
                value={verificationMethod}
                onValueChange={(value) => setVerificationMethod(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP (/.well-known/nostr.json)</SelectItem>
                  <SelectItem value="dns">DNS (TXT record)</SelectItem>
                  <SelectItem value="manual">Manual Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateVerification}
              disabled={isCreating || !newIdentifier.includes('@')}
            >
              {isCreating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Verification'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🚫 Revoke Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this NIP-05 verification? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {selectedVerification && (
            <div className="space-y-2">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{selectedVerification.nip05_identifier}</p>
                <p className="text-sm text-muted-foreground">
                  Status: {getStatusBadge(selectedVerification.verification_status)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeVerification}>
              Revoke Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * 🎴 Verification Card Component
 */
interface VerificationCardProps {
  verification: NIP05VerificationRecord;
  onRefresh: () => void;
  onRevoke: () => void;
  onLoadDomainStats: (domain: string) => void;
  onCopyToClipboard: (text: string) => void;
  isRefreshing: boolean;
}

const VerificationCard: React.FC<VerificationCardProps> = ({
  verification,
  onRefresh,
  onRevoke,
  onLoadDomainStats,
  onCopyToClipboard,
  isRefreshing,
}) => {
  const isVerified = verification.verification_status === 'verified';
  const needsRefresh = verification.status_info?.needs_refresh;
  const isExpired = verification.status_info?.is_expired;

  return (
    <Card className={`transition-all hover:shadow-md ${isVerified ? 'ring-1 ring-green-200' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-medium text-lg">{verification.nip05_identifier}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyToClipboard(verification.nip05_identifier)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(verification.verification_status)}
                {getMethodBadge(verification.verification_method)}
                {verification.domain_info?.is_trusted && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Trusted Domain
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {needsRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLoadDomainStats(verification.domain)}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onRevoke}
              disabled={verification.verification_status === 'revoked'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Verification Details */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Domain:</span> {verification.domain}
            </div>
            <div>
              <span className="font-medium">Local Part:</span> {verification.local_part}
            </div>
            <div>
              <span className="font-medium">Created:</span>{' '}
              {new Date(verification.created_at).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Last Checked:</span>{' '}
              {new Date(verification.last_checked_at).toLocaleDateString()}
            </div>
          </div>

          {verification.verified_at && (
            <div>
              <span className="font-medium">Verified:</span>{' '}
              {new Date(verification.verified_at).toLocaleString()}
            </div>
          )}

          {verification.expires_at && (
            <div>
              <span className="font-medium">Expires:</span>{' '}
              {new Date(verification.expires_at).toLocaleString()}
              {isExpired && <span className="text-red-600 ml-2">(Expired)</span>}
            </div>
          )}

          {verification.failure_reason && (
            <div className="text-red-600">
              <span className="font-medium">Error:</span> {verification.failure_reason}
            </div>
          )}

          {verification.check_count > 0 && (
            <div>
              <span className="font-medium">Checks:</span> {verification.check_count}
            </div>
          )}
        </div>

        {/* Verification Data */}
        {verification.verification_data &&
          Object.keys(verification.verification_data).length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Verification Details
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(verification.verification_data, null, 2)}
              </pre>
            </details>
          )}
      </CardContent>
    </Card>
  );
};

// 🔧 Helper function to get status badge
function getStatusBadge(status: string): JSX.Element {
  switch (status) {
    case 'verified':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-muted text-foreground border-border">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    case 'revoked':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <X className="h-3 w-3 mr-1" />
          Revoked
        </Badge>
      );
    default:
      return <Badge className="bg-muted text-foreground border-border">{status}</Badge>;
  }
}

// 🔧 Helper function to get method badge
function getMethodBadge(method: string): JSX.Element {
  switch (method) {
    case 'http':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-200">
          <Globe className="h-3 w-3 mr-1" />
          HTTP
        </Badge>
      );
    case 'dns':
      return (
        <Badge variant="outline" className="text-purple-600 border-purple-200">
          <Shield className="h-3 w-3 mr-1" />
          DNS
        </Badge>
      );
    case 'manual':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-200">
          Manual
        </Badge>
      );
    default:
      return <Badge variant="outline">{method}</Badge>;
  }
}

export default NIP05Manager;
