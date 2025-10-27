#!/usr/bin/env ts-node
/**
 * NOSTR Duplication Cleanup Script
 * EPIC 003 WAVE 5 - STORY 7: Cleanup Duplicate NOSTR Code
 *
 * This script performs automated cleanup of duplicate NOSTR code
 * identified in the comprehensive audit.
 *
 * Usage:
 *   npm run cleanup:nostr
 *   OR
 *   ts-node scripts/cleanup-nostr-duplicates.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface CleanupTask {
  id: string;
  description: string;
  file: string;
  action: 'remove-import' | 'replace-code' | 'delete-file';
  before: string;
  after: string;
  lineNumber?: number;
}

interface CleanupResult {
  task: CleanupTask;
  success: boolean;
  error?: string;
  backupPath?: string;
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.cleanup-backups');

/**
 * All cleanup tasks identified in the audit
 */
const CLEANUP_TASKS: CleanupTask[] = [
  {
    id: 'M1',
    description: 'Remove unused getEventHash import from NotificationService',
    file: 'packages/frontend/src/features/nostr/notifications/services/NotificationService.ts',
    action: 'remove-import',
    before: `import { getEventHash, nip19 } from 'nostr-tools';`,
    after: `import { nip19 } from 'nostr-tools';`,
    lineNumber: 7,
  },
];

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Logger utility
 */
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log.info(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Create a backup of a file before modifying it
 */
function backupFile(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = path.basename(filePath);
  const backupPath = path.join(BACKUP_DIR, `${fileName}.${timestamp}.bak`);

  fs.copyFileSync(filePath, backupPath);
  log.info(`Backed up to: ${backupPath}`);

  return backupPath;
}

/**
 * Execute a cleanup task
 */
function executeCleanupTask(task: CleanupTask): CleanupResult {
  const filePath = path.join(PROJECT_ROOT, task.file);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      task,
      success: false,
      error: `File not found: ${filePath}`,
    };
  }

  try {
    // Backup the file
    const backupPath = backupFile(filePath);

    // Read the file
    let content = fs.readFileSync(filePath, 'utf-8');

    // Perform the action
    switch (task.action) {
      case 'remove-import':
      case 'replace-code':
        // Check if the "before" content exists
        if (!content.includes(task.before)) {
          return {
            task,
            success: false,
            error: `Could not find expected content in file. File may have been modified.`,
          };
        }

        // Replace the content
        content = content.replace(task.before, task.after);

        // Write back to file
        fs.writeFileSync(filePath, content, 'utf-8');
        break;

      case 'delete-file':
        fs.unlinkSync(filePath);
        break;

      default:
        return {
          task,
          success: false,
          error: `Unknown action: ${task.action}`,
        };
    }

    return {
      task,
      success: true,
      backupPath,
    };
  } catch (error) {
    return {
      task,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify cleanup by running basic checks
 */
async function verifyCleanup(): Promise<boolean> {
  log.header('🔍 Verifying Cleanup');

  let allChecksPassed = true;

  // Check 1: Verify modified file exists and has correct content
  const notificationServicePath = path.join(
    PROJECT_ROOT,
    'packages/frontend/src/features/nostr/notifications/services/NotificationService.ts'
  );

  if (fs.existsSync(notificationServicePath)) {
    const content = fs.readFileSync(notificationServicePath, 'utf-8');

    // Should have nip19 import
    if (content.includes(`import { nip19 } from 'nostr-tools';`)) {
      log.success('NotificationService has correct nip19 import');
    } else {
      log.error('NotificationService missing expected nip19 import');
      allChecksPassed = false;
    }

    // Should NOT have getEventHash import
    if (!content.includes('getEventHash')) {
      log.success('NotificationService no longer imports unused getEventHash');
    } else {
      log.warning('NotificationService still contains getEventHash reference');
      allChecksPassed = false;
    }
  } else {
    log.error(`NotificationService file not found at ${notificationServicePath}`);
    allChecksPassed = false;
  }

  return allChecksPassed;
}

/**
 * Generate cleanup report
 */
function generateReport(results: CleanupResult[]): void {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  log.header('📊 Cleanup Report');

  console.log(`Total tasks: ${results.length}`);
  console.log(`${colors.green}Successful: ${successCount}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failureCount}${colors.reset}`);

  if (failureCount > 0) {
    console.log('\n❌ Failed Tasks:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.task.id}: ${r.task.description}`);
        console.log(`    Error: ${r.error}`);
      });
  }

  console.log('\n📦 Backups created in:', BACKUP_DIR);
  console.log('\nTo restore from backup:');
  console.log(`  cp ${BACKUP_DIR}/<backup-file> <original-file>`);
}

/**
 * Main execution
 */
async function main() {
  log.header('🧹 NOSTR Duplication Cleanup Script');
  log.info('EPIC 003 WAVE 5 - STORY 7: Cleanup Duplicate NOSTR Code');

  // Ensure backup directory exists
  ensureBackupDir();

  // Execute all cleanup tasks
  log.header('🔧 Executing Cleanup Tasks');
  const results: CleanupResult[] = [];

  for (const task of CLEANUP_TASKS) {
    log.info(`\n[${task.id}] ${task.description}`);
    log.info(`File: ${task.file}`);

    const result = executeCleanupTask(task);
    results.push(result);

    if (result.success) {
      log.success(`Completed successfully`);
    } else {
      log.error(`Failed: ${result.error}`);
    }
  }

  // Verify cleanup
  const verificationPassed = await verifyCleanup();

  // Generate report
  generateReport(results);

  // Exit with appropriate code
  const allSucceeded = results.every(r => r.success) && verificationPassed;

  if (allSucceeded) {
    log.header('✅ Cleanup Completed Successfully');
    log.success('All NOSTR duplications have been removed.');
    log.success('Run tests to verify: npm test');
    process.exit(0);
  } else {
    log.header('⚠️  Cleanup Completed with Errors');
    log.warning('Some tasks failed. Review the report above.');
    log.warning('Backups are available in .cleanup-backups/');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

export { main, executeCleanupTask, CLEANUP_TASKS };
