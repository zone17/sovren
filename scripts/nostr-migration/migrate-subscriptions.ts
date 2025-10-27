#!/usr/bin/env ts-node
/**
 * 🔄 NOSTR SUBSCRIPTION MIGRATION SCRIPT
 *
 * US-323: NOSTR Migration Scripts - Subscription Migration
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Migrates legacy NOSTR subscriptions to the new SubscriptionManager
 * with improved management, performance tracking, and auto-cleanup.
 *
 * Features:
 * - Dry-run mode
 * - Subscription validation
 * - Filter migration
 * - Active/inactive detection
 * - Progress tracking
 * - Backup creation
 *
 * Usage:
 *   npm run migrate:subscriptions              # Interactive mode
 *   npm run migrate:subscriptions -- --dry-run # Preview changes
 *   npm run migrate:subscriptions -- --force   # Skip confirmations
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Filter } from 'nostr-tools';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline/promises';

// ========================================
// TYPE DEFINITIONS
// ========================================

interface LegacySubscription {
  id: string;
  filters: Filter[];
  relays?: string[];
  active: boolean;
  createdAt?: number;
  lastEventAt?: number;
  metadata?: Record<string, unknown>;
  source: 'indexedDB' | 'memory';
}

interface MigratedSubscription {
  id: string;
  filters: Filter[];
  relays: string[];
  active: boolean;
  createdAt: number;
  lastEventAt?: number;
  eventCount: number;
  metadata: {
    migrated: boolean;
    migratedFrom: string;
    migratedAt: number;
    originalCreatedAt?: number;
  };
}

interface MigrationStats {
  totalSubscriptions: number;
  migrated: number;
  inactive: number;
  invalid: number;
  failed: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

interface MigrationOptions {
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  migrateInactive: boolean;
  cleanupOld: boolean;
}

// ========================================
// CONFIGURATION
// ========================================

const LEGACY_INDEXEDDB_NAME = 'NostrSubscriptions';
const NEW_INDEXEDDB_NAME = 'SovrenSubscriptionManager';
const INDEXEDDB_VERSION = 1;

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'nostr-subscriptions');

// Maximum age for inactive subscriptions (30 days)
const MAX_INACTIVE_AGE = 30 * 24 * 60 * 60 * 1000;

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

async function ensureBackupDir(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, timestamp);

  await fs.mkdir(backupPath, { recursive: true });
  return backupPath;
}

async function saveBackup(
  backupPath: string,
  subscriptions: LegacySubscription[]
): Promise<void> {
  const backupFile = path.join(backupPath, 'subscriptions-backup.json');

  await fs.writeFile(
    backupFile,
    JSON.stringify(
      {
        version: '1.0',
        timestamp: Date.now(),
        subscriptionCount: subscriptions.length,
        subscriptions,
      },
      null,
      2
    )
  );

  log(`✓ Backup saved to: ${backupFile}`, 'success');
}

// ========================================
// SUBSCRIPTION EXTRACTION
// ========================================

/**
 * Extract subscriptions from legacy IndexedDB
 */
async function extractLegacySubscriptions(): Promise<LegacySubscription[]> {
  const subscriptions: LegacySubscription[] = [];

  try {
    const db = await openDB(LEGACY_INDEXEDDB_NAME, INDEXEDDB_VERSION);

    const storeNames = ['subscriptions', 'subs', 'active_subscriptions'];

    for (const storeName of storeNames) {
      if (db.objectStoreNames.contains(storeName)) {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const allSubs = await store.getAll();

        for (const sub of allSubs) {
          subscriptions.push({
            id: sub.id || sub.subscriptionId || generateId(),
            filters: sub.filters || [],
            relays: sub.relays,
            active: sub.active !== false, // Default to true
            createdAt: sub.createdAt || sub.timestamp,
            lastEventAt: sub.lastEventAt,
            metadata: sub.metadata,
            source: 'indexedDB',
          });
        }
      }
    }

    db.close();
  } catch (error) {
    log(`Warning: Could not access legacy IndexedDB: ${error}`, 'warn');
  }

  return subscriptions;
}

/**
 * Generate unique subscription ID
 */
function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ========================================
// SUBSCRIPTION VALIDATION
// ========================================

/**
 * Validate subscription data
 */
function validateSubscription(
  sub: LegacySubscription
): { valid: boolean; error?: string } {
  try {
    // Check required fields
    if (!sub.id) {
      return { valid: false, error: 'Missing subscription ID' };
    }

    if (!Array.isArray(sub.filters) || sub.filters.length === 0) {
      return { valid: false, error: 'Missing or invalid filters' };
    }

    // Validate filters
    for (const filter of sub.filters) {
      if (typeof filter !== 'object' || filter === null) {
        return { valid: false, error: 'Invalid filter object' };
      }

      // Check for at least one filter property
      const validProps = ['ids', 'authors', 'kinds', 'since', 'until', 'limit'];
      const hasValidProp = validProps.some(prop => prop in filter);
      const hasTagFilter = Object.keys(filter).some(key => key.startsWith('#'));

      if (!hasValidProp && !hasTagFilter) {
        return { valid: false, error: 'Filter must have at least one property' };
      }

      // Validate kinds
      if (filter.kinds) {
        if (!Array.isArray(filter.kinds)) {
          return { valid: false, error: 'kinds must be an array' };
        }

        if (filter.kinds.some(k => typeof k !== 'number')) {
          return { valid: false, error: 'kinds must contain numbers' };
        }
      }

      // Validate authors
      if (filter.authors) {
        if (!Array.isArray(filter.authors)) {
          return { valid: false, error: 'authors must be an array' };
        }

        if (filter.authors.some(a => !/^[0-9a-f]{64}$/i.test(a))) {
          return { valid: false, error: 'Invalid author pubkey format' };
        }
      }

      // Validate limit
      if (filter.limit !== undefined) {
        if (typeof filter.limit !== 'number' || filter.limit < 0) {
          return { valid: false, error: 'limit must be a positive number' };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * Check if subscription is inactive (old and no recent events)
 */
function isInactive(sub: LegacySubscription): boolean {
  const now = Date.now();

  // No creation timestamp - can't determine age
  if (!sub.createdAt) {
    return false;
  }

  // Check if subscription is too old
  const age = now - sub.createdAt;
  if (age < MAX_INACTIVE_AGE) {
    return false;
  }

  // Check if there were recent events
  if (sub.lastEventAt) {
    const lastEventAge = now - sub.lastEventAt;
    if (lastEventAge < MAX_INACTIVE_AGE) {
      return false;
    }
  }

  // Old subscription with no recent events
  return true;
}

// ========================================
// MIGRATION LOGIC
// ========================================

/**
 * Migrate a single subscription
 */
async function migrateSubscription(
  sub: LegacySubscription,
  db: IDBPDatabase
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate subscription
    const validation = validateSubscription(sub);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Create migrated subscription
    const migratedData: MigratedSubscription = {
      id: sub.id,
      filters: sub.filters,
      relays: sub.relays || [],
      active: sub.active,
      createdAt: sub.createdAt || Date.now(),
      lastEventAt: sub.lastEventAt,
      eventCount: 0,
      metadata: {
        migrated: true,
        migratedFrom: sub.source,
        migratedAt: Date.now(),
        originalCreatedAt: sub.createdAt,
      },
    };

    // Store in new database
    const tx = db.transaction('subscriptions', 'readwrite');
    await tx.objectStore('subscriptions').put(migratedData, sub.id);
    await tx.done;

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Perform migration
 */
async function performMigration(options: MigrationOptions): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalSubscriptions: 0,
    migrated: 0,
    inactive: 0,
    invalid: 0,
    failed: 0,
    errors: [],
  };

  log('\n📋 Starting subscription migration...', 'info');

  // Step 1: Extract legacy subscriptions
  log('\n1️⃣  Extracting legacy subscriptions...', 'info');
  const allSubscriptions = await extractLegacySubscriptions();

  stats.totalSubscriptions = allSubscriptions.length;

  if (stats.totalSubscriptions === 0) {
    log('No legacy subscriptions found to migrate.', 'warn');
    return stats;
  }

  log(`Found ${stats.totalSubscriptions} subscription(s) to migrate`, 'info');

  // Step 2: Filter subscriptions
  const subscriptionsToMigrate = allSubscriptions.filter(sub => {
    const inactive = isInactive(sub);

    if (inactive) {
      stats.inactive++;

      if (!options.migrateInactive) {
        if (options.verbose) {
          log(`Skipping inactive subscription: ${sub.id}`, 'warn');
        }
        return false;
      }
    }

    return true;
  });

  log(`${subscriptionsToMigrate.length} active subscriptions to migrate`, 'info');
  log(`${stats.inactive} inactive subscriptions ${options.migrateInactive ? 'included' : 'skipped'}`, 'warn');

  // Step 3: Create backup
  const backupPath = await ensureBackupDir();
  log(`\n2️⃣  Creating backup in: ${backupPath}`, 'info');

  if (!options.dryRun) {
    await saveBackup(backupPath, allSubscriptions);
  } else {
    log('(Dry run - backup skipped)', 'warn');
  }

  // Step 4: Migrate subscriptions
  log('\n3️⃣  Migrating subscriptions...', 'info');

  if (options.dryRun) {
    log('(Dry run - migration skipped)', 'warn');

    // Simulate migration
    for (const sub of subscriptionsToMigrate) {
      const validation = validateSubscription(sub);
      if (validation.valid) {
        stats.migrated++;
        if (options.verbose) {
          log(`✓ Would migrate subscription ${sub.id}`, 'success');
        }
      } else {
        stats.invalid++;
        stats.errors.push({
          subscriptionId: sub.id,
          error: validation.error || 'Unknown error',
        });
        if (options.verbose) {
          log(`✗ Would skip invalid subscription: ${validation.error}`, 'error');
        }
      }
    }
  } else {
    // Open new database
    const db = await openDB(NEW_INDEXEDDB_NAME, INDEXEDDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('subscriptions')) {
          const store = db.createObjectStore('subscriptions');
          store.createIndex('active', 'active');
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });

    // Migrate each subscription
    for (let i = 0; i < subscriptionsToMigrate.length; i++) {
      const sub = subscriptionsToMigrate[i];
      const progress = Math.round(((i + 1) / subscriptionsToMigrate.length) * 100);

      log(`[${progress}%] Migrating subscription ${i + 1}/${subscriptionsToMigrate.length}...`, 'info');

      const result = await migrateSubscription(sub, db);

      if (result.success) {
        stats.migrated++;
        if (options.verbose) {
          log(`✓ Migrated subscription ${sub.id}`, 'success');
        }
      } else {
        stats.failed++;
        stats.errors.push({
          subscriptionId: sub.id,
          error: result.error || 'Unknown error',
        });
        if (options.verbose) {
          log(`✗ Failed: ${result.error}`, 'error');
        }
      }
    }

    db.close();

    // Step 5: Cleanup (if enabled)
    if (options.cleanupOld && !options.dryRun) {
      log('\n4️⃣  Cleaning up old subscription database...', 'info');

      try {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(LEGACY_INDEXEDDB_NAME);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        log('✓ Old database cleaned up', 'success');
      } catch (error) {
        log(`Warning: Could not cleanup old database: ${error}`, 'warn');
      }
    }
  }

  return stats;
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║    NOSTR SUBSCRIPTION MIGRATION TO SUBSCRIPTIONMANAGER  ║');
  console.log('║                    Epic 003 Wave 5                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    migrateInactive: args.includes('--include-inactive'),
    cleanupOld: args.includes('--cleanup'),
  };

  if (options.dryRun) {
    log('🔍 DRY RUN MODE - No changes will be made\n', 'warn');
  }

  if (!options.force && !options.dryRun) {
    const proceed = await confirm(
      'This will migrate your NOSTR subscriptions to new manager. Continue?'
    );
    if (!proceed) {
      log('Migration cancelled by user.', 'warn');
      process.exit(0);
    }
  }

  try {
    const stats = await performMigration(options);

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                   MIGRATION COMPLETE                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    log(`Total subscriptions found: ${stats.totalSubscriptions}`, 'info');
    log(`Successfully migrated:     ${stats.migrated}`, 'success');
    log(`Inactive subscriptions:    ${stats.inactive}`, 'warn');
    log(`Invalid subscriptions:     ${stats.invalid}`, stats.invalid > 0 ? 'error' : 'info');
    log(`Failed:                    ${stats.failed}`, stats.failed > 0 ? 'error' : 'info');

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(({ subscriptionId, error }) => {
        log(`  - ${subscriptionId}: ${error}`, 'error');
      });
    }

    if (options.dryRun) {
      log('\n✓ Dry run complete. Run without --dry-run to perform actual migration.', 'success');
      log('💡 Use --include-inactive to migrate old subscriptions', 'info');
      log('💡 Use --cleanup to remove old database after migration', 'info');
    } else if (stats.migrated > 0) {
      log('\n✓ Migration successful! Subscriptions are now managed by SubscriptionManager.', 'success');
    }

    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    log(`\n❌ Migration failed: ${error}`, 'error');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { performMigration, type MigrationOptions, type MigrationStats };
