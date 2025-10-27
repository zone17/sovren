/**
 * @file APIContractTester.ts
 * @description Automated API contract testing and validation with self-updating capabilities
 */

import { Logger } from '../common/Logger';

/**
 * API endpoint configuration for contract testing
 */
export interface APIEndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  expectedStatus: number[];
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  pathParams?: Record<string, string>;
  authenticated?: boolean;
  rateLimit?: number;
  timeout?: number;
}

/**
 * Contract test result
 */
export interface ContractTestResult {
  endpoint: string;
  method: string;
  status: 'passed' | 'failed' | 'skipped';
  responseTime: number;
  statusCode: number;
  errors: string[];
  warnings: string[];
  contractViolations: string[];
  timestamp: Date;
}

/**
 * API contract testing options
 */
export interface APIContractTesterOptions {
  endpoints: string[];
  timeout: number;
  retryAttempts: number;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  enableSchemaValidation?: boolean;
  enableResponseValidation?: boolean;
  enablePerformanceValidation?: boolean;
  maxResponseTime?: number;
}

/**
 * Automated API contract testing with self-updating capabilities
 */
export class APIContractTester {
  private options: APIContractTesterOptions;
  private logger: Logger;
  private endpointConfigs: Map<string, APIEndpointConfig>;
  private testResults: ContractTestResult[];
  private schemaCache: Map<string, Record<string, unknown>>;

  constructor(options: APIContractTesterOptions) {
    this.options = {
      enableSchemaValidation: true,
      enableResponseValidation: true,
      enablePerformanceValidation: true,
      maxResponseTime: 5000,
      ...options,
    };

    this.logger = new Logger('APIContractTester');
    this.endpointConfigs = new Map();
    this.testResults = [];
    this.schemaCache = new Map();

    this.initializeEndpointConfigs();
  }

  /**
   * Initializes endpoint configurations from discovery
   */
  private initializeEndpointConfigs(): void {
    this.options.endpoints.forEach((endpoint) => {
      const config = this.parseEndpointPath(endpoint);
      this.endpointConfigs.set(endpoint, config);
    });

    this.logger.info(`Initialized ${this.endpointConfigs.size} endpoint configurations`);
  }

  /**
   * Parses endpoint path to create configuration
   */
  private parseEndpointPath(endpoint: string): APIEndpointConfig {
    // Extract method and path from endpoint
    const [method, path] = endpoint.includes(' ') ? endpoint.split(' ') : ['GET', endpoint];

    return {
      path: path.trim(),
      method: method.toUpperCase() as APIEndpointConfig['method'],
      expectedStatus: [200, 201, 204],
      authenticated: path.includes('auth') || path.includes('private'),
      timeout: this.options.timeout,
    };
  }

  /**
   * Runs contract tests for all configured endpoints
   */
  public async runContractTests(): Promise<ContractTestResult[]> {
    this.logger.info('Starting API contract testing');
    this.testResults = [];

    const testPromises = Array.from(this.endpointConfigs.entries()).map(([endpoint, config]) =>
      this.testEndpointContract(endpoint, config)
    );

    const results = await Promise.allSettled(testPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.testResults.push(result.value);
      } else {
        const endpoint = Array.from(this.endpointConfigs.keys())[index];
        this.testResults.push({
          endpoint,
          method: 'GET',
          status: 'failed',
          responseTime: 0,
          statusCode: 0,
          errors: [result.reason?.message || 'Unknown error'],
          warnings: [],
          contractViolations: [],
          timestamp: new Date(),
        });
      }
    });

    await this.analyzeContractCompliance();
    await this.updateContractDefinitions();

    this.logger.info(`Contract testing completed: ${this.testResults.length} tests run`);
    return this.testResults;
  }

  /**
   * Tests individual endpoint contract
   */
  private async testEndpointContract(
    endpoint: string,
    config: APIEndpointConfig
  ): Promise<ContractTestResult> {
    const startTime = Date.now();
    const result: ContractTestResult = {
      endpoint,
      method: config.method,
      status: 'passed',
      responseTime: 0,
      statusCode: 0,
      errors: [],
      warnings: [],
      contractViolations: [],
      timestamp: new Date(),
    };

    try {
      // Simulate API call with fetch or HTTP client
      const response = await this.makeAPICall(config);

      result.statusCode = response.status;
      result.responseTime = Date.now() - startTime;

      // Validate status code
      if (!config.expectedStatus.includes(response.status)) {
        result.contractViolations.push(
          `Expected status ${config.expectedStatus.join(' or ')}, got ${response.status}`
        );
      }

      // Validate response time
      if (
        this.options.enablePerformanceValidation &&
        result.responseTime > (this.options.maxResponseTime || 5000)
      ) {
        result.warnings.push(
          `Response time ${result.responseTime}ms exceeds threshold ${this.options.maxResponseTime}ms`
        );
      }

      // Validate response schema
      if (this.options.enableResponseValidation && config.responseSchema) {
        const responseData = await response.json();
        const schemaViolations = this.validateResponseSchema(responseData, config.responseSchema);
        result.contractViolations.push(...schemaViolations);
      }

      // Validate headers
      await this.validateResponseHeaders(response, result);

      result.status = result.contractViolations.length > 0 ? 'failed' : 'passed';
    } catch (error) {
      result.status = 'failed';
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.responseTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Makes API call with proper configuration
   */
  private async makeAPICall(config: APIEndpointConfig): Promise<Response> {
    const url = this.buildURL(config);
    const headers = { ...this.options.defaultHeaders, ...config.headers };

    const fetchOptions: RequestInit = {
      method: config.method,
      headers,
      signal: AbortSignal.timeout(config.timeout || this.options.timeout),
    };

    // Add request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(config.method) && config.requestSchema) {
      fetchOptions.body = JSON.stringify(this.generateRequestBody(config.requestSchema));
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, fetchOptions);
  }

  /**
   * Builds complete URL with query parameters
   */
  private buildURL(config: APIEndpointConfig): string {
    let url = config.path;

    if (this.options.baseUrl) {
      url = `${this.options.baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }

    // Replace path parameters
    if (config.pathParams) {
      Object.entries(config.pathParams).forEach(([key, value]) => {
        url = url.replace(`:${key}`, value);
        url = url.replace(`{${key}}`, value);
      });
    }

    // Add query parameters
    if (config.queryParams) {
      const params = new URLSearchParams(config.queryParams);
      url += `?${params.toString()}`;
    }

    return url;
  }

  /**
   * Generates request body from schema
   */
  private generateRequestBody(schema: Record<string, unknown>): Record<string, unknown> {
    const body: Record<string, unknown> = {};

    Object.entries(schema).forEach(([key, value]) => {
      if (typeof value === 'string') {
        body[key] = this.generateStringValue(value);
      } else if (typeof value === 'number') {
        body[key] = Math.floor(Math.random() * 100);
      } else if (typeof value === 'boolean') {
        body[key] = Math.random() > 0.5;
      } else if (Array.isArray(value)) {
        body[key] = [this.generateRequestBody(value[0] as Record<string, unknown>)];
      } else if (typeof value === 'object' && value !== null) {
        body[key] = this.generateRequestBody(value as Record<string, unknown>);
      }
    });

    return body;
  }

  /**
   * Generates string values based on field hints
   */
  private generateStringValue(fieldType: string): string {
    switch (fieldType.toLowerCase()) {
      case 'email':
        return 'test@example.com';
      case 'phone':
        return '+1234567890';
      case 'url':
        return 'https://example.com';
      case 'uuid':
        return crypto.randomUUID();
      case 'date':
        return new Date().toISOString();
      default:
        return `test_${Math.random().toString(36).substring(7)}`;
    }
  }

  /**
   * Validates response schema against expected structure
   */
  private validateResponseSchema(
    responseData: unknown,
    expectedSchema: Record<string, unknown>
  ): string[] {
    const violations: string[] = [];

    if (typeof responseData !== 'object' || responseData === null) {
      violations.push('Response is not a valid object');
      return violations;
    }

    const data = responseData as Record<string, unknown>;

    // Check required fields
    Object.keys(expectedSchema).forEach((key) => {
      if (!(key in data)) {
        violations.push(`Missing required field: ${key}`);
      }
    });

    // Check field types
    Object.entries(data).forEach(([key, value]) => {
      if (key in expectedSchema) {
        const expectedType = expectedSchema[key];
        if (!this.validateFieldType(value, expectedType)) {
          violations.push(
            `Invalid type for field ${key}: expected ${expectedType}, got ${typeof value}`
          );
        }
      }
    });

    return violations;
  }

  /**
   * Validates field type against expected type
   */
  private validateFieldType(value: unknown, expectedType: unknown): boolean {
    if (typeof expectedType === 'string') {
      return typeof value === expectedType;
    } else if (Array.isArray(expectedType)) {
      return Array.isArray(value);
    } else if (typeof expectedType === 'object') {
      return typeof value === 'object' && value !== null;
    }
    return true;
  }

  /**
   * Validates response headers
   */
  private async validateResponseHeaders(
    response: Response,
    result: ContractTestResult
  ): Promise<void> {
    // Check for security headers
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'content-security-policy',
    ];

    securityHeaders.forEach((header) => {
      if (!response.headers.get(header)) {
        result.warnings.push(`Missing security header: ${header}`);
      }
    });

    // Validate content type for JSON responses
    const contentType = response.headers.get('content-type');
    if (response.status !== 204 && contentType && !contentType.includes('application/json')) {
      result.warnings.push(`Unexpected content type: ${contentType}`);
    }
  }

  /**
   * Analyzes contract compliance across all tests
   */
  private async analyzeContractCompliance(): Promise<void> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.status === 'passed').length;
    const complianceRate = (passedTests / totalTests) * 100;

    this.logger.info(`Contract compliance rate: ${complianceRate.toFixed(2)}%`);

    // Identify common violation patterns
    const violationPatterns = new Map<string, number>();
    this.testResults.forEach((result) => {
      result.contractViolations.forEach((violation) => {
        const pattern = this.extractViolationPattern(violation);
        violationPatterns.set(pattern, (violationPatterns.get(pattern) || 0) + 1);
      });
    });

    // Log top violation patterns
    const sortedPatterns = Array.from(violationPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedPatterns.length > 0) {
      const patternsObj = Object.fromEntries(sortedPatterns);
      this.logger.warn('Top contract violation patterns:', patternsObj);
    }
  }

  /**
   * Extracts violation pattern for analysis
   */
  private extractViolationPattern(violation: string): string {
    // Extract pattern from violation message
    if (violation.includes('Expected status')) {
      return 'status_code_mismatch';
    } else if (violation.includes('Missing required field')) {
      return 'missing_required_field';
    } else if (violation.includes('Invalid type')) {
      return 'type_mismatch';
    } else {
      return 'other';
    }
  }

  /**
   * Updates contract definitions based on test results
   */
  private async updateContractDefinitions(): Promise<void> {
    // Analyze successful responses to update schemas
    const successfulTests = this.testResults.filter((r) => r.status === 'passed');

    for (const test of successfulTests) {
      const config = this.endpointConfigs.get(test.endpoint);
      if (config) {
        // Update response time expectations
        if (test.responseTime > 0) {
          config.timeout = Math.max(config.timeout || 5000, test.responseTime * 1.5);
        }

        // Cache successful response schema
        this.schemaCache.set(`${test.endpoint}_${test.method}`, {
          lastUpdated: new Date(),
          responseTime: test.responseTime,
          statusCode: test.statusCode,
        });
      }
    }

    this.logger.info('Contract definitions updated based on test results');
  }

  /**
   * Gets contract test results
   */
  public getTestResults(): ContractTestResult[] {
    return [...this.testResults];
  }

  /**
   * Gets endpoint configurations
   */
  public getEndpointConfigs(): Map<string, APIEndpointConfig> {
    return new Map(this.endpointConfigs);
  }

  /**
   * Updates endpoint configuration
   */
  public updateEndpointConfig(endpoint: string, updates: Partial<APIEndpointConfig>): void {
    const existing = this.endpointConfigs.get(endpoint);
    if (existing) {
      this.endpointConfigs.set(endpoint, { ...existing, ...updates });
      this.logger.info(`Updated configuration for endpoint: ${endpoint}`);
    }
  }

  /**
   * Adds new endpoint for testing
   */
  public addEndpoint(endpoint: string, config?: Partial<APIEndpointConfig>): void {
    const defaultConfig = this.parseEndpointPath(endpoint);
    const finalConfig = { ...defaultConfig, ...config };

    this.endpointConfigs.set(endpoint, finalConfig);
    this.logger.info(`Added new endpoint for testing: ${endpoint}`);
  }

  /**
   * Removes endpoint from testing
   */
  public removeEndpoint(endpoint: string): void {
    this.endpointConfigs.delete(endpoint);
    this.schemaCache.delete(`${endpoint}_GET`);
    this.logger.info(`Removed endpoint from testing: ${endpoint}`);
  }

  /**
   * Gets contract compliance summary
   */
  public getComplianceSummary(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    complianceRate: number;
    averageResponseTime: number;
  } {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.status === 'passed').length;
    const failedTests = totalTests - passedTests;
    const complianceRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    const averageResponseTime =
      totalTests > 0
        ? this.testResults.reduce((sum, r) => sum + r.responseTime, 0) / totalTests
        : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      complianceRate,
      averageResponseTime,
    };
  }
}
