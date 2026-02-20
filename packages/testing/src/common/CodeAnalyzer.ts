// @ts-nocheck
/**
 * @file CodeAnalyzer.ts
 * @description Analyzes source code to extract testable components and structure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from './Logger';
import { CodeStructure, TestableComponent } from './types';

/**
 * Configuration options for the code analyzer
 */
export interface CodeAnalyzerOptions {
  /** File extensions to analyze */
  fileExtensions?: string[];
  /** Directories to exclude */
  excludeDirs?: string[];
  /** Files to exclude */
  excludeFiles?: string[];
  /** Maximum depth for directory traversal */
  maxDepth?: number;
  /** Enable detailed analysis */
  detailedAnalysis?: boolean;
}

/**
 * Analyzes source code to extract testable components and structure
 */
export class CodeAnalyzer {
  private options: CodeAnalyzerOptions;
  private logger: Logger;

  /**
   * Creates a new CodeAnalyzer instance
   * @param options Configuration options
   */
  constructor(options: CodeAnalyzerOptions = {}) {
    this.options = {
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git'],
      excludeFiles: ['.d.ts', '.test.', '.spec.', '.min.'],
      maxDepth: 10,
      detailedAnalysis: true,
      ...options,
    };

    this.logger = new Logger('CodeAnalyzer');
  }

  /**
   * Analyzes code in the specified directory
   * @param targetPath Path to the directory or file to analyze
   * @returns Analyzed code structure
   */
  public async analyzeCode(targetPath: string): Promise<CodeStructure> {
    this.logger.info(`Analyzing code at ${targetPath}`);

    const isDirectory = await this.isDirectory(targetPath);

    // Initialize code structure
    const codeStructure: CodeStructure = {
      projectName: path.basename(targetPath),
      rootDir: targetPath,
      files: [],
      components: [],
      dependencies: {},
      metadata: {
        analysisDate: new Date().toISOString(),
        analyzer: 'CodeAnalyzer',
        version: '1.0.0',
      },
    };

    if (isDirectory) {
      // Scan directory for files
      await this.scanDirectory(targetPath, codeStructure, 0);
    } else {
      // Analyze single file
      const fileExtension = path.extname(targetPath);
      if (this.options.fileExtensions.includes(fileExtension)) {
        codeStructure.files.push(targetPath);
        await this.analyzeFile(targetPath, codeStructure);
      }
    }

    // Analyze dependencies between components
    this.analyzeDependencies(codeStructure);

    this.logger.info(
      `Analysis complete: Found ${codeStructure.files.length} files and ${codeStructure.components.length} components`
    );

    return codeStructure;
  }

  /**
   * Analyzes data requirements for tests
   * @param testScope Scope of tests requiring data
   * @returns Data requirements
   */
  public async analyzeDataRequirements(testScope: string): Promise<Record<string, unknown>> {
    this.logger.info(`Analyzing data requirements for ${testScope}`);

    // This would typically involve analyzing the test scope to determine
    // what kind of data is needed for testing

    // For this example, we'll return some mock requirements
    return {
      scope: testScope,
      types: ['user', 'product', 'order'],
      complexity: 'medium',
      volume: {
        small: 10,
        medium: 100,
        large: 1000,
      },
      relationships: true,
      constraints: {
        uniqueFields: ['id', 'email'],
        referentialIntegrity: true,
      },
    };
  }

  /**
   * Recursively scans a directory for files to analyze
   * @param dirPath Directory path
   * @param codeStructure Code structure to update
   * @param depth Current recursion depth
   */
  private async scanDirectory(
    dirPath: string,
    codeStructure: CodeStructure,
    depth: number
  ): Promise<void> {
    // Check max depth
    if (depth > this.options.maxDepth) {
      this.logger.debug(`Max depth reached at ${dirPath}, skipping`);
      return;
    }

    // Read directory contents
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (
          this.options.excludeDirs.some(
            (dir) => entry.name === dir || entry.name.startsWith(dir + '/')
          )
        ) {
          this.logger.debug(`Skipping excluded directory: ${entryPath}`);
          continue;
        }

        // Recursively scan subdirectory
        await this.scanDirectory(entryPath, codeStructure, depth + 1);
      } else if (entry.isFile()) {
        // Check file extension
        const fileExtension = path.extname(entry.name);
        if (!this.options.fileExtensions.includes(fileExtension)) {
          continue;
        }

        // Skip excluded files
        if (this.options.excludeFiles.some((pattern) => entry.name.includes(pattern))) {
          this.logger.debug(`Skipping excluded file: ${entryPath}`);
          continue;
        }

        // Add file to list and analyze it
        codeStructure.files.push(entryPath);
        await this.analyzeFile(entryPath, codeStructure);
      }
    }
  }

  /**
   * Analyzes a single file and extracts components
   * @param filePath File path
   * @param codeStructure Code structure to update
   */
  private async analyzeFile(filePath: string, codeStructure: CodeStructure): Promise<void> {
    this.logger.debug(`Analyzing file: ${filePath}`);

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract components from file
      const components = await this.extractComponents(filePath, content);

      // Add components to code structure
      codeStructure.components.push(...components);
    } catch (error) {
      this.logger.error(`Failed to analyze file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Extracts testable components from file content
   * @param filePath File path
   * @param content File content
   * @returns Extracted components
   */
  private async extractComponents(filePath: string, content: string): Promise<TestableComponent[]> {
    const components: TestableComponent[] = [];
    const fileExtension = path.extname(filePath).substring(1); // Remove leading dot

    // In a real implementation, this would use a parser like TypeScript's
    // compiler API or Babel to extract component information

    // For this example, we'll use some simple regex-based extraction
    // to simulate the process

    // Extract classes
    const classMatches =
      content.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g) ||
      [];
    for (const match of classMatches) {
      const className = match.match(/class\s+(\w+)/)[1];

      components.push({
        name: className,
        type: 'class',
        filePath,
        extension: fileExtension,
        sourceCode: this.extractClassCode(content, className),
        exports: this.extractExports(content, className),
        dependencies: this.extractDependencies(content, className),
        methods: this.extractMethods(content, className),
      });
    }

    // Extract functions
    const functionMatches =
      content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g) || [];
    for (const match of functionMatches) {
      const functionName = match.match(/function\s+(\w+)/)[1];

      components.push({
        name: functionName,
        type: 'function',
        filePath,
        extension: fileExtension,
        sourceCode: this.extractFunctionCode(content, functionName),
        exports: this.extractExports(content, functionName),
        dependencies: this.extractDependencies(content, functionName),
        parameters: this.extractParameters(content, functionName),
        returnType: this.extractReturnType(content, functionName),
      });
    }

    // Extract React components (functional)
    const reactComponentMatches =
      content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>\s*\{/g) || [];
    for (const match of reactComponentMatches) {
      const componentName = match.match(/const\s+(\w+)/)[1];

      // Only include components that start with uppercase (React convention)
      if (componentName[0] === componentName[0].toUpperCase()) {
        components.push({
          name: componentName,
          type: 'component',
          filePath,
          extension: fileExtension,
          sourceCode: this.extractComponentCode(content, componentName),
          exports: this.extractExports(content, componentName),
          dependencies: this.extractDependencies(content, componentName),
          props: this.extractProps(content, componentName),
          hooks: this.extractHooks(content, componentName),
        });
      }
    }

    // Extract React hooks
    const hookMatches = content.match(/(?:export\s+)?(?:function|const)\s+(use\w+)/g) || [];
    for (const match of hookMatches) {
      const hookName = match.match(/(?:function|const)\s+(use\w+)/)[1];

      components.push({
        name: hookName,
        type: 'hook',
        filePath,
        extension: fileExtension,
        sourceCode: this.extractHookCode(content, hookName),
        exports: this.extractExports(content, hookName),
        dependencies: this.extractDependencies(content, hookName),
        parameters: this.extractParameters(content, hookName),
        returnType: this.extractReturnType(content, hookName),
      });
    }

    // Extract API endpoints
    if (
      content.includes('router') &&
      (content.includes('.get(') ||
        content.includes('.post(') ||
        content.includes('.put(') ||
        content.includes('.delete('))
    ) {
      const apiComponent: TestableComponent = {
        name: path.basename(filePath, path.extname(filePath)),
        type: 'api',
        filePath,
        extension: fileExtension,
        sourceCode: content,
        exports: [],
        dependencies: this.extractDependencies(content, ''),
        endpoints: this.extractEndpoints(content),
      };

      components.push(apiComponent);
    }

    return components;
  }

  /**
   * Analyzes dependencies between components
   * @param codeStructure Code structure to analyze
   */
  private analyzeDependencies(codeStructure: CodeStructure): void {
    this.logger.debug('Analyzing dependencies between components');

    // Build a map of component names to their indices
    const componentMap = new Map<string, number>();
    codeStructure.components.forEach((component, index) => {
      componentMap.set(component.name, index);
    });

    // Analyze dependencies for each component
    for (const component of codeStructure.components) {
      const dependencies: string[] = [];

      // Check if this component depends on other components
      for (const dependency of component.dependencies) {
        if (componentMap.has(dependency)) {
          dependencies.push(dependency);
        }
      }

      // Add dependencies to code structure
      codeStructure.dependencies[component.name] = dependencies;
    }
  }

  /**
   * Checks if a path is a directory
   * @param path Path to check
   * @returns True if the path is a directory
   */
  private async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Extracts class code from file content
   * @param content File content
   * @param className Class name
   * @returns Class code
   */
  private extractClassCode(content: string, className: string): string {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const classRegex = new RegExp(`class\\s+${className}[^{]*{([^}]*(?:{[^}]*}[^}]*)*)}`);
    const match = content.match(classRegex);
    return match ? `class ${className} ${match[0]}` : '';
  }

  /**
   * Extracts function code from file content
   * @param content File content
   * @param functionName Function name
   * @returns Function code
   */
  private extractFunctionCode(content: string, functionName: string): string {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const functionRegex = new RegExp(
      `function\\s+${functionName}\\s*\\([^)]*\\)\\s*{([^}]*(?:{[^}]*}[^}]*)*)}`
    );
    const match = content.match(functionRegex);
    return match ? match[0] : '';
  }

  /**
   * Extracts component code from file content
   * @param content File content
   * @param componentName Component name
   * @returns Component code
   */
  private extractComponentCode(content: string, componentName: string): string {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const componentRegex = new RegExp(
      `const\\s+${componentName}\\s*=\\s*(?:\\([^)]*\\)|[^=]*)\\s*=>\\s*{([^}]*(?:{[^}]*}[^}]*)*)}`
    );
    const match = content.match(componentRegex);
    return match ? match[0] : '';
  }

  /**
   * Extracts hook code from file content
   * @param content File content
   * @param hookName Hook name
   * @returns Hook code
   */
  private extractHookCode(content: string, hookName: string): string {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const hookRegex = new RegExp(
      `(?:function|const)\\s+${hookName}\\s*(?:=\\s*)?(?:\\([^)]*\\)|[^=]*)\\s*(?:=>\\s*)?{([^}]*(?:{[^}]*}[^}]*)*)}`
    );
    const match = content.match(hookRegex);
    return match ? match[0] : '';
  }

  /**
   * Extracts exports from file content
   * @param content File content
   * @param name Component name
   * @returns Exports
   */
  private extractExports(content: string, name: string): string[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const exports: string[] = [];

    // Check for named export
    if (content.includes(`export { ${name} }`)) {
      exports.push(name);
    }

    // Check for default export
    if (content.includes(`export default ${name}`)) {
      exports.push('default');
    }

    // Check for direct export
    if (
      content.includes(`export function ${name}`) ||
      content.includes(`export class ${name}`) ||
      content.includes(`export const ${name}`)
    ) {
      exports.push(name);
    }

    return exports;
  }

  /**
   * Extracts dependencies from file content
   * @param content File content
   * @param name Component name
   * @returns Dependencies
   */
  private extractDependencies(content: string, name: string): string[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const dependencies: string[] = [];

    // Extract import statements
    const importMatches =
      content.match(/import\s+(?:{[^}]*}|[^;]*)\s+from\s+['"][^'"]*['"]/g) || [];

    for (const importMatch of importMatches) {
      // Extract imported names
      const namedImports = importMatch.match(/{([^}]*)}/);
      if (namedImports) {
        const names = namedImports[1].split(',').map((n) => n.trim());
        dependencies.push(...names);
      }

      // Extract default import
      const defaultImport = importMatch.match(/import\s+(\w+)\s+from/);
      if (defaultImport) {
        dependencies.push(defaultImport[1]);
      }
    }

    return dependencies;
  }

  /**
   * Extracts methods from class code
   * @param content File content
   * @param className Class name
   * @returns Methods
   */
  private extractMethods(content: string, className: string): any[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const methods: any[] = [];

    // Extract class code first
    const classCode = this.extractClassCode(content, className);

    // Extract method signatures
    const methodMatches =
      classCode.match(
        /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)/g
      ) || [];

    for (const methodMatch of methodMatches) {
      const visibility = methodMatch.includes('public')
        ? 'public'
        : methodMatch.includes('private')
          ? 'private'
          : methodMatch.includes('protected')
            ? 'protected'
            : 'public';

      const isStatic = methodMatch.includes('static');
      const isAsync = methodMatch.includes('async');
      const name = methodMatch.match(
        /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)/
      )[1];

      // Skip constructor
      if (name === 'constructor') {
        continue;
      }

      methods.push({
        name,
        visibility,
        isStatic,
        isAsync,
        parameters: this.extractParameters(classCode, name),
        returnType: this.extractReturnType(classCode, name),
        sourceCode: '', // Would extract the full method body in a real implementation
        complexity: 1, // Would calculate complexity in a real implementation
      });
    }

    return methods;
  }

  /**
   * Extracts parameters from function or method
   * @param content File content
   * @param name Function or method name
   * @returns Parameters
   */
  private extractParameters(content: string, name: string): any[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const parameters: any[] = [];

    // Extract parameter list
    const paramMatch = content.match(new RegExp(`${name}\\s*\\(([^)]*)\\)`));
    if (!paramMatch) {
      return parameters;
    }

    const paramList = paramMatch[1];
    if (!paramList.trim()) {
      return parameters;
    }

    // Split parameters and extract information
    const params = paramList.split(',').map((p) => p.trim());

    for (const param of params) {
      const isOptional = param.includes('?:') || param.includes('=');
      const isRest = param.startsWith('...');

      // Extract name and type
      let name = param;
      let type = 'any';

      if (param.includes(':')) {
        const parts = param.split(':');
        name = parts[0].trim().replace('?', '');
        type = parts[1].split('=')[0].trim();
      } else if (param.includes('=')) {
        name = param.split('=')[0].trim();
      }

      // Remove rest operator from name
      if (name.startsWith('...')) {
        name = name.substring(3);
      }

      parameters.push({
        name,
        type,
        isOptional,
        isRest,
      });
    }

    return parameters;
  }

  /**
   * Extracts return type from function or method
   * @param content File content
   * @param name Function or method name
   * @returns Return type
   */
  private extractReturnType(content: string, name: string): string {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    // Look for return type annotation
    const returnMatch = content.match(new RegExp(`${name}\\s*\\([^)]*\\)\\s*:\\s*([^{;]+)`));
    if (returnMatch) {
      return returnMatch[1].trim();
    }

    // If no explicit return type, check for async to infer Promise
    const asyncMatch = content.match(new RegExp(`async\\s+(?:function\\s+)?${name}`));
    if (asyncMatch) {
      return 'Promise<any>';
    }

    return 'any';
  }

  /**
   * Extracts props from React component
   * @param content File content
   * @param componentName Component name
   * @returns Props
   */
  private extractProps(content: string, componentName: string): any[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const props: any[] = [];

    // Look for Props type or interface
    const propsTypeMatch = content.match(/interface\s+(\w+Props)\s*{([^}]*)}/);
    if (propsTypeMatch) {
      const propsContent = propsTypeMatch[2];
      const propMatches = propsContent.match(/(\w+)(\?)?:\s*([^;]+);/g) || [];

      for (const propMatch of propMatches) {
        const [_, name, optional, type] = propMatch.match(/(\w+)(\?)?:\s*([^;]+);/) || [];

        if (name) {
          props.push({
            name,
            type: type || 'any',
            isRequired: !optional,
            description: this.extractPropDescription(content, name),
          });
        }
      }
    }

    // Look for prop destructuring in function parameters
    const destructuringMatch = content.match(
      new RegExp(`${componentName}\\s*=\\s*\\(\\{([^}]*)\\}`)
    );
    if (destructuringMatch) {
      const destructuredProps = destructuringMatch[1].split(',').map((p) => p.trim());

      for (const prop of destructuredProps) {
        if (prop) {
          // Extract name and default value
          const [name, defaultValue] = prop.split('=').map((p) => p.trim());

          // Skip if already found in props type
          if (!props.some((p) => p.name === name)) {
            props.push({
              name,
              type: 'any',
              isRequired: !defaultValue,
              defaultValue: defaultValue || undefined,
            });
          }
        }
      }
    }

    return props;
  }

  /**
   * Extracts prop description from JSDoc comments
   * @param content File content
   * @param propName Prop name
   * @returns Prop description
   */
  private extractPropDescription(content: string, propName: string): string {
    // This is a simplified implementation
    // In a real implementation, this would use a proper JSDoc parser

    const jsdocMatch = content.match(
      new RegExp(`/\\*\\*[^*]*\\*\\s*@prop\\s*{[^}]*}\\s*${propName}\\s*([^*]*)\\*/`)
    );
    if (jsdocMatch) {
      return jsdocMatch[1].trim();
    }

    return '';
  }

  /**
   * Extracts hooks from React component
   * @param content File content
   * @param componentName Component name
   * @returns Hooks
   */
  private extractHooks(content: string, componentName: string): any[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const hooks: any[] = [];

    // Extract component code first
    const componentCode = this.extractComponentCode(content, componentName);

    // Look for hook calls
    const hookMatches =
      componentCode.match(
        /\b(useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue|useCustomHook\w*)\s*\(/g
      ) || [];

    for (const hookMatch of hookMatches) {
      const hookName = hookMatch.match(/(\w+)\s*\(/)[1];

      // Extract dependencies for certain hooks
      let dependencies: string[] = [];
      if (['useEffect', 'useCallback', 'useMemo', 'useLayoutEffect'].includes(hookName)) {
        const depsMatch = componentCode.match(
          new RegExp(`${hookName}\\s*\\([^\\[]*\\[([^\\]]*)\\]`)
        );
        if (depsMatch) {
          dependencies = depsMatch[1]
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);
        }
      }

      hooks.push({
        name: hookName,
        type: hookName,
        dependencies,
        sourceCode: '', // Would extract the full hook call in a real implementation
      });
    }

    return hooks;
  }

  /**
   * Extracts API endpoints from file content
   * @param content File content
   * @returns Endpoints
   */
  private extractEndpoints(content: string): any[] {
    // This is a simplified implementation
    // In a real implementation, this would use a proper parser

    const endpoints: any[] = [];

    // Look for route definitions
    const routeMatches =
      content.match(/\b(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]/g) || [];

    for (const routeMatch of routeMatches) {
      const [_, method, path] = routeMatch.match(
        /\b(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]/
      );

      endpoints.push({
        path,
        method: method.toUpperCase(),
        parameters: [], // Would extract parameters in a real implementation
        responseType: 'any', // Would extract response type in a real implementation
        statusCodes: [200], // Would extract status codes in a real implementation
        requiresAuth: content.includes('auth') || content.includes('authenticate'), // Simple heuristic
      });
    }

    return endpoints;
  }
}
