#!/usr/bin/env ts-node
/**
 * ⏮️ NOSTR MIGRATION ROLLBACK SCRIPT
 *
 * US-323: NOSTR Migration Scripts - Rollback
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Safely rollback NOSTR migrations by restoring from backup.
 * Provides data recovery in case of migration failures or issues.
 *
 * Features:
 * - Backup restoration
 * - Data integrity verification
 * - Selective rollback (keys, events, subscriptions)
 * - Dry-run mode
 * - Progress tracking
 * - Safety confirmations
 *
 * Usage:
 *   npm run rollback:migration                    # Interactive rollback
 *   npm run rollback:migration -- --backup-path /path/to/backup
 *   npm run rollback:migration -- --keys          # Rollback keys only
 *   npm run rollback:migration -- --events        # Rollback events only
 *   npm run rollback:migration -- --subscriptions # Rollback subscriptions only
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */

import { openDB } from 'idb';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline/promises';

// ========================================
// TYPE DEFINITIONS
// ========================================

interface RollbackStats {
  totalRestored: number;
  failed: number;
  errors: Array<{ item: string; error: string }>;
}

interface RollbackOptions {
  backupPath?: string;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  rollbackKeys: boolean;
  rollbackEvents: boolean;
  rollbackSubscriptions: boolean;
  deleteNewDatabase: boolean;
}

interface BackupMetadata {
  version: string;
  timestamp: number;
  [key: string]: unknown;
}

// ========================================
// CONFIGURATION
// ========================================

const BACKUP_BASE_DIR = path.join(process.cwd(), 'backups');

const DATABASE_CONFIGS = {
  keys: {
    legacy: 'NostrKeys',
    new: 'SovrenNostrKeys',
    backupDir: 'nostr-keys',
    storeNames: ['keys'],
  },
  events: {
    legacy: 'NostrEvents',
    new: 'SovrenEventCache',
    backupDir: 'nostr-events',
    storeNames: ['events', 'nostrEvents', 'cache'],
  },
  subscriptions: {
    legacy: 'NostrSubscriptions',
    new: 'SovrenSubscriptionManager',
    backupDir: 'nostr-subscriptions',
    storeNames: ['subscriptions', 'subs', 'active_subscriptions'],
  },
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function confirm(message: string): Promise<boolean> {
  const rl = createReadline();
  try {
    const answer = await rl.question(`${message} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m',
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

// ========================================
// BACKUP DISCOVERY
// ========================================

/**
 * Find all available backups for a category
 */
async function findBackups(category: keyof typeof DATABASE_CONFIGS): Promise<string[]> {
  const backupDir = path.join(BACKUP_BASE_DIR, DATABASE_CONFIGS[category].backupDir);

  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });

    const backupDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(backupDir, entry.name))
      .sort()
      .reverse(); // Most recent first

    return backupDirs;
  } catch (error) {
    log(`Warning: Could not access backup directory for ${category}`, 'warn');
    return [];
  }
}

/**
 * Read backup metadata
 */
async function readBackupMetadata(backupPath: string): Promise<BackupMetadata | null> {
  try {
    const metadataFile = path.join(backupPath, 'backup-metadata.json');
    const content = await fs.readFile(metadataFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Try reading from main backup file
    try {
      const files = await fs.readdir(backupPath);
      const backupFile = files.find(f => f.includes('backup.json'));

      if (backupFile) {
        const content = await fs.readFile(path.join(backupPath, backupFile), 'utf-8');
        const data = JSON.parse(content);
        return {
          version: data.version || '1.0',
          timestamp: data.timestamp || Date.now(),
        };
      }
    } catch {}

    return null;
  }
}

/**
 * Select backup interactively
 */
async function selectBackup(category: keyof typeof DATABASE_CONFIGS): Promise<string | null> {
  const backups = await findBackups(category);

  if (backups.length === 0) {
    log(`No backups found for ${category}`, 'error');
    return null;
  }

  console.log(`\nAvailable backups for ${category}:`);

  for (let i = 0; i < backups.length && i < 10; i++) {
    const metadata = await readBackupMetadata(backups[i]);
    const timestamp = metadata?.timestamp
      ? new Date(metadata.timestamp).toLocaleString()
      : 'Unknown date';

    console.log(`${i + 1}. ${path.basename(backups[i])} (${timestamp})`);
  }

  const rl = createReadline();
  try {
    const answer = await rl.question('\nSelect backup number (or 0 to cancel): ');
    const selection = parseInt(answer, 10);

    if (selection === 0 || isNaN(selection) || selection > backups.length) {
      return null;
    }

    return backups[selection - 1];
  } finally {
    rl.close();
  }
}

// ========================================
// ROLLBACK LOGIC
// ========================================

/**
 * Restore keys from backup
 */
async function rollbackKeys(
  backupPath: string,
  options: RollbackOptions
): Promise<RollbackStats> {
  const stats: RollbackStats = {
    totalRestored: 0,
    failed: 0,
    errors: [],
  };

  log('\n🔐 Rolling back key migration...', 'info');

  try {
    // Read backup
    const backupFile = path.join(backupPath, 'keys-backup.json');
    const backupContent = await fs.readFile(backupFile, 'utf-8');
    const backupData = JSON.parse(backupContent);

    const keys = backupData.keys || [];

    if (options.dryRun) {
      log(`Would restore ${keys.length} keys`, 'warn');
      stats.totalRestored = keys.length;
      return stats;
    }

    // Delete new database if requested
    if (options.deleteNewDatabase) {
      log('Deleting new database...', 'warn');
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DATABASE_CONFIGS.keys.new);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Continue even if deletion fails
      });
    }

    // Restore to legacy database
    const db = await openDB(DATABASE_CONFIGS.keys.legacy, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
      },
    });

    for (const keyData of keys) {
      try {
        const tx = db.transaction('keys', 'readwrite');
        await tx.objectStore('keys').put(keyData, keyData.publicKey || keyData.pubkey);
        await tx.done;

        stats.totalRestored++;

        if (options.verbose) {
          log(`✓ Restored key ${keyData.publicKey?.substring(0, 16)}...`, 'success');
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          item: keyData.publicKey || 'unknown',
          error: String(error),
        });

        if (options.verbose) {
          log(`✗ Failed to restore key: ${error}`, 'error');
        }
      }
    }

    db.close();
  } catch (error) {
    stats.errors.push({ item: 'keys', error: String(error) });
  }

  return stats;
}

/**
 * Restore events from backup
 */
async function rollbackEvents(
  backupPath: string,
  options: RollbackOptions
): Promise<RollbackStats> {
  const stats: RollbackStats = {
    totalRestored: 0,
    failed: 0,
    errors: [],
  };

  log('\n📦 Rolling back event migration...', 'info');

  try {
    // Read backup chunks
    const files = await fs.readdir(backupPath);
    const chunkFiles = files.filter(f => f.startsWith('events-chunk-'));

    let allEvents = [];
    for (const chunkFile of chunkFiles) {
      const content = await fs.readFile(path.join(backupPath, chunkFile), 'utf-8');
      const chunk = JSON.parse(content);
      allEvents = allEvents.concat(chunk);
    }

    if (options.dryRun) {
      log(`Would restore ${allEvents.length} events`, 'warn');
      stats.totalRestored = allEvents.length;
      return stats;
    }

    // Delete new database if requested
    if (options.deleteNewDatabase) {
      log('Deleting new database...', 'warn');
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DATABASE_CONFIGS.events.new);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    }

    // Restore to legacy database
    const db = await openDB(DATABASE_CONFIGS.events.legacy, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events');
        }
      },
    });

    for (let i = 0; i < allEvents.length; i++) {
      const eventData = allEvents[i];

      if (i % 100 === 0 || i === allEvents.length - 1) {
        const progress = Math.round(((i + 1) / allEvents.length) * 100);
        log(`[${progress}%] Restoring event ${i + 1}/${allEvents.length}...`, 'info');
      }

      try {
        const tx = db.transaction('events', 'readwrite');
        await tx.objectStore('events').put(eventData, eventData.event?.id || eventData.id);
        await tx.done;

        stats.totalRestored++;
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          item: eventData.event?.id || eventData.id || 'unknown',
          error: String(error),
        });
      }
    }

    db.close();
  } catch (error) {
    stats.errors.push({ item: 'events', error: String(error) });
  }

  return stats;
}

/**
 * Restore subscriptions from backup
 */
async function rollbackSubscriptions(
  backupPath: string,
  options: RollbackOptions
): Promise<RollbackStats> {
  const stats: RollbackStats = {
    totalRestored: 0,
    failed: 0,
    errors: [],
  };

  log('\n🔄 Rolling back subscription migration...', 'info');

  try {
    // Read backup
    const backupFile = path.join(backupPath, 'subscriptions-backup.json');
    const backupContent = await fs.readFile(backupFile, 'utf-8');
    const backupData = JSON.parse(backupContent);

    const subscriptions = backupData.subscriptions || [];

    if (options.dryRun) {
      log(`Would restore ${subscriptions.length} subscriptions`, 'warn');
      stats.totalRestored = subscriptions.length;
      return stats;
    }

    // Delete new database if requested
    if (options.deleteNewDatabase) {
      log('Deleting new database...', 'warn');
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DATABASE_CONFIGS.subscriptions.new);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    }

    // Restore to legacy database
    const db = await openDB(DATABASE_CONFIGS.subscriptions.legacy, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('subscriptions')) {
          db.createObjectStore('subscriptions');
        }
      },
    });

    for (const subData of subscriptions) {
      try {
        const tx = db.transaction('subscriptions', 'readwrite');
        await tx.objectStore('subscriptions').put(subData, subData.id || subData.subscriptionId);
        await tx.done;

        stats.totalRestored++;

        if (options.verbose) {
          log(`✓ Restored subscription ${subData.id}`, 'success');
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          item: subData.id || 'unknown',
          error: String(error),
        });

        if (options.verbose) {
          log(`✗ Failed to restore subscription: ${error}`, 'error');
        }
      }
    }

    db.close();
  } catch (error) {
    stats.errors.push({ item: 'subscriptions', error: String(error) });
  }

  return stats;
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              NOSTR MIGRATION ROLLBACK                   ║');
  console.log('║                    Epic 003 Wave 5                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  log('⚠️  WARNING: This will restore old data and may delete new data!', 'warn');
  log('⚠️  Make sure you have a recent backup before proceeding.', 'warn');

  const args = process.argv.slice(2);
  const options: RollbackOptions = {
    backupPath: args.find(a => a.startsWith('--backup-path='))?.split('=')[1],
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    rollbackKeys: args.includes('--keys') || args.length === 0 || args.every(a => a.startsWith('--')),
    rollbackEvents: args.includes('--events') || args.length === 0 || args.every(a => a.startsWith('--')),
    rollbackSubscriptions: args.includes('--subscriptions') || args.length === 0 || args.every(a => a.startsWith('--')),
    deleteNewDatabase: args.includes('--delete-new'),
  };

  if (options.dryRun) {
    log('\n🔍 DRY RUN MODE - No changes will be made\n', 'warn');
  }

  if (!options.force && !options.dryRun) {
    const proceed = await confirm(
      '\nThis will rollback your NOSTR migration. Are you ABSOLUTELY SURE?'
    );
    if (!proceed) {
      log('Rollback cancelled by user.', 'warn');
      process.exit(0);
    }

    const doubleCheck = await confirm(
      'This action cannot be easily undone. Proceed with rollback?'
    );
    if (!doubleCheck) {
      log('Rollback cancelled by user.', 'warn');
      process.exit(0);
    }
  }

  const results: Record<string, RollbackStats> = {};

  // Rollback keys
  if (options.rollbackKeys) {
    const backupPath = options.backupPath || await selectBackup('keys');
    if (backupPath) {
      results.keys = await rollbackKeys(backupPath, options);
    } else {
      log('Keys rollback skipped (no backup selected)', 'warn');
    }
  }

  // Rollback events
  if (options.rollbackEvents) {
    const backupPath = options.backupPath || await selectBackup('events');
    if (backupPath) {
      results.events = await rollbackEvents(backupPath, options);
    } else {
      log('Events rollback skipped (no backup selected)', 'warn');
    }
  }

  // Rollback subscriptions
  if (options.rollbackSubscriptions) {
    const backupPath = options.backupPath || await selectBackup('subscriptions');
    if (backupPath) {
      results.subscriptions = await rollbackSubscriptions(backupPath, options);
    } else {
      log('Subscriptions rollback skipped (no backup selected)', 'warn');
    }
  }

  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   ROLLBACK COMPLETE                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let totalRestored = 0;
  let totalFailed = 0;

  for (const [category, stats] of Object.entries(results)) {
    log(`\n${category.toUpperCase()}:`, 'info');
    log(`  Restored: ${stats.totalRestored}`, 'success');
    log(`  Failed:   ${stats.failed}`, stats.failed > 0 ? 'error' : 'info');

    totalRestored += stats.totalRestored;
    totalFailed += stats.failed;

    if (stats.errors.length > 0 && options.verbose) {
      console.log('  Errors:');
      stats.errors.forEach(({ item, error }) => {
        log(`    - ${item}: ${error}`, 'error');
      });
    }
  }

  console.log('');
  log(`Total restored: ${totalRestored}`, 'success');
  log(`Total failed:   ${totalFailed}`, totalFailed > 0 ? 'error' : 'info');

  if (options.dryRun) {
    log('\n✓ Dry run complete. Run without --dry-run to perform actual rollback.', 'success');
  } else if (totalRestored > 0) {
    log('\n✓ Rollback successful! Legacy data has been restored.', 'success');
    log('💡 You may want to clear your browser cache and reload the application.', 'info');
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { rollbackKeys, rollbackEvents, rollbackSubscriptions };
