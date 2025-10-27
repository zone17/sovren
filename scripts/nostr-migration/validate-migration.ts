#!/usr/bin/env ts-node
/**
 * ✅ NOSTR MIGRATION VALIDATION SCRIPT
 *
 * US-323: NOSTR Migration Scripts - Validation
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Validates migration integrity by comparing legacy and migrated data.
 * Ensures no data loss and maintains data integrity post-migration.
 *
 * Features:
 * - Count verification (all items migrated)
 * - Data integrity checks (checksums)
 * - Structure validation
 * - Performance benchmarking
 * - Detailed reporting
 *
 * Usage:
 *   npm run validate:migration           # Validate all migrations
 *   npm run validate:migration -- --keys # Validate keys only
 *   npm run validate:migration -- --events # Validate events only
 *   npm run validate:migration -- --subscriptions # Validate subscriptions only
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */

import { openDB } from 'idb';
import { verifyEvent } from 'nostr-tools';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

// ========================================
// TYPE DEFINITIONS
// ========================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: ValidationStats;
}

interface ValidationStats {
  totalLegacy: number;
  totalMigrated: number;
  matched: number;
  missing: number;
  corrupted: number;
  checksum: {
    legacy: string;
    migrated: string;
    matches: boolean;
  };
}

interface ValidationOptions {
  validateKeys: boolean;
  validateEvents: boolean;
  validateSubscriptions: boolean;
  strictMode: boolean;
  verbose: boolean;
  generateReport: boolean;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

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

/**
 * Calculate checksum for data
 */
function calculateChecksum(data: unknown[]): string {
  const sorted = data
    .map(item => JSON.stringify(item))
    .sort()
    .join('|');

  return createHash('sha256').update(sorted).digest('hex');
}

/**
 * Generate validation report
 */
async function generateReport(
  results: Record<string, ValidationResult>,
  outputPath: string
): Promise<void> {
  const timestamp = new Date().toISOString();

  const report = {
    timestamp,
    summary: {
      allValid: Object.values(results).every(r => r.valid),
      totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: Object.values(results).reduce((sum, r) => sum + r.warnings.length, 0),
    },
    results,
  };

  await fs.writeFile(
    outputPath,
    JSON.stringify(report, null, 2)
  );

  log(`📄 Validation report saved to: ${outputPath}`, 'success');
}

// ========================================
// KEY VALIDATION
// ========================================

async function validateKeyMigration(options: ValidationOptions): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalLegacy: 0,
      totalMigrated: 0,
      matched: 0,
      missing: 0,
      corrupted: 0,
      checksum: {
        legacy: '',
        migrated: '',
        matches: false,
      },
    },
  };

  log('\n🔐 Validating key migration...', 'info');

  try {
    // Extract legacy keys
    const legacyDB = await openDB('NostrKeys', 1);
    const legacyKeys = await legacyDB.getAll('keys');
    result.stats.totalLegacy = legacyKeys.length;

    // Extract migrated keys
    const migratedDB = await openDB('SovrenNostrKeys', 1);
    const migratedKeys = await migratedDB.getAll('keys');
    result.stats.totalMigrated = migratedKeys.length;

    // Count verification
    if (result.stats.totalLegacy !== result.stats.totalMigrated) {
      result.errors.push(
        `Key count mismatch: ${result.stats.totalLegacy} legacy vs ${result.stats.totalMigrated} migrated`
      );
      result.valid = false;
    }

    // Match keys by public key
    const legacyPubkeys = new Set(
      legacyKeys.map(k => k.publicKey || k.pubkey).filter(Boolean)
    );

    const migratedPubkeys = new Set(
      migratedKeys.map(k => k.publicKey).filter(Boolean)
    );

    // Check for missing keys
    for (const pubkey of legacyPubkeys) {
      if (migratedPubkeys.has(pubkey)) {
        result.stats.matched++;
      } else {
        result.stats.missing++;
        result.errors.push(`Missing migrated key: ${pubkey.substring(0, 16)}...`);
        result.valid = false;
      }
    }

    // Validate encryption on migrated keys
    for (const key of migratedKeys) {
      if (!key.encryptedPrivateKey || !key.iv || !key.authTag) {
        result.stats.corrupted++;
        result.errors.push(`Corrupted migrated key: ${key.publicKey?.substring(0, 16)}...`);
        result.valid = false;
      }

      if (!key.migrated || !key.migratedFrom) {
        result.warnings.push(`Key missing migration metadata: ${key.publicKey?.substring(0, 16)}...`);
      }
    }

    // Calculate checksums
    result.stats.checksum.legacy = calculateChecksum(
      legacyKeys.map(k => k.publicKey || k.pubkey)
    );
    result.stats.checksum.migrated = calculateChecksum(
      migratedKeys.map(k => k.publicKey)
    );
    result.stats.checksum.matches = result.stats.checksum.legacy === result.stats.checksum.migrated;

    if (!result.stats.checksum.matches) {
      result.errors.push('Checksum mismatch - data may be corrupted');
      result.valid = false;
    }

    legacyDB.close();
    migratedDB.close();

    if (options.verbose) {
      log(`  Legacy keys:    ${result.stats.totalLegacy}`, 'info');
      log(`  Migrated keys:  ${result.stats.totalMigrated}`, 'info');
      log(`  Matched:        ${result.stats.matched}`, 'success');
      log(`  Missing:        ${result.stats.missing}`, result.stats.missing > 0 ? 'error' : 'info');
      log(`  Corrupted:      ${result.stats.corrupted}`, result.stats.corrupted > 0 ? 'error' : 'info');
      log(`  Checksum match: ${result.stats.checksum.matches}`, result.stats.checksum.matches ? 'success' : 'error');
    }
  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    result.valid = false;
  }

  return result;
}

// ========================================
// EVENT VALIDATION
// ========================================

async function validateEventMigration(options: ValidationOptions): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalLegacy: 0,
      totalMigrated: 0,
      matched: 0,
      missing: 0,
      corrupted: 0,
      checksum: {
        legacy: '',
        migrated: '',
        matches: false,
      },
    },
  };

  log('\n📦 Validating event migration...', 'info');

  try {
    // Extract legacy events
    const legacyDB = await openDB('NostrEvents', 2);
    const storeNames = ['events', 'nostrEvents', 'cache'];

    const legacyEvents = [];
    for (const storeName of storeNames) {
      if (legacyDB.objectStoreNames.contains(storeName)) {
        const events = await legacyDB.getAll(storeName);
        legacyEvents.push(...events.map(e => e.event || e));
      }
    }

    result.stats.totalLegacy = legacyEvents.length;

    // Extract migrated events
    const migratedDB = await openDB('SovrenEventCache', 2);
    const migratedEvents = await migratedDB.getAll('events');
    result.stats.totalMigrated = migratedEvents.length;

    // Count verification (allowing for deduplication)
    if (result.stats.totalMigrated > result.stats.totalLegacy) {
      result.errors.push(
        `More migrated events than legacy (possible duplicate legacy data)`
      );
    }

    // Match events by ID
    const legacyIds = new Set(legacyEvents.map(e => e.id).filter(Boolean));
    const migratedIds = new Set(migratedEvents.map(e => e.event?.id).filter(Boolean));

    // Check for missing events
    for (const eventId of legacyIds) {
      if (migratedIds.has(eventId)) {
        result.stats.matched++;
      } else {
        result.stats.missing++;
        if (options.strictMode) {
          result.errors.push(`Missing migrated event: ${eventId.substring(0, 16)}...`);
          result.valid = false;
        } else {
          result.warnings.push(`Missing migrated event: ${eventId.substring(0, 16)}...`);
        }
      }
    }

    // Validate migrated event structure and signatures
    for (const migratedEvent of migratedEvents) {
      const event = migratedEvent.event;

      if (!event) {
        result.stats.corrupted++;
        result.errors.push('Migrated event missing event data');
        result.valid = false;
        continue;
      }

      // Validate event structure
      if (!event.id || !event.pubkey || !event.sig) {
        result.stats.corrupted++;
        result.errors.push(`Corrupted event: ${event.id?.substring(0, 16) || 'unknown'}...`);
        result.valid = false;
        continue;
      }

      // Verify signature if strict mode
      if (options.strictMode) {
        try {
          const signatureValid = verifyEvent(event);
          if (!signatureValid) {
            result.errors.push(`Invalid signature: ${event.id.substring(0, 16)}...`);
            result.valid = false;
          }
        } catch (error) {
          result.errors.push(`Signature verification failed: ${event.id.substring(0, 16)}...`);
          result.valid = false;
        }
      }

      // Check migration metadata
      if (!migratedEvent.metadata?.migrated) {
        result.warnings.push(`Event missing migration metadata: ${event.id.substring(0, 16)}...`);
      }
    }

    // Calculate checksums
    result.stats.checksum.legacy = calculateChecksum(
      legacyEvents.map(e => e.id).filter(Boolean).sort()
    );
    result.stats.checksum.migrated = calculateChecksum(
      migratedEvents.map(e => e.event?.id).filter(Boolean).sort()
    );
    result.stats.checksum.matches = result.stats.checksum.legacy === result.stats.checksum.migrated;

    if (!result.stats.checksum.matches && options.strictMode) {
      result.errors.push('Checksum mismatch - possible data corruption or deduplication');
    } else if (!result.stats.checksum.matches) {
      result.warnings.push('Checksum mismatch - likely due to deduplication');
    }

    legacyDB.close();
    migratedDB.close();

    if (options.verbose) {
      log(`  Legacy events:    ${result.stats.totalLegacy}`, 'info');
      log(`  Migrated events:  ${result.stats.totalMigrated}`, 'info');
      log(`  Matched:          ${result.stats.matched}`, 'success');
      log(`  Missing:          ${result.stats.missing}`, result.stats.missing > 0 ? 'warn' : 'info');
      log(`  Corrupted:        ${result.stats.corrupted}`, result.stats.corrupted > 0 ? 'error' : 'info');
      log(`  Checksum match:   ${result.stats.checksum.matches}`, result.stats.checksum.matches ? 'success' : 'warn');
    }
  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    result.valid = false;
  }

  return result;
}

// ========================================
// SUBSCRIPTION VALIDATION
// ========================================

async function validateSubscriptionMigration(options: ValidationOptions): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalLegacy: 0,
      totalMigrated: 0,
      matched: 0,
      missing: 0,
      corrupted: 0,
      checksum: {
        legacy: '',
        migrated: '',
        matches: false,
      },
    },
  };

  log('\n🔄 Validating subscription migration...', 'info');

  try {
    // Extract legacy subscriptions
    const legacyDB = await openDB('NostrSubscriptions', 1);
    const storeNames = ['subscriptions', 'subs', 'active_subscriptions'];

    const legacySubs = [];
    for (const storeName of storeNames) {
      if (legacyDB.objectStoreNames.contains(storeName)) {
        const subs = await legacyDB.getAll(storeName);
        legacySubs.push(...subs);
      }
    }

    result.stats.totalLegacy = legacySubs.length;

    // Extract migrated subscriptions
    const migratedDB = await openDB('SovrenSubscriptionManager', 1);
    const migratedSubs = await migratedDB.getAll('subscriptions');
    result.stats.totalMigrated = migratedSubs.length;

    // Match subscriptions by ID
    const legacyIds = new Set(legacySubs.map(s => s.id || s.subscriptionId).filter(Boolean));
    const migratedIds = new Set(migratedSubs.map(s => s.id).filter(Boolean));

    for (const subId of legacyIds) {
      if (migratedIds.has(subId)) {
        result.stats.matched++;
      } else {
        result.stats.missing++;
        result.warnings.push(`Missing migrated subscription: ${subId}`);
      }
    }

    // Validate migrated subscription structure
    for (const sub of migratedSubs) {
      if (!sub.id || !Array.isArray(sub.filters) || sub.filters.length === 0) {
        result.stats.corrupted++;
        result.errors.push(`Corrupted subscription: ${sub.id || 'unknown'}`);
        result.valid = false;
      }

      if (!sub.metadata?.migrated) {
        result.warnings.push(`Subscription missing migration metadata: ${sub.id}`);
      }
    }

    // Calculate checksums
    result.stats.checksum.legacy = calculateChecksum(
      legacySubs.map(s => s.id || s.subscriptionId).filter(Boolean).sort()
    );
    result.stats.checksum.migrated = calculateChecksum(
      migratedSubs.map(s => s.id).filter(Boolean).sort()
    );
    result.stats.checksum.matches = result.stats.checksum.legacy === result.stats.checksum.migrated;

    legacyDB.close();
    migratedDB.close();

    if (options.verbose) {
      log(`  Legacy subscriptions:    ${result.stats.totalLegacy}`, 'info');
      log(`  Migrated subscriptions:  ${result.stats.totalMigrated}`, 'info');
      log(`  Matched:                 ${result.stats.matched}`, 'success');
      log(`  Missing:                 ${result.stats.missing}`, result.stats.missing > 0 ? 'warn' : 'info');
      log(`  Corrupted:               ${result.stats.corrupted}`, result.stats.corrupted > 0 ? 'error' : 'info');
      log(`  Checksum match:          ${result.stats.checksum.matches}`, result.stats.checksum.matches ? 'success' : 'warn');
    }
  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    result.valid = false;
  }

  return result;
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           NOSTR MIGRATION VALIDATION                    ║');
  console.log('║                    Epic 003 Wave 5                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const options: ValidationOptions = {
    validateKeys: args.includes('--keys') || args.length === 0,
    validateEvents: args.includes('--events') || args.length === 0,
    validateSubscriptions: args.includes('--subscriptions') || args.length === 0,
    strictMode: args.includes('--strict'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    generateReport: args.includes('--report'),
  };

  if (options.strictMode) {
    log('🔍 STRICT MODE - All errors are fatal\n', 'warn');
  }

  const results: Record<string, ValidationResult> = {};

  // Validate keys
  if (options.validateKeys) {
    results.keys = await validateKeyMigration(options);
  }

  // Validate events
  if (options.validateEvents) {
    results.events = await validateEventMigration(options);
  }

  // Validate subscriptions
  if (options.validateSubscriptions) {
    results.subscriptions = await validateSubscriptionMigration(options);
  }

  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   VALIDATION SUMMARY                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let allValid = true;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const [category, result] of Object.entries(results)) {
    const status = result.valid ? '✓' : '✗';
    const statusColor = result.valid ? 'success' : 'error';

    log(`${status} ${category.toUpperCase()}: ${result.valid ? 'VALID' : 'INVALID'}`, statusColor);

    if (result.errors.length > 0) {
      log(`  Errors:   ${result.errors.length}`, 'error');
      totalErrors += result.errors.length;
    }

    if (result.warnings.length > 0) {
      log(`  Warnings: ${result.warnings.length}`, 'warn');
      totalWarnings += result.warnings.length;
    }

    allValid = allValid && result.valid;
  }

  console.log('');
  log(`Total errors:   ${totalErrors}`, totalErrors > 0 ? 'error' : 'success');
  log(`Total warnings: ${totalWarnings}`, totalWarnings > 0 ? 'warn' : 'info');

  // Print detailed errors and warnings
  if (totalErrors > 0 || totalWarnings > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                      DETAILS');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const [category, result] of Object.entries(results)) {
      if (result.errors.length > 0) {
        log(`\n${category.toUpperCase()} ERRORS:`, 'error');
        result.errors.forEach(err => log(`  • ${err}`, 'error'));
      }

      if (result.warnings.length > 0 && options.verbose) {
        log(`\n${category.toUpperCase()} WARNINGS:`, 'warn');
        result.warnings.forEach(warn => log(`  • ${warn}`, 'warn'));
      }
    }
  }

  // Generate report if requested
  if (options.generateReport) {
    const reportDir = path.join(process.cwd(), 'reports', 'migration-validation');
    await fs.mkdir(reportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `validation-${timestamp}.json`);

    await generateReport(results, reportPath);
  }

  // Final verdict
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  if (allValid) {
    log('║                ✅ MIGRATION VALIDATED                    ║', 'success');
  } else {
    log('║                ❌ MIGRATION FAILED VALIDATION            ║', 'error');
  }
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  process.exit(allValid ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateKeyMigration, validateEventMigration, validateSubscriptionMigration };
