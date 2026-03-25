# NOSTR Migration Troubleshooting Guide

**US-325: Migration Scripts**
**Epic 003 Wave 5: NOSTR Consolidation**

## Quick Diagnostic

Run this first when encountering issues:

```bash
npm run migrate:diagnose
```

This checks:

- Node.js version compatibility
- Required dependencies
- File system permissions
- Database connectivity
- Backup availability
- Migration state

## Common Issues and Solutions

### 1. Migration Fails to Start

#### Error: "Cannot find module"

**Symptoms**:

```
Error: Cannot find module './migrate-keys'
```

**Causes**:

- Missing dependencies
- Incorrect working directory
- TypeScript compilation needed

**Solutions**:

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run from project root
cd /path/to/Sovren
npm run migrate
```

#### Error: "Permission denied"

**Symptoms**:

```
EACCES: permission denied, mkdir '.migration-backups'
```

**Causes**:

- Insufficient file system permissions
- Directory ownership issues

**Solutions**:

```bash
# Fix permissions
chmod -R u+w .migration-backups

# Or run with appropriate permissions
sudo npm run migrate  # Not recommended for production
```

#### Error: "Node version not supported"

**Symptoms**:

```
Error: Node.js 20 or higher required
```

**Causes**:

- Outdated Node.js version

**Solutions**:

```bash
# Check current version
node --version

# Install Node.js 20+
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### 2. Discovery Issues

#### Issue: "No legacy data found"

**Symptoms**:

- Migration finds 0 items to migrate
- "No legacy keys found to migrate"

**Diagnosis**:

```bash
# Check if already migrated
npm run migrate -- --status

# Check for legacy data manually
ls -la ~/.local/share/nostr
sqlite3 ~/.local/share/nostr/db.sqlite "SELECT COUNT(*) FROM events;"
```

**Solutions**:

1. **Already migrated**: Use `--force` to re-migrate

   ```bash
   npm run migrate -- --all --force
   ```

2. **Data in different location**: Specify custom path

   ```bash
   npm run migrate -- --data-path=/custom/path
   ```

3. **No data to migrate**: Normal for fresh installations

#### Issue: "Invalid legacy data format"

**Symptoms**:

- "Failed to parse legacy key data"
- "Unsupported relay format"

**Diagnosis**:

```bash
# Inspect legacy data
cat .migration-backups/*/legacy-*.json

# Validate data structure
npm run validate:legacy-data
```

**Solutions**:

1. **Manual conversion needed**: Export and convert manually
2. **Contact support**: Provide data samples
3. **Skip invalid data**: Use `--skip-invalid` flag
   ```bash
   npm run migrate -- --all --skip-invalid
   ```

### 3. Encryption Issues

#### Error: "Failed to encrypt keys"

**Symptoms**:

```
Error: Failed to encrypt private key
CryptographyError: Invalid key length
```

**Causes**:

- Node.js crypto not available
- Invalid password
- Insufficient entropy

**Solutions**:

1. **Verify crypto support**:

   ```bash
   node -e "console.log(crypto.getCiphers())"
   ```

2. **Use stronger password**:
   - Minimum 12 characters
   - Include mix of characters
   - Avoid common words

3. **Check Node.js build**:
   ```bash
   node -p "process.versions.openssl"
   ```

#### Error: "Passwords do not match"

**Symptoms**:

- Password confirmation fails
- "Passwords do not match"

**Solutions**:

- Type passwords carefully
- Use password manager
- Copy/paste both entries
- Disable password masking temporarily:
  ```bash
  npm run migrate:keys -- --show-password
  ```

#### Error: "Cannot decrypt keys"

**Symptoms**:

- Post-migration key access fails
- "Invalid authentication tag"

**Diagnosis**:

```bash
# Verify encrypted data integrity
npm run verify:encryption
```

**Solutions**:

1. **Wrong password**: Cannot recover without correct password
2. **Corrupted data**: Restore from backup
   ```bash
   npm run migrate -- --rollback
   ```
3. **Key rotation needed**: Generate new keys

### 4. Relay Configuration Issues

#### Issue: "No relays configured after migration"

**Symptoms**:

- Cannot connect to any relays
- Empty relay list

**Diagnosis**:

```bash
# Check relay config
cat packages/shared/src/config/relays.ts

# Check environment
env | grep NOSTR_RELAYS
```

**Solutions**:

1. **Missing config file**:

   ```bash
   # Re-run relay migration
   npm run migrate:relay-config -- --force
   ```

2. **Invalid environment variable**:

   ```bash
   # Update .env
   echo 'NOSTR_RELAYS="wss://relay.damus.io,wss://nos.lol"' >> .env
   ```

3. **Manual configuration**:
   ```typescript
   // packages/shared/src/config/relays.ts
   export const DEFAULT_RELAYS = [
     {
       url: 'wss://relay.damus.io',
       read: true,
       write: true,
       search: true,
       priority: 1,
     },
   ];
   ```

#### Issue: "Relay URLs invalid"

**Symptoms**:

- "Invalid relay URL format"
- Connection failures

**Diagnosis**:

```bash
# Test relay connectivity
npm run test:relay wss://relay.damus.io
```

**Solutions**:

1. **Fix URL format**: Must be `wss://` or `ws://`
2. **Remove invalid URLs**: Edit relay config manually
3. **Use known good relays**:
   ```typescript
   const KNOWN_RELAYS = [
     'wss://relay.damus.io',
     'wss://relay.nostr.band',
     'wss://nos.lol',
     'wss://relay.snort.social',
   ];
   ```

### 5. Event Cache Issues

#### Issue: "Event cache migration timeout"

**Symptoms**:

- Migration stalls at events
- "Operation timed out"

**Causes**:

- Too many cached events
- Large event payload
- Database locks

**Solutions**:

1. **Increase timeout**:

   ```bash
   npm run migrate:events -- --timeout=600000  # 10 minutes
   ```

2. **Batch migration**:

   ```bash
   npm run migrate:events -- --batch-size=100
   ```

3. **Clear old events first**:
   ```bash
   npm run cache:prune -- --older-than=30d
   npm run migrate:events
   ```

#### Issue: "Duplicate events detected"

**Symptoms**:

- "Event already exists"
- Higher event count post-migration

**Causes**:

- Multiple data sources
- Previous migration attempts

**Solutions**:

1. **Enable deduplication** (automatic in new system)
2. **Manual cleanup**:

   ```bash
   npm run cache:deduplicate
   ```

3. **Ignore duplicates**: Migration handles automatically

### 6. Subscription Issues

#### Issue: "Subscriptions not reconnecting"

**Symptoms**:

- No events received
- "Subscription inactive"

**Diagnosis**:

```bash
# Check subscription status
npm run subs:status

# Check relay connections
npm run relays:status
```

**Solutions**:

1. **Restart subscription manager**:

   ```bash
   npm run subs:restart
   ```

2. **Re-create subscriptions**:

   ```bash
   npm run migrate:subscriptions -- --force
   ```

3. **Check relay health**:
   ```bash
   npm run relays:health
   ```

#### Issue: "Filter format errors"

**Symptoms**:

- "Invalid filter format"
- Events not matching filters

**Solutions**:

1. **Update filter format**: Old filters auto-converted
2. **Validate filters**:
   ```bash
   npm run validate:filters
   ```
3. **Regenerate subscriptions**: Use `--force`

### 7. Validation Failures

#### Error: "Validation failed"

**Symptoms**:

```
❌ Validation failed
- Data integrity check failed
- Missing 3 keys
```

**Diagnosis**:

```bash
# Run detailed validation
npm run validate:migration -- --verbose

# Check specific component
npm run validate:keys
npm run validate:events
```

**Solutions**:

1. **Review validation report**:

   ```bash
   cat .migration-backups/*/validation-report.json
   ```

2. **Fix specific issues**:
   - Missing data: Re-run migration
   - Corrupted data: Restore from backup
   - Format issues: Manual conversion

3. **Rollback if critical**:
   ```bash
   npm run migrate -- --rollback
   ```

### 8. Rollback Issues

#### Error: "Rollback not available"

**Symptoms**:

- "No rollback available"
- "Backup not found"

**Causes**:

- Backup deleted/corrupted
- Migration never completed
- Too much time elapsed

**Solutions**:

1. **Check backup existence**:

   ```bash
   ls -la .migration-backups/
   ```

2. **Restore from manual backup**:

   ```bash
   npm run rollback:all -- --backup=/path/to/backup
   ```

3. **Manual rollback**: Follow manual restoration guide

#### Error: "Rollback incomplete"

**Symptoms**:

- Some data restored, some not
- Inconsistent state

**Solutions**:

1. **Complete rollback**:

   ```bash
   npm run rollback:all -- --force
   ```

2. **Manual verification**:

   ```bash
   npm run verify:rollback
   ```

3. **Restore specific components**:
   ```bash
   npm run rollback:keys
   npm run rollback:events
   ```

### 9. Performance Issues

#### Issue: "Migration extremely slow"

**Symptoms**:

- Takes 10x longer than estimated
- High CPU/memory usage

**Diagnosis**:

```bash
# Monitor migration progress
npm run migrate -- --all --verbose

# Check system resources
top
htop
```

**Solutions**:

1. **Reduce batch size**:

   ```bash
   npm run migrate -- --batch-size=10
   ```

2. **Free system resources**: Close other applications

3. **Split migration**: Migrate components separately
   ```bash
   npm run migrate -- --relays
   # Wait for completion
   npm run migrate -- --keys
   # etc.
   ```

#### Issue: "Out of memory"

**Symptoms**:

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Solutions**:

1. **Increase Node.js memory**:

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run migrate
   ```

2. **Use streaming mode**:

   ```bash
   npm run migrate:events -- --streaming
   ```

3. **Clear cache before migration**:
   ```bash
   npm run cache:clear
   npm run migrate
   ```

### 10. Database Issues

#### Error: "Database locked"

**Symptoms**:

```
Error: database is locked
SQLITE_BUSY
```

**Solutions**:

1. **Close other database connections**
2. **Increase timeout**:
   ```bash
   npm run migrate -- --db-timeout=30000
   ```
3. **Use WAL mode**:
   ```sql
   PRAGMA journal_mode=WAL;
   ```

#### Error: "Database schema mismatch"

**Symptoms**:

- "Table does not exist"
- "Column not found"

**Solutions**:

1. **Run migrations**:

   ```bash
   npm run db:migrate
   ```

2. **Reset database** (CAUTION: data loss):
   ```bash
   npm run db:reset
   npm run migrate -- --all
   ```

## Advanced Troubleshooting

### Enable Debug Mode

```bash
# Maximum verbosity
DEBUG=* npm run migrate -- --all --verbose

# Component-specific debug
DEBUG=nostr:migration:keys npm run migrate:keys
DEBUG=nostr:migration:relays npm run migrate:relay-config
```

### Inspect Migration State

```bash
# View complete state
cat .migration-backups/migration-state.json | jq

# Check specific component
cat .migration-backups/migration-state.json | jq '.components.keys'
```

### Manual Data Recovery

If automated recovery fails:

1. **Export data**:

   ```bash
   npm run export:legacy-data -- --output=./recovery
   ```

2. **Convert manually**: Use conversion scripts

3. **Import to new system**:
   ```bash
   npm run import:data -- --input=./recovery
   ```

### Reset Migration State

If migration state is corrupted:

```bash
# WARNING: This clears all migration history
rm .migration-backups/migration-state.json

# Re-run migration
npm run migrate -- --all
```

## Getting Help

### Before Asking for Help

Collect this information:

1. **System info**:

   ```bash
   npm run system-info > system-info.txt
   ```

2. **Migration logs**:

   ```bash
   cat .migration-backups/*/migration.log > migration-logs.txt
   ```

3. **Error messages**: Copy complete error output

4. **Migration report**:
   ```bash
   cat .migration-backups/*/migration-report.json > migration-report.txt
   ```

### Support Channels

1. **Documentation**: `docs/migration/`
2. **GitHub Issues**: For bugs/feature requests
3. **GitHub Discussions**: For questions/help
4. **Discord**: Real-time chat support
5. **Email**: support@sovren.app

### Creating a Bug Report

Include:

- System information
- Migration logs
- Steps to reproduce
- Expected vs actual behavior
- Migration report
- Any error messages

Template:

```markdown
## Environment

- OS: macOS 14.1
- Node.js: 20.10.0
- Package version: 1.2.0

## Issue

Migration fails at event cache with "timeout" error

## Steps to Reproduce

1. Run `npm run migrate -- --events`
2. Wait for 5 minutes
3. Error occurs

## Logs

[Attach migration.log]

## Migration Report

[Attach migration-report.json]
```

## Prevention Tips

1. **Always run dry-run first**
2. **Test in development before production**
3. **Keep backups for 7+ days**
4. **Monitor migration progress**
5. **Validate immediately after migration**
6. **Document any custom configurations**
7. **Read release notes for migration-specific info**
8. **Schedule adequate downtime**

## Emergency Procedures

### If Production Migration Fails

1. **Immediately enable maintenance mode**
2. **Stop all services**
3. **Do NOT attempt quick fixes**
4. **Run rollback**: `npm run migrate -- --rollback`
5. **Verify rollback successful**
6. **Restart services**
7. **Investigate issues in isolation**
8. **Test fix in staging**
9. **Schedule re-migration**

### If Data Appears Corrupted

1. **STOP all write operations**
2. **Assess damage**:
   ```bash
   npm run validate:migration
   npm run validate:data-integrity
   ```
3. **If critical**: Restore from backup
4. **If minor**: Fix specific issues
5. **Document findings**
6. **Prevent future occurrence**

## Migration Health Checklist

After resolving issues, verify:

- [ ] All components migrated
- [ ] Validation passes
- [ ] Application starts successfully
- [ ] Relay connections work
- [ ] Keys accessible
- [ ] Events loading
- [ ] Subscriptions active
- [ ] No error logs
- [ ] Performance acceptable
- [ ] Backups intact

---

**Still having issues?** Contact support with your migration report and logs.
