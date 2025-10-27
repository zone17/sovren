/**
 * 🎭 **ELITE EXTERNAL DEPENDENCY MOCKER**
 *
 * **Purpose**: Comprehensive mocking strategy for external dependencies
 * **Architecture**: Centralized mocking with realistic behavior simulation
 * **Security**: Safe mocking without exposing real credentials
 * **Performance**: Optimized mock responses for fast test execution
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

import { jest } from '@jest/globals';
import { timeoutManager } from './test-timeout-manager';

// 🌍 **EXTERNAL DEPENDENCY TYPES**
export interface MockConfig {
  delay?: number;
  shouldFail?: boolean;
  failureRate?: number;
  errorMessage?: string;
  responseData?: any;
}

export interface MockResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

// 🔧 **EXTERNAL DEPENDENCY MOCKER CLASS**
export class ExternalDependencyMocker {
  private mockConfigs: Map<string, MockConfig> = new Map();
  private callHistory: Map<string, any[]> = new Map();
  private activeInterceptors: Map<string, any> = new Map();

  /**
   * Configure mock behavior for a specific dependency
   */
  public configure(dependency: string, config: MockConfig): void {
    this.mockConfigs.set(dependency, config);
  }

  /**
   * Reset all mock configurations
   */
  public resetAll(): void {
    this.mockConfigs.clear();
    this.callHistory.clear();
    this.activeInterceptors.forEach((interceptor) => {
      if (interceptor.restore) {
        interceptor.restore();
      }
    });
    this.activeInterceptors.clear();
  }

  /**
   * Get call history for a dependency
   */
  public getCallHistory(dependency: string): any[] {
    return this.callHistory.get(dependency) || [];
  }

  /**
   * Record a call to a dependency
   */
  private recordCall(dependency: string, args: any[]): void {
    const history = this.callHistory.get(dependency) || [];
    history.push(args);
    this.callHistory.set(dependency, history);
  }

  /**
   * Create a mock response based on configuration
   */
  private async createMockResponse<T>(
    dependency: string,
    defaultData?: T
  ): Promise<MockResponse<T>> {
    const config = this.mockConfigs.get(dependency) || {};
    const {
      delay = 100,
      shouldFail = false,
      failureRate = 0,
      errorMessage = 'Mock error',
    } = config;

    // Simulate network delay
    if (delay > 0) {
      await timeoutManager.wait(delay);
    }

    // Simulate random failures
    const shouldFailRandomly = Math.random() < failureRate;
    if (shouldFail || shouldFailRandomly) {
      return {
        success: false,
        error: errorMessage,
        status: 500,
      };
    }

    return {
      success: true,
      data: config.responseData || defaultData,
      status: 200,
      headers: { 'content-type': 'application/json' },
    };
  }

  // 📡 **FETCH API MOCKING**
  public mockFetch(): jest.MockedFunction<typeof fetch> {
    const mockFetch = jest.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      this.recordCall('fetch', [url, options]);

      // Determine dependency based on URL
      const dependency = this.getDependencyFromUrl(url);
      const response = await this.createMockResponse(dependency, { message: 'Mock response' });

      if (!response.success) {
        throw new Error(response.error);
      }

      return new Response(JSON.stringify(response.data), {
        status: response.status,
        headers: response.headers,
      });
    });

    global.fetch = mockFetch;
    this.activeInterceptors.set('fetch', mockFetch);
    return mockFetch;
  }

  // 🔌 **WEBSOCKET MOCKING**
  public mockWebSocket(): jest.MockedFunction<typeof WebSocket> {
    const mockWebSocket = jest.fn().mockImplementation((url: string) => {
      this.recordCall('websocket', [url]);

      const ws = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
        protocol: '',
        bufferedAmount: 0,
        extensions: '',
        binaryType: 'blob' as BinaryType,
      };

      // Simulate connection events
      setTimeout(() => {
        if (ws.onopen) {
          ws.onopen({} as Event);
        }
      }, 100);

      return ws;
    });

    global.WebSocket = mockWebSocket as any;
    this.activeInterceptors.set('websocket', mockWebSocket);
    return mockWebSocket;
  }

  // 🗄️ **LOCALSTORAGE MOCKING**
  public mockLocalStorage(): Storage {
    const storage = new Map<string, string>();

    const mockStorage: Storage = {
      getItem: jest.fn((key: string) => {
        this.recordCall('localStorage.getItem', [key]);
        return storage.get(key) || null;
      }),
      setItem: jest.fn((key: string, value: string) => {
        this.recordCall('localStorage.setItem', [key, value]);
        storage.set(key, value);
      }),
      removeItem: jest.fn((key: string) => {
        this.recordCall('localStorage.removeItem', [key]);
        storage.delete(key);
      }),
      clear: jest.fn(() => {
        this.recordCall('localStorage.clear', []);
        storage.clear();
      }),
      key: jest.fn((index: number) => {
        const keys = Array.from(storage.keys());
        return keys[index] || null;
      }),
      length: 0,
    };

    Object.defineProperty(mockStorage, 'length', {
      get: () => storage.size,
    });

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });

    this.activeInterceptors.set('localStorage', mockStorage);
    return mockStorage;
  }

  // 🎯 **GEOLOCATION MOCKING**
  public mockGeolocation(): Geolocation {
    const mockGeolocation: Geolocation = {
      getCurrentPosition: jest.fn((success, error) => {
        this.recordCall('geolocation.getCurrentPosition', [success, error]);

        const config = this.mockConfigs.get('geolocation') || {};
        if (config.shouldFail) {
          if (error) {
            error({
              code: 1,
              message: config.errorMessage || 'Location access denied',
            } as GeolocationPositionError);
          }
        } else {
          if (success) {
            success({
              coords: {
                latitude: 37.7749,
                longitude: -122.4194,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            } as GeolocationPosition);
          }
        }
      }),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    };

    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    this.activeInterceptors.set('geolocation', mockGeolocation);
    return mockGeolocation;
  }

  // 🔔 **NOTIFICATION MOCKING**
  public mockNotification(): typeof Notification {
    const mockNotification = jest
      .fn()
      .mockImplementation((title: string, options?: NotificationOptions) => {
        this.recordCall('notification.constructor', [title, options]);

        return {
          title,
          body: options?.body || '',
          icon: options?.icon || '',
          permission: 'granted',
          close: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        };
      });

    mockNotification.requestPermission = jest.fn().mockResolvedValue('granted');
    mockNotification.permission = 'granted';

    Object.defineProperty(window, 'Notification', {
      value: mockNotification,
      writable: true,
    });

    this.activeInterceptors.set('notification', mockNotification);
    return mockNotification;
  }

  // 🎥 **MEDIA DEVICES MOCKING**
  public mockMediaDevices(): MediaDevices {
    const mockMediaDevices: MediaDevices = {
      getUserMedia: jest.fn().mockImplementation(async (constraints) => {
        this.recordCall('mediaDevices.getUserMedia', [constraints]);

        const config = this.mockConfigs.get('mediaDevices') || {};
        if (config.shouldFail) {
          throw new Error(config.errorMessage || 'Permission denied');
        }

        return {
          id: 'mock-stream',
          active: true,
          getTracks: jest.fn().mockReturnValue([]),
          getVideoTracks: jest.fn().mockReturnValue([]),
          getAudioTracks: jest.fn().mockReturnValue([]),
          addTrack: jest.fn(),
          removeTrack: jest.fn(),
          clone: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        } as MediaStream;
      }),
      getDisplayMedia: jest.fn(),
      enumerateDevices: jest.fn().mockResolvedValue([]),
      getSupportedConstraints: jest.fn().mockReturnValue({}),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      writable: true,
    });

    this.activeInterceptors.set('mediaDevices', mockMediaDevices);
    return mockMediaDevices;
  }

  // 🔍 **INTERSECTION OBSERVER MOCKING**
  public mockIntersectionObserver(): typeof IntersectionObserver {
    const mockIntersectionObserver = jest.fn().mockImplementation((callback) => {
      this.recordCall('intersectionObserver.constructor', [callback]);

      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
        root: null,
        rootMargin: '0px',
        thresholds: [0],
      };
    });

    Object.defineProperty(window, 'IntersectionObserver', {
      value: mockIntersectionObserver,
      writable: true,
    });

    this.activeInterceptors.set('intersectionObserver', mockIntersectionObserver);
    return mockIntersectionObserver;
  }

  // 📐 **RESIZE OBSERVER MOCKING**
  public mockResizeObserver(): typeof ResizeObserver {
    const mockResizeObserver = jest.fn().mockImplementation((callback) => {
      this.recordCall('resizeObserver.constructor', [callback]);

      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });

    Object.defineProperty(window, 'ResizeObserver', {
      value: mockResizeObserver,
      writable: true,
    });

    this.activeInterceptors.set('resizeObserver', mockResizeObserver);
    return mockResizeObserver;
  }

  // 🎨 **CANVAS MOCKING**
  public mockCanvas(): void {
    const mockCanvas = {
      getContext: jest.fn().mockReturnValue({
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        strokeRect: jest.fn(),
        fillText: jest.fn(),
        measureText: jest.fn().mockReturnValue({ width: 100 }),
        drawImage: jest.fn(),
        createImageData: jest.fn(),
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        arc: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        translate: jest.fn(),
        rotate: jest.fn(),
        scale: jest.fn(),
        setTransform: jest.fn(),
        resetTransform: jest.fn(),
      }),
      toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mock'),
      toBlob: jest.fn().mockImplementation((callback) => {
        callback(new Blob(['mock'], { type: 'image/png' }));
      }),
      width: 300,
      height: 150,
    };

    // Mock createElement to return our mock canvas
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn().mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        this.recordCall('canvas.createElement', [tagName]);
        return mockCanvas;
      }
      return originalCreateElement.call(document, tagName);
    });

    this.activeInterceptors.set('canvas', document.createElement);
  }

  // 🌐 **THIRD-PARTY API MOCKING**
  public mockThirdPartyAPI(apiName: string, methods: Record<string, any>): any {
    const mockAPI = {};

    for (const [methodName, mockImplementation] of Object.entries(methods)) {
      mockAPI[methodName] = jest.fn().mockImplementation(async (...args) => {
        this.recordCall(`${apiName}.${methodName}`, args);

        if (typeof mockImplementation === 'function') {
          return mockImplementation(...args);
        }

        return await this.createMockResponse(apiName, mockImplementation);
      });
    }

    this.activeInterceptors.set(apiName, mockAPI);
    return mockAPI;
  }

  // 🔧 **UTILITY METHODS**
  private getDependencyFromUrl(url: string): string {
    if (url.includes('api.stripe.com')) return 'stripe';
    if (url.includes('api.github.com')) return 'github';
    if (url.includes('api.twitter.com')) return 'twitter';
    if (url.includes('api.openai.com')) return 'openai';
    if (url.includes('supabase.co')) return 'supabase';
    if (url.includes('vercel.com')) return 'vercel';
    if (url.includes('/api/')) return 'internal-api';
    return 'external-api';
  }

  /**
   * Create a comprehensive mock setup for common dependencies
   */
  public setupCommonMocks(): void {
    this.mockFetch();
    this.mockWebSocket();
    this.mockLocalStorage();
    this.mockIntersectionObserver();
    this.mockResizeObserver();
    this.mockCanvas();
  }

  /**
   * Verify that a dependency was called with expected arguments
   */
  public expectCalled(dependency: string, expectedArgs?: any[]): void {
    const history = this.getCallHistory(dependency);
    expect(history.length).toBeGreaterThan(0);

    if (expectedArgs) {
      expect(history).toContainEqual(expectedArgs);
    }
  }

  /**
   * Verify that a dependency was NOT called
   */
  public expectNotCalled(dependency: string): void {
    const history = this.getCallHistory(dependency);
    expect(history).toHaveLength(0);
  }

  /**
   * Get statistics about mock usage
   */
  public getUsageStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const [dependency, calls] of this.callHistory.entries()) {
      stats[dependency] = calls.length;
    }

    return stats;
  }
}

// 🌍 **GLOBAL MOCKER INSTANCE**
export const globalMocker = new ExternalDependencyMocker();

// 🧹 **AUTOMATIC CLEANUP**
beforeEach(() => {
  globalMocker.resetAll();
});

afterEach(() => {
  globalMocker.resetAll();
});

// 🎯 **CONVENIENCE FUNCTIONS**

/**
 * Mock a specific external dependency
 */
export function mockDependency(name: string, config: MockConfig = {}): void {
  globalMocker.configure(name, config);
}

/**
 * Mock fetch with specific behavior
 */
export function mockFetchResponse(url: string, response: any, options: MockConfig = {}): void {
  globalMocker.configure(globalMocker['getDependencyFromUrl'](url), {
    ...options,
    responseData: response,
  });
  globalMocker.mockFetch();
}

/**
 * Create a mock that fails intermittently
 */
export function mockFlaky(dependency: string, failureRate: number = 0.1): void {
  globalMocker.configure(dependency, {
    failureRate,
    errorMessage: `Flaky ${dependency} failure`,
  });
}

/**
 * Create a slow mock for testing timeouts
 */
export function mockSlow(dependency: string, delay: number = 5000): void {
  globalMocker.configure(dependency, {
    delay,
    responseData: { message: 'Slow response' },
  });
}

/**
 * Setup mocks for analytics testing
 */
export function setupAnalyticsMocks(): void {
  globalMocker.setupCommonMocks();

  // Mock analytics-specific APIs
  globalMocker.configure('internal-api', {
    delay: 200,
    responseData: { analytics: 'mock_data' },
  });

  globalMocker.configure('external-api', {
    delay: 300,
    responseData: { external: 'mock_data' },
  });
}

// 🎭 **EXPORT MAIN INTERFACE**
export { globalMocker as dependencyMocker, ExternalDependencyMocker };
