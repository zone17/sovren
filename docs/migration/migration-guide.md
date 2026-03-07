# NOSTR Data Migration Guide

**US-325: Migration Scripts**
**Epic 003 Wave 5: NOSTR Consolidation**

## Overview

This guide helps you migrate from legacy NOSTR implementations to the new consolidated services architecture. The migration process is safe, reversible, and includes comprehensive validation.

## What Gets Migrated

The migration scripts handle four key areas:

### 1. Relay Configuration

- **From**: Hardcoded relay URLs scattered across codebase
- **To**: Centralized relay configuration in `/packages/shared/src/config/relays.ts`
- **Benefits**: Easy to update, consistent across app, environment-specific configs

### 2. Key Storage

- **From**: Unencrypted keys in localStorage or IndexedDB
- **To**: AES-256-GCM encrypted keys in KeyManagementService
- **Benefits**: Enhanced security, hardware wallet support, key rotation

### 3. Event Cache

- **From**: Raw event storage with no deduplication
- **To**: Optimized EventCache with intelligent deduplication
- **Benefits**: Lower memory usage, faster lookups, better performance

### 4. Subscriptions

- **From**: Manual subscription management per relay
- **To**: Centralized SubscriptionManager with connection pooling
- **Benefits**: Automatic reconnection, load balancing, health monitoring

## Prerequisites

Before starting migration:

1. **Backup your data** (automatic, but verify backup location)
2. **Close all app instances** to avoid data conflicts
3. **Ensure Node.js 20+** is installed
4. **Have database access** credentials ready (if applicable)
5. **Read this guide completely** before starting

## Migration Methods

### Method 1: Interactive Wizard (Recommended)

The easiest way to migrate is using the interactive CLI:

```bash
npm run migrate
```

This launches a step-by-step wizard that:

- Detects what needs migration
- Explains each step
- Confirms actions before making changes
- Shows real-time progress
- Provides detailed results

**Recommended for**: First-time migrations, less technical users

### Method 2: Dry Run (Test First)

Preview what will change without making modifications:

```bash
npm run migrate -- --all --dry-run
```

This will:

- Discover all legacy data
- Show what would be migrated
- Report potential issues
- Generate a preview report

**Recommended for**: Production environments, validation before migration

### Method 3: Command-Line (Advanced)

For automation or specific component migration:

```bash
# Migrate everything
npm run migrate -- --all

# Migrate specific components
npm run migrate -- --relays
npm run migrate -- --keys
npm run migrate -- --events
npm run migrate -- --subs

# Force re-migration (if already migrated)
npm run migrate -- --all --force

# Verbose logging
npm run migrate -- --all --verbose
```

**Recommended for**: Experienced users, CI/CD automation, scripting

## Step-by-Step Migration Process

### Step 1: Check Current Status

First, check what's been migrated:

```bash
npm run migrate -- --status
```

Output:

```
╔════════════════════════════════════════════════════════════╗
║                   Migration Status                         ║
╚════════════════════════════════════════════════════════════╝

Last migration: Never
Components:

⬜ Relay Configuration
⬜ Key Storage
⬜ Event Cache
⬜ Subscriptions
```

### Step 2: Run Dry Run

Test the migration without making changes:

```bash
npm run migrate -- --all --dry-run
```

Review the output carefully:

- Number of items to migrate
- Estimated time
- Potential issues
- Changes that will be made

### Step 3: Perform Migration

If dry run looks good, run actual migration:

```bash
npm run migrate -- --all
```

**For production**, use verbose mode:

```bash
npm run migrate -- --all --verbose
```

### Step 4: Verify Migration

After migration completes:

1. **Check migration status**:

   ```bash
   npm run migrate -- --status
   ```

2. **Review migration report**:

   ```bash
   cat .migration-backups/migration-*/migration-report.json
   ```

3. **Test your application**:

   ```bash
   npm run dev
   ```

4. **Verify data integrity**:
   ```bash
   npm run validate:migration
   ```

### Step 5: Rollback (if needed)

If issues occur, rollback immediately:

```bash
npm run migrate -- --rollback
```

This restores all data to pre-migration state.

## Component-Specific Guides

### Migrating Relay Configuration

**What happens**:

1. Scans codebase for hardcoded relay URLs
2. Discovers relays from config files and localStorage
3. Deduplicates and prioritizes relays
4. Creates centralized relay config
5. Updates environment variables

**Command**:

```bash
npm run migrate:relay-config
```

**Dry run**:

```bash
npm run migrate:relay-config -- --dry-run
```

**After migration**:

- Update relay imports:

  ```typescript
  // Before
  const relays = ['wss://relay.damus.io', 'wss://nos.lol'];

  // After
  import { getReadRelays } from '@/config/relays';
  const relays = getReadRelays();
  ```

### Migrating Key Storage

**What happens**:

1. Extracts keys from localStorage and IndexedDB
2. Validates key formats
3. Encrypts keys with AES-256-GCM
4. Stores in new KeyManagementService
5. Verifies encryption integrity

**Command**:

```bash
npm run migrate:keys
```

**Important**: You'll be prompted for an encryption password. **Remember this password** - you cannot recover keys without it!

**Password requirements**:

- Minimum 12 characters
- Mix of letters, numbers, symbols recommended
- Store securely (password manager)

**After migration**:

- Update key access:

  ```typescript
  // Before
  const privateKey = localStorage.getItem('nostr_private_key');

  // After
  import { NostrKeyManagementService } from '@/services';
  const keyService = new NostrKeyManagementService();
  await keyService.initialize();
  const keyPair = await keyService.getActiveKey();
  ```

### Migrating Event Cache

**What happens**:

1. Loads cached events from old storage
2. Deduplicates events by ID
3. Validates event signatures
4. Migrates to new EventCache
5. Creates optimized indexes

**Command**:

```bash
npm run migrate:events
```

**After migration**:

- Event access is automatic
- Cache limits apply (configurable)
- Old events are pruned based on TTL

### Migrating Subscriptions

**What happens**:

1. Discovers active subscriptions
2. Updates filter formats
3. Migrates to SubscriptionManager
4. Re-establishes connections
5. Preserves subscription state

**Command**:

```bash
npm run migrate:subscriptions
```

**After migration**:

- Subscriptions auto-reconnect
- Health monitoring enabled
- Connection pooling active

## Migration Timeline

Typical migration times:

| Component     | Small Dataset | Medium Dataset | Large Dataset   |
| ------------- | ------------- | -------------- | --------------- |
| Relay Config  | 30 seconds    | 1 minute       | 2 minutes       |
| Key Storage   | 1 minute      | 2 minutes      | 3 minutes       |
| Event Cache   | 2 minutes     | 5 minutes      | 10+ minutes     |
| Subscriptions | 30 seconds    | 1 minute       | 2 minutes       |
| **Total**     | **4 minutes** | **9 minutes**  | **17+ minutes** |

**Small**: < 100 events, < 5 keys, < 10 subscriptions
**Medium**: 100-1000 events, 5-20 keys, 10-50 subscriptions
**Large**: 1000+ events, 20+ keys, 50+ subscriptions

## Backup and Rollback

### Automatic Backups

Every migration creates automatic backups in `.migration-backups/`:

```
.migration-backups/
├── migration-2024-10-26T12-30-00/
│   ├── relay-config/
│   │   ├── relays.ts          # Original relay config
│   │   ├── .env               # Original env vars
│   │   └── legacy-relays.json # Discovery results
│   ├── keys/
│   │   └── keys-backup.json   # Encrypted backup
│   ├── events/
│   │   └── events-backup.json
│   ├── subscriptions/
│   │   └── subscriptions-backup.json
│   └── migration-report.json  # Full report
└── migration-state.json        # Current state
```

### Manual Backup

Before migration, you can create manual backup:

```bash
# Backup everything
npm run backup:all

# Backup specific component
npm run backup:keys
npm run backup:relays
```

### Rollback Process

**Immediate rollback** (right after migration):

```bash
npm run migrate -- --rollback
```

**Manual rollback** (from backup):

```bash
# Restore keys
npm run rollback:keys -- --backup=.migration-backups/migration-2024-10-26T12-30-00

# Restore all components
npm run rollback:all -- --backup=.migration-backups/migration-2024-10-26T12-30-00
```

**Important**: Rollback is only available if:

1. Backup exists and is intact
2. Migration completed successfully
3. No new data created after migration

## Validation and Verification

### Automatic Validation

Migration automatically validates:

- Data integrity (checksums)
- No data loss (item counts)
- Proper encryption
- Valid formats

### Manual Validation

Run comprehensive validation:

```bash
npm run validate:migration
```

This checks:

- All components migrated correctly
- No orphaned data
- Performance benchmarks met
- Security requirements satisfied

### Validation Report

```
╔════════════════════════════════════════════════════════════╗
║                  Validation Report                         ║
╚════════════════════════════════════════════════════════════╝

✓ Relay Configuration
  - 5 relays migrated
  - All URLs valid
  - Read/write relays present

✓ Key Storage
  - 3 keys migrated
  - All keys encrypted
  - Signatures valid

✓ Event Cache
  - 234 events migrated
  - No duplicates
  - All verified

✓ Subscriptions
  - 12 subscriptions migrated
  - All active
  - Connections healthy

Overall: ✅ PASS
```

## Troubleshooting

### Common Issues

#### Issue: "No legacy data found"

**Cause**: Migration already completed or no data to migrate

**Solution**:

1. Check migration status: `npm run migrate -- --status`
2. If already migrated, use `--force` to re-migrate
3. Verify data exists in legacy storage

#### Issue: "Failed to encrypt keys"

**Cause**: Invalid password or crypto error

**Solution**:

1. Ensure password meets requirements (12+ chars)
2. Check Node.js crypto support
3. Try with different password

#### Issue: "Migration incomplete"

**Cause**: Error during migration process

**Solution**:

1. Check error messages in console
2. Review `.migration-backups/*/migration-report.json`
3. Run with `--verbose` for detailed logs
4. Rollback and try again

#### Issue: "Cannot connect to relays after migration"

**Cause**: Invalid relay URLs or network issues

**Solution**:

1. Check relay config: `cat packages/shared/src/config/relays.ts`
2. Test relay connectivity: `npm run test:relays`
3. Verify environment variables
4. Rollback if needed

### Getting Help

If you encounter issues:

1. **Check logs**: `.migration-backups/*/migration.log`
2. **Read troubleshooting**: `docs/migration/troubleshooting.md`
3. **Run diagnostics**: `npm run migrate:diagnose`
4. **Open issue**: GitHub with migration report attached

## Production Migration

Special considerations for production:

### Pre-Migration Checklist

- [ ] Schedule maintenance window
- [ ] Notify users of downtime
- [ ] Run full backup
- [ ] Test migration in staging
- [ ] Review rollback procedure
- [ ] Have monitoring ready
- [ ] Plan for validation
- [ ] Document any customizations

### Migration Steps

1. **Enable maintenance mode**
2. **Stop all services**
3. **Create production backup**
4. **Run migration with verbose logging**
5. **Validate thoroughly**
6. **Monitor for errors**
7. **Test critical paths**
8. **Disable maintenance mode**
9. **Monitor for 24 hours**
10. **Remove old backups after 7 days**

### Rollback Plan

If issues occur in production:

1. **Immediately enable maintenance mode**
2. **Stop all services**
3. **Run rollback: `npm run migrate -- --rollback`**
4. **Validate rollback**
5. **Restart services**
6. **Verify functionality**
7. **Investigate issues**
8. **Schedule re-migration**

## Post-Migration

### Cleanup

After successful migration and validation (7+ days):

```bash
# Remove old backups
rm -rf .migration-backups/migration-2024-*

# Keep latest backup
ls -t .migration-backups/ | tail -n +2 | xargs rm -rf
```

### Monitoring

Monitor these metrics post-migration:

- **Relay connections**: Should be stable
- **Key access times**: Should be similar or faster
- **Event cache hit rate**: Should improve
- **Subscription reconnects**: Should decrease
- **Memory usage**: Should decrease

### Optimization

After migration, consider:

1. **Relay optimization**: Remove slow/unreliable relays
2. **Cache tuning**: Adjust TTL and limits
3. **Key rotation**: Schedule regular rotations
4. **Subscription cleanup**: Remove unused subscriptions

## FAQ

### Q: Can I migrate without downtime?

**A**: Key and relay migrations can be done without downtime. Event cache and subscriptions may require brief service restart.

### Q: How long are backups kept?

**A**: Backups are kept indefinitely until manually deleted. Recommended: Keep for 7 days after successful migration.

### Q: Can I run migration multiple times?

**A**: Yes, use `--force` flag. Previous migration data will be overwritten.

### Q: What if I lose my encryption password?

**A**: Keys cannot be recovered without the password. Always backup your password securely.

### Q: Can I rollback after making new changes?

**A**: No, rollback only works if no new data was created after migration. Manual merge may be needed.

### Q: How do I migrate in stages?

**A**: Use component-specific commands:

```bash
npm run migrate -- --relays     # Day 1
npm run migrate -- --keys       # Day 2
npm run migrate -- --events     # Day 3
npm run migrate -- --subs       # Day 4
```

### Q: What about custom relay configurations?

**A**: Manual relay configs are preserved. You can edit `packages/shared/src/config/relays.ts` after migration.

## Next Steps

After successful migration:

1. Read [Architecture Documentation](../ELITE_ARCHITECTURE_DOCUMENTATION.md)
2. Review [Relay Management Guide](./relay-management.md)
3. Setup [Key Rotation](./key-rotation.md)
4. Configure [Monitoring](./monitoring-setup.md)
5. Optimize [Performance](./performance-tuning.md)

## Support

- **Documentation**: `docs/migration/`
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@sovren.app

---

**Remember**: Always test migration in development/staging before production!
