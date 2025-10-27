/**
 * @file types.ts
 * @description Common types used across the testing system
 */

/**
 * Represents a component that can be tested
 */
export interface TestableComponent {
  /** Component name */
  name: string;
  /** Component type (class, function, etc.) */
  type: 'class' | 'function' | 'module' | 'component' | 'hook' | 'api';
  /** File path */
  filePath: string;
  /** File extension */
  extension: string;
  /** Component source code */
  sourceCode: string;
  /** Component exports */
  exports: string[];
  /** Component dependencies */
  dependencies: string[];
  /** Component methods (for classes) */
  methods?: MethodInfo[];
  /** Component parameters (for functions) */
  parameters?: ParameterInfo[];
  /** Component return type (for functions) */
  returnType?: string;
  /** Component props (for React components) */
  props?: PropInfo[];
  /** Component state (for React components) */
  state?: StateInfo[];
  /** Component hooks (for React components) */
  hooks?: HookInfo[];
  /** Component API endpoints (for API components) */
  endpoints?: EndpointInfo[];
  /** Component metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a method in a class
 */
export interface MethodInfo {
  /** Method name */
  name: string;
  /** Method visibility */
  visibility: 'public' | 'protected' | 'private';
  /** Method parameters */
  parameters: ParameterInfo[];
  /** Method return type */
  returnType: string;
  /** Method is async */
  isAsync: boolean;
  /** Method is static */
  isStatic: boolean;
  /** Method source code */
  sourceCode: string;
  /** Method complexity */
  complexity?: number;
}

/**
 * Represents a parameter in a function or method
 */
export interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Parameter is optional */
  isOptional: boolean;
  /** Parameter default value */
  defaultValue?: string;
  /** Parameter is rest parameter */
  isRest?: boolean;
}

/**
 * Represents a prop in a React component
 */
export interface PropInfo {
  /** Prop name */
  name: string;
  /** Prop type */
  type: string;
  /** Prop is required */
  isRequired: boolean;
  /** Prop default value */
  defaultValue?: string;
  /** Prop description */
  description?: string;
}

/**
 * Represents a state variable in a React component
 */
export interface StateInfo {
  /** State name */
  name: string;
  /** State type */
  type: string;
  /** State initial value */
  initialValue?: string;
  /** State setter function */
  setter: string;
}

/**
 * Represents a hook in a React component
 */
export interface HookInfo {
  /** Hook name */
  name: string;
  /** Hook type */
  type: string;
  /** Hook dependencies */
  dependencies?: string[];
  /** Hook source code */
  sourceCode: string;
}

/**
 * Represents an API endpoint
 */
export interface EndpointInfo {
  /** Endpoint path */
  path: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request parameters */
  parameters: ParameterInfo[];
  /** Response type */
  responseType: string;
  /** Status codes */
  statusCodes: number[];
  /** Authentication required */
  requiresAuth: boolean;
}

/**
 * Represents the structure of analyzed code
 */
export interface CodeStructure {
  /** Project name */
  projectName: string;
  /** Root directory */
  rootDir: string;
  /** Source files */
  files: string[];
  /** Testable components */
  components: TestableComponent[];
  /** Dependencies between components */
  dependencies: Record<string, string[]>;
  /** Project structure metadata */
  metadata: Record<string, unknown>;
}

/**
 * Represents test coverage results
 */
export interface CoverageResult {
  /** Coverage percentage */
  percentage: number;
  /** Statement coverage */
  statements: {
    covered: number;
    total: number;
    percentage: number;
  };
  /** Branch coverage */
  branches: {
    covered: number;
    total: number;
    percentage: number;
  };
  /** Function coverage */
  functions: {
    covered: number;
    total: number;
    percentage: number;
  };
  /** Line coverage */
  lines: {
    covered: number;
    total: number;
    percentage: number;
  };
  /** Uncovered components */
  uncoveredComponents: TestableComponent[];
  /** Coverage report file */
  reportFile?: string;
}

/**
 * Represents test performance metrics
 */
export interface PerformanceMetrics {
  /** Test execution time (ms) */
  executionTime: number;
  /** Test setup time (ms) */
  setupTime: number;
  /** Test teardown time (ms) */
  teardownTime: number;
  /** Memory usage (MB) */
  memoryUsage: number;
  /** CPU usage (%) */
  cpuUsage: number;
  /** Number of assertions */
  assertionCount: number;
  /** Number of tests */
  testCount: number;
  /** Test bottlenecks */
  bottlenecks: {
    /** Bottleneck component */
    component: string;
    /** Bottleneck type */
    type: 'setup' | 'execution' | 'assertion' | 'teardown';
    /** Bottleneck duration (ms) */
    duration: number;
    /** Bottleneck impact (%) */
    impact: number;
  }[];
}

/**
 * Represents test effectiveness metrics
 */
export interface EffectivenessMetrics {
  /** Defect detection rate (%) */
  defectDetectionRate: number;
  /** Test reliability (%) */
  reliability: number;
  /** Maintenance cost (hours per month) */
  maintenanceCost: number;
  /** Execution speed (tests per second) */
  executionSpeed: number;
  /** Coverage efficiency (coverage % per test) */
  coverageEfficiency: number;
  /** Metrics trends */
  trends: {
    /** Metric name */
    metric: string;
    /** Metric values over time */
    values: number[];
    /** Metric timestamps */
    timestamps: string[];
  }[];
}
