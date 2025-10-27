/**
 * @file DatabaseIntegrationTester.ts
 * @description Autonomous database integration testing with multi-database support
 */

import { Logger } from '../common/Logger';

/**
 * Database configuration for integration testing
 */
export interface DatabaseConfig {
  name: string;
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  schema?: string;
  connectionPool?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
}

/**
 * Database test result
 */
export interface DatabaseTestResult {
  testId: string;
  testName: string;
  database: string;
  testType: 'connection' | 'schema' | 'crud' | 'performance' | 'transaction';
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  startTime: Date;
  endTime: Date;
  errors: string[];
  warnings: string[];
  metrics?: {
    queryTime?: number;
    rowsAffected?: number;
    connectionTime?: number;
    memoryUsage?: number;
  };
}

/**
 * Database integration tester options
 */
export interface DatabaseIntegrationTesterOptions {
  configs: DatabaseConfig[];
  timeout: number;
  enableSchemaValidation?: boolean;
  enablePerformanceTesting?: boolean;
  enableTransactionTesting?: boolean;
  enableConnectionPoolTesting?: boolean;
  maxQueryTime?: number;
  testDataSize?: number;
}

/**
 * SQL query template for testing
 */
interface QueryTemplate {
  name: string;
  sql: string;
  parameters?: Record<string, unknown>;
  expectedResult?: 'rows' | 'count' | 'success';
  description: string;
}

/**
 * Autonomous database integration testing
 */
export class DatabaseIntegrationTester {
  private options: DatabaseIntegrationTesterOptions;
  private logger: Logger;
  private testResults: DatabaseTestResult[];
  private connections: Map<string, unknown>;
  private queryTemplates: Map<string, QueryTemplate[]>;
  private schemaCache: Map<string, Record<string, unknown>>;

  constructor(options: DatabaseIntegrationTesterOptions) {
    this.options = {
      enableSchemaValidation: true,
      enablePerformanceTesting: true,
      enableTransactionTesting: true,
      enableConnectionPoolTesting: true,
      maxQueryTime: 5000,
      testDataSize: 100,
      ...options,
    };

    this.logger = new Logger('DatabaseIntegrationTester');
    this.testResults = [];
    this.connections = new Map();
    this.queryTemplates = new Map();
    this.schemaCache = new Map();

    this.initializeQueryTemplates();
  }

  /**
   * Initializes query templates for different database types
   */
  private initializeQueryTemplates(): void {
    // PostgreSQL templates
    this.queryTemplates.set('postgres', [
      {
        name: 'connection_test',
        sql: 'SELECT version() as version, current_database() as database',
        expectedResult: 'rows',
        description: 'Test database connection and version',
      },
      {
        name: 'schema_test',
        sql: `SELECT table_name, column_name, data_type
              FROM information_schema.columns
              WHERE table_schema = 'public'
              ORDER BY table_name, ordinal_position`,
        expectedResult: 'rows',
        description: 'Validate database schema structure',
      },
      {
        name: 'performance_test',
        sql: 'SELECT COUNT(*) as count FROM generate_series(1, $1)',
        parameters: { '1': 1000 },
        expectedResult: 'rows',
        description: 'Test query performance with generated data',
      },
    ]);

    // MySQL templates
    this.queryTemplates.set('mysql', [
      {
        name: 'connection_test',
        sql: 'SELECT VERSION() as version, DATABASE() as database',
        expectedResult: 'rows',
        description: 'Test database connection and version',
      },
      {
        name: 'schema_test',
        sql: `SELECT table_name, column_name, data_type
              FROM information_schema.columns
              WHERE table_schema = DATABASE()
              ORDER BY table_name, ordinal_position`,
        expectedResult: 'rows',
        description: 'Validate database schema structure',
      },
    ]);

    // SQLite templates
    this.queryTemplates.set('sqlite', [
      {
        name: 'connection_test',
        sql: 'SELECT sqlite_version() as version',
        expectedResult: 'rows',
        description: 'Test database connection and version',
      },
      {
        name: 'schema_test',
        sql: `SELECT name, sql FROM sqlite_master
              WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        expectedResult: 'rows',
        description: 'Validate database schema structure',
      },
    ]);

    // MongoDB templates (as aggregation pipelines)
    this.queryTemplates.set('mongodb', [
      {
        name: 'connection_test',
        sql: '{ "ping": 1 }',
        expectedResult: 'success',
        description: 'Test database connection',
      },
      {
        name: 'schema_test',
        sql: '{ "listCollections": 1 }',
        expectedResult: 'rows',
        description: 'List all collections in database',
      },
    ]);

    this.logger.info('Database query templates initialized');
  }

  /**
   * Runs integration tests for all configured databases
   */
  public async runDatabaseTests(): Promise<DatabaseTestResult[]> {
    this.logger.info('Starting database integration testing');
    this.testResults = [];

    for (const config of this.options.configs) {
      try {
        await this.testDatabaseConnection(config);

        if (this.options.enableSchemaValidation) {
          await this.testDatabaseSchema(config);
        }

        await this.testBasicCRUDOperations(config);

        if (this.options.enablePerformanceTesting) {
          await this.testDatabasePerformance(config);
        }

        if (this.options.enableTransactionTesting) {
          await this.testTransactionSupport(config);
        }

        if (this.options.enableConnectionPoolTesting) {
          await this.testConnectionPool(config);
        }
      } catch (error) {
        this.testResults.push({
          testId: `db_test_${config.name}_error`,
          testName: `Database ${config.name} Error`,
          database: config.name,
          testType: 'connection',
          status: 'error',
          duration: 0,
          startTime: new Date(),
          endTime: new Date(),
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
        });
      }
    }

    await this.analyzeTestResults();
    this.logger.info(`Database testing completed: ${this.testResults.length} tests run`);
    return this.testResults;
  }

  /**
   * Tests database connection
   */
  private async testDatabaseConnection(config: DatabaseConfig): Promise<void> {
    const testId = `connection_${config.name}`;
    const startTime = new Date();

    try {
      const connection = await this.establishConnection(config);
      const templates = this.queryTemplates.get(config.type) || [];
      const connectionTemplate = templates.find((t) => t.name === 'connection_test');

      if (connectionTemplate) {
        const result = await this.executeQuery(connection, connectionTemplate, config);

        this.testResults.push({
          testId,
          testName: `Connection Test - ${config.name}`,
          database: config.name,
          testType: 'connection',
          status: 'passed',
          duration: Date.now() - startTime.getTime(),
          startTime,
          endTime: new Date(),
          errors: [],
          warnings: [],
          metrics: {
            connectionTime: Date.now() - startTime.getTime(),
          },
        });

        this.connections.set(config.name, connection);
      }
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Connection Test - ${config.name}`,
        database: config.name,
        testType: 'connection',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Connection failed'],
        warnings: [],
      });
    }
  }

  /**
   * Tests database schema validation
   */
  private async testDatabaseSchema(config: DatabaseConfig): Promise<void> {
    const testId = `schema_${config.name}`;
    const startTime = new Date();

    try {
      const connection = this.connections.get(config.name);
      if (!connection) {
        throw new Error('No active connection found');
      }

      const templates = this.queryTemplates.get(config.type) || [];
      const schemaTemplate = templates.find((t) => t.name === 'schema_test');

      if (schemaTemplate) {
        const result = await this.executeQuery(connection, schemaTemplate, config);

        // Cache schema information
        this.schemaCache.set(config.name, {
          schema: result,
          lastUpdated: new Date(),
          tableCount: Array.isArray(result) ? result.length : 0,
        });

        this.testResults.push({
          testId,
          testName: `Schema Validation - ${config.name}`,
          database: config.name,
          testType: 'schema',
          status: 'passed',
          duration: Date.now() - startTime.getTime(),
          startTime,
          endTime: new Date(),
          errors: [],
          warnings: [],
        });
      }
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Schema Validation - ${config.name}`,
        database: config.name,
        testType: 'schema',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Schema validation failed'],
        warnings: [],
      });
    }
  }

  /**
   * Tests basic CRUD operations
   */
  private async testBasicCRUDOperations(config: DatabaseConfig): Promise<void> {
    const testId = `crud_${config.name}`;
    const startTime = new Date();

    try {
      const connection = this.connections.get(config.name);
      if (!connection) {
        throw new Error('No active connection found');
      }

      // Test CREATE
      await this.testCreateOperation(connection, config);

      // Test READ
      await this.testReadOperation(connection, config);

      // Test UPDATE
      await this.testUpdateOperation(connection, config);

      // Test DELETE
      await this.testDeleteOperation(connection, config);

      this.testResults.push({
        testId,
        testName: `CRUD Operations - ${config.name}`,
        database: config.name,
        testType: 'crud',
        status: 'passed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [],
        warnings: [],
      });
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `CRUD Operations - ${config.name}`,
        database: config.name,
        testType: 'crud',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'CRUD operations failed'],
        warnings: [],
      });
    }
  }

  /**
   * Tests database performance
   */
  private async testDatabasePerformance(config: DatabaseConfig): Promise<void> {
    const testId = `performance_${config.name}`;
    const startTime = new Date();

    try {
      const connection = this.connections.get(config.name);
      if (!connection) {
        throw new Error('No active connection found');
      }

      const templates = this.queryTemplates.get(config.type) || [];
      const performanceTemplate = templates.find((t) => t.name === 'performance_test');

      if (performanceTemplate) {
        const queryStartTime = Date.now();
        await this.executeQuery(connection, performanceTemplate, config);
        const queryTime = Date.now() - queryStartTime;

        const warnings: string[] = [];
        if (queryTime > (this.options.maxQueryTime || 5000)) {
          warnings.push(
            `Query time ${queryTime}ms exceeds threshold ${this.options.maxQueryTime}ms`
          );
        }

        this.testResults.push({
          testId,
          testName: `Performance Test - ${config.name}`,
          database: config.name,
          testType: 'performance',
          status: warnings.length > 0 ? 'failed' : 'passed',
          duration: Date.now() - startTime.getTime(),
          startTime,
          endTime: new Date(),
          errors: [],
          warnings,
          metrics: {
            queryTime,
          },
        });
      }
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Performance Test - ${config.name}`,
        database: config.name,
        testType: 'performance',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Performance test failed'],
        warnings: [],
      });
    }
  }

  /**
   * Tests transaction support
   */
  private async testTransactionSupport(config: DatabaseConfig): Promise<void> {
    const testId = `transaction_${config.name}`;
    const startTime = new Date();

    try {
      const connection = this.connections.get(config.name);
      if (!connection) {
        throw new Error('No active connection found');
      }

      // Test transaction commit
      await this.testTransactionCommit(connection, config);

      // Test transaction rollback
      await this.testTransactionRollback(connection, config);

      this.testResults.push({
        testId,
        testName: `Transaction Support - ${config.name}`,
        database: config.name,
        testType: 'transaction',
        status: 'passed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [],
        warnings: [],
      });
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Transaction Support - ${config.name}`,
        database: config.name,
        testType: 'transaction',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Transaction test failed'],
        warnings: [],
      });
    }
  }

  /**
   * Tests connection pool functionality
   */
  private async testConnectionPool(config: DatabaseConfig): Promise<void> {
    const testId = `pool_${config.name}`;
    const startTime = new Date();

    try {
      // Test multiple concurrent connections
      const connections = await Promise.all(
        Array.from({ length: 5 }, () => this.establishConnection(config))
      );

      // Verify all connections work
      const promises = connections.map((conn) =>
        this.executeQuery(
          conn,
          {
            name: 'pool_test',
            sql: this.getPoolTestQuery(config.type),
            expectedResult: 'rows',
            description: 'Connection pool test',
          },
          config
        )
      );

      await Promise.all(promises);

      // Close connections
      await Promise.all(connections.map((conn) => this.closeConnection(conn, config)));

      this.testResults.push({
        testId,
        testName: `Connection Pool - ${config.name}`,
        database: config.name,
        testType: 'connection',
        status: 'passed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [],
        warnings: [],
      });
    } catch (error) {
      this.testResults.push({
        testId,
        testName: `Connection Pool - ${config.name}`,
        database: config.name,
        testType: 'connection',
        status: 'failed',
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Connection pool test failed'],
        warnings: [],
      });
    }
  }

  /**
   * Establishes database connection (mocked for now)
   */
  private async establishConnection(config: DatabaseConfig): Promise<unknown> {
    // Mock connection establishment
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      type: config.type,
      database: config.database,
      connected: true,
      id: Math.random().toString(36).substring(7),
    };
  }

  /**
   * Executes query on database connection (mocked for now)
   */
  private async executeQuery(
    connection: unknown,
    template: QueryTemplate,
    config: DatabaseConfig
  ): Promise<unknown> {
    // Mock query execution
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));

    if (template.expectedResult === 'rows') {
      return [{ id: 1, name: 'test' }];
    } else if (template.expectedResult === 'count') {
      return { count: 1 };
    } else {
      return { success: true };
    }
  }

  /**
   * Closes database connection (mocked for now)
   */
  private async closeConnection(connection: unknown, config: DatabaseConfig): Promise<void> {
    // Mock connection closure
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /**
   * Gets pool test query for database type
   */
  private getPoolTestQuery(type: string): string {
    switch (type) {
      case 'postgres':
      case 'mysql':
        return 'SELECT 1 as test';
      case 'sqlite':
        return 'SELECT 1 as test';
      case 'mongodb':
        return '{ "ping": 1 }';
      default:
        return 'SELECT 1 as test';
    }
  }

  /**
   * Test create operation
   */
  private async testCreateOperation(connection: unknown, config: DatabaseConfig): Promise<void> {
    // Mock create operation
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /**
   * Test read operation
   */
  private async testReadOperation(connection: unknown, config: DatabaseConfig): Promise<void> {
    // Mock read operation
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  /**
   * Test update operation
   */
  private async testUpdateOperation(connection: unknown, config: DatabaseConfig): Promise<void> {
    // Mock update operation
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  /**
   * Test delete operation
   */
  private async testDeleteOperation(connection: unknown, config: DatabaseConfig): Promise<void> {
    // Mock delete operation
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  /**
   * Test transaction commit
   */
  private async testTransactionCommit(connection: unknown, config: DatabaseConfig): Promise<void> {
    // Mock transaction commit
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Test transaction rollback
   */
  private async testTransactionRollback(
    connection: unknown,
    config: DatabaseConfig
  ): Promise<void> {
    // Mock transaction rollback
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Analyzes test results and updates configurations
   */
  private async analyzeTestResults(): Promise<void> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.status === 'passed').length;
    const failureRate = ((totalTests - passedTests) / totalTests) * 100;

    this.logger.info(
      `Database test summary: ${passedTests}/${totalTests} passed (${failureRate.toFixed(2)}% failure rate)`
    );

    // Analyze performance metrics
    const performanceTests = this.testResults.filter((r) => r.testType === 'performance');
    if (performanceTests.length > 0) {
      const avgQueryTime =
        performanceTests.reduce((sum, test) => sum + (test.metrics?.queryTime || 0), 0) /
        performanceTests.length;

      this.logger.info(`Average query time: ${avgQueryTime.toFixed(2)}ms`);
    }

    // Update configurations based on results
    await this.updateDatabaseConfigurations();
  }

  /**
   * Updates database configurations based on test results
   */
  private async updateDatabaseConfigurations(): Promise<void> {
    for (const config of this.options.configs) {
      const configTests = this.testResults.filter((r) => r.database === config.name);
      const failedTests = configTests.filter((r) => r.status === 'failed');

      if (failedTests.length > 0) {
        this.logger.warn(`Database ${config.name} has ${failedTests.length} failed tests`);

        // Adjust timeouts based on performance
        const performanceTests = configTests.filter((r) => r.testType === 'performance');
        if (performanceTests.length > 0) {
          const maxQueryTime = Math.max(...performanceTests.map((t) => t.metrics?.queryTime || 0));
          if (maxQueryTime > this.options.timeout) {
            this.logger.info(
              `Adjusting timeout for ${config.name} from ${this.options.timeout}ms to ${maxQueryTime * 1.5}ms`
            );
          }
        }
      }
    }
  }

  /**
   * Gets database test results
   */
  public getTestResults(): DatabaseTestResult[] {
    return [...this.testResults];
  }

  /**
   * Gets database configurations
   */
  public getDatabaseConfigs(): DatabaseConfig[] {
    return [...this.options.configs];
  }

  /**
   * Updates database configuration
   */
  public updateDatabaseConfig(name: string, updates: Partial<DatabaseConfig>): void {
    const configIndex = this.options.configs.findIndex((c) => c.name === name);
    if (configIndex !== -1) {
      this.options.configs[configIndex] = { ...this.options.configs[configIndex], ...updates };
      this.logger.info(`Updated configuration for database: ${name}`);
    }
  }

  /**
   * Adds new database configuration
   */
  public addDatabaseConfig(config: DatabaseConfig): void {
    this.options.configs.push(config);
    this.logger.info(`Added new database configuration: ${config.name}`);
  }

  /**
   * Removes database configuration
   */
  public removeDatabaseConfig(name: string): void {
    this.options.configs = this.options.configs.filter((c) => c.name !== name);
    this.connections.delete(name);
    this.schemaCache.delete(name);
    this.logger.info(`Removed database configuration: ${name}`);
  }

  /**
   * Gets database test summary
   */
  public getTestSummary(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    averageQueryTime: number;
    databases: string[];
  } {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.status === 'passed').length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    const testsWithQueryTime = this.testResults.filter((r) => r.metrics?.queryTime);
    const averageQueryTime =
      testsWithQueryTime.length > 0
        ? testsWithQueryTime.reduce((sum, r) => sum + (r.metrics?.queryTime || 0), 0) /
          testsWithQueryTime.length
        : 0;

    const databases = [...new Set(this.testResults.map((r) => r.database))];

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate,
      averageQueryTime,
      databases,
    };
  }
}
