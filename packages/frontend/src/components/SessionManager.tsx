import {
  AlertTriangle,
  Clock,
  MapPin,
  Monitor,
  MoreVertical,
  RefreshCw,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
  Wifi,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';

// 🔐 Session Management Types
interface DeviceInfo {
  userAgent: string;
  platform: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  fingerprint: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

interface Session {
  id: string;
  user_id: string;
  jwt_token_hash: string;
  nostr_pubkey: string;
  ip_address: string;
  user_agent: string;
  device_info: DeviceInfo;
  lightning_enabled: boolean;
  lightning_permissions: Record<string, any>;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  active: boolean;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  is_current?: boolean;
  activity_summary?: {
    total_activities: number;
    last_api_call: string;
    most_common_activity: string;
  };
}

interface SessionStats {
  total_active_sessions: number;
  sessions_by_device: Record<string, number>;
  recent_activity: number;
  oldest_session: string;
  most_recent_activity: string;
}

interface SessionManagerProps {
  onSessionRevoked?: (sessionId: string) => void;
  onBulkRevocation?: (count: number) => void;
  className?: string;
}

/**
 * 🔐 Elite Session Manager Component
 * WHY: Comprehensive session monitoring and management with security controls
 */
export const SessionManager: React.FC<SessionManagerProps> = ({
  onSessionRevoked,
  onBulkRevocation,
  className = '',
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showBulkRevokeDialog, setShowBulkRevokeDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'activity' | 'created' | 'device'>('activity');
  const [filterDevice, setFilterDevice] = useState<string>('all');

  // 🔄 Load Sessions Data
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [sessionsResponse, statsResponse] = await Promise.all([
        fetch('/api/sessions', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch('/api/sessions/stats', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!sessionsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to load session data');
      }

      const sessionsData = await sessionsResponse.json();
      const statsData = await statsResponse.json();

      if (!sessionsData.success || !statsData.success) {
        throw new Error(sessionsData.error || statsData.error || 'Session data loading failed');
      }

      setSessions(sessionsData.data.sessions || []);
      setStats(statsData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 🚫 Revoke Single Session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Session revocation failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Session revocation failed');
      }

      // Update local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setShowRevokeDialog(false);
      setSelectedSession(null);

      onSessionRevoked?.(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session revocation failed');
    }
  };

  // 🚫 Revoke All Other Sessions
  const handleRevokeOtherSessions = async () => {
    try {
      const response = await fetch('/api/sessions/revoke-others', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Bulk session revocation failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Bulk session revocation failed');
      }

      // Reload sessions to reflect changes
      await loadSessions();
      setShowBulkRevokeDialog(false);

      onBulkRevocation?.(result.data.revoked_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk session revocation failed');
    }
  };

  // 🔄 Update Session Activity
  const updateSessionActivity = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}/activity`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activity_type: 'page_view' }),
      });
    } catch (err) {
      console.warn('Failed to update session activity:', err);
    }
  };

  // 🎨 Device Icon Helper
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  // 🎨 Device Badge Color
  const getDeviceBadgeColor = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return 'bg-blue-100 text-blue-800';
      case 'tablet':
        return 'bg-purple-100 text-purple-800';
      case 'desktop':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 🔍 Filter and Sort Sessions
  const filteredAndSortedSessions = sessions
    .filter((session) => {
      const matchesSearch =
        session.device_info.browser.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.device_info.os.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.ip_address.includes(searchQuery) ||
        session.location?.city?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDevice =
        filterDevice === 'all' || session.device_info.deviceType === filterDevice;

      return matchesSearch && matchesDevice;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'device':
          return a.device_info.deviceType.localeCompare(b.device_info.deviceType);
        default:
          return 0;
      }
    });

  // 🚀 Initialize Component
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 📊 Session Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Active Sessions</p>
                  <p className="text-2xl font-bold">{stats.total_active_sessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Recent Activity</p>
                  <p className="text-2xl font-bold">{stats.recent_activity}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Monitor className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">Desktop</p>
                  <p className="text-2xl font-bold">{stats.sessions_by_device.desktop || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Smartphone className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">Mobile</p>
                  <p className="text-2xl font-bold">{stats.sessions_by_device.mobile || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🔍 Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Active Sessions</span>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={loadSessions} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkRevokeDialog(true)}
                disabled={sessions.length <= 1}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Revoke Others
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Sessions</Label>
              <Input
                id="search"
                placeholder="Search by browser, OS, IP, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div>
                <Label htmlFor="sort">Sort By</Label>
                <select
                  id="sort"
                  className="w-full p-2 border rounded-md"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="activity">Last Activity</option>
                  <option value="created">Created Date</option>
                  <option value="device">Device Type</option>
                </select>
              </div>
              <div>
                <Label htmlFor="filter">Filter Device</Label>
                <select
                  id="filter"
                  className="w-full p-2 border rounded-md"
                  value={filterDevice}
                  onChange={(e) => setFilterDevice(e.target.value)}
                >
                  <option value="all">All Devices</option>
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                  <option value="tablet">Tablet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Sessions List */}
          <div className="space-y-3">
            {filteredAndSortedSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery || filterDevice !== 'all'
                  ? 'No sessions match your search criteria'
                  : 'No active sessions found'}
              </div>
            ) : (
              filteredAndSortedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRevoke={() => {
                    setSelectedSession(session);
                    setShowRevokeDialog(true);
                  }}
                  onViewDetails={() => setSelectedSession(session)}
                  onUpdateActivity={() => updateSessionActivity(session.id)}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 🚫 Revoke Session Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {getDeviceIcon(selectedSession.device_info.deviceType)}
                <span className="font-medium">
                  {selectedSession.device_info.browser} on {selectedSession.device_info.os}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>IP: {selectedSession.ip_address}</div>
                <div>
                  Last active: {new Date(selectedSession.last_activity_at).toLocaleString()}
                </div>
                {selectedSession.location && (
                  <div>
                    Location: {selectedSession.location.city}, {selectedSession.location.country}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedSession && handleRevokeSession(selectedSession.id)}
            >
              Revoke Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🚫 Bulk Revoke Dialog */}
      <Dialog open={showBulkRevokeDialog} onOpenChange={setShowBulkRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke All Other Sessions</DialogTitle>
            <DialogDescription>
              This will revoke all sessions except your current one. You'll remain logged in on this
              device, but all other devices will be logged out.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-yellow-50 p-4 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">
                This will affect {sessions.filter((s) => !s.is_current).length} sessions
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkRevokeDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeOtherSessions}>
              Revoke All Others
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * 🎴 Session Card Component
 */
interface SessionCardProps {
  session: Session;
  onRevoke: () => void;
  onViewDetails: () => void;
  onUpdateActivity: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onRevoke,
  onViewDetails,
  onUpdateActivity,
}) => {
  const isCurrentSession = session.is_current;
  const lastActivity = new Date(session.last_activity_at);
  const isRecentActivity = Date.now() - lastActivity.getTime() < 5 * 60 * 1000; // 5 minutes

  return (
    <Card
      className={`transition-all hover:shadow-md ${isCurrentSession ? 'ring-2 ring-blue-500' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {React.createElement(
                session.device_info.deviceType === 'mobile'
                  ? Smartphone
                  : session.device_info.deviceType === 'tablet'
                    ? Tablet
                    : Monitor,
                { className: 'h-5 w-5 text-gray-600' }
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {session.device_info.browser} {session.device_info.browserVersion}
                  </span>
                  <Badge className={getDeviceBadgeColor(session.device_info.deviceType)}>
                    {session.device_info.deviceType}
                  </Badge>
                  {isCurrentSession && <Badge variant="default">Current</Badge>}
                  {isRecentActivity && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-green-600">Active</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {session.device_info.os} {session.device_info.osVersion}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right text-sm">
              <div className="flex items-center space-x-1 text-gray-600">
                <MapPin className="h-3 w-3" />
                <span>
                  {session.location?.city}, {session.location?.country}
                </span>
              </div>
              <div className="flex items-center space-x-1 text-gray-600">
                <Wifi className="h-3 w-3" />
                <span>{session.ip_address}</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-600">
                <Clock className="h-3 w-3" />
                <span>{lastActivity.toLocaleString()}</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onViewDetails}>View Details</DropdownMenuItem>
                <DropdownMenuItem onClick={onUpdateActivity}>Update Activity</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRevoke}
                  disabled={isCurrentSession}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revoke Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Session Details */}
        <div className="mt-3 pt-3 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">Created:</span>
              <br />
              {new Date(session.created_at).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Expires:</span>
              <br />
              {new Date(session.expires_at).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Activities:</span>
              <br />
              {session.activity_summary?.total_activities || 0}
            </div>
            <div>
              <span className="font-medium">Lightning:</span>
              <br />
              {session.lightning_enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// 🔧 Helper function to get device badge color
function getDeviceBadgeColor(deviceType: string): string {
  switch (deviceType) {
    case 'mobile':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'tablet':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'desktop':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export default SessionManager;
