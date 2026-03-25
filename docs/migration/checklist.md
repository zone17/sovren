# NOSTR Migration Checklist

**US-325: Migration Scripts**
**Epic 003 Wave 5: NOSTR Consolidation**

Use this checklist to ensure a smooth, successful migration.

## Pre-Migration Checklist

### Environment Preparation

- [ ] Node.js 20+ installed and verified

  ```bash
  node --version  # Should be >= 20.0.0
  ```

- [ ] All dependencies installed

  ```bash
  npm install
  ```

- [ ] Project builds successfully

  ```bash
  npm run build
  ```

- [ ] Tests passing

  ```bash
  npm test
  ```

- [ ] Running from project root directory
  ```bash
  pwd  # Should show /path/to/Sovren
  ```

### Documentation Review

- [ ] Read [Migration Guide](./migration-guide.md)
- [ ] Review [Troubleshooting Guide](./troubleshooting.md)
- [ ] Understand component being migrated
- [ ] Know rollback procedure
- [ ] Have support contacts ready

### Backup Verification

- [ ] Backup directory accessible

  ```bash
  mkdir -p .migration-backups
  ls -la .migration-backups
  ```

- [ ] Sufficient disk space (minimum 2GB free)

  ```bash
  df -h .
  ```

- [ ] Write permissions verified

  ```bash
  touch .migration-backups/test && rm .migration-backups/test
  ```

- [ ] External backup created (optional but recommended)
  ```bash
  tar -czf sovren-backup-$(date +%Y%m%d).tar.gz \
    .env \
    packages/*/src/config \
    .migration-backups
  ```

### Application State

- [ ] Application stopped or in maintenance mode
- [ ] No active database connections
- [ ] No background jobs running
- [ ] Users notified of maintenance (production)
- [ ] Monitoring systems aware

### Migration Status Check

- [ ] Current migration status known

  ```bash
  npm run migrate -- --status
  ```

- [ ] Previous migrations reviewed (if any)
- [ ] No pending migrations or errors

## Dry Run Checklist

### Initial Test

- [ ] Dry run completed successfully

  ```bash
  npm run migrate -- --all --dry-run
  ```

- [ ] Dry run output reviewed and understood
- [ ] Estimated time acceptable
- [ ] No critical warnings or errors
- [ ] Data counts look correct

### Validation

- [ ] Number of items to migrate matches expectations
- [ ] No unexpected data discovered
- [ ] All dependencies met
- [ ] Configuration looks correct
- [ ] Environment variables correct

## Migration Execution Checklist

### Component Selection

- [ ] Components to migrate selected:
  - [ ] Relay Configuration
  - [ ] Key Storage
  - [ ] Event Cache
  - [ ] Subscriptions

- [ ] Component dependencies verified
- [ ] Migration order determined

### Pre-Flight Checks

- [ ] System resources sufficient (CPU, memory, disk)
- [ ] Network connectivity stable
- [ ] Database accessible
- [ ] No conflicting processes

### Execution

- [ ] Migration command prepared

  ```bash
  npm run migrate -- --all --verbose
  ```

- [ ] Terminal session stable (use tmux/screen for production)
- [ ] Logging enabled
- [ ] Start time recorded

### Monitoring

- [ ] Migration started successfully
- [ ] Progress visible and updating
- [ ] No error messages appearing
- [ ] System resources normal
- [ ] Estimated completion time reasonable

## Component-Specific Checklists

### Relay Configuration Migration

- [ ] Hardcoded relay URLs identified
- [ ] Config files containing relays listed
- [ ] localStorage relay data noted
- [ ] Dry run shows correct relay count
- [ ] New relay config location confirmed
- [ ] Environment variables to be updated noted

**Post-Migration**:

- [ ] Relay config file exists
  ```bash
  cat packages/shared/src/config/relays.ts
  ```
- [ ] Environment variables updated
  ```bash
  grep NOSTR_RELAYS .env
  ```
- [ ] At least one read relay configured
- [ ] At least one write relay configured
- [ ] Relay priorities assigned correctly

### Key Storage Migration

- [ ] Encryption password prepared (12+ chars)
- [ ] Password stored securely (password manager)
- [ ] Legacy key locations identified
- [ ] Key count matches expectations
- [ ] Dry run shows correct key count

**During Migration**:

- [ ] Password entered correctly
- [ ] Password confirmation matches
- [ ] Encryption progress visible

**Post-Migration**:

- [ ] Keys encrypted successfully
- [ ] Keys accessible with password
- [ ] Key validation passes
  ```bash
  npm run validate:keys
  ```
- [ ] No unencrypted keys remaining

### Event Cache Migration

- [ ] Event count estimated
- [ ] Cache size reasonable (< 10GB)
- [ ] Deduplication enabled
- [ ] TTL settings confirmed
- [ ] Index strategy selected

**Post-Migration**:

- [ ] Events migrated count matches
- [ ] No duplicate events
- [ ] Event signatures valid
- [ ] Cache performance acceptable
- [ ] Memory usage normal

### Subscription Migration

- [ ] Active subscriptions counted
- [ ] Filter formats noted
- [ ] Relay dependencies met (relay config migrated)
- [ ] Connection pool settings reviewed

**Post-Migration**:

- [ ] Subscriptions active
- [ ] Filters working correctly
- [ ] Events being received
- [ ] Connections healthy
- [ ] Auto-reconnect working

## Validation Checklist

### Automated Validation

- [ ] Migration validation runs successfully

  ```bash
  npm run validate:migration
  ```

- [ ] All validation checks pass
- [ ] Data integrity confirmed
- [ ] No data loss detected
- [ ] Checksums match

### Manual Validation

- [ ] Application starts successfully

  ```bash
  npm run dev
  ```

- [ ] Relay connections established
- [ ] Keys load correctly
- [ ] Events display properly
- [ ] Subscriptions receiving events
- [ ] No console errors
- [ ] Performance acceptable

### Data Verification

- [ ] Key counts match pre-migration
  - Before: \_\_\_ keys
  - After: \_\_\_ keys

- [ ] Event counts match (or explain difference)
  - Before: \_\_\_ events
  - After: \_\_\_ events

- [ ] Subscription counts match
  - Before: \_\_\_ subscriptions
  - After: \_\_\_ subscriptions

- [ ] Relay counts match
  - Before: \_\_\_ relays
  - After: \_\_\_ relays

### Functional Testing

- [ ] Can generate new NOSTR events
- [ ] Can sign events with migrated keys
- [ ] Can receive events from subscriptions
- [ ] Can connect to all configured relays
- [ ] Can publish events to write relays
- [ ] Encryption/decryption works
- [ ] Key rotation available (if applicable)

## Post-Migration Checklist

### Immediate Actions

- [ ] Migration report reviewed

  ```bash
  cat .migration-backups/*/migration-report.json
  ```

- [ ] Success/failure status confirmed
- [ ] Any errors or warnings addressed
- [ ] Backup location documented
- [ ] Migration time recorded

### Application Restart

- [ ] Application restarted successfully
- [ ] No startup errors
- [ ] All services healthy
- [ ] Database connections established
- [ ] API endpoints responding

### Monitoring Setup

- [ ] Error monitoring active
- [ ] Performance monitoring enabled
- [ ] Alert thresholds configured
- [ ] Logs being collected
- [ ] Metrics being tracked

### User Communication

- [ ] Maintenance mode disabled (if enabled)
- [ ] Users notified of completion
- [ ] Known issues communicated
- [ ] Support available for questions

## Rollback Checklist

### When to Rollback

Rollback immediately if:

- [ ] Critical functionality broken
- [ ] Data loss detected
- [ ] Performance severely degraded
- [ ] Security issues discovered
- [ ] Validation fails completely

### Rollback Procedure

- [ ] Enable maintenance mode
- [ ] Stop all services
- [ ] Run rollback command
  ```bash
  npm run migrate -- --rollback
  ```
- [ ] Verify rollback successful
- [ ] Restart services
- [ ] Validate functionality restored
- [ ] Document rollback reason

### Post-Rollback

- [ ] Issue investigation started
- [ ] Root cause identified
- [ ] Fix implemented and tested
- [ ] Re-migration scheduled
- [ ] Stakeholders notified

## Production-Specific Checklist

### Pre-Production

- [ ] Migration tested in development
- [ ] Migration tested in staging
- [ ] Performance impact assessed
- [ ] Downtime window scheduled
- [ ] Stakeholders notified
- [ ] Support team briefed
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

### During Production Migration

- [ ] Maintenance mode enabled
- [ ] Health checks disabled
- [ ] Load balancer updated
- [ ] CDN cache cleared (if applicable)
- [ ] Migration progress communicated
- [ ] Support team on standby

### Post-Production

- [ ] Thorough validation performed
- [ ] Critical paths tested
- [ ] Performance monitored for 24 hours
- [ ] Error rates normal
- [ ] User feedback collected
- [ ] Migration documented
- [ ] Lessons learned recorded

## Cleanup Checklist

### After 7 Days (if migration successful)

- [ ] All systems stable
- [ ] No rollback needed
- [ ] Performance metrics normal
- [ ] Error rates acceptable
- [ ] User feedback positive

### Optional Cleanup

- [ ] Old backups archived

  ```bash
  tar -czf old-backups-$(date +%Y%m%d).tar.gz .migration-backups/migration-*
  ```

- [ ] Legacy code removed (if applicable)
- [ ] Old dependencies cleaned up
- [ ] Documentation updated
- [ ] Team trained on new system

## Sign-Off Checklist

### Technical Sign-Off

- [ ] All migrations completed successfully
- [ ] All validations passing
- [ ] No critical errors or warnings
- [ ] Performance within acceptable ranges
- [ ] Security audit passed (if required)
- [ ] Code review completed (if required)

**Signed**: **\*\***\_\_\_**\*\*** **Date**: **\*\***\_\_\_**\*\***

### Stakeholder Sign-Off

- [ ] Business requirements met
- [ ] User acceptance testing passed
- [ ] Documentation complete
- [ ] Training completed (if required)
- [ ] Support handoff complete

**Signed**: **\*\***\_\_\_**\*\*** **Date**: **\*\***\_\_\_**\*\***

## Migration Report Template

```markdown
# Migration Report: [Date]

## Overview

- **Date**: YYYY-MM-DD HH:MM
- **Duration**: X hours Y minutes
- **Components**: Relay Config, Keys, Events, Subscriptions
- **Environment**: Development / Staging / Production

## Results

- **Status**: Success / Partial / Failed
- **Items Migrated**: X / Y (Z%)
- **Errors**: 0
- **Warnings**: 0

## Components

### Relay Configuration

- Discovered: X relays
- Migrated: Y relays
- Time: Z minutes
- Status: ✅ Success

### Key Storage

- Discovered: X keys
- Migrated: Y keys
- Time: Z minutes
- Status: ✅ Success

### Event Cache

- Discovered: X events
- Migrated: Y events
- Time: Z minutes
- Status: ✅ Success

### Subscriptions

- Discovered: X subscriptions
- Migrated: Y subscriptions
- Time: Z minutes
- Status: ✅ Success

## Validation

- Data integrity: ✅ Pass
- No data loss: ✅ Pass
- Performance: ✅ Pass
- Security: ✅ Pass

## Issues

None / [List any issues]

## Recommendations

[Any recommendations for future]

## Backup Location

.migration-backups/migration-YYYY-MM-DDTHH-MM-SS/

## Notes

[Any additional notes]

---

Report generated: YYYY-MM-DD HH:MM:SS
```

---

**Remember**: This checklist is comprehensive. Not all items may apply to your specific migration scenario. Adapt as needed!
