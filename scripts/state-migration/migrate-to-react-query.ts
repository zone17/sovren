#!/usr/bin/env ts-node

/**
 * State Management Migration Script
 * Automates migration from Redux server state to React Query
 *
 * Features:
 * - Validates Redux slices for server data
 * - Automated refactoring of common patterns
 * - Component migration helpers
 * - Query key generation
 * - Redux slice migration
 * - Rollback functionality
 * - Progress tracking
 * - Validation checks and warnings
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/parser';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import * as prettier from 'prettier';

interface MigrationConfig {
  projectRoot: string;
  backupDir: string;
  dryRun: boolean;
  verbose: boolean;
  components: string[];
  slices: string[];
}

interface MigrationResult {
  success: boolean;
  filesModified: string[];
  errors: string[];
  warnings: string[];
  rollbackPath?: string;
}

interface ValidationIssue {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export class StateManagementMigrator {
  private config: MigrationConfig;
  private backupPath: string;
  private spinner: ora.Ora;
  private modifiedFiles: Set<string> = new Set();
  private issues: ValidationIssue[] = [];

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      projectRoot: process.cwd(),
      backupDir: path.join(process.cwd(), '.migration-backup'),
      dryRun: false,
      verbose: false,
      components: [],
      slices: [],
      ...config
    };

    this.backupPath = path.join(
      this.config.backupDir,
      `backup-${Date.now()}`
    );

    this.spinner = ora();
  }

  /**
   * Main migration entry point
   */
  async migrate(): Promise<MigrationResult> {
    try {
      this.log('🚀 Starting State Management Migration', 'info');

      // Step 1: Validation
      await this.validateProject();

      // Step 2: Create backup
      if (!this.config.dryRun) {
        await this.createBackup();
      }

      // Step 3: Analyze Redux slices for server data
      const serverDataSlices = await this.findServerDataInRedux();

      // Step 4: Migrate components
      await this.migrateComponents(serverDataSlices);

      // Step 5: Generate React Query hooks
      await this.generateQueryHooks(serverDataSlices);

      // Step 6: Update Redux slices (remove server data)
      await this.cleanupReduxSlices(serverDataSlices);

      // Step 7: Validate migration
      const validationResult = await this.validateMigration();

      // Step 8: Generate migration report
      const report = await this.generateReport();

      return {
        success: validationResult,
        filesModified: Array.from(this.modifiedFiles),
        errors: this.issues.filter(i => i.severity === 'error').map(i => i.message),
        warnings: this.issues.filter(i => i.severity === 'warning').map(i => i.message),
        rollbackPath: this.backupPath
      };
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      if (!this.config.dryRun) {
        await this.rollback();
      }
      throw error;
    }
  }

  /**
   * Step 1: Validate project structure
   */
  private async validateProject(): Promise<void> {
    this.spinner.start('Validating project structure...');

    const requiredPaths = [
      'package.json',
      'tsconfig.json',
      'src/store',
      'src/hooks'
    ];

    for (const reqPath of requiredPaths) {
      const fullPath = path.join(this.config.projectRoot, reqPath);
      if (!fs.existsSync(fullPath)) {
        this.spinner.fail();
        throw new Error(`Required path not found: ${reqPath}`);
      }
    }

    // Check for React Query installation
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.config.projectRoot, 'package.json'), 'utf-8')
    );

    if (!packageJson.dependencies['@tanstack/react-query']) {
      this.issues.push({
        file: 'package.json',
        line: 0,
        message: 'React Query not installed. Run: npm install @tanstack/react-query',
        severity: 'error'
      });
    }

    this.spinner.succeed('Project validation complete');
  }

  /**
   * Step 2: Create backup of files to be modified
   */
  private async createBackup(): Promise<void> {
    this.spinner.start('Creating backup...');

    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }

    // Find all files that will be modified
    const filesToBackup = await glob('src/**/*.{ts,tsx}', {
      cwd: this.config.projectRoot
    });

    for (const file of filesToBackup) {
      const sourcePath = path.join(this.config.projectRoot, file);
      const destPath = path.join(this.backupPath, file);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(sourcePath, destPath);
    }

    this.spinner.succeed(`Backup created at: ${this.backupPath}`);
  }

  /**
   * Step 3: Find server data in Redux slices
   */
  private async findServerDataInRedux(): Promise<Map<string, string[]>> {
    this.spinner.start('Analyzing Redux slices for server data...');

    const serverDataSlices = new Map<string, string[]>();
    const slicePaths = await glob('src/store/slices/*.{ts,tsx}', {
      cwd: this.config.projectRoot
    });

    for (const slicePath of slicePaths) {
      const fullPath = path.join(this.config.projectRoot, slicePath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Look for patterns indicating server data
      const serverDataPatterns = [
        /fetch\w+/gi,
        /api\w+/gi,
        /load\w+/gi,
        /get\w+/gi,
        /\basync\b/gi,
        /createAsyncThunk/gi
      ];

      const foundPatterns: string[] = [];
      for (const pattern of serverDataPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          foundPatterns.push(...matches);
        }
      }

      if (foundPatterns.length > 0) {
        serverDataSlices.set(slicePath, foundPatterns);
        this.issues.push({
          file: slicePath,
          line: 0,
          message: `Found server data patterns: ${foundPatterns.join(', ')}`,
          severity: 'warning'
        });
      }
    }

    this.spinner.succeed(`Found ${serverDataSlices.size} slices with server data`);
    return serverDataSlices;
  }

  /**
   * Step 4: Migrate components from Redux to React Query
   */
  private async migrateComponents(serverDataSlices: Map<string, string[]>): Promise<void> {
    this.spinner.start('Migrating components...');

    const componentPaths = this.config.components.length > 0
      ? this.config.components
      : await glob('src/**/*.{tsx}', { cwd: this.config.projectRoot });

    for (const componentPath of componentPaths) {
      const fullPath = path.join(this.config.projectRoot, componentPath);
      let content = fs.readFileSync(fullPath, 'utf-8');
      let modified = false;

      // Pattern 1: useSelector for server data → useQuery
      const useSelectorPattern = /const\s+(\w+)\s*=\s*useSelector\(select(\w+)\)/g;
      content = content.replace(useSelectorPattern, (match, varName, entityName) => {
        if (this.isServerData(entityName)) {
          modified = true;
          return `const { data: ${varName} } = use${entityName}Query()`;
        }
        return match;
      });

      // Pattern 2: useDispatch for async actions → useMutation
      const dispatchPattern = /dispatch\((\w+)\((.*?)\)\)/g;
      content = content.replace(dispatchPattern, (match, actionName, params) => {
        if (actionName.includes('fetch') || actionName.includes('create') || actionName.includes('update')) {
          modified = true;
          const mutationName = actionName.replace('fetch', 'get');
          return `${mutationName}Mutation.mutate(${params})`;
        }
        return match;
      });

      // Pattern 3: Add React Query imports if modified
      if (modified) {
        const hasReactQueryImport = content.includes('@tanstack/react-query');
        if (!hasReactQueryImport) {
          const importStatement = "import { useQuery, useMutation } from '@tanstack/react-query';\n";
          content = importStatement + content;
        }

        // Write modified content
        if (!this.config.dryRun) {
          fs.writeFileSync(fullPath, this.formatCode(content));
        }
        this.modifiedFiles.add(componentPath);
      }
    }

    this.spinner.succeed(`Migrated ${this.modifiedFiles.size} components`);
  }

  /**
   * Step 5: Generate React Query hooks
   */
  private async generateQueryHooks(serverDataSlices: Map<string, string[]>): Promise<void> {
    this.spinner.start('Generating React Query hooks...');

    const hooksDir = path.join(this.config.projectRoot, 'src/hooks/queries');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    for (const [slicePath, patterns] of serverDataSlices) {
      const sliceName = path.basename(slicePath, '.ts').replace('Slice', '');
      const hookFileName = `use${this.capitalize(sliceName)}Query.ts`;
      const hookPath = path.join(hooksDir, hookFileName);

      const hookContent = this.generateQueryHook(sliceName, patterns);

      if (!this.config.dryRun) {
        fs.writeFileSync(hookPath, this.formatCode(hookContent));
      }
      this.modifiedFiles.add(path.relative(this.config.projectRoot, hookPath));
    }

    this.spinner.succeed('React Query hooks generated');
  }

  /**
   * Generate a React Query hook for an entity
   */
  private generateQueryHook(entityName: string, patterns: string[]): string {
    const capitalizedName = this.capitalize(entityName);
    const pluralName = this.pluralize(entityName);

    return `
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

// Types
export interface ${capitalizedName} {
  id: string;
  // TODO: Add proper type definitions
}

// Query Keys
export const ${entityName}Keys = {
  all: ['${pluralName}'] as const,
  lists: () => [...${entityName}Keys.all, 'list'] as const,
  list: (filters: string) => [...${entityName}Keys.lists(), { filters }] as const,
  details: () => [...${entityName}Keys.all, 'detail'] as const,
  detail: (id: string) => [...${entityName}Keys.details(), id] as const,
};

// Query Hook
export function use${capitalizedName}Query(id?: string) {
  return useQuery({
    queryKey: id ? ${entityName}Keys.detail(id) : ${entityName}Keys.all,
    queryFn: async () => {
      const endpoint = id ? \`/${pluralName}/\${id}\` : '/${pluralName}';
      const response = await api.get(endpoint);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// List Query Hook
export function use${capitalizedName}ListQuery(filters?: Record<string, any>) {
  return useQuery({
    queryKey: filters ? ${entityName}Keys.list(JSON.stringify(filters)) : ${entityName}Keys.lists(),
    queryFn: async () => {
      const response = await api.get('/${pluralName}', { params: filters });
      return response.data;
    },
  });
}

// Create Mutation
export function useCreate${capitalizedName}Mutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<${capitalizedName}>) => {
      const response = await api.post('/${pluralName}', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${entityName}Keys.all });
    },
  });
}

// Update Mutation
export function useUpdate${capitalizedName}Mutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<${capitalizedName}> & { id: string }) => {
      const response = await api.put(\`/${pluralName}/\${id}\`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ${entityName}Keys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ${entityName}Keys.lists() });
    },
  });
}

// Delete Mutation
export function useDelete${capitalizedName}Mutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(\`/${pluralName}/\${id}\`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${entityName}Keys.all });
    },
  });
}
`;
  }

  /**
   * Step 6: Clean up Redux slices (remove server data)
   */
  private async cleanupReduxSlices(serverDataSlices: Map<string, string[]>): Promise<void> {
    this.spinner.start('Cleaning up Redux slices...');

    for (const [slicePath] of serverDataSlices) {
      const fullPath = path.join(this.config.projectRoot, slicePath);
      let content = fs.readFileSync(fullPath, 'utf-8');

      // Remove async thunks
      content = content.replace(/export const \w+ = createAsyncThunk[\s\S]*?\}\);/g, '');

      // Remove server data from initial state
      content = content.replace(/loading: false,?\n?/g, '');
      content = content.replace(/error: null,?\n?/g, '');
      content = content.replace(/data: \[\],?\n?/g, '');

      // Remove extraReducers for async thunks
      content = content.replace(/extraReducers:[\s\S]*?\},\n\s*\},/g, '},');

      // Add comment about migration
      const migrationComment = `
// Note: Server data has been migrated to React Query
// This slice now only handles UI state
`;
      content = migrationComment + content;

      if (!this.config.dryRun) {
        fs.writeFileSync(fullPath, this.formatCode(content));
      }
      this.modifiedFiles.add(slicePath);
    }

    this.spinner.succeed('Redux slices cleaned up');
  }

  /**
   * Step 7: Validate migration
   */
  private async validateMigration(): Promise<boolean> {
    this.spinner.start('Validating migration...');

    let isValid = true;

    // Check for remaining Redux async patterns
    const files = await glob('src/**/*.{ts,tsx}', {
      cwd: this.config.projectRoot
    });

    for (const file of files) {
      const fullPath = path.join(this.config.projectRoot, file);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check for problematic patterns
      if (content.includes('createAsyncThunk') && !file.includes('.test.')) {
        this.issues.push({
          file,
          line: 0,
          message: 'Still contains createAsyncThunk - may need manual migration',
          severity: 'warning'
        });
      }

      // Check for TypeScript errors
      try {
        parse(content, {
          ecmaVersion: 2020,
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true
          }
        });
      } catch (error) {
        this.issues.push({
          file,
          line: error.lineNumber || 0,
          message: `Parse error: ${error.message}`,
          severity: 'error'
        });
        isValid = false;
      }
    }

    this.spinner.succeed('Validation complete');
    return isValid;
  }

  /**
   * Generate migration report
   */
  private async generateReport(): Promise<string> {
    const report = `
# State Management Migration Report

**Date**: ${new Date().toISOString()}
**Files Modified**: ${this.modifiedFiles.size}
**Mode**: ${this.config.dryRun ? 'Dry Run' : 'Live'}

## Modified Files
${Array.from(this.modifiedFiles).map(f => `- ${f}`).join('\n')}

## Issues Found
${this.issues.map(i => `- [${i.severity.toUpperCase()}] ${i.file}: ${i.message}`).join('\n')}

## Next Steps
1. Review modified files
2. Run tests to ensure everything works
3. Update type definitions as needed
4. Remove unused Redux code
5. Update documentation

## Rollback
To rollback this migration, run:
\`\`\`bash
npm run migrate:rollback ${this.backupPath}
\`\`\`
`;

    const reportPath = path.join(this.config.projectRoot, 'migration-report.md');
    if (!this.config.dryRun) {
      fs.writeFileSync(reportPath, report);
    }

    this.log('📋 Migration report generated', 'success');
    return report;
  }

  /**
   * Rollback migration
   */
  async rollback(): Promise<void> {
    this.spinner.start('Rolling back migration...');

    if (!fs.existsSync(this.backupPath)) {
      throw new Error('No backup found for rollback');
    }

    const backupFiles = await glob('**/*', {
      cwd: this.backupPath
    });

    for (const file of backupFiles) {
      const sourcePath = path.join(this.backupPath, file);
      const destPath = path.join(this.config.projectRoot, file);

      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, destPath);
      }
    }

    this.spinner.succeed('Migration rolled back successfully');
  }

  // Utility methods

  private isServerData(name: string): boolean {
    const serverDataIndicators = ['user', 'post', 'comment', 'api', 'data'];
    return serverDataIndicators.some(indicator =>
      name.toLowerCase().includes(indicator)
    );
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private pluralize(str: string): string {
    // Simple pluralization
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    return str + 's';
  }

  private formatCode(code: string): string {
    try {
      return prettier.format(code, {
        parser: 'typescript',
        singleQuote: true,
        trailingComma: 'es5',
        tabWidth: 2,
        semi: true,
      });
    } catch (error) {
      // Return unformatted if prettier fails
      return code;
    }
  }

  private log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.config.verbose && type === 'info') return;

    const colorMap = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
    };

    console.log(colorMap[type](message));
  }
}

// CLI Interface
if (require.main === module) {
  const argv = process.argv.slice(2);

  const config: Partial<MigrationConfig> = {
    dryRun: argv.includes('--dry-run'),
    verbose: argv.includes('--verbose'),
  };

  const componentsIndex = argv.indexOf('--components');
  if (componentsIndex > -1) {
    config.components = argv[componentsIndex + 1].split(',');
  }

  const slicesIndex = argv.indexOf('--slices');
  if (slicesIndex > -1) {
    config.slices = argv[slicesIndex + 1].split(',');
  }

  const migrator = new StateManagementMigrator(config);

  console.log(chalk.bold('\n🔄 State Management Migration Tool\n'));

  migrator.migrate()
    .then(result => {
      if (result.success) {
        console.log(chalk.green.bold('\n✅ Migration completed successfully!\n'));
        console.log(`Files modified: ${result.filesModified.length}`);
        if (result.warnings.length > 0) {
          console.log(chalk.yellow(`\nWarnings: ${result.warnings.length}`));
          result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
        }
      } else {
        console.log(chalk.red.bold('\n❌ Migration failed!\n'));
        result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
      }
    })
    .catch(error => {
      console.error(chalk.red.bold(`\n❌ Migration error: ${error.message}\n`));
      process.exit(1);
    });
}

export default StateManagementMigrator;