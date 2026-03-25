# 🎓 Browser Extension Integration Engineer Training

**Training Module**: US-215 NOSTR Browser Extension Integration
**Target Audience**: Sovren Engineers
**Duration**: 2-3 hours
**Level**: Intermediate to Advanced
**Last Updated**: January 20, 2025

## 📋 **Training Objectives**

By the end of this training, engineers will be able to:

1. **Understand NOSTR Protocol**: Grasp NIP-07 browser extension standards and implementation
2. **Implement Extension Detection**: Build robust extension detection systems with fallback mechanisms
3. **Handle Extension Connections**: Manage connection lifecycle, timeouts, and retry logic
4. **Implement Error Handling**: Create comprehensive error handling with user-friendly recovery
5. **Build Analytics Systems**: Track extension performance and usage metrics
6. **Test Extension Integration**: Write comprehensive tests for extension functionality
7. **Debug Extension Issues**: Troubleshoot and resolve common extension integration problems

---

## 🎯 **Module 1: NOSTR Protocol & Extension Fundamentals**

### **Learning Objectives**

- Understand NOSTR protocol basics and NIP-07 standard
- Learn about popular NOSTR extensions (nos2x, Alby)
- Understand extension capabilities and limitations

### **Key Concepts**

#### **NOSTR Protocol Overview**

NOSTR (Notes and Other Stuff Transmitted by Relays) is a simple, open protocol that enables censorship-resistant social networking and communication.

```typescript
// Core NOSTR Event Structure
interface NostrEvent {
  id?: string; // Event ID (hash of serialized event)
  pubkey?: string; // Author's public key (32-byte hex)
  created_at?: number; // Unix timestamp
  kind: number; // Event type (0=metadata, 1=text note, etc.)
  tags: string[][]; // Event tags (references, hashtags, etc.)
  content: string; // Event content
  sig?: string; // Signature (64-byte hex)
}
```

#### **NIP-07 Browser Extension Standard**

NIP-07 defines the standard interface that NOSTR browser extensions must implement:

```typescript
// Standard NIP-07 Interface
interface NostrExtension {
  // Core methods (required)
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;

  // Optional encryption methods
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };

  // Optional NIP-44 encryption
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}
```

#### **Extension Capabilities Matrix**

| Extension | Get Public Key | Sign Events | NIP-04 | NIP-44 | Lightning | WebLN |
| --------- | -------------- | ----------- | ------ | ------ | --------- | ----- |
| nos2x     | ✅             | ✅          | ✅     | ❌     | ❌        | ❌    |
| Alby      | ✅             | ✅          | ✅     | ✅     | ✅        | ✅    |
| Generic   | ✅             | ✅          | ❓     | ❓     | ❌        | ❌    |

### **Hands-On Exercise 1: Basic Extension Detection**

```typescript
// Exercise: Implement basic extension detection
async function detectNostrExtension(): Promise<boolean> {
  // TODO: Check if window.nostr exists
  // TODO: Verify getPublicKey method is available
  // TODO: Handle async loading of extensions
  // TODO: Return true if extension detected, false otherwise
}

// Solution will be provided during training
```

---

## 🔧 **Module 2: Extension Detection Implementation**

### **Learning Objectives**

- Implement robust extension detection with timeout handling
- Understand extension loading patterns and timing issues
- Build priority-based extension selection

### **Core Implementation Patterns**

#### **Detection with Timeout**

```typescript
class ExtensionDetector {
  private readonly DETECTION_TIMEOUT = 2000;

  async detectExtension(extensionId: string, validator: () => boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Detection timeout for ${extensionId}`);
        resolve(false);
      }, this.DETECTION_TIMEOUT);

      // Check if already available
      if (validator()) {
        clearTimeout(timeout);
        resolve(true);
        return;
      }

      // Poll for extension loading
      const pollInterval = setInterval(() => {
        if (validator()) {
          clearTimeout(timeout);
          clearInterval(pollInterval);
          resolve(true);
        }
      }, 100);
    });
  }
}
```

#### **nos2x Detection Implementation**

```typescript
async function detectNos2x(): Promise<ExtensionInfo | null> {
  const isAvailable = await this.detectExtension('nos2x', () => {
    return (
      typeof window !== 'undefined' &&
      window.nostr &&
      typeof window.nostr.getPublicKey === 'function'
    );
  });

  if (!isAvailable) return null;

  // Test capabilities
  const capabilities = await this.testNos2xCapabilities();

  return {
    id: 'nos2x',
    name: 'nos2x',
    capabilities,
    priority: 80, // High priority for nos2x
    performance: {
      averageResponseTime: 0,
      successRate: 100,
      errorCount: 0,
    },
  };
}

async function testNos2xCapabilities(): Promise<ExtensionCapability[]> {
  const capabilities: ExtensionCapability[] = [];

  try {
    // Test getPublicKey
    if (typeof window.nostr.getPublicKey === 'function') {
      capabilities.push(ExtensionCapability.GET_PUBLIC_KEY);
    }

    // Test signEvent
    if (typeof window.nostr.signEvent === 'function') {
      capabilities.push(ExtensionCapability.SIGN_EVENT);
    }

    // Test NIP-04 encryption
    if (window.nostr.nip04?.encrypt && window.nostr.nip04?.decrypt) {
      capabilities.push(ExtensionCapability.ENCRYPT, ExtensionCapability.DECRYPT);
    }
  } catch (error) {
    console.warn('Error testing nos2x capabilities:', error);
  }

  return capabilities;
}
```

#### **Alby Detection with Lightning Support**

```typescript
async function detectAlby(): Promise<ExtensionInfo | null> {
  const isAvailable = await this.detectExtension('alby', () => {
    return (
      typeof window !== 'undefined' &&
      ((window.nostr && typeof window.nostr.getPublicKey === 'function') ||
        (window.webln && typeof window.webln.enable === 'function'))
    );
  });

  if (!isAvailable) return null;

  const capabilities = await this.testAlbyCapabilities();

  return {
    id: 'alby',
    name: 'Alby',
    capabilities,
    priority: 90, // Highest priority due to Lightning support
    performance: {
      averageResponseTime: 0,
      successRate: 100,
      errorCount: 0,
    },
  };
}

async function testAlbyCapabilities(): Promise<ExtensionCapability[]> {
  const capabilities: ExtensionCapability[] = [];

  try {
    // Test NOSTR capabilities
    if (window.nostr?.getPublicKey) {
      capabilities.push(ExtensionCapability.GET_PUBLIC_KEY);
    }
    if (window.nostr?.signEvent) {
      capabilities.push(ExtensionCapability.SIGN_EVENT);
    }

    // Test Lightning capabilities
    if (window.webln?.sendPayment) {
      capabilities.push(ExtensionCapability.LIGHTNING_PAYMENT);
    }
    if (window.webln?.makeInvoice) {
      capabilities.push(ExtensionCapability.LIGHTNING_INVOICE);
    }
  } catch (error) {
    console.warn('Error testing Alby capabilities:', error);
  }

  return capabilities;
}
```

### **Hands-On Exercise 2: Extension Priority System**

```typescript
// Exercise: Implement extension prioritization
function prioritizeExtensions(extensions: ExtensionInfo[]): ExtensionInfo[] {
  // TODO: Sort extensions by priority
  // TODO: Consider capabilities in priority calculation
  // TODO: Handle tie-breaking for same priority

  return extensions; // Placeholder
}

// Bonus: Add performance-based priority adjustment
function adjustPriorityByPerformance(extension: ExtensionInfo): number {
  // TODO: Factor in success rate and response time
  // TODO: Return adjusted priority score

  return extension.priority; // Placeholder
}
```

---

## 🔌 **Module 3: Connection Management & Error Handling**

### **Learning Objectives**

- Implement robust connection management with retry logic
- Handle various error scenarios gracefully
- Build user-friendly error messages and recovery options

### **Connection Management Patterns**

#### **Connection with Retry Logic**

```typescript
class ConnectionManager {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000;

  async connectWithRetry(extensionId: string): Promise<ConnectedExtension> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`Connection attempt ${attempt} for ${extensionId}`);

        const connection = await this.attemptConnection(extensionId);

        // Verify connection is working
        await this.verifyConnection(connection);

        console.log(`Successfully connected to ${extensionId}`);
        return connection;
      } catch (error) {
        lastError = error;
        console.warn(`Connection attempt ${attempt} failed:`, error.message);

        if (attempt < this.MAX_RETRIES) {
          const delay = this.calculateBackoffDelay(attempt);
          console.log(`Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw new ExtensionError(
      `Failed to connect after ${this.MAX_RETRIES} attempts`,
      ExtensionErrorCode.CONNECTION_FAILED,
      { extensionId, attempts: this.MAX_RETRIES, lastError }
    );
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.BASE_DELAY * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1s jitter
    return Math.min(exponentialDelay + jitter, 10000); // Cap at 10s
  }

  private async verifyConnection(connection: ConnectedExtension): Promise<void> {
    try {
      // Test basic functionality
      const publicKey = await connection.getPublicKey();
      if (!this.isValidPublicKey(publicKey)) {
        throw new Error('Invalid public key received');
      }
    } catch (error) {
      throw new ExtensionError(
        'Connection verification failed',
        ExtensionErrorCode.INVALID_RESPONSE,
        { error: error.message }
      );
    }
  }
}
```

#### **Comprehensive Error Handling**

```typescript
enum ExtensionErrorCode {
  EXTENSION_NOT_FOUND = 'EXTENSION_NOT_FOUND',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  USER_REJECTED = 'USER_REJECTED',
  VERSION_INCOMPATIBLE = 'VERSION_INCOMPATIBLE',
  RATE_LIMITED = 'RATE_LIMITED',
}

class ExtensionError extends Error {
  constructor(
    message: string,
    public code: ExtensionErrorCode,
    public details?: Record<string, any>,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ExtensionError';
  }

  getUserMessage(): string {
    switch (this.code) {
      case ExtensionErrorCode.EXTENSION_NOT_FOUND:
        return 'No NOSTR extension found. Please install nos2x or Alby.';
      case ExtensionErrorCode.PERMISSION_DENIED:
        return 'Permission denied. Please check your extension settings.';
      case ExtensionErrorCode.CONNECTION_TIMEOUT:
        return 'Connection timed out. Please try again.';
      case ExtensionErrorCode.USER_REJECTED:
        return 'Authentication was cancelled. Please try again.';
      default:
        return 'Extension error occurred. Please try again or use manual authentication.';
    }
  }

  getRecoveryActions(): string[] {
    switch (this.code) {
      case ExtensionErrorCode.EXTENSION_NOT_FOUND:
        return [
          'Install nos2x or Alby extension',
          'Refresh the page after installation',
          'Use manual authentication as fallback',
        ];
      case ExtensionErrorCode.PERMISSION_DENIED:
        return [
          'Check extension settings and permissions',
          'Re-authorize Sovren in your extension',
          'Try disconnecting and reconnecting',
        ];
      case ExtensionErrorCode.CONNECTION_TIMEOUT:
        return [
          'Refresh the page and try again',
          'Check your internet connection',
          'Restart your browser if issue persists',
        ];
      default:
        return ['Try again', 'Use manual authentication'];
    }
  }
}
```

### **Hands-On Exercise 3: Error Recovery Implementation**

```typescript
// Exercise: Implement error recovery component
interface ErrorRecoveryProps {
  error: ExtensionError;
  onRetry: () => void;
  onFallback: () => void;
}

function ErrorRecovery({ error, onRetry, onFallback }: ErrorRecoveryProps) {
  // TODO: Display user-friendly error message
  // TODO: Show recovery actions
  // TODO: Provide retry and fallback buttons
  // TODO: Include troubleshooting links

  return <div>Error Recovery Component</div>; // Placeholder
}
```

---

## 📊 **Module 4: Analytics & Performance Monitoring**

### **Learning Objectives**

- Implement comprehensive analytics tracking
- Monitor extension performance and reliability
- Build performance optimization strategies

### **Analytics Implementation**

#### **Performance Monitoring**

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>();
  private readonly MAX_METRICS = 100;

  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const timestamp = Date.now();

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      this.recordMetric(operation, {
        timestamp,
        duration,
        success: true,
        context,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.recordMetric(operation, {
        timestamp,
        duration,
        success: false,
        error: error.message,
        context,
      });

      throw error;
    }
  }

  private recordMetric(operation: string, metric: PerformanceMetric): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);

    // Keep only recent metrics
    if (operationMetrics.length > this.MAX_METRICS) {
      operationMetrics.splice(0, operationMetrics.length - this.MAX_METRICS);
    }
  }

  getAnalytics(operation?: string): Analytics {
    if (operation) {
      return this.getOperationAnalytics(operation);
    }

    return this.getOverallAnalytics();
  }

  private getOperationAnalytics(operation: string): Analytics {
    const metrics = this.metrics.get(operation) || [];
    const successful = metrics.filter((m) => m.success);
    const failed = metrics.filter((m) => !m.success);

    return {
      totalOperations: metrics.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      successRate: metrics.length > 0 ? (successful.length / metrics.length) * 100 : 0,
      averageResponseTime:
        successful.length > 0
          ? successful.reduce((sum, m) => sum + m.duration, 0) / successful.length
          : 0,
      p95ResponseTime: this.calculatePercentile(
        successful.map((m) => m.duration),
        95
      ),
      errorDistribution: this.getErrorDistribution(failed),
    };
  }
}
```

#### **Usage Analytics**

```typescript
class UsageAnalytics {
  private events: AnalyticsEvent[] = [];

  trackExtensionDetected(extensionId: string, capabilities: string[]): void {
    this.trackEvent('extension_detected', {
      extensionId,
      capabilities,
      timestamp: Date.now(),
    });
  }

  trackConnectionAttempt(extensionId: string): void {
    this.trackEvent('connection_attempt', {
      extensionId,
      timestamp: Date.now(),
    });
  }

  trackConnectionSuccess(extensionId: string, duration: number): void {
    this.trackEvent('connection_success', {
      extensionId,
      duration,
      timestamp: Date.now(),
    });
  }

  trackConnectionFailure(extensionId: string, error: string): void {
    this.trackEvent('connection_failure', {
      extensionId,
      error,
      timestamp: Date.now(),
    });
  }

  trackFallbackActivated(reason: string): void {
    this.trackEvent('fallback_activated', {
      reason,
      timestamp: Date.now(),
    });
  }

  private trackEvent(eventType: string, data: Record<string, any>): void {
    this.events.push({
      type: eventType,
      data,
      timestamp: Date.now(),
    });

    // Send to analytics service (implementation depends on your analytics stack)
    this.sendToAnalytics(eventType, data);
  }

  getUsageReport(): UsageReport {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recentEvents = this.events.filter((e) => e.timestamp > last24h);

    return {
      totalEvents: recentEvents.length,
      extensionDetections: recentEvents.filter((e) => e.type === 'extension_detected').length,
      connectionAttempts: recentEvents.filter((e) => e.type === 'connection_attempt').length,
      successfulConnections: recentEvents.filter((e) => e.type === 'connection_success').length,
      failedConnections: recentEvents.filter((e) => e.type === 'connection_failure').length,
      fallbackActivations: recentEvents.filter((e) => e.type === 'fallback_activated').length,
      mostUsedExtension: this.getMostUsedExtension(recentEvents),
    };
  }
}
```

### **Hands-On Exercise 4: Performance Dashboard**

```typescript
// Exercise: Build a performance monitoring component
interface PerformanceDashboardProps {
  analytics: Analytics;
  usageReport: UsageReport;
}

function PerformanceDashboard({ analytics, usageReport }: PerformanceDashboardProps) {
  // TODO: Display key performance metrics
  // TODO: Show success/failure rates
  // TODO: Display response time charts
  // TODO: Show extension usage distribution

  return <div>Performance Dashboard</div>; // Placeholder
}
```

---

## 🧪 **Module 5: Testing Strategies**

### **Learning Objectives**

- Write comprehensive unit tests for extension integration
- Implement integration tests for extension flows
- Test error scenarios and edge cases
- Build end-to-end tests for user workflows

### **Unit Testing Patterns**

#### **Service Testing**

```typescript
import { BrowserExtensionService } from '@/services/browser-extension-service';

describe('BrowserExtensionService', () => {
  let service: BrowserExtensionService;
  let mockWindow: any;

  beforeEach(() => {
    // Create clean mock environment
    mockWindow = {
      nostr: undefined,
      webln: undefined,
    };
    global.window = mockWindow;

    service = new BrowserExtensionService({
      timeout: 1000, // Shorter timeout for tests
      retryAttempts: 2,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.destroy(); // Clean up event listeners
  });

  describe('detectExtensions', () => {
    it('should detect nos2x extension when available', async () => {
      // Arrange
      mockWindow.nostr = {
        getPublicKey: jest.fn().mockResolvedValue('test-pubkey'),
        signEvent: jest.fn(),
      };

      // Act
      const extensions = await service.detectExtensions();

      // Assert
      expect(extensions).toHaveLength(1);
      expect(extensions[0].id).toBe('nos2x');
      expect(extensions[0].capabilities).toContain('getPublicKey');
    });

    it('should detect Alby extension with Lightning capabilities', async () => {
      // Arrange
      mockWindow.nostr = {
        getPublicKey: jest.fn().mockResolvedValue('test-pubkey'),
        signEvent: jest.fn(),
      };
      mockWindow.webln = {
        enable: jest.fn().mockResolvedValue(true),
        sendPayment: jest.fn(),
        makeInvoice: jest.fn(),
      };

      // Act
      const extensions = await service.detectExtensions();

      // Assert
      expect(extensions).toHaveLength(1);
      expect(extensions[0].id).toBe('alby');
      expect(extensions[0].capabilities).toContain('webln.sendPayment');
    });

    it('should return empty array when no extensions available', async () => {
      // Act
      const extensions = await service.detectExtensions();

      // Assert
      expect(extensions).toHaveLength(0);
    });

    it('should handle extension detection timeout', async () => {
      // Arrange - Extension loads slowly
      setTimeout(() => {
        mockWindow.nostr = { getPublicKey: jest.fn() };
      }, 2000); // Longer than test timeout

      // Act
      const extensions = await service.detectExtensions();

      // Assert
      expect(extensions).toHaveLength(0);
    });
  });

  describe('connectToExtension', () => {
    beforeEach(() => {
      mockWindow.nostr = {
        getPublicKey: jest.fn().mockResolvedValue('test-pubkey'),
        signEvent: jest.fn().mockResolvedValue({ sig: 'test-signature' }),
      };
    });

    it('should successfully connect to extension', async () => {
      // Act
      const connection = await service.connectToExtension('nos2x');

      // Assert
      expect(connection.id).toBe('nos2x');
      expect(typeof connection.getPublicKey).toBe('function');
      expect(typeof connection.signEvent).toBe('function');
    });

    it('should retry on connection failure', async () => {
      // Arrange - First call fails, second succeeds
      mockWindow.nostr.getPublicKey
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce('test-pubkey');

      // Act
      const connection = await service.connectToExtension('nos2x');

      // Assert
      expect(connection.id).toBe('nos2x');
      expect(mockWindow.nostr.getPublicKey).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      // Arrange
      mockWindow.nostr.getPublicKey.mockRejectedValue(new Error('Persistent failure'));

      // Act & Assert
      await expect(service.connectToExtension('nos2x')).rejects.toThrow('Failed to connect');
    });
  });
});
```

#### **Component Testing**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExtensionSelector } from '@/components/auth/ExtensionSelector';

describe('ExtensionSelector', () => {
  const defaultProps = {
    onExtensionSelected: jest.fn(),
    onFallbackActivated: jest.fn(),
    onError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display loading state initially', () => {
    render(<ExtensionSelector {...defaultProps} />);

    expect(screen.getByText('Detecting NOSTR extensions...')).toBeInTheDocument();
  });

  it('should display detected extensions', async () => {
    // Mock successful extension detection
    global.window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue('test-pubkey')
    };

    render(<ExtensionSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('nos2x detected')).toBeInTheDocument();
    });
  });

  it('should handle extension connection', async () => {
    global.window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue('test-pubkey'),
      signEvent: jest.fn().mockResolvedValue({ sig: 'test-sig' })
    };

    render(<ExtensionSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Connect to nos2x')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Connect to nos2x'));

    await waitFor(() => {
      expect(defaultProps.onExtensionSelected).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'nos2x' })
      );
    });
  });

  it('should show fallback when no extensions detected', async () => {
    render(<ExtensionSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No extensions detected')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(defaultProps.onFallbackActivated).toHaveBeenCalledWith(
      'No extensions detected'
    );
  });
});
```

### **Hands-On Exercise 5: Error Scenario Testing**

```typescript
// Exercise: Write tests for error scenarios
describe('ExtensionSelector Error Handling', () => {
  it('should handle permission denied errors', async () => {
    // TODO: Mock permission denied scenario
    // TODO: Verify error handling
    // TODO: Check user-friendly error message
  });

  it('should handle connection timeout', async () => {
    // TODO: Mock timeout scenario
    // TODO: Verify retry behavior
    // TODO: Check fallback activation
  });

  it('should handle invalid extension responses', async () => {
    // TODO: Mock invalid response
    // TODO: Verify error detection
    // TODO: Check error reporting
  });
});
```

---

## 🛠 **Module 6: Debugging & Troubleshooting**

### **Learning Objectives**

- Use browser developer tools for extension debugging
- Implement comprehensive logging for troubleshooting
- Diagnose and resolve common integration issues

### **Debugging Techniques**

#### **Browser Console Debugging**

```typescript
class ExtensionDebugger {
  private debug: boolean;

  constructor(debug: boolean = process.env.NODE_ENV === 'development') {
    this.debug = debug;
  }

  log(category: string, message: string, data?: any): void {
    if (!this.debug) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [EXTENSION-${category.toUpperCase()}]`;

    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  logDetection(extensionId: string, detected: boolean, capabilities?: string[]): void {
    this.log('DETECTION', `${extensionId} ${detected ? 'detected' : 'not found'}`, {
      extensionId,
      detected,
      capabilities,
    });
  }

  logConnection(extensionId: string, success: boolean, error?: Error): void {
    this.log('CONNECTION', `${extensionId} connection ${success ? 'successful' : 'failed'}`, {
      extensionId,
      success,
      error: error?.message,
    });
  }

  logPerformance(operation: string, duration: number, success: boolean): void {
    this.log('PERFORMANCE', `${operation} completed in ${duration}ms`, {
      operation,
      duration,
      success,
    });
  }

  // Global debug helpers for browser console
  installGlobalDebugHelpers(): void {
    if (typeof window === 'undefined') return;

    (window as any).sovrenDebug = {
      checkExtensions: () => {
        console.table({
          nos2x: {
            available: !!window.nostr,
            getPublicKey: typeof window.nostr?.getPublicKey,
            signEvent: typeof window.nostr?.signEvent,
          },
          alby: {
            nostrAvailable: !!window.nostr,
            weblnAvailable: !!window.webln,
            weblnEnabled: typeof window.webln?.enable,
          },
        });
      },
      testExtension: async (extensionId: string) => {
        try {
          const service = new BrowserExtensionService();
          const connection = await service.connectToExtension(extensionId);
          const pubkey = await connection.getPublicKey();
          console.log(`✅ ${extensionId} working, pubkey: ${pubkey}`);
        } catch (error) {
          console.error(`❌ ${extensionId} failed:`, error);
        }
      },
    };

    console.log(
      '🔧 Sovren debug helpers installed. Use sovrenDebug.checkExtensions() or sovrenDebug.testExtension("nos2x")'
    );
  }
}
```

#### **Common Issues Diagnosis**

```typescript
class IssueDiagnostic {
  static async diagnoseExtensionIssues(): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      browserInfo: this.getBrowserInfo(),
      issues: [],
      recommendations: [],
    };

    // Check for common issues
    await this.checkExtensionAvailability(report);
    await this.checkPermissions(report);
    await this.checkNetworkConnectivity(report);
    await this.checkPerformanceIssues(report);

    return report;
  }

  private static async checkExtensionAvailability(report: DiagnosticReport): Promise<void> {
    // Check if extensions are installed
    if (!window.nostr && !window.webln) {
      report.issues.push({
        category: 'Extension',
        severity: 'High',
        message: 'No NOSTR extensions detected',
        details: 'Neither nos2x nor Alby extensions are available',
      });
      report.recommendations.push('Install nos2x or Alby browser extension');
    }

    // Check extension functionality
    if (window.nostr) {
      try {
        await window.nostr.getPublicKey();
      } catch (error) {
        report.issues.push({
          category: 'Extension',
          severity: 'Medium',
          message: 'Extension not responding',
          details: error.message,
        });
        report.recommendations.push('Check extension permissions and try refreshing the page');
      }
    }
  }

  private static getBrowserInfo(): BrowserInfo {
    return {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    };
  }
}
```

### **Hands-On Exercise 6: Troubleshooting Workflow**

```typescript
// Exercise: Create a troubleshooting component
interface TroubleshootingProps {
  issue: 'detection' | 'connection' | 'permission' | 'performance';
}

function TroubleshootingPanel({ issue }: TroubleshootingProps) {
  // TODO: Display issue-specific diagnostic information
  // TODO: Provide step-by-step resolution guidance
  // TODO: Include links to documentation and support
  // TODO: Allow running automated diagnostics

  return <div>Troubleshooting Panel</div>; // Placeholder
}
```

---

## 🎯 **Module 7: Best Practices & Code Quality**

### **Learning Objectives**

- Apply code quality standards to extension integration
- Implement security best practices
- Follow performance optimization guidelines
- Maintain comprehensive documentation

### **Code Quality Standards**

#### **TypeScript Best Practices**

```typescript
// ✅ Good: Proper type definitions
interface ExtensionConnection {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly ExtensionCapability[];

  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedNostrEvent): Promise<SignedNostrEvent>;
  encrypt?(pubkey: HexString, plaintext: string): Promise<EncryptedMessage>;
}

// ❌ Bad: Any types and mutable data
interface ExtensionConnection {
  id: any;
  capabilities: any[];
  methods: any;
}

// ✅ Good: Error handling with specific types
async function connectToExtension(id: string): Promise<ExtensionConnection> {
  try {
    const connection = await this.establishConnection(id);
    return connection;
  } catch (error) {
    if (error instanceof PermissionError) {
      throw new ExtensionError('Permission denied by user', ExtensionErrorCode.PERMISSION_DENIED, {
        extensionId: id,
      });
    }
    throw error;
  }
}

// ❌ Bad: Generic error handling
async function connectToExtension(id: string): Promise<any> {
  try {
    return await this.establishConnection(id);
  } catch (error) {
    console.error(error);
    return null;
  }
}
```

#### **Security Best Practices**

```typescript
class SecurityValidation {
  // Validate public keys
  static isValidNostrPublicKey(pubkey: string): boolean {
    return /^[a-f0-9]{64}$/i.test(pubkey);
  }

  // Validate signatures
  static isValidNostrSignature(signature: string): boolean {
    return /^[a-f0-9]{128}$/i.test(signature);
  }

  // Sanitize event content
  static sanitizeEventContent(content: string): string {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:(?!image\/)/gi, '')
      .trim();
  }

  // Validate event structure
  static validateNostrEvent(event: any): event is NostrEvent {
    return (
      typeof event === 'object' &&
      typeof event.kind === 'number' &&
      Array.isArray(event.tags) &&
      typeof event.content === 'string' &&
      (!event.pubkey || this.isValidNostrPublicKey(event.pubkey)) &&
      (!event.sig || this.isValidNostrSignature(event.sig))
    );
  }
}
```

#### **Performance Optimization**

```typescript
class PerformanceOptimization {
  // Debounce extension detection
  private detectionDebounce = this.debounce(this.detectExtensions.bind(this), 500);

  // Cache extension information
  private extensionCache = new Map<string, { data: ExtensionInfo; expires: number }>();

  async getExtensionInfo(id: string): Promise<ExtensionInfo | null> {
    const cached = this.extensionCache.get(id);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    const info = await this.fetchExtensionInfo(id);
    if (info) {
      this.extensionCache.set(id, {
        data: info,
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      });
    }

    return info;
  }

  // Optimize DOM queries
  private static memo = new Map<string, Element | null>();

  private memoizedQuerySelector(selector: string): Element | null {
    if (!PerformanceOptimization.memo.has(selector)) {
      PerformanceOptimization.memo.set(selector, document.querySelector(selector));
    }
    return PerformanceOptimization.memo.get(selector)!;
  }

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
}
```

### **Final Exercise: Code Review Checklist**

```typescript
// Exercise: Review this code and identify issues
class ExtensionManager {
  async connect(id) {
    try {
      const ext = window[id];
      const key = await ext.getPublicKey();
      return { id, key };
    } catch (e) {
      console.log('error');
      return null;
    }
  }

  detectAll() {
    const extensions = [];
    if (window.nostr) extensions.push('nostr');
    if (window.webln) extensions.push('webln');
    return extensions;
  }
}

// TODO: Identify and fix the following issues:
// 1. Type safety issues
// 2. Error handling problems
// 3. Security concerns
// 4. Performance issues
// 5. Code clarity problems
```

---

## 📚 **Training Resources & References**

### **Essential Documentation**

1. **[NIP-07 Specification](https://github.com/nostr-protocol/nips/blob/master/07.md)**: Browser extension standard
2. **[nos2x Documentation](https://github.com/fiatjaf/nos2x)**: Popular NOSTR extension
3. **[Alby Documentation](https://github.com/getAlby/lightning-browser-extension)**: Lightning & NOSTR extension
4. **[WebLN Specification](https://webln.guide/)**: Lightning Network browser API

### **Sovren-Specific Guides**

1. **[Browser Extension Setup Guide](../user-guides/browser-extension-setup-guide.md)**: User setup instructions
2. **[Troubleshooting Guide](../user-guides/troubleshooting-guide.md)**: Issue resolution procedures
3. **[Developer Integration Guide](../user-guides/extension-integration-developer-guide.md)**: Technical implementation
4. **[Browser Extension Integration](../features/browser-extension-integration.md)**: Feature overview

### **Code Examples Repository**

```bash
# Access training examples
git clone https://github.com/sovren/extension-integration-examples
cd extension-integration-examples
npm install
npm run examples
```

### **Testing Environment Setup**

```bash
# Set up local testing environment
npm install
npm run test:extensions
npm run storybook  # View component examples
```

---

## ✅ **Training Completion Checklist**

### **Knowledge Assessment**

- [ ] **NOSTR Protocol Understanding**: Can explain NIP-07 standard and browser extension architecture
- [ ] **Extension Detection**: Can implement robust detection with timeout and retry logic
- [ ] **Connection Management**: Can handle connection lifecycle with proper error handling
- [ ] **Error Handling**: Can create user-friendly error messages and recovery workflows
- [ ] **Analytics Implementation**: Can build performance monitoring and usage tracking
- [ ] **Testing Proficiency**: Can write comprehensive unit, integration, and E2E tests
- [ ] **Debugging Skills**: Can diagnose and resolve common extension integration issues

### **Practical Skills Demonstration**

- [ ] **Code Implementation**: Successfully complete all hands-on exercises
- [ ] **Code Review**: Can identify and fix code quality issues
- [ ] **Troubleshooting**: Can resolve real-world integration problems
- [ ] **Documentation**: Can write clear technical documentation and user guides

### **Next Steps**

After completing this training:

1. **Apply Learning**: Implement extension integration in your current projects
2. **Share Knowledge**: Mentor other team members on extension integration
3. **Contribute**: Submit improvements to the extension integration codebase
4. **Stay Updated**: Monitor NOSTR protocol updates and new extension releases

---

## 🎓 **Certification**

**Training Module**: Browser Extension Integration (US-215)
**Completion Date**: **\*\***\_\_\_\_**\*\***
**Engineer**: **\*\***\_\_\_\_**\*\***
**Instructor**: **\*\***\_\_\_\_**\*\***

**Skills Demonstrated**:

- ✅ NOSTR Protocol & NIP-07 Understanding
- ✅ Extension Detection Implementation
- ✅ Connection Management & Error Handling
- ✅ Analytics & Performance Monitoring
- ✅ Testing & Debugging
- ✅ Code Quality & Best Practices

**Certification Level**: Elite Engineering Standards Achieved

---

**Questions or Need Support?**

- **Development Team**: #sovren-dev Slack channel
- **Training Support**: training@sovren.app
- **Technical Issues**: dev-support@sovren.app
