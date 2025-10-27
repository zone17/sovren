# NOSTR Migration Guide

**Epic 003 Wave 5**: NOSTR Consolidation - Complete Migration Instructions

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Process](#migration-process)
4. [Post-Migration Validation](#post-migration-validation)
5. [Troubleshooting](#troubleshooting)
6. [Rollback Procedures](#rollback-procedures)

---

## Overview

This guide walks you through migrating from legacy NOSTR storage to the new consolidated system with:
- **KeyManagementService** - AES-256-GCM encrypted key storage
- **EventCacheService** - Optimized event caching with deduplication
- **SubscriptionManagerService** - Enhanced subscription tracking

### What Gets Migrated?

| Data Type | From | To | Encryption |
|-----------|------|----|-----------|
| Keys | LocalStorage/IndexedDB | SovrenNostrKeys | AES-256-GCM |
| Events | NostrEvents DB | SovrenEventCache | No (public data) |
| Subscriptions | NostrSubscriptions DB | SovrenSubscriptionManager | No |

### Estimated Time

- **Keys**: 1-2 minutes (depends on encryption)
- **Events**: 5-30 minutes (depends on count)
- **Subscriptions**: 1-5 minutes

---

## Pre-Migration Checklist

### 1. System Requirements

- [ ] Node.js 18+ installed
- [ ] TypeScript 5.3+ installed
- [ ] At least 500MB free disk space
- [ ] Browser closed (to access IndexedDB)

### 2. Backup Existing Data

**CRITICAL**: Always backup before migration!

```bash
# Backup will be created automatically in:
# ./backups/nostr-keys/<timestamp>/
# ./backups/nostr-events/<timestamp>/
# ./backups/nostr-subscriptions/<timestamp>/
```

### 3. Test Dry Run

Always run dry-run first to preview changes:

```bash
npm run migrate:all:dry-run
```

Expected output:
```
🔍 DRY RUN MODE - No changes will be made

📋 Starting key migration...
Found 1 key(s) to migrate
✓ Would migrate key from localStorage

📋 Starting event migration...
Found 523 event(s) to migrate
✓ Would migrate 523 events

📋 Starting subscription migration...
Found 3 subscription(s) to migrate
✓ Would migrate 3 subscriptions
```

---

## Migration Process

### Step 1: Key Migration

**What it does**: Migrates NOSTR private keys to encrypted storage

```bash
# Dry run first
npm run migrate:keys:dry-run

# Actual migration
npm run migrate:keys
```

**Interactive prompts**:

1. **Confirmation**: Proceed with migration? `y`
2. **Encryption password**: Enter strong password (12+ chars)
3. **Confirm password**: Re-enter password

**Output**:
```
╔══════════════════════════════════════════════════════════╗
║       NOSTR KEY MIGRATION TO KEYMANAGEMENTSERVICE       ║
╚══════════════════════════════════════════════════════════╝

1️⃣  Extracting legacy keys...
Found 1 key(s) to migrate

2️⃣  Creating backup in: ./backups/nostr-keys/2025-10-26T12-00-00-000Z
✓ Backup saved to: ./backups/nostr-keys/2025-10-26T12-00-00-000Z/keys-backup.json

3️⃣  Encryption setup
Enter encryption password: ************
Confirm encryption password: ************

4️⃣  Migrating keys...
[100%] Migrating key 1/1...
✓ Migrated key from localStorage

╔══════════════════════════════════════════════════════════╗
║                   MIGRATION COMPLETE                     ║
╚══════════════════════════════════════════════════════════╝

Total keys found:     1
Successfully migrated: 1
Skipped:              0
Failed:               0

✓ Migration successful! Your keys are now encrypted with AES-256-GCM.
⚠️  Remember your encryption password - you cannot recover keys without it!
```

**IMPORTANT**: Write down your encryption password! Store it in a password manager.

---

### Step 2: Event Migration

**What it does**: Migrates NOSTR events to optimized cache with deduplication

```bash
# Dry run first
npm run migrate:events:dry-run

# Actual migration (can take time with large datasets)
npm run migrate:events
```

**Options**:
- `--skip-verify`: Skip signature verification (faster but less safe)
- `--no-dedupe`: Migrate all events including duplicates
- `--verbose`: Show detailed progress

**Output**:
```
╔══════════════════════════════════════════════════════════╗
║          NOSTR EVENT MIGRATION TO EVENTCACHE            ║
╚══════════════════════════════════════════════════════════╝

1️⃣  Extracting legacy events...
Found 523 event(s) to migrate

2️⃣  Creating backup in: ./backups/nostr-events/2025-10-26T12-00-00-000Z
✓ Backup saved to: ./backups/nostr-events/2025-10-26T12-00-00-000Z

3️⃣  Migrating events...
[100%] Migrating event 523/523...

╔══════════════════════════════════════════════════════════╗
║                   MIGRATION COMPLETE                     ║
╚══════════════════════════════════════════════════════════╝

Total events found:       523
Successfully migrated:    518
Duplicates skipped:       5
Invalid events:           0
Failed:                   0

Events by kind:
  Kind 1: 423 (text notes)
  Kind 0: 45 (metadata)
  Kind 3: 23 (contacts)
  Kind 7: 32 (reactions)

✓ Migration successful! Events are now in optimized cache structure.
```

---

### Step 3: Subscription Migration

**What it does**: Migrates active NOSTR subscriptions to SubscriptionManager

```bash
# Dry run first
npm run migrate:subscriptions:dry-run

# Actual migration
npm run migrate:subscriptions
```

**Options**:
- `--include-inactive`: Migrate old/inactive subscriptions
- `--cleanup`: Delete old database after migration
- `--verbose`: Show detailed progress

**Output**:
```
╔══════════════════════════════════════════════════════════╗
║    NOSTR SUBSCRIPTION MIGRATION TO SUBSCRIPTIONMANAGER  ║
╚══════════════════════════════════════════════════════════╝

1️⃣  Extracting legacy subscriptions...
Found 3 subscription(s) to migrate

2️⃣  Creating backup in: ./backups/nostr-subscriptions/2025-10-26T12-00-00-000Z
✓ Backup saved

3️⃣  Migrating subscriptions...
[100%] Migrating subscription 3/3...

╔══════════════════════════════════════════════════════════╗
║                   MIGRATION COMPLETE                     ║
╚══════════════════════════════════════════════════════════╝

Total subscriptions found: 3
Successfully migrated:     3
Inactive subscriptions:    0
Invalid subscriptions:     0
Failed:                    0

✓ Migration successful! Subscriptions are now managed by SubscriptionManager.
```

---

## Post-Migration Validation

### Validate Migration Integrity

```bash
# Standard validation
npm run migrate:validate

# Strict validation (with signature verification)
npm run migrate:validate:strict
```

**What gets validated**:
1. Count verification (all items migrated)
2. Data integrity (checksums match)
3. Structure validation (schema compliance)
4. Signature verification (strict mode only)

**Expected output**:
```
╔══════════════════════════════════════════════════════════╗
║           NOSTR MIGRATION VALIDATION                    ║
╚══════════════════════════════════════════════════════════╝

🔐 Validating key migration...
  Legacy keys:    1
  Migrated keys:  1
  Matched:        1
  Missing:        0
  Corrupted:      0
  Checksum match: true

📦 Validating event migration...
  Legacy events:    523
  Migrated events:  518
  Matched:          518
  Missing:          0
  Corrupted:        0
  Checksum match: true

🔄 Validating subscription migration...
  Legacy subscriptions:    3
  Migrated subscriptions:  3
  Matched:                 3
  Missing:                 0
  Corrupted:               0
  Checksum match:          true

╔══════════════════════════════════════════════════════════╗
║                ✅ MIGRATION VALIDATED                    ║
╚══════════════════════════════════════════════════════════╝

Total errors:   0
Total warnings: 0
```

If validation fails, see [Troubleshooting](#troubleshooting).

---

## Troubleshooting

### Keys Not Migrated

**Symptom**: "No legacy keys found to migrate"

**Solutions**:
1. Check browser LocalStorage: DevTools → Application → Local Storage
2. Verify IndexedDB: DevTools → Application → IndexedDB → NostrKeys
3. Ensure browser is closed during migration (file locks)

### Events Missing After Migration

**Symptom**: Lower migrated count than legacy count

**Causes**:
- Deduplication (expected) - duplicates were removed
- Invalid signatures (if `--skip-verify` not used)
- Corrupted events in legacy storage

**Solutions**:
1. Re-run with `--skip-verify` to migrate unsigned events
2. Re-run with `--no-dedupe` to keep all duplicates
3. Check error log for specific event IDs

### Migration Timeout

**Symptom**: "Migration timed out" or hangs

**Solutions**:
1. Migrate in chunks: Run events migration separately
2. Increase timeout (modify script)
3. Close other applications (free up resources)

### Password Forgotten

**Symptom**: Can't decrypt migrated keys

**Solutions**:
1. **Rollback** to legacy storage (see below)
2. Re-migrate with new password
3. **No recovery** without password - keys are permanently encrypted

---

## Rollback Procedures

### When to Rollback

- Migration validation failed
- Application errors after migration
- Performance degradation
- Data inconsistencies

### Rollback Process

```bash
# Dry run first
npm run migrate:rollback:dry-run

# Interactive rollback (select backup)
npm run migrate:rollback

# Specific backup path
npm run migrate:rollback -- --backup-path ./backups/nostr-keys/2025-10-26T12-00-00-000Z

# Delete new database after rollback
npm run migrate:rollback -- --delete-new
```

**Interactive prompts**:
```
╔══════════════════════════════════════════════════════════╗
║              NOSTR MIGRATION ROLLBACK                   ║
╚══════════════════════════════════════════════════════════╝

⚠️  WARNING: This will restore old data and may delete new data!

Available backups for keys:
1. 2025-10-26T12-00-00-000Z (Oct 26, 2025, 12:00 PM)
2. 2025-10-25T10-30-00-000Z (Oct 25, 2025, 10:30 AM)

Select backup number (or 0 to cancel): 1

This will rollback your NOSTR migration. Are you ABSOLUTELY SURE? (y/n): y
This action cannot be easily undone. Proceed with rollback? (y/n): y

🔐 Rolling back key migration...
[100%] Restoring key 1/1...
✓ Restored key from backup

╔══════════════════════════════════════════════════════════╗
║                   ROLLBACK COMPLETE                      ║
╚══════════════════════════════════════════════════════════╝

Total restored: 1
Total failed:   0

✓ Rollback successful! Legacy data has been restored.
💡 You may want to clear your browser cache and reload the application.
```

### Post-Rollback Steps

1. Clear browser cache
2. Reload application
3. Verify keys work (try signing an event)
4. Report issue to development team

---

## Best Practices

### Before Migration

1. **Backup manually** (export keys to paper wallet)
2. **Test in development** environment first
3. **Run dry-run** to preview changes
4. **Close browser** during migration
5. **Document password** securely

### During Migration

1. **Don't interrupt** migration scripts
2. **Monitor progress** for errors
3. **Save output logs** for troubleshooting
4. **Note any warnings** even if migration succeeds

### After Migration

1. **Validate immediately** (`npm run migrate:validate`)
2. **Test key functionality** (sign an event)
3. **Verify events visible** in app
4. **Keep backups** for 30 days minimum
5. **Monitor performance** for issues

---

## FAQs

**Q: Can I migrate in stages?**
A: Yes! You can migrate keys, events, and subscriptions independently.

**Q: Is migration reversible?**
A: Yes, via rollback with backups. Backups are created automatically.

**Q: Will old apps still work?**
A: No, after migration, use the new Sovren app. Old data remains accessible via backup.

**Q: How long do I keep backups?**
A: Minimum 30 days. Keep permanently if storage allows.

**Q: Can I re-run migration?**
A: Yes, but it will overwrite existing migrated data. Use rollback first.

**Q: What if I lose my encryption password?**
A: **Keys are permanently lost**. No recovery possible. Keep password safe!

---

## Support

**Issues**: [GitHub Issues](https://github.com/sovren/sovren/issues)
**Docs**: `/docs/nostr/`
**Status**: Check `npm run migrate:validate` output

---

**Last Updated**: 2025-10-26
**Epic**: 003 Wave 5 - NOSTR Consolidation
