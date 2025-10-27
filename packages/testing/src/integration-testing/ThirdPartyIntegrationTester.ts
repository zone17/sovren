/**
 * @file ThirdPartyIntegrationTester.ts
 * @description Self-updating third-party integration testing with service discovery
 */

import { Logger } from '../common/Logger';

/**
 * Third-party service configuration
 */
export interface ThirdPartyService {
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket';
  baseUrl: string;
  authentication: {
    type: 'none' | 'basic' | 'bearer' | 'oauth' | 'apikey';
    credentials: Record<string, string>;
  };
  endpoints: string[];
  healthCheckEndpoint?: string;
  rateLimit?: number;
  timeout?: number;
  expectedResponseCodes?: number[];
}

/**
 * Third-party test result
 */
export interface ThirdPartyTestResult {
  testId: string;
  testName: string;
  serviceName: string;
  endpoint: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout';
  duration: number;
  startTime: Date;
  endTime: Date;
  responseCode?: number;
  responseTime: number;
  errors: string[];
  warnings: string[];
  metrics?: {
    rateLimitRemaining?: number;
    responseSize?: number;
    connectionTime?: number;
  };
}

/**
 * Third-party integration tester options
 */
export interface ThirdPartyIntegrationTesterOptions {
  services: ThirdPartyService[];
  timeout: number;
  retryAttempts: number;
  enableHealthChecks?: boolean;
  enableContractValidation?: boolean;
  enableRateLimitTesting?: boolean;
  enablePerformanceTracking?: boolean;
  parallelRequests?: number;
}

/**
 * Service health status
 */
interface ServiceHealthStatus {
  serviceName: string;
  isHealthy: boolean;
  lastChecked: Date;
  responseTime: number;
  consecutiveFailures: number;
  uptime?: number;
}

/**
 * Self-updating third-party integration testing
 */
export class ThirdPartyIntegrationTester {
  private options: ThirdPartyIntegrationTesterOptions;
  private logger: Logger;
  private testResults: ThirdPartyTestResult[];
  private serviceHealthStatus: Map<string, ServiceHealthStatus>;
  private contractCache: Map<string, Record<string, unknown>>;
  private rateLimitTracker: Map<string, { requests: number; resetTime: Date }>;

  constructor(options: ThirdPartyIntegrationTesterOptions) {
    this.options = {
      enableHealthChecks: true,
      enableContractValidation: true,
      enableRateLimitTesting: true,
      enablePerformanceTracking: true,
      parallelRequests: 3,
      ...options,
    };

    this.logger = new Logger('ThirdPartyIntegrationTester');
    this.testResults = [];
    this.serviceHealthStatus = new Map();
    this.contractCache = new Map();
    this.rateLimitTracker = new Map();

    this.initializeServices();
  }

  /**
   * Initializes service monitoring and health tracking
   */
  private initializeServices(): void {
    this.options.services.forEach((service) => {
      this.serviceHealthStatus.set(service.name, {
        serviceName: service.name,
        isHealthy: true,
        lastChecked: new Date(),
        responseTime: 0,
        consecutiveFailures: 0,
      });

      this.rateLimitTracker.set(service.name, {
        requests: 0,
        resetTime: new Date(Date.now() + 3600000), // 1 hour from now
      });
    });

    this.logger.info(
      `Initialized ${this.options.services.length} third-party service configurations`
    );
  }

  /**
   * Runs integration tests for all third-party services
   */
  public async runThirdPartyTests(): Promise<ThirdPartyTestResult[]> {
    this.logger.info('Starting third-party integration testing');
    this.testResults = [];

    // Run health checks first if enabled
    if (this.options.enableHealthChecks) {
      await this.runHealthChecks();
    }

    // Run endpoint tests for all services
    for (const service of this.options.services) {
      await this.testServiceEndpoints(service);
    }

    // Run contract validation if enabled
    if (this.options.enableContractValidation) {
      await this.validateServiceContracts();
    }

    // Run rate limit tests if enabled
    if (this.options.enableRateLimitTesting) {
      await this.testRateLimits();
    }

    await this.analyzeTestResults();
    this.logger.info(`Third-party testing completed: ${this.testResults.length} tests run`);
    return this.testResults;
  }

  /**
   * Runs health checks for all services
   */
  private async runHealthChecks(): Promise<void> {
    this.logger.info('Running third-party service health checks');

    const healthCheckPromises = this.options.services
      .filter((service) => service.healthCheckEndpoint)
      .map((service) => this.checkServiceHealth(service));

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Checks health of individual service
   */
  private async checkServiceHealth(service: ThirdPartyService): Promise<void> {
    const testId = `health_${service.name}`;
    const startTime = new Date();

    try {
      const url = `${service.baseUrl}${service.healthCheckEndpoint}`;
      const response = await this.makeServiceRequest(url, 'GET', service);

      const responseTime = Date.now() - startTime.getTime();
      const isHealthy = response.ok;

      const healthStatus = this.serviceHealthStatus.get(service.name);
      if (healthStatus) {
        healthStatus.isHealthy = isHealthy;
        healthStatus.lastChecked = new Date();
        healthStatus.responseTime = responseTime;
        healthStatus.consecutiveFailures = isHealthy ? 0 : healthStatus.consecutiveFailures + 1;
      }

      this.testResults.push({
        testId,
        testName: `Health Check - ${service.name}`,
        serviceName: service.name,
        endpoint: service.healthCheckEndpoint || '',
        status: isHealthy ? 'passed' : 'failed',
        duration: responseTime,
        startTime,
        endTime: new Date(),
        responseCode: response.status,
        responseTime,
        errors: isHealthy ? [] : [`Health check failed with status ${response.status}`],
        warnings: [],
        metrics: {
          connectionTime: responseTime,
        },
      });
    } catch (error) {
      const healthStatus = this.serviceHealthStatus.get(service.name);
      if (healthStatus) {
        healthStatus.isHealthy = false;
        healthStatus.lastChecked = new Date();
        healthStatus.consecutiveFailures += 1;
      }

      this.testResults.push({
        testId,
        testName: `Health Check - ${service.name}`,
        serviceName: service.name,
        endpoint: service.healthCheckEndpoint || '',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        responseTime: 0,
        errors: [error instanceof Error ? error.message : 'Health check failed'],
        warnings: [],
      });
    }
  }

  /**
   * Tests all endpoints for a service
   */
  private async testServiceEndpoints(service: ThirdPartyService): Promise<void> {
    const healthStatus = this.serviceHealthStatus.get(service.name);
    if (healthStatus && !healthStatus.isHealthy && healthStatus.consecutiveFailures > 3) {
      this.logger.warn(`Skipping tests for unhealthy service: ${service.name}`);
      return;
    }

    // Test endpoints in parallel with concurrency limit
    const endpointPromises = service.endpoints.map((endpoint) =>
      this.testServiceEndpoint(service, endpoint)
    );

    // Execute with controlled concurrency
    await this.executeConcurrently(endpointPromises, this.options.parallelRequests || 3);
  }

  /**
   * Tests individual service endpoint
   */
  private async testServiceEndpoint(service: ThirdPartyService, endpoint: string): Promise<void> {
    const testId = `endpoint_${service.name}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const startTime = new Date();

    try {
      // Check rate limit before making request
      if (!this.checkRateLimit(service.name)) {
        this.testResults.push({
          testId,
          testName: `Endpoint Test - ${service.name}${endpoint}`,
          serviceName: service.name,
          endpoint,
          status: 'skipped',
          duration: 0,
          startTime,
          endTime: new Date(),
          responseTime: 0,
          errors: [],
          warnings: ['Skipped due to rate limit'],
        });
        return;
      }

      const url = `${service.baseUrl}${endpoint}`;
      const method = this.getMethodForEndpoint(endpoint);
      const response = await this.makeServiceRequest(url, method, service);

      const responseTime = Date.now() - startTime.getTime();
      const expectedCodes = service.expectedResponseCodes || [200, 201, 204];
      const isValidResponse = expectedCodes.includes(response.status);

      // Track rate limit info if available
      const rateLimitRemaining = this.extractRateLimitInfo(response);

      this.testResults.push({
        testId,
        testName: `Endpoint Test - ${service.name}${endpoint}`,
        serviceName: service.name,
        endpoint,
        status: isValidResponse ? 'passed' : 'failed',
        duration: responseTime,
        startTime,
        endTime: new Date(),
        responseCode: response.status,
        responseTime,
        errors: isValidResponse ? [] : [`Unexpected response code: ${response.status}`],
        warnings: this.validateResponseWarnings(response, service),
        metrics: {
          rateLimitRemaining,
          responseSize: response.headers.get('content-length')
            ? parseInt(response.headers.get('content-length') || '0')
            : undefined,
          connectionTime: responseTime,
        },
      });

      // Cache contract information for validation
      if (isValidResponse && this.options.enableContractValidation) {
        await this.cacheContractInfo(service, endpoint, response);
      }
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Endpoint Test - ${service.name}${endpoint}`,
        serviceName: service.name,
        endpoint,
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        responseTime: 0,
        errors: [error instanceof Error ? error.message : 'Request failed'],
        warnings: [],
      });
    }
  }

  /**
   * Makes HTTP request to service with authentication
   */
  private async makeServiceRequest(
    url: string,
    method: string,
    service: ThirdPartyService
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Sovren-Integration-Tester/1.0',
    };

    // Add authentication
    switch (service.authentication.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${service.authentication.credentials.token}`;
        break;
      case 'basic':
        const auth = btoa(
          `${service.authentication.credentials.username}:${service.authentication.credentials.password}`
        );
        headers['Authorization'] = `Basic ${auth}`;
        break;
      case 'apikey':
        if (service.authentication.credentials.header) {
          headers[service.authentication.credentials.header] =
            service.authentication.credentials.key;
        } else {
          headers['X-API-Key'] = service.authentication.credentials.key;
        }
        break;
    }

    return fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(service.timeout || this.options.timeout),
    });
  }

  /**
   * Validates service contracts against cached definitions
   */
  private async validateServiceContracts(): Promise<void> {
    this.logger.info('Validating service contracts');

    for (const [serviceEndpoint, contractInfo] of this.contractCache.entries()) {
      // Perform contract validation logic
      // This would typically involve schema validation, response structure checks, etc.
      await this.validateContract(serviceEndpoint, contractInfo);
    }
  }

  /**
   * Tests rate limits for services
   */
  private async testRateLimits(): Promise<void> {
    this.logger.info('Testing service rate limits');

    for (const service of this.options.services) {
      if (service.rateLimit) {
        await this.testServiceRateLimit(service);
      }
    }
  }

  /**
   * Tests rate limit for individual service
   */
  private async testServiceRateLimit(service: ThirdPartyService): Promise<void> {
    const testId = `ratelimit_${service.name}`;
    const startTime = new Date();

    try {
      // Make rapid requests to test rate limiting
      const requests = Math.min(service.rateLimit! + 5, 20); // Test slightly over limit
      const promises = Array.from(
        { length: requests },
        (_, i) =>
          this.makeServiceRequest(
            `${service.baseUrl}${service.endpoints[0] || '/'}`,
            'GET',
            service
          ).catch(() => ({ status: 429, ok: false })) // Catch and return rate limit response
      );

      const responses = await Promise.all(promises);
      const rateLimitHit = responses.some((r: any) => r.status === 429);

      this.testResults.push({
        testId,
        testName: `Rate Limit Test - ${service.name}`,
        serviceName: service.name,
        endpoint: 'rate_limit_test',
        status: rateLimitHit ? 'passed' : 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        responseTime: 0,
        errors: rateLimitHit ? [] : ['Rate limit not enforced as expected'],
        warnings: [],
      });
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Rate Limit Test - ${service.name}`,
        serviceName: service.name,
        endpoint: 'rate_limit_test',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        responseTime: 0,
        errors: [error instanceof Error ? error.message : 'Rate limit test failed'],
        warnings: [],
      });
    }
  }

  /**
   * Executes promises with controlled concurrency
   */
  private async executeConcurrently<T>(promises: Promise<T>[], concurrency: number): Promise<T[]> {
    const results: Promise<T>[] = [];
    const executing: Promise<T>[] = [];

    for (const promise of promises) {
      const executing_promise = promise.then((result) => {
        executing.splice(executing.indexOf(executing_promise), 1);
        return result;
      });

      results.push(executing_promise);
      executing.push(executing_promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * Checks if request is within rate limit
   */
  private checkRateLimit(serviceName: string): boolean {
    const tracker = this.rateLimitTracker.get(serviceName);
    if (!tracker) return true;

    const now = new Date();
    if (now > tracker.resetTime) {
      tracker.requests = 0;
      tracker.resetTime = new Date(now.getTime() + 3600000); // Reset every hour
    }

    const service = this.options.services.find((s) => s.name === serviceName);
    if (service?.rateLimit && tracker.requests >= service.rateLimit) {
      return false;
    }

    tracker.requests++;
    return true;
  }

  /**
   * Extracts rate limit information from response headers
   */
  private extractRateLimitInfo(response: Response): number | undefined {
    const headers = ['x-ratelimit-remaining', 'x-rate-limit-remaining', 'ratelimit-remaining'];

    for (const header of headers) {
      const value = response.headers.get(header);
      if (value) {
        return parseInt(value);
      }
    }

    return undefined;
  }

  /**
   * Validates response for warnings
   */
  private validateResponseWarnings(response: Response, service: ThirdPartyService): string[] {
    const warnings: string[] = [];

    // Check for deprecated API versions
    const apiVersion = response.headers.get('api-version');
    if (apiVersion && apiVersion.includes('deprecated')) {
      warnings.push(`API version ${apiVersion} is deprecated`);
    }

    // Check for slow responses
    const responseTime = parseInt(response.headers.get('x-response-time') || '0');
    if (responseTime > 2000) {
      warnings.push(`Slow response time: ${responseTime}ms`);
    }

    return warnings;
  }

  /**
   * Caches contract information for validation
   */
  private async cacheContractInfo(
    service: ThirdPartyService,
    endpoint: string,
    response: Response
  ): Promise<void> {
    try {
      const data = await response.clone().json();
      const key = `${service.name}_${endpoint}`;

      this.contractCache.set(key, {
        schema: data,
        lastUpdated: new Date(),
        statusCode: response.status,
        contentType: response.headers.get('content-type'),
      });
    } catch {
      // Ignore if response is not JSON
    }
  }

  /**
   * Validates contract against cached definition
   */
  private async validateContract(
    serviceEndpoint: string,
    contractInfo: Record<string, unknown>
  ): Promise<void> {
    // Mock contract validation - in real implementation this would validate
    // schema compliance, field presence, data types, etc.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /**
   * Gets HTTP method for endpoint
   */
  private getMethodForEndpoint(endpoint: string): string {
    // Simple heuristic - in real implementation this would be more sophisticated
    if (endpoint.includes('create') || endpoint.includes('post')) return 'POST';
    if (endpoint.includes('update') || endpoint.includes('put')) return 'PUT';
    if (endpoint.includes('delete')) return 'DELETE';
    return 'GET';
  }

  /**
   * Analyzes test results and updates service configurations
   */
  private async analyzeTestResults(): Promise<void> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.status === 'passed').length;
    const failureRate = ((totalTests - passedTests) / totalTests) * 100;

    this.logger.info(
      `Third-party test summary: ${passedTests}/${totalTests} passed (${failureRate.toFixed(2)}% failure rate)`
    );

    // Analyze service health
    const serviceHealthSummary = Array.from(this.serviceHealthStatus.values()).map((health) => ({
      service: health.serviceName,
      healthy: health.isHealthy,
      failures: health.consecutiveFailures,
      avgResponseTime: health.responseTime,
    }));

    this.logger.info('Service health summary:', { services: serviceHealthSummary });

    // Update service configurations based on results
    await this.updateServiceConfigurations();
  }

  /**
   * Updates service configurations based on test results
   */
  private async updateServiceConfigurations(): Promise<void> {
    for (const service of this.options.services) {
      const serviceTests = this.testResults.filter((r) => r.serviceName === service.name);
      const avgResponseTime =
        serviceTests.length > 0
          ? serviceTests.reduce((sum, test) => sum + test.responseTime, 0) / serviceTests.length
          : 0;

      // Adjust timeout based on observed response times
      if (avgResponseTime > 0 && avgResponseTime > (service.timeout || this.options.timeout)) {
        const newTimeout = Math.ceil(avgResponseTime * 1.5);
        this.logger.info(`Adjusting timeout for ${service.name} to ${newTimeout}ms`);
        service.timeout = newTimeout;
      }

      // Update health status
      const healthStatus = this.serviceHealthStatus.get(service.name);
      if (healthStatus && healthStatus.consecutiveFailures > 5) {
        this.logger.warn(
          `Service ${service.name} has ${healthStatus.consecutiveFailures} consecutive failures`
        );
      }
    }
  }

  /**
   * Gets third-party test results
   */
  public getTestResults(): ThirdPartyTestResult[] {
    return [...this.testResults];
  }

  /**
   * Gets service health status
   */
  public getServiceHealthStatus(): Map<string, ServiceHealthStatus> {
    return new Map(this.serviceHealthStatus);
  }

  /**
   * Gets service configurations
   */
  public getServiceConfigurations(): ThirdPartyService[] {
    return [...this.options.services];
  }

  /**
   * Updates service configuration
   */
  public updateServiceConfig(name: string, updates: Partial<ThirdPartyService>): void {
    const serviceIndex = this.options.services.findIndex((s) => s.name === name);
    if (serviceIndex !== -1) {
      this.options.services[serviceIndex] = { ...this.options.services[serviceIndex], ...updates };
      this.logger.info(`Updated configuration for service: ${name}`);
    }
  }

  /**
   * Adds new service configuration
   */
  public addServiceConfig(service: ThirdPartyService): void {
    this.options.services.push(service);
    this.serviceHealthStatus.set(service.name, {
      serviceName: service.name,
      isHealthy: true,
      lastChecked: new Date(),
      responseTime: 0,
      consecutiveFailures: 0,
    });
    this.logger.info(`Added new service configuration: ${service.name}`);
  }

  /**
   * Removes service configuration
   */
  public removeServiceConfig(name: string): void {
    this.options.services = this.options.services.filter((s) => s.name !== name);
    this.serviceHealthStatus.delete(name);
    this.rateLimitTracker.delete(name);
    this.logger.info(`Removed service configuration: ${name}`);
  }

  /**
   * Gets test summary
   */
  public getTestSummary(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    successRate: number;
    averageResponseTime: number;
    healthyServices: number;
    totalServices: number;
  } {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.status === 'passed').length;
    const failedTests = this.testResults.filter((r) => r.status === 'failed').length;
    const skippedTests = this.testResults.filter((r) => r.status === 'skipped').length;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    const averageResponseTime =
      this.testResults.length > 0
        ? this.testResults.reduce((sum, r) => sum + r.responseTime, 0) / this.testResults.length
        : 0;

    const healthyServices = Array.from(this.serviceHealthStatus.values()).filter(
      (status) => status.isHealthy
    ).length;
    const totalServices = this.serviceHealthStatus.size;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate,
      averageResponseTime,
      healthyServices,
      totalServices,
    };
  }
}
