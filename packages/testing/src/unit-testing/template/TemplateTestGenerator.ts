/**
 * @file TemplateTestGenerator.ts
 * @description Template-based test generator for fallback test generation
 */

import { Logger } from '../../common/Logger';
import { TestableComponent } from '../../common/types';

/**
 * Configuration options for template test generation
 */
export interface TemplateTestGeneratorOptions {
  /** Test framework to target */
  framework: 'jest' | 'mocha' | 'vitest';
  /** Template directory */
  templateDir?: string;
  /** Include setup/teardown */
  includeSetupTeardown?: boolean;
  /** Include mocking */
  includeMocking?: boolean;
}

/**
 * Template-based test generator for creating standardized unit tests
 */
export class TemplateTestGenerator {
  private options: TemplateTestGeneratorOptions;
  private logger: Logger;
  private templates: Map<string, string>;

  constructor(options: TemplateTestGeneratorOptions) {
    this.options = {
      includeSetupTeardown: true,
      includeMocking: false,
      ...options,
    };

    this.logger = new Logger('TemplateTestGenerator');
    this.templates = new Map();

    this.initializeTemplates();
  }

  /**
   * Generates tests for a component using templates
   * @param component Component to generate tests for
   * @returns Generated test code
   */
  public async generateTestsForComponent(component: TestableComponent): Promise<string> {
    this.logger.info(`Generating template-based tests for ${component.name}`);

    try {
      const template = this.getTemplateForComponent(component);
      const testCode = this.populateTemplate(template, component);

      return testCode;
    } catch (error) {
      this.logger.error(
        `Template test generation failed for ${component.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Gets appropriate template for component type
   * @param component Component to get template for
   * @returns Template string
   */
  private getTemplateForComponent(component: TestableComponent): string {
    const templateKey = `${component.type}_${this.options.framework}`;
    const template = this.templates.get(templateKey);

    if (template) {
      return template;
    }

    // Fall back to generic template
    const genericTemplate = this.templates.get(`generic_${this.options.framework}`);
    if (genericTemplate) {
      return genericTemplate;
    }

    throw new Error(`No template found for component type: ${component.type}`);
  }

  /**
   * Populates template with component data
   * @param template Template string
   * @param component Component data
   * @returns Populated template
   */
  private populateTemplate(template: string, component: TestableComponent): string {
    let populatedTemplate = template;

    // Replace placeholders with component data
    populatedTemplate = populatedTemplate.replace(/\{\{componentName\}\}/g, component.name);
    populatedTemplate = populatedTemplate.replace(/\{\{componentPath\}\}/g, component.filePath);
    populatedTemplate = populatedTemplate.replace(/\{\{componentType\}\}/g, component.type);

    // Add methods tests
    if (component.methods && component.methods.length > 0) {
      const methodTests = this.generateMethodTests(component.methods);
      populatedTemplate = populatedTemplate.replace(/\{\{methodTests\}\}/g, methodTests);
    } else {
      populatedTemplate = populatedTemplate.replace(/\{\{methodTests\}\}/g, '');
    }

    // Add props tests for React components
    if (component.props && component.props.length > 0) {
      const propsTests = this.generatePropsTests(component.props);
      populatedTemplate = populatedTemplate.replace(/\{\{propsTests\}\}/g, propsTests);
    } else {
      populatedTemplate = populatedTemplate.replace(/\{\{propsTests\}\}/g, '');
    }

    // Add setup/teardown if enabled
    if (this.options.includeSetupTeardown) {
      const setupTeardown = this.generateSetupTeardown(component);
      populatedTemplate = populatedTemplate.replace(/\{\{setupTeardown\}\}/g, setupTeardown);
    } else {
      populatedTemplate = populatedTemplate.replace(/\{\{setupTeardown\}\}/g, '');
    }

    return populatedTemplate;
  }

  /**
   * Generates method tests
   * @param methods Array of method information
   * @returns Generated method tests
   */
  private generateMethodTests(methods: any[]): string {
    let methodTests = '';

    for (const method of methods) {
      methodTests += `
  describe('${method.name}', () => {
    it('should be defined', () => {
      expect(instance.${method.name}).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof instance.${method.name}).toBe('function');
    });

    ${
      method.isAsync
        ? `
    it('should return a promise', () => {
      const result = instance.${method.name}();
      expect(result).toBeInstanceOf(Promise);
    });
    `
        : ''
    }

    ${
      method.parameters && method.parameters.length > 0
        ? `
    it('should handle valid parameters', ${method.isAsync ? 'async ' : ''}() => {
      const result = ${method.isAsync ? 'await ' : ''}instance.${method.name}(${this.generateMethodParams(method.parameters)});
      expect(result).toBeDefined();
    });
    `
        : ''
    }

    ${
      method.returnType && method.returnType !== 'void'
        ? `
    it('should return correct type', ${method.isAsync ? 'async ' : ''}() => {
      const result = ${method.isAsync ? 'await ' : ''}instance.${method.name}(${this.generateMethodParams(method.parameters || [])});
      ${this.generateTypeAssertion(method.returnType, 'result')}
    });
    `
        : ''
    }
  });
`;
    }

    return methodTests;
  }

  /**
   * Generates props tests for React components
   * @param props Array of prop information
   * @returns Generated props tests
   */
  private generatePropsTests(props: any[]): string {
    let propsTests = '';

    for (const prop of props) {
      propsTests += `
  describe('${prop.name} prop', () => {
    it('should accept ${prop.type} type', () => {
      const testValue = ${this.generateTestValue(prop.type)};
      const wrapper = render(<{{componentName}} ${prop.name}={testValue} />);
      expect(wrapper).toBeDefined();
    });

    ${
      prop.isRequired
        ? `
    it('should be required', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      render(<{{componentName}} />);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
    `
        : ''
    }

    ${
      prop.defaultValue
        ? `
    it('should have default value', () => {
      const wrapper = render(<{{componentName}} />);
      expect(wrapper.prop('${prop.name}')).toBe(${prop.defaultValue});
    });
    `
        : ''
    }
  });
`;
    }

    return propsTests;
  }

  /**
   * Generates setup and teardown code
   * @param component Component information
   * @returns Setup and teardown code
   */
  private generateSetupTeardown(component: TestableComponent): string {
    let setupTeardown = '';

    if (component.type === 'class') {
      setupTeardown = `
  let instance: ${component.name};

  beforeEach(() => {
    instance = new ${component.name}();
  });

  afterEach(() => {
    // Cleanup
    instance = null;
  });
`;
    } else if (component.type === 'component') {
      setupTeardown = `
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });
`;
    }

    return setupTeardown;
  }

  /**
   * Generates method parameters for test calls
   * @param parameters Array of parameter information
   * @returns Generated parameters string
   */
  private generateMethodParams(parameters: any[]): string {
    return parameters.map((param) => this.generateTestValue(param.type)).join(', ');
  }

  /**
   * Generates test value for a given type
   * @param type Data type
   * @returns Test value string
   */
  private generateTestValue(type: string): string {
    switch (type.toLowerCase()) {
      case 'string':
        return '"test"';
      case 'number':
        return '42';
      case 'boolean':
        return 'true';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      case 'date':
        return 'new Date()';
      case 'function':
        return 'jest.fn()';
      default:
        return 'null';
    }
  }

  /**
   * Generates type assertion for a given type
   * @param type Return type
   * @param variable Variable name
   * @returns Type assertion string
   */
  private generateTypeAssertion(type: string, variable: string): string {
    switch (type.toLowerCase()) {
      case 'string':
        return `expect(typeof ${variable}).toBe('string');`;
      case 'number':
        return `expect(typeof ${variable}).toBe('number');`;
      case 'boolean':
        return `expect(typeof ${variable}).toBe('boolean');`;
      case 'array':
        return `expect(Array.isArray(${variable})).toBe(true);`;
      case 'object':
        return `expect(typeof ${variable}).toBe('object');`;
      case 'promise':
        return `expect(${variable}).toBeInstanceOf(Promise);`;
      default:
        return `expect(${variable}).toBeDefined();`;
    }
  }

  /**
   * Initializes test templates
   */
  private initializeTemplates(): void {
    // Jest templates
    this.templates.set('class_jest', this.getClassJestTemplate());
    this.templates.set('function_jest', this.getFunctionJestTemplate());
    this.templates.set('component_jest', this.getComponentJestTemplate());
    this.templates.set('generic_jest', this.getGenericJestTemplate());

    // Mocha templates
    this.templates.set('class_mocha', this.getClassMochaTemplate());
    this.templates.set('function_mocha', this.getFunctionMochaTemplate());
    this.templates.set('generic_mocha', this.getGenericMochaTemplate());

    // Vitest templates
    this.templates.set('class_vitest', this.getClassVitestTemplate());
    this.templates.set('function_vitest', this.getFunctionVitestTemplate());
    this.templates.set('generic_vitest', this.getGenericVitestTemplate());
  }

  // Template definitions
  private getClassJestTemplate(): string {
    return `import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).toBeDefined();
  });

  it('should create an instance', () => {
    expect(instance).toBeInstanceOf({{componentName}});
  });

  {{methodTests}}
});
`;
  }

  private getFunctionJestTemplate(): string {
    return `import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof {{componentName}}).toBe('function');
  });

  it('should execute without errors', () => {
    expect(() => {{componentName}}()).not.toThrow();
  });
});
`;
  }

  private getComponentJestTemplate(): string {
    return `import React from 'react';
import { render, screen } from '@testing-library/react';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should render without crashing', () => {
    render(<{{componentName}} />);
    expect(screen.getByTestId('{{componentName}}')).toBeInTheDocument();
  });

  {{propsTests}}
});
`;
  }

  private getGenericJestTemplate(): string {
    return `import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).toBeDefined();
  });

  {{methodTests}}
});
`;
  }

  private getClassMochaTemplate(): string {
    return `import { expect } from 'chai';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).to.not.be.undefined;
  });

  it('should create an instance', () => {
    expect(instance).to.be.an.instanceof({{componentName}});
  });

  {{methodTests}}
});
`;
  }

  private getFunctionMochaTemplate(): string {
    return `import { expect } from 'chai';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).to.not.be.undefined;
  });

  it('should be a function', () => {
    expect({{componentName}}).to.be.a('function');
  });
});
`;
  }

  private getGenericMochaTemplate(): string {
    return `import { expect } from 'chai';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).to.not.be.undefined;
  });

  {{methodTests}}
});
`;
  }

  private getClassVitestTemplate(): string {
    return `import { describe, it, expect, beforeEach } from 'vitest';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).toBeDefined();
  });

  it('should create an instance', () => {
    expect(instance).toBeInstanceOf({{componentName}});
  });

  {{methodTests}}
});
`;
  }

  private getFunctionVitestTemplate(): string {
    return `import { describe, it, expect } from 'vitest';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof {{componentName}}).toBe('function');
  });
});
`;
  }

  private getGenericVitestTemplate(): string {
    return `import { describe, it, expect } from 'vitest';
import { {{componentName}} } from '{{componentPath}}';

describe('{{componentName}}', () => {
  {{setupTeardown}}

  it('should be defined', () => {
    expect({{componentName}}).toBeDefined();
  });

  {{methodTests}}
});
`;
  }
}
