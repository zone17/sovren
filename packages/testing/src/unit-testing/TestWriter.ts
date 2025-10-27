/**
 * @file TestWriter.ts
 * @description Test file writer for generated unit tests
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../common/Logger';
import { TestableComponent } from '../common/types';

/**
 * Configuration options for test writer
 */
export interface TestWriterOptions {
  /** Output directory for test files */
  outputDir?: string;
  /** File naming pattern */
  filePattern?: string;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  /** Whether to create directory structure */
  createDirs?: boolean;
  /** File extension for test files */
  fileExtension?: string;
}

/**
 * Test file writer that handles writing generated tests to the filesystem
 */
export class TestWriter {
  private options: TestWriterOptions;
  private logger: Logger;

  constructor(options: TestWriterOptions = {}) {
    this.options = {
      outputDir: '__tests__',
      filePattern: '{{name}}.test.{{ext}}',
      overwrite: false,
      createDirs: true,
      fileExtension: 'ts',
      ...options,
    };

    this.logger = new Logger('TestWriter');
  }

  /**
   * Writes a test file for a component
   * @param component Component information
   * @param testCode Generated test code
   * @param customFileName Optional custom file name
   * @returns Path to the written file
   */
  public async writeTest(
    component: TestableComponent,
    testCode: string,
    customFileName?: string
  ): Promise<string> {
    const fileName = customFileName || this.generateFileName(component);
    const filePath = path.join(this.options.outputDir || '__tests__', fileName);

    this.logger.info(`Writing test file: ${filePath}`);

    try {
      // Create directory if needed
      if (this.options.createDirs) {
        await this.ensureDirectoryExists(path.dirname(filePath));
      }

      // Check if file exists and overwrite is disabled
      if (!this.options.overwrite && (await this.fileExists(filePath))) {
        this.logger.warn(`Test file already exists: ${filePath}`);
        return filePath;
      }

      // Format the test code
      const formattedTestCode = await this.formatTestCode(testCode);

      // Write the file
      await fs.writeFile(filePath, formattedTestCode, 'utf8');

      this.logger.info(`Test file written successfully: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(
        `Failed to write test file: ${filePath} - ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Writes multiple test files
   * @param testFiles Array of test file data
   * @returns Array of written file paths
   */
  public async writeTests(
    testFiles: Array<{
      component: TestableComponent;
      testCode: string;
      customFileName?: string;
    }>
  ): Promise<string[]> {
    this.logger.info(`Writing ${testFiles.length} test files`);

    const writtenFiles: string[] = [];

    for (const testFile of testFiles) {
      try {
        const filePath = await this.writeTest(
          testFile.component,
          testFile.testCode,
          testFile.customFileName
        );
        writtenFiles.push(filePath);
      } catch (error) {
        this.logger.error(
          `Failed to write test file for ${testFile.component.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        // Continue with other files even if one fails
      }
    }

    return writtenFiles;
  }

  /**
   * Generates a file name based on the component and pattern
   * @param component Component information
   * @returns Generated file name
   */
  private generateFileName(component: TestableComponent): string {
    let fileName = this.options.filePattern || '{{name}}.test.{{ext}}';

    // Replace placeholders
    fileName = fileName.replace(/\{\{name\}\}/g, component.name);
    fileName = fileName.replace(/\{\{ext\}\}/g, this.options.fileExtension || 'ts');
    fileName = fileName.replace(/\{\{type\}\}/g, component.type);

    return fileName;
  }

  /**
   * Ensures a directory exists, creating it if necessary
   * @param dirPath Directory path
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.info(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Checks if a file exists
   * @param filePath File path
   * @returns True if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Formats test code with proper indentation and styling
   * @param testCode Raw test code
   * @returns Formatted test code
   */
  private async formatTestCode(testCode: string): Promise<string> {
    // Basic formatting - in a real implementation, this would use a proper formatter
    let formatted = testCode;

    // Fix indentation
    formatted = this.fixIndentation(formatted);

    // Add standard header
    formatted = this.addFileHeader(formatted);

    // Remove excessive empty lines
    formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');

    return formatted;
  }

  /**
   * Fixes indentation in test code
   * @param code Test code
   * @returns Code with fixed indentation
   */
  private fixIndentation(code: string): string {
    const lines = code.split('\n');
    let indentLevel = 0;
    const indentSize = 2;

    const formattedLines = lines.map((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        return '';
      }

      // Decrease indent for closing braces
      if (trimmedLine.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const formattedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine;

      // Increase indent for opening braces
      if (trimmedLine.endsWith('{')) {
        indentLevel++;
      }

      return formattedLine;
    });

    return formattedLines.join('\n');
  }

  /**
   * Adds a standard file header to the test code
   * @param code Test code
   * @returns Code with header
   */
  private addFileHeader(code: string): string {
    const header = `/**
 * @file Generated unit test file
 * @description Automatically generated unit tests
 * @generated This file was generated automatically. Do not edit manually.
 */

`;

    return header + code;
  }

  /**
   * Gets the configured output directory
   * @returns Output directory path
   */
  public getOutputDirectory(): string {
    return this.options.outputDir || '__tests__';
  }

  /**
   * Sets the output directory
   * @param outputDir New output directory
   */
  public setOutputDirectory(outputDir: string): void {
    this.options.outputDir = outputDir;
  }

  /**
   * Gets the configured file pattern
   * @returns File pattern
   */
  public getFilePattern(): string {
    return this.options.filePattern || '{{name}}.test.{{ext}}';
  }

  /**
   * Sets the file pattern
   * @param pattern New file pattern
   */
  public setFilePattern(pattern: string): void {
    this.options.filePattern = pattern;
  }

  /**
   * Gets the configured file extension
   * @returns File extension
   */
  public getFileExtension(): string {
    return this.options.fileExtension || 'ts';
  }

  /**
   * Sets the file extension
   * @param extension New file extension
   */
  public setFileExtension(extension: string): void {
    this.options.fileExtension = extension;
  }

  /**
   * Gets the overwrite setting
   * @returns True if overwrite is enabled
   */
  public getOverwrite(): boolean {
    return this.options.overwrite || false;
  }

  /**
   * Sets the overwrite setting
   * @param overwrite Whether to overwrite existing files
   */
  public setOverwrite(overwrite: boolean): void {
    this.options.overwrite = overwrite;
  }

  /**
   * Cleans up generated test files
   * @param filePaths Array of file paths to clean up
   */
  public async cleanupTestFiles(filePaths: string[]): Promise<void> {
    this.logger.info(`Cleaning up ${filePaths.length} test files`);

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        this.logger.info(`Deleted test file: ${filePath}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete test file: ${filePath} - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Validates test file content
   * @param filePath Path to test file
   * @returns True if valid
   */
  public async validateTestFile(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Basic validation - check for required elements
      const hasDescribe = content.includes('describe(');
      const hasIt = content.includes('it(');
      const hasExpect = content.includes('expect(');

      return hasDescribe && hasIt && hasExpect;
    } catch (error) {
      this.logger.error(
        `Failed to validate test file: ${filePath} - ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }
}
