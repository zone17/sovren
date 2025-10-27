/**
 * @file TestDataGenerator.ts
 * @description Automated test data generation and management system
 */

import { Logger } from '../../common/Logger';
import { ParameterInfo, TestableComponent } from '../../common/types';

/**
 * Configuration options for test data generation
 */
export interface TestDataGeneratorOptions {
  /** Enable data generation */
  enabled?: boolean;
  /** Data generation strategy */
  strategy?: 'random' | 'realistic' | 'boundary' | 'comprehensive';
  /** Maximum data size for arrays/objects */
  maxDataSize?: number;
  /** Include edge cases */
  includeEdgeCases?: boolean;
  /** Include invalid data */
  includeInvalidData?: boolean;
  /** Custom data providers */
  customProviders?: Record<string, () => any>;
}

/**
 * Automated test data generator for unit tests
 */
export class TestDataGenerator {
  private options: TestDataGeneratorOptions;
  private logger: Logger;
  private dataProviders: Map<string, () => any>;
  private generatedData: Map<string, any>;

  constructor(options: TestDataGeneratorOptions = {}) {
    this.options = {
      enabled: true,
      strategy: 'comprehensive',
      maxDataSize: 10,
      includeEdgeCases: true,
      includeInvalidData: true,
      customProviders: {},
      ...options,
    };

    this.logger = new Logger('TestDataGenerator');
    this.dataProviders = new Map();
    this.generatedData = new Map();

    this.initializeDataProviders();
  }

  /**
   * Generates test data for a component
   * @param component Component to generate data for
   * @returns Generated test data
   */
  public async generateTestData(component: TestableComponent): Promise<Record<string, any>> {
    if (!this.options.enabled) {
      return {};
    }

    this.logger.info(`Generating test data for ${component.name}`);

    const testData: Record<string, any> = {};

    // Generate data for component methods
    if (component.methods) {
      for (const method of component.methods) {
        const methodData = await this.generateMethodTestData(method);
        testData[method.name] = methodData;
      }
    }

    // Generate data for component parameters (if it's a function)
    if (component.parameters) {
      const parameterData = await this.generateParameterTestData(component.parameters);
      testData.parameters = parameterData;
    }

    // Generate data for component props (if it's a React component)
    if (component.props) {
      const propsData = await this.generatePropsTestData(component.props);
      testData.props = propsData;
    }

    // Cache generated data
    this.generatedData.set(component.name, testData);

    return testData;
  }

  /**
   * Generates test data based on requirements
   * @param requirements Data requirements
   * @returns Generated test data
   */
  public async generateDataFromRequirements(
    requirements: Record<string, any>
  ): Promise<Record<string, any>> {
    this.logger.info('Generating test data from requirements');

    const testData: Record<string, any> = {};

    for (const [key, requirement] of Object.entries(requirements)) {
      testData[key] = await this.generateDataForRequirement(requirement);
    }

    return testData;
  }

  /**
   * Generates method-specific test data
   * @param method Method information
   * @returns Generated method test data
   */
  private async generateMethodTestData(method: any): Promise<Record<string, any>> {
    const methodData: Record<string, any> = {
      validInputs: [],
      invalidInputs: [],
      edgeCases: [],
      expectedOutputs: [],
    };

    // Generate valid inputs
    if (method.parameters) {
      for (let i = 0; i < 3; i++) {
        // Generate 3 sets of valid inputs
        const validInput = method.parameters.map((param: ParameterInfo) =>
          this.generateValidValue(param.type)
        );
        methodData.validInputs.push(validInput);
      }
    }

    // Generate invalid inputs if enabled
    if (this.options.includeInvalidData && method.parameters) {
      for (const param of method.parameters) {
        const invalidInput = this.generateInvalidValue(param.type);
        methodData.invalidInputs.push(invalidInput);
      }
    }

    // Generate edge cases if enabled
    if (this.options.includeEdgeCases && method.parameters) {
      for (const param of method.parameters) {
        const edgeCases = this.generateEdgeCases(param.type);
        methodData.edgeCases.push(...edgeCases);
      }
    }

    // Generate expected outputs
    if (method.returnType && method.returnType !== 'void') {
      for (let i = 0; i < 3; i++) {
        const expectedOutput = this.generateValidValue(method.returnType);
        methodData.expectedOutputs.push(expectedOutput);
      }
    }

    return methodData;
  }

  /**
   * Generates parameter-specific test data
   * @param parameters Parameter information
   * @returns Generated parameter test data
   */
  private async generateParameterTestData(
    parameters: ParameterInfo[]
  ): Promise<Record<string, any>> {
    const parameterData: Record<string, any> = {
      validSets: [],
      invalidSets: [],
      edgeCaseSets: [],
    };

    // Generate valid parameter sets
    for (let i = 0; i < 5; i++) {
      const validSet = parameters.map((param) => this.generateValidValue(param.type));
      parameterData.validSets.push(validSet);
    }

    // Generate invalid parameter sets
    if (this.options.includeInvalidData) {
      for (const param of parameters) {
        const invalidSet = parameters.map((p) =>
          p.name === param.name
            ? this.generateInvalidValue(p.type)
            : this.generateValidValue(p.type)
        );
        parameterData.invalidSets.push(invalidSet);
      }
    }

    // Generate edge case parameter sets
    if (this.options.includeEdgeCases) {
      for (const param of parameters) {
        const edgeCases = this.generateEdgeCases(param.type);
        for (const edgeCase of edgeCases) {
          const edgeCaseSet = parameters.map((p) =>
            p.name === param.name ? edgeCase : this.generateValidValue(p.type)
          );
          parameterData.edgeCaseSets.push(edgeCaseSet);
        }
      }
    }

    return parameterData;
  }

  /**
   * Generates props-specific test data
   * @param props Props information
   * @returns Generated props test data
   */
  private async generatePropsTestData(props: any[]): Promise<Record<string, any>> {
    const propsData: Record<string, any> = {
      validProps: {},
      invalidProps: {},
      edgeCaseProps: {},
    };

    // Generate valid props
    for (const prop of props) {
      propsData.validProps[prop.name] = this.generateValidValue(prop.type);
    }

    // Generate invalid props
    if (this.options.includeInvalidData) {
      for (const prop of props) {
        propsData.invalidProps[prop.name] = this.generateInvalidValue(prop.type);
      }
    }

    // Generate edge case props
    if (this.options.includeEdgeCases) {
      for (const prop of props) {
        const edgeCases = this.generateEdgeCases(prop.type);
        propsData.edgeCaseProps[prop.name] = edgeCases;
      }
    }

    return propsData;
  }

  /**
   * Generates data for a specific requirement
   * @param requirement Data requirement
   * @returns Generated data
   */
  private async generateDataForRequirement(requirement: any): Promise<any> {
    if (typeof requirement === 'string') {
      return this.generateValidValue(requirement);
    }

    if (typeof requirement === 'object' && requirement.type) {
      return this.generateValidValue(requirement.type);
    }

    return requirement;
  }

  /**
   * Generates valid value for a given type
   * @param type Data type
   * @returns Valid value
   */
  private generateValidValue(type: string): any {
    const provider = this.dataProviders.get(type);
    if (provider) {
      return provider();
    }

    // Handle complex types
    switch (type.toLowerCase()) {
      case 'string':
        return this.generateString();
      case 'number':
        return this.generateNumber();
      case 'boolean':
        return this.generateBoolean();
      case 'array':
        return this.generateArray();
      case 'object':
        return this.generateObject();
      case 'date':
        return this.generateDate();
      case 'email':
        return this.generateEmail();
      case 'url':
        return this.generateUrl();
      case 'uuid':
        return this.generateUuid();
      case 'phone':
        return this.generatePhone();
      case 'address':
        return this.generateAddress();
      default:
        return this.generateDefault(type);
    }
  }

  /**
   * Generates invalid value for a given type
   * @param type Data type
   * @returns Invalid value
   */
  private generateInvalidValue(type: string): any {
    switch (type.toLowerCase()) {
      case 'string':
        return null;
      case 'number':
        return 'invalid-number';
      case 'boolean':
        return 'invalid-boolean';
      case 'array':
        return 'not-an-array';
      case 'object':
        return 'not-an-object';
      case 'date':
        return 'invalid-date';
      case 'email':
        return 'invalid-email';
      case 'url':
        return 'invalid-url';
      case 'uuid':
        return 'invalid-uuid';
      case 'phone':
        return 'invalid-phone';
      default:
        return undefined;
    }
  }

  /**
   * Generates edge cases for a given type
   * @param type Data type
   * @returns Array of edge cases
   */
  private generateEdgeCases(type: string): any[] {
    switch (type.toLowerCase()) {
      case 'string':
        return ['', ' ', '   ', '\n', '\t', '\\', '"', "'", '"`\'\\'];
      case 'number':
        return [
          0,
          -1,
          1,
          Number.MAX_VALUE,
          Number.MIN_VALUE,
          Number.NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ];
      case 'boolean':
        return [true, false];
      case 'array':
        return [[], [null], [undefined], new Array(this.options.maxDataSize).fill(0)];
      case 'object':
        return [{}, { null: null }, { undefined: undefined }];
      case 'date':
        return [
          new Date(0),
          new Date('invalid'),
          new Date(8640000000000000),
          new Date(-8640000000000000),
        ];
      default:
        return [null, undefined];
    }
  }

  /**
   * Initializes data providers
   */
  private initializeDataProviders(): void {
    // Basic type providers
    this.dataProviders.set('string', () => this.generateString());
    this.dataProviders.set('number', () => this.generateNumber());
    this.dataProviders.set('boolean', () => this.generateBoolean());
    this.dataProviders.set('array', () => this.generateArray());
    this.dataProviders.set('object', () => this.generateObject());
    this.dataProviders.set('date', () => this.generateDate());

    // Specialized providers
    this.dataProviders.set('email', () => this.generateEmail());
    this.dataProviders.set('url', () => this.generateUrl());
    this.dataProviders.set('uuid', () => this.generateUuid());
    this.dataProviders.set('phone', () => this.generatePhone());
    this.dataProviders.set('address', () => this.generateAddress());

    // Add custom providers
    if (this.options.customProviders) {
      for (const [type, provider] of Object.entries(this.options.customProviders)) {
        this.dataProviders.set(type, provider);
      }
    }
  }

  // Data generation methods
  private generateString(): string {
    const strings = [
      'test',
      'sample',
      'example',
      'data',
      'value',
      'content',
      'information',
      'text',
      'message',
      'input',
    ];
    return strings[Math.floor(Math.random() * strings.length)];
  }

  private generateNumber(): number {
    return Math.floor(Math.random() * 1000);
  }

  private generateBoolean(): boolean {
    return Math.random() > 0.5;
  }

  private generateArray(): any[] {
    const length = Math.floor(Math.random() * (this.options.maxDataSize || 10));
    return Array.from({ length }, (_, i) => i);
  }

  private generateObject(): Record<string, any> {
    return {
      id: Math.floor(Math.random() * 1000),
      name: this.generateString(),
      active: this.generateBoolean(),
      created: this.generateDate(),
    };
  }

  private generateDate(): Date {
    return new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000));
  }

  private generateEmail(): string {
    const domains = ['test.com', 'example.org', 'sample.net', 'demo.io'];
    const usernames = ['user', 'test', 'demo', 'sample', 'example'];
    const username = usernames[Math.floor(Math.random() * usernames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${username}${Math.floor(Math.random() * 1000)}@${domain}`;
  }

  private generateUrl(): string {
    const protocols = ['http', 'https'];
    const domains = ['example.com', 'test.org', 'sample.net', 'demo.io'];
    const paths = ['', '/api', '/users', '/data', '/content'];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    return `${protocol}://${domain}${path}`;
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private generatePhone(): string {
    const areaCodes = ['555', '123', '456', '789'];
    const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
    const prefix = Math.floor(Math.random() * 900) + 100;
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    return `${areaCode}-${prefix}-${suffix}`;
  }

  private generateAddress(): Record<string, string> {
    const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Cedar Ln', 'Elm Dr'];
    const cities = ['Springfield', 'Madison', 'Georgetown', 'Franklin', 'Clinton'];
    const states = ['CA', 'NY', 'TX', 'FL', 'IL'];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const state = states[Math.floor(Math.random() * states.length)];
    const zipCode = Math.floor(Math.random() * 90000) + 10000;

    return {
      street: `${Math.floor(Math.random() * 9999) + 1} ${street}`,
      city,
      state,
      zipCode: zipCode.toString(),
    };
  }

  private generateDefault(type: string): any {
    this.logger.warn(`No provider found for type: ${type}, using default value`);
    return `default-${type}`;
  }
}
