#!/usr/bin/env ts-node
/**
 * 📦 NOSTR EVENT MIGRATION SCRIPT
 *
 * US-323: NOSTR Migration Scripts - Event Migration
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Migrates existing NOSTR events to the new EventCache structure
 * with improved indexing, deduplication, and performance.
 *
 * Features:
 * - Dry-run mode for testing
 * - Event deduplication
 * - Metadata preservation
 * - Progress tracking
 * - Integrity verification
 * - Automatic backup
 *
 * Usage:
 *   npm run migrate:events              # Interactive mode
 *   npm run migrate:events -- --dry-run # Preview changes
 *   npm run migrate:events -- --force   # Skip confirmations
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */

import { openDB, type IDBPDatabase } from 'idb';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline/promises';
import { createHash } from 'crypto';

// ========================================
// TYPE DEFINITIONS
// ========================================

interface LegacyEventData {
  event: NostrEvent;
  relay?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  source: 'indexedDB' | 'localStorage';
}

interface MigratedEventData {
  event: NostrEvent;
  relay: string;
  timestamp: number;
  verified: boolean;
  seenOn: string[];
  metadata: {
    migrated: boolean;
    migratedFrom: string;
    migratedAt: number;
    originalTimestamp?: number;
  };
}

interface MigrationStats {
  totalEvents: number;
  migrated: number;
  duplicates: number;
  invalid: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
  byKind: Record<number, number>;
}

interface MigrationOptions {
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  verifySignatures: boolean;
  deduplicateEvents: boolean;
}

// ========================================
// CONFIGURATION
// ========================================

const LEGACY_INDEXEDDB_NAME = 'NostrEvents';
const NEW_INDEXEDDB_NAME = 'SovrenEventCache';
const INDEXEDDB_VERSION = 2;

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'nostr-events');

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

async function saveBackup(backupPath: string, events: LegacyEventData[]): Promise<void> {
  const backupFile = path.join(backupPath, 'events-backup.json');

  // Save metadata
  const metadata = {
    version: '1.0',
    timestamp: Date.now(),
    eventCount: events.length,
    byKind: events.reduce(
      (acc, { event }) => {
        acc[event.kind] = (acc[event.kind] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    ),
  };

  await fs.writeFile(
    path.join(backupPath, 'backup-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  // Save events in chunks to avoid memory issues
  const chunkSize = 1000;
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    const chunkFile = path.join(backupPath, `events-chunk-${Math.floor(i / chunkSize)}.json`);

    await fs.writeFile(chunkFile, JSON.stringify(chunk, null, 2));
  }

  log(`✓ Backup saved to: ${backupPath}`, 'success');
}

/**
 * Calculate event hash for deduplication
 */
function calculateEventHash(event: NostrEvent): string {
  const canonical = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  return createHash('sha256').update(canonical).digest('hex');
}

// ========================================
// EVENT EXTRACTION
// ========================================

/**
 * Extract events from legacy IndexedDB
 */
async function extractLegacyEvents(): Promise<LegacyEventData[]> {
  const events: LegacyEventData[] = [];

  try {
    const db = await openDB(LEGACY_INDEXEDDB_NAME, INDEXEDDB_VERSION);

    // Try different possible object store names
    const storeNames = ['events', 'nostrEvents', 'cache'];

    for (const storeName of storeNames) {
      if (db.objectStoreNames.contains(storeName)) {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const allEvents = await store.getAll();

        for (const eventData of allEvents) {
          if (eventData.event || eventData.id) {
            events.push({
              event: eventData.event || eventData,
              relay: eventData.relay,
              timestamp: eventData.timestamp || eventData.created_at,
              metadata: eventData.metadata,
              source: 'indexedDB',
            });
          }
        }
      }
    }

    db.close();
  } catch (error) {
    log(`Warning: Could not access legacy IndexedDB: ${error}`, 'warn');
  }

  return events;
}

/**
 * Extract events from localStorage
 */
function extractLocalStorageEvents(): LegacyEventData[] {
  const events: LegacyEventData[] = [];

  if (typeof localStorage === 'undefined') {
    return events;
  }

  // Check for cached events in localStorage
  const cacheKeys = Object.keys(localStorage).filter(
    (key) => key.startsWith('nostr_event_') || key.startsWith('event_cache_')
  );

  for (const key of cacheKeys) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed.event || parsed.id) {
          events.push({
            event: parsed.event || parsed,
            relay: parsed.relay,
            timestamp: parsed.timestamp || Date.now(),
            metadata: parsed.metadata,
            source: 'localStorage',
          });
        }
      }
    } catch (error) {
      log(`Warning: Failed to parse localStorage event ${key}: ${error}`, 'warn');
    }
  }

  return events;
}

// ========================================
// EVENT VALIDATION
// ========================================

/**
 * Validate NOSTR event structure
 */
function validateEvent(event: NostrEvent): { valid: boolean; error?: string } {
  try {
    // Check required fields
    if (!event.id || !event.pubkey || !event.sig) {
      return { valid: false, error: 'Missing required fields' };
    }

    // Validate field formats
    if (!/^[0-9a-f]{64}$/i.test(event.id)) {
      return { valid: false, error: 'Invalid event ID format' };
    }

    if (!/^[0-9a-f]{64}$/i.test(event.pubkey)) {
      return { valid: false, error: 'Invalid pubkey format' };
    }

    if (!/^[0-9a-f]{128}$/i.test(event.sig)) {
      return { valid: false, error: 'Invalid signature format' };
    }

    // Validate event kind
    if (typeof event.kind !== 'number' || event.kind < 0) {
      return { valid: false, error: 'Invalid event kind' };
    }

    // Validate timestamp
    if (typeof event.created_at !== 'number' || event.created_at <= 0) {
      return { valid: false, error: 'Invalid timestamp' };
    }

    // Validate tags
    if (!Array.isArray(event.tags)) {
      return { valid: false, error: 'Invalid tags format' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * Verify event signature
 */
function verifyEventSignature(event: NostrEvent): boolean {
  try {
    return verifyEvent(event);
  } catch {
    return false;
  }
}

// ========================================
// MIGRATION LOGIC
// ========================================

/**
 * Migrate a single event
 */
async function migrateEvent(
  eventData: LegacyEventData,
  db: IDBPDatabase,
  options: MigrationOptions
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    // Validate event structure
    const validation = validateEvent(eventData.event);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Verify signature if enabled
    if (options.verifySignatures) {
      const signatureValid = verifyEventSignature(eventData.event);
      if (!signatureValid) {
        return { success: false, error: 'Invalid signature' };
      }
    }

    // Check for duplicate
    if (options.deduplicateEvents) {
      const tx = db.transaction('events', 'readonly');
      const existingEvent = await tx.objectStore('events').get(eventData.event.id);

      if (existingEvent) {
        return { success: true, duplicate: true };
      }
    }

    // Create migrated event data
    const migratedData: MigratedEventData = {
      event: eventData.event,
      relay: eventData.relay || 'unknown',
      timestamp: eventData.timestamp || Date.now(),
      verified: options.verifySignatures,
      seenOn: eventData.relay ? [eventData.relay] : [],
      metadata: {
        migrated: true,
        migratedFrom: eventData.source,
        migratedAt: Date.now(),
        originalTimestamp: eventData.timestamp,
      },
    };

    // Store in new database
    const tx = db.transaction('events', 'readwrite');
    await tx.objectStore('events').put(migratedData, eventData.event.id);
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
    totalEvents: 0,
    migrated: 0,
    duplicates: 0,
    invalid: 0,
    failed: 0,
    errors: [],
    byKind: {},
  };

  log('\n📋 Starting event migration...', 'info');

  // Step 1: Extract legacy events
  log('\n1️⃣  Extracting legacy events...', 'info');
  const indexedDBEvents = await extractLegacyEvents();
  const localStorageEvents = extractLocalStorageEvents();

  const allEvents = [...indexedDBEvents, ...localStorageEvents];
  stats.totalEvents = allEvents.length;

  if (stats.totalEvents === 0) {
    log('No legacy events found to migrate.', 'warn');
    return stats;
  }

  log(`Found ${stats.totalEvents} event(s) to migrate`, 'info');

  // Count by kind
  allEvents.forEach(({ event }) => {
    stats.byKind[event.kind] = (stats.byKind[event.kind] || 0) + 1;
  });

  // Step 2: Create backup
  const backupPath = await ensureBackupDir();
  log(`\n2️⃣  Creating backup in: ${backupPath}`, 'info');

  if (!options.dryRun) {
    await saveBackup(backupPath, allEvents);
  } else {
    log('(Dry run - backup skipped)', 'warn');
  }

  // Step 3: Migrate events
  log('\n3️⃣  Migrating events...', 'info');

  if (options.dryRun) {
    log('(Dry run - migration skipped)', 'warn');

    // Simulate migration
    for (const eventData of allEvents) {
      const validation = validateEvent(eventData.event);
      if (validation.valid) {
        stats.migrated++;
        if (options.verbose) {
          log(`✓ Would migrate event ${eventData.event.id.substring(0, 8)}...`, 'success');
        }
      } else {
        stats.invalid++;
        stats.errors.push({
          eventId: eventData.event.id || 'unknown',
          error: validation.error || 'Unknown error',
        });
        if (options.verbose) {
          log(`✗ Would skip invalid event: ${validation.error}`, 'error');
        }
      }
    }
  } else {
    // Open new database
    const db = await openDB(NEW_INDEXEDDB_NAME, INDEXEDDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events');
          store.createIndex('kind', 'event.kind');
          store.createIndex('pubkey', 'event.pubkey');
          store.createIndex('created_at', 'event.created_at');
        }
      },
    });

    // Migrate each event
    for (let i = 0; i < allEvents.length; i++) {
      const eventData = allEvents[i];
      const progress = Math.round(((i + 1) / allEvents.length) * 100);

      if (i % 100 === 0 || i === allEvents.length - 1) {
        log(`[${progress}%] Migrating event ${i + 1}/${allEvents.length}...`, 'info');
      }

      const result = await migrateEvent(eventData, db, options);

      if (result.success) {
        if (result.duplicate) {
          stats.duplicates++;
        } else {
          stats.migrated++;
        }

        if (options.verbose && !result.duplicate) {
          log(`✓ Migrated event ${eventData.event.id.substring(0, 8)}...`, 'success');
        }
      } else {
        stats.failed++;
        stats.errors.push({
          eventId: eventData.event.id || 'unknown',
          error: result.error || 'Unknown error',
        });

        if (options.verbose) {
          log(`✗ Failed: ${result.error}`, 'error');
        }
      }
    }

    db.close();
  }

  return stats;
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          NOSTR EVENT MIGRATION TO EVENTCACHE            ║');
  console.log('║                    Epic 003 Wave 5                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    verifySignatures: !args.includes('--skip-verify'),
    deduplicateEvents: !args.includes('--no-dedupe'),
  };

  if (options.dryRun) {
    log('🔍 DRY RUN MODE - No changes will be made\n', 'warn');
  }

  if (!options.force && !options.dryRun) {
    const proceed = await confirm(
      'This will migrate your NOSTR events to new cache structure. Continue?'
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

    log(`Total events found:       ${stats.totalEvents}`, 'info');
    log(`Successfully migrated:    ${stats.migrated}`, 'success');
    log(`Duplicates skipped:       ${stats.duplicates}`, 'warn');
    log(`Invalid events:           ${stats.invalid}`, stats.invalid > 0 ? 'error' : 'info');
    log(`Failed:                   ${stats.failed}`, stats.failed > 0 ? 'error' : 'info');

    console.log('\nEvents by kind:');
    Object.entries(stats.byKind)
      .sort(([, a], [, b]) => b - a)
      .forEach(([kind, count]) => {
        log(`  Kind ${kind}: ${count}`, 'info');
      });

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors (first 10):');
      stats.errors.slice(0, 10).forEach(({ eventId, error }) => {
        log(`  - ${eventId.substring(0, 16)}...: ${error}`, 'error');
      });

      if (stats.errors.length > 10) {
        log(`  ... and ${stats.errors.length - 10} more`, 'warn');
      }
    }

    if (options.dryRun) {
      log('\n✓ Dry run complete. Run without --dry-run to perform actual migration.', 'success');
    } else if (stats.migrated > 0) {
      log('\n✓ Migration successful! Events are now in optimized cache structure.', 'success');
    }

    process.exit(stats.failed > stats.totalEvents / 2 ? 1 : 0);
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
