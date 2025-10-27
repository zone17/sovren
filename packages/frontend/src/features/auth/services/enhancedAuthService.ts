/**
 * 🔐 **ENHANCED AUTHENTICATION SERVICE - Frontend US-213 Implementation**
 *
 * Elite NOSTR authentication client with multi-device support and analytics
 *
 * **Implementation for US-213: NOSTR Authentication Flow**
 *
 * Features:
 * - Enhanced challenge generation with device registration ✅
 * - Multi-device authentication flows ✅
 * - Session management and refresh ✅
 * - Device management and revocation ✅
 * - Authentication analytics and monitoring ✅
 * - Security alerts and notifications ✅
 * - Comprehensive error handling ✅
 * - Real-time authentication state management ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

import { EventEmitter } from 'events';

// 🎯 Frontend Authentication Types
export interface DeviceInfo {
  deviceId?: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'browser';
  userAgent: string;
  platform: string;
  trusted?: boolean;
  location?: {
    country?: string;
    city?: string;
  };
}

export interface AuthSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  deviceId: string;
  pubkey: string;
}

export interface SecurityAlert {
  alertType:
    | 'suspicious_login'
    | 'multiple_failures'
    | 'unknown_device'
    | 'session_hijack'
    | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  resolved: boolean;
}

export interface AuthAnalytics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueDevices: number;
  averageSessionDuration: number;
  topDeviceTypes: Record<string, number>;
  securityAlerts: SecurityAlert[];
}

export interface EnhancedAuthResponse {
  success: boolean;
  sessionId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  user?: {
    pubkey: string;
    deviceId: string;
    trusted: boolean;
  };
  error?: string;
  securityAlert?: SecurityAlert;
}

// 🔐 Enhanced NOSTR Authentication Service (Frontend)
export class EnhancedAuthService extends EventEmitter {
  private readonly baseUrl: string;
  private currentSession: AuthSession | null = null;
  private refreshTimer?: number;
  private readonly deviceInfo: DeviceInfo;

  constructor(baseUrl: string = '/api/enhanced-auth') {
    super();
    this.baseUrl = baseUrl;
    this.deviceInfo = this.detectDeviceInfo();

    // Restore session from storage
    this.restoreSession();

    // Set up automatic token refresh
    this.setupTokenRefresh();
  }

  /**
   * 🎯 Generate Enhanced Challenge with Device Registration
   */
  async generateChallenge(): Promise<{
    challenge?: string;
    deviceId?: string;
    timestamp?: number;
    expires_at?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceInfo: this.deviceInfo,
          userAgent: navigator.userAgent,
          platform: this.detectPlatform(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          error: result.error || 'Failed to generate challenge',
        };
      }

      return {
        challenge: result.data.challenge,
        deviceId: result.data.deviceId,
        timestamp: result.data.timestamp,
        expires_at: result.data.expires_at,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error during challenge generation',
      };
    }
  }

  /**
   * 🔍 Enhanced Authentication with Multi-Device Support
   */
  async authenticate(params: {
    pubkey: string;
    signature: string;
    challenge: string;
    timestamp: number;
    deviceId: string;
  }): Promise<EnhancedAuthResponse> {
    try {
      const deviceInfo: DeviceInfo = {
        deviceId: params.deviceId,
        deviceName: this.deviceInfo.deviceName,
        deviceType: this.deviceInfo.deviceType,
        userAgent: navigator.userAgent,
        platform: this.detectPlatform(),
        trusted: this.deviceInfo.trusted || false,
      };

      const response = await fetch(`${this.baseUrl}/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pubkey: params.pubkey,
          signature: params.signature,
          challenge: params.challenge,
          timestamp: params.timestamp,
          deviceInfo,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Handle security alerts
        if (result.securityAlert) {
          this.emit('security:alert', result.securityAlert);
        }

        return {
          success: false,
          error: result.error || 'Authentication failed',
          securityAlert: result.securityAlert,
        };
      }

      // Store session information
      const session: AuthSession = {
        sessionId: result.data.sessionId,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        expiresAt: result.data.expiresAt,
        deviceId: params.deviceId,
        pubkey: params.pubkey,
      };

      this.setSession(session);

      // Emit authentication success event
      this.emit('authentication:success', {
        pubkey: params.pubkey,
        deviceId: params.deviceId,
        session,
      });

      return {
        success: true,
        sessionId: result.data.sessionId,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        expiresAt: result.data.expiresAt,
        user: result.data.user,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Network error during authentication';

      this.emit('authentication:error', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 🔄 Session Refresh
   */
  async refreshSession(): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session to refresh' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          refreshToken: this.currentSession.refreshToken,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Clear invalid session
        this.clearSession();

        return {
          success: false,
          error: result.error || 'Session refresh failed',
        };
      }

      // Update session with new tokens
      this.currentSession.accessToken = result.data.accessToken;
      this.currentSession.refreshToken = result.data.refreshToken;
      this.currentSession.expiresAt = result.data.expiresAt;

      this.saveSession();

      this.emit('session:refreshed', this.currentSession);

      return {
        success: true,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        expiresAt: result.data.expiresAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during session refresh',
      };
    }
  }

  /**
   * 📱 Device Management
   */
  async getDevices(): Promise<{
    success: boolean;
    devices?: DeviceInfo[];
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/devices`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve devices',
        };
      }

      return {
        success: true,
        devices: result.data.devices,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during device retrieval',
      };
    }
  }

  async revokeDevice(deviceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to revoke device',
        };
      }

      this.emit('device:revoked', { deviceId });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during device revocation',
      };
    }
  }

  /**
   * 🔐 Session Management
   */
  async getSessions(): Promise<{
    success: boolean;
    sessions?: any[];
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve sessions',
        };
      }

      return {
        success: true,
        sessions: result.data.sessions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during session retrieval',
      };
    }
  }

  async revokeSession(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to revoke session',
        };
      }

      // If revoking current session, clear it
      if (sessionId === this.currentSession.sessionId) {
        this.clearSession();
        this.emit('session:revoked', { sessionId, current: true });
      } else {
        this.emit('session:revoked', { sessionId, current: false });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during session revocation',
      };
    }
  }

  /**
   * 📊 Analytics
   */
  async getAnalytics(): Promise<{
    success: boolean;
    analytics?: AuthAnalytics;
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/analytics`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve analytics',
        };
      }

      return {
        success: true,
        analytics: result.data.analytics,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during analytics retrieval',
      };
    }
  }

  /**
   * 🛡️ Security Monitoring
   */
  async getSecurityAlerts(): Promise<{
    success: boolean;
    alerts?: SecurityAlert[];
    summary?: {
      total: number;
      unresolved: number;
      critical: number;
      high: number;
    };
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/security/alerts`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve security alerts',
        };
      }

      return {
        success: true,
        alerts: result.data.alerts,
        summary: result.data.summary,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Network error during security alerts retrieval',
      };
    }
  }

  /**
   * 🔧 Utility Methods
   */
  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  isAuthenticated(): boolean {
    return this.currentSession !== null && Date.now() < this.currentSession.expiresAt;
  }

  getAccessToken(): string | null {
    return this.currentSession?.accessToken || null;
  }

  logout(): void {
    this.clearSession();
    this.emit('authentication:logout');
  }

  private detectDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent;
    const platform = this.detectPlatform();

    let deviceType: DeviceInfo['deviceType'] = 'browser';
    if (/Mobile|Android|iP(hone|od|ad)/.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/Tablet|iPad/.test(userAgent)) {
      deviceType = 'tablet';
    }

    return {
      deviceName: this.generateDeviceName(deviceType, platform),
      deviceType,
      userAgent,
      platform,
      trusted: false,
    };
  }

  private detectPlatform(): string {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Win')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';

    return 'Unknown';
  }

  private generateDeviceName(deviceType: string, platform: string): string {
    const browser = this.detectBrowser();
    return `${platform} ${deviceType} (${browser})`;
  }

  private detectBrowser(): string {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';

    return 'Unknown Browser';
  }

  private setSession(session: AuthSession): void {
    this.currentSession = session;
    this.saveSession();
    this.setupTokenRefresh();
  }

  private clearSession(): void {
    this.currentSession = null;
    localStorage.removeItem('enhancedAuthSession');
    this.clearRefreshTimer();
  }

  private saveSession(): void {
    if (this.currentSession) {
      localStorage.setItem('enhancedAuthSession', JSON.stringify(this.currentSession));
    }
  }

  private restoreSession(): void {
    try {
      const storedSession = localStorage.getItem('enhancedAuthSession');
      if (storedSession) {
        const session = JSON.parse(storedSession) as AuthSession;

        // Check if session is still valid
        if (Date.now() < session.expiresAt) {
          this.currentSession = session;
          this.setupTokenRefresh();
          this.emit('session:restored', session);
        } else {
          localStorage.removeItem('enhancedAuthSession');
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.removeItem('enhancedAuthSession');
    }
  }

  private setupTokenRefresh(): void {
    this.clearRefreshTimer();

    if (!this.currentSession) return;

    const refreshTime = this.currentSession.expiresAt - Date.now() - 5 * 60 * 1000; // 5 minutes before expiry

    if (refreshTime > 0) {
      this.refreshTimer = window.setTimeout(async () => {
        await this.refreshSession();
      }, refreshTime);
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  destroy(): void {
    this.clearRefreshTimer();
    this.removeAllListeners();
  }
}

// 🏭 Default instance
export const enhancedAuthService = new EnhancedAuthService();
