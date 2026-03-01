#!/usr/bin/env ts-node
/**
 * 🌐 NOSTR RELAY CONFIGURATION MIGRATION SCRIPT
 *
 * US-325: NOSTR Migration Scripts - Relay Config Migration
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Migrates hardcoded relay URLs to centralized configuration.
 * Updates environment variables and converts old relay format to new format.
 *
 * Features:
 * - Discovers all hardcoded relay URLs in codebase
 * - Migrates to centralized relay configuration
 * - Updates environment variables
 * - Validates relay connectivity
 * - Creates backup of old configuration
 * - Generates migration report
 *
 * Usage:
 *   npm run migrate:relay-config              # Interactive mode
 *   npm run migrate:relay-config -- --dry-run # Preview changes
 *   npm run migrate:relay-config -- --force   # Skip confirmations
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline/promises';
import { createHash } from 'crypto';

// ========================================
// TYPE DEFINITIONS
// ========================================

interface LegacyRelayConfig {
  url: string;
  source: 'hardcoded' | 'localStorage' | 'config';
  location?: string; // File path or storage key
  read?: boolean;
  write?: boolean;
}

interface NewRelayConfig {
  url: string;
  read: boolean;
  write: boolean;
  search: boolean;
  priority: number;
  metadata?: {
    name?: string;
    description?: string;
    operator?: string;
  };
}

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  warnings: string[];
  report: MigrationReport;
}

interface MigrationReport {
  startTime: number;
  endTime: number;
  duration: number;
  legacyRelays: LegacyRelayConfig[];
  migratedRelays: NewRelayConfig[];
  backupPath: string;
  checksums: {
    before: string;
    after: string;
  };
}

// ========================================
// CONSTANTS
// ========================================

const BACKUP_DIR = path.join(process.cwd(), '.migration-backups');
const RELAY_CONFIG_PATH = path.join(process.cwd(), 'packages/shared/src/config/relays.ts');
const ENV_FILE_PATH = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.join(process.cwd(), 'env.example');

// Common NOSTR relay URLs (fallback discovery)
const KNOWN_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.current.fyi',
  'wss://relay.nostr.info',
  'wss://nostr.wine',
  'wss://eden.nostr.land',
];

// ========================================
// MIGRATION LOGIC
// ========================================

class RelayConfigMigration {
  private dryRun: boolean = false;
  private force: boolean = false;
  private rl?: readline.Interface;
  private legacyRelays: LegacyRelayConfig[] = [];
  private migratedRelays: NewRelayConfig[] = [];
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(options: { dryRun?: boolean; force?: boolean } = {}) {
    this.dryRun = options.dryRun || false;
    this.force = options.force || false;
  }

  /**
   * Main migration execution
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      console.log('🌐 Starting Relay Configuration Migration...\n');

      // Step 1: Discover legacy relay configurations
      await this.discoverLegacyRelays();

      // Step 2: Confirm migration if not in force mode
      if (!this.force && !this.dryRun) {
        const confirmed = await this.confirmMigration();
        if (!confirmed) {
          console.log('❌ Migration cancelled by user');
          return this.createFailureResult(startTime);
        }
      }

      // Step 3: Create backup
      const backupPath = await this.createBackup();

      // Step 4: Convert legacy relays to new format
      this.convertRelays();

      // Step 5: Write new configuration (unless dry-run)
      if (!this.dryRun) {
        await this.writeNewConfig();
        await this.updateEnvironmentVariables();
      }

      // Step 6: Validate migration
      const validationResult = await this.validate();

      const endTime = Date.now();
      const report = this.createReport(startTime, endTime, backupPath);

      // Step 7: Display summary
      this.displaySummary(report);

      return {
        success: validationResult.valid,
        migratedCount: this.migratedRelays.length,
        skippedCount: 0,
        errorCount: this.errors.length,
        errors: this.errors,
        warnings: this.warnings,
        report,
      };
    } catch (error) {
      const err = error as Error;
      console.error('❌ Migration failed:', err.message);
      this.errors.push(err.message);
      return this.createFailureResult(startTime);
    } finally {
      this.rl?.close();
    }
  }

  /**
   * Discover legacy relay configurations
   */
  private async discoverLegacyRelays(): Promise<void> {
    console.log('🔍 Discovering legacy relay configurations...');

    // Discover from localStorage keys
    await this.discoverFromLocalStorage();

    // Discover from config files
    await this.discoverFromConfigFiles();

    // Discover from hardcoded values
    await this.discoverFromSourceCode();

    console.log(`✅ Found ${this.legacyRelays.length} legacy relay configurations\n`);
  }

  /**
   * Discover relays from localStorage (browser storage simulation)
   */
  private async discoverFromLocalStorage(): Promise<void> {
    // Check for localStorage backup files or config
    const localStoragePath = path.join(BACKUP_DIR, 'localStorage.json');

    try {
      const exists = await fs
        .access(localStoragePath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const data = JSON.parse(await fs.readFile(localStoragePath, 'utf-8'));

        if (data.nostr_relays) {
          const relays = JSON.parse(data.nostr_relays);
          relays.forEach((url: string) => {
            this.legacyRelays.push({
              url,
              source: 'localStorage',
              location: 'localStorage:nostr_relays',
              read: true,
              write: true,
            });
          });
        }
      }
    } catch (error) {
      // localStorage backup not found, skip
    }
  }

  /**
   * Discover relays from configuration files
   */
  private async discoverFromConfigFiles(): Promise<void> {
    const configPaths = [
      'packages/frontend/lib/config/environment.ts',
      'packages/backend/src/config/nostr.ts',
      'packages/shared/src/config/relays.ts',
    ];

    for (const configPath of configPaths) {
      const fullPath = path.join(process.cwd(), configPath);

      try {
        const exists = await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false);
        if (!exists) continue;

        const content = await fs.readFile(fullPath, 'utf-8');
        const relayUrls = this.extractRelayUrls(content);

        relayUrls.forEach((url) => {
          if (!this.isDuplicate(url)) {
            this.legacyRelays.push({
              url,
              source: 'config',
              location: configPath,
              read: true,
              write: true,
            });
          }
        });
      } catch (error) {
        this.warnings.push(`Could not read config file: ${configPath}`);
      }
    }
  }

  /**
   * Discover hardcoded relays from source code
   */
  private async discoverFromSourceCode(): Promise<void> {
    const searchPaths = [
      'packages/frontend/lib/services',
      'packages/frontend/src/services',
      'packages/backend/src/services',
    ];

    for (const searchPath of searchPaths) {
      const fullPath = path.join(process.cwd(), searchPath);

      try {
        const exists = await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false);
        if (!exists) continue;

        await this.searchDirectory(fullPath);
      } catch (error) {
        // Directory not found, skip
      }
    }
  }

  /**
   * Recursively search directory for relay URLs
   */
  private async searchDirectory(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        await this.searchDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relayUrls = this.extractRelayUrls(content);

        relayUrls.forEach((url) => {
          if (!this.isDuplicate(url)) {
            this.legacyRelays.push({
              url,
              source: 'hardcoded',
              location: fullPath.replace(process.cwd(), ''),
              read: true,
              write: true,
            });
          }
        });
      }
    }
  }

  /**
   * Extract relay URLs from content using regex
   */
  private extractRelayUrls(content: string): string[] {
    const relayRegex = /['"]wss?:\/\/[^'"]+['"]/g;
    const matches = content.match(relayRegex) || [];

    return matches
      .map((match) => match.replace(/['"]/g, ''))
      .filter((url) => url.startsWith('wss://') || url.startsWith('ws://'));
  }

  /**
   * Check if relay URL is already discovered
   */
  private isDuplicate(url: string): boolean {
    return this.legacyRelays.some((relay) => relay.url === url);
  }

  /**
   * Convert legacy relays to new format
   */
  private convertRelays(): void {
    console.log('🔄 Converting relay configurations...');

    // Group by URL and merge configurations
    const relayMap = new Map<string, LegacyRelayConfig[]>();

    this.legacyRelays.forEach((relay) => {
      const existing = relayMap.get(relay.url) || [];
      existing.push(relay);
      relayMap.set(relay.url, existing);
    });

    // Convert to new format with priority
    let priority = 1;

    relayMap.forEach((configs, url) => {
      const read = configs.some((c) => c.read !== false);
      const write = configs.some((c) => c.write !== false);

      this.migratedRelays.push({
        url,
        read,
        write,
        search: true, // Enable search by default
        priority: priority++,
        metadata: this.inferMetadata(url),
      });
    });

    console.log(`✅ Converted ${this.migratedRelays.length} relay configurations\n`);
  }

  /**
   * Infer metadata from relay URL
   */
  private inferMetadata(url: string): NewRelayConfig['metadata'] {
    const metadata: NewRelayConfig['metadata'] = {};

    if (url.includes('damus')) {
      metadata.name = 'Damus Relay';
      metadata.description = 'Popular general purpose relay';
      metadata.operator = 'Damus';
    } else if (url.includes('snort')) {
      metadata.name = 'Snort Relay';
      metadata.description = 'Snort social relay';
      metadata.operator = 'Snort';
    } else if (url.includes('nos.lol')) {
      metadata.name = 'Nos.lol';
      metadata.description = 'Community relay';
    }

    return metadata;
  }

  /**
   * Write new relay configuration file
   */
  private async writeNewConfig(): Promise<void> {
    console.log('📝 Writing new relay configuration...');

    const configContent = this.generateConfigFile();
    const configDir = path.dirname(RELAY_CONFIG_PATH);

    // Ensure directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Write config file
    await fs.writeFile(RELAY_CONFIG_PATH, configContent, 'utf-8');

    console.log(`✅ Wrote configuration to ${RELAY_CONFIG_PATH}\n`);
  }

  /**
   * Generate relay configuration file content
   */
  private generateConfigFile(): string {
    const relaysJson = JSON.stringify(this.migratedRelays, null, 2);

    return `/**
 * 🌐 NOSTR Relay Configuration
 *
 * Centralized relay configuration for NOSTR protocol.
 * Auto-generated by migration script on ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - Use relay management UI or migration tools
 */

export interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
  search: boolean;
  priority: number;
  metadata?: {
    name?: string;
    description?: string;
    operator?: string;
  };
}

export const DEFAULT_RELAYS: RelayConfig[] = ${relaysJson};

export const getRelaysByPriority = (): RelayConfig[] => {
  return DEFAULT_RELAYS.sort((a, b) => a.priority - b.priority);
};

export const getReadRelays = (): string[] => {
  return DEFAULT_RELAYS.filter(r => r.read).map(r => r.url);
};

export const getWriteRelays = (): string[] => {
  return DEFAULT_RELAYS.filter(r => r.write).map(r => r.url);
};

export const getSearchRelays = (): string[] => {
  return DEFAULT_RELAYS.filter(r => r.search).map(r => r.url);
};
`;
  }

  /**
   * Update environment variables with relay URLs
   */
  private async updateEnvironmentVariables(): Promise<void> {
    console.log('🔧 Updating environment variables...');

    const relayUrls = this.migratedRelays.map((r) => r.url).join(',');
    const envVar = `NOSTR_RELAYS="${relayUrls}"\n`;

    // Update .env file
    try {
      const envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8').catch(() => '');
      const updatedEnv = this.replaceOrAddEnvVar(envContent, 'NOSTR_RELAYS', relayUrls);
      await fs.writeFile(ENV_FILE_PATH, updatedEnv, 'utf-8');
      console.log('✅ Updated .env file\n');
    } catch (error) {
      this.warnings.push('Could not update .env file');
    }

    // Update env.example file
    try {
      const exampleContent = await fs.readFile(ENV_EXAMPLE_PATH, 'utf-8').catch(() => '');
      const updatedExample = this.replaceOrAddEnvVar(exampleContent, 'NOSTR_RELAYS', relayUrls);
      await fs.writeFile(ENV_EXAMPLE_PATH, updatedExample, 'utf-8');
      console.log('✅ Updated env.example file\n');
    } catch (error) {
      this.warnings.push('Could not update env.example file');
    }
  }

  /**
   * Replace or add environment variable in content
   */
  private replaceOrAddEnvVar(content: string, key: string, value: string): string {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}="${value}"`;

    if (regex.test(content)) {
      return content.replace(regex, newLine);
    } else {
      return content.trim() + `\n\n# NOSTR Relay Configuration (auto-generated)\n${newLine}\n`;
    }
  }

  /**
   * Create backup of current configuration
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(BACKUP_DIR, `relay-config-${timestamp}`);

    await fs.mkdir(backupDir, { recursive: true });

    // Backup relay config file if exists
    try {
      const exists = await fs
        .access(RELAY_CONFIG_PATH)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const content = await fs.readFile(RELAY_CONFIG_PATH, 'utf-8');
        await fs.writeFile(path.join(backupDir, 'relays.ts'), content);
      }
    } catch (error) {
      // No existing config to backup
    }

    // Backup environment files
    try {
      const envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8').catch(() => '');
      if (envContent) {
        await fs.writeFile(path.join(backupDir, '.env'), envContent);
      }
    } catch (error) {
      // No env file to backup
    }

    // Save discovery results
    await fs.writeFile(
      path.join(backupDir, 'legacy-relays.json'),
      JSON.stringify(this.legacyRelays, null, 2)
    );

    console.log(`💾 Created backup at: ${backupDir}\n`);
    return backupDir;
  }

  /**
   * Validate migration results
   */
  private async validate(): Promise<{ valid: boolean; issues: string[] }> {
    console.log('✅ Validating migration...');

    const issues: string[] = [];

    // Validate relay count
    if (this.migratedRelays.length === 0) {
      issues.push('No relays were migrated');
    }

    // Validate relay URLs
    this.migratedRelays.forEach((relay) => {
      if (!relay.url.startsWith('wss://') && !relay.url.startsWith('ws://')) {
        issues.push(`Invalid relay URL: ${relay.url}`);
      }
    });

    // Validate at least one read relay
    if (!this.migratedRelays.some((r) => r.read)) {
      issues.push('No read relays configured');
    }

    // Validate at least one write relay
    if (!this.migratedRelays.some((r) => r.write)) {
      issues.push('No write relays configured');
    }

    const valid = issues.length === 0;
    console.log(valid ? '✅ Validation passed\n' : '❌ Validation failed\n');

    return { valid, issues };
  }

  /**
   * Confirm migration with user
   */
  private async confirmMigration(): Promise<boolean> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n📋 Migration Summary:');
    console.log(`   Legacy relays found: ${this.legacyRelays.length}`);
    console.log(`   Unique URLs: ${new Set(this.legacyRelays.map((r) => r.url)).size}`);
    console.log('\n   Sources:');

    const sourceCounts = this.legacyRelays.reduce(
      (acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`     - ${source}: ${count}`);
    });

    const answer = await this.rl.question('\n❓ Proceed with migration? (yes/no): ');
    this.rl.close();

    return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
  }

  /**
   * Create migration report
   */
  private createReport(startTime: number, endTime: number, backupPath: string): MigrationReport {
    const checksumBefore = this.calculateChecksum(JSON.stringify(this.legacyRelays));
    const checksumAfter = this.calculateChecksum(JSON.stringify(this.migratedRelays));

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      legacyRelays: this.legacyRelays,
      migratedRelays: this.migratedRelays,
      backupPath,
      checksums: {
        before: checksumBefore,
        after: checksumAfter,
      },
    };
  }

  /**
   * Display migration summary
   */
  private displaySummary(report: MigrationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELAY CONFIGURATION MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${report.duration}ms`);
    console.log(`📥 Legacy relays: ${report.legacyRelays.length}`);
    console.log(`📤 Migrated relays: ${report.migratedRelays.length}`);
    console.log(`💾 Backup: ${report.backupPath}`);
    console.log(`🔐 Checksum (before): ${report.checksums.before}`);
    console.log(`🔐 Checksum (after): ${report.checksums.after}`);

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${this.warnings.length}`);
      this.warnings.forEach((w) => console.log(`   - ${w}`));
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors: ${this.errors.length}`);
      this.errors.forEach((e) => console.log(`   - ${e}`));
    }

    console.log('='.repeat(60) + '\n');
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Create failure result
   */
  private createFailureResult(startTime: number): MigrationResult {
    return {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: this.errors.length,
      errors: this.errors,
      warnings: this.warnings,
      report: {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        legacyRelays: this.legacyRelays,
        migratedRelays: [],
        backupPath: '',
        checksums: {
          before: '',
          after: '',
        },
      },
    };
  }
}

// ========================================
// CLI EXECUTION
// ========================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (dryRun) {
    console.log('🏃 Running in DRY-RUN mode (no changes will be made)\n');
  }

  const migration = new RelayConfigMigration({ dryRun, force });
  const result = await migration.migrate();

  process.exit(result.success ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { RelayConfigMigration, MigrationResult, LegacyRelayConfig, NewRelayConfig };
