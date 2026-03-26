# PITR (Point-in-Time Recovery) Verification

**Last Updated:** 2026-03-25
**Applies To:** Supabase PostgreSQL (production and staging)

---

## 1. Verify PITR Is Enabled in Supabase Dashboard

1. Log in to [app.supabase.com](https://app.supabase.com) with an org admin account.
2. Select the **Sovren** project (production or staging).
3. Navigate to **Settings → Database**.
4. Scroll to the **Backups** section.
5. Confirm **Point in Time Recovery** shows status **Enabled**.
6. Note the **retention window** (should be 7 days minimum for production, 1 day for staging).

If PITR is not enabled, contact Supabase support or upgrade to a plan that includes PITR. PITR requires the Pro plan or above.

---

## 2. Quarterly Restore Test Procedure

Run this procedure once per quarter to validate that PITR backups are restorable.

### Pre-requisites

- Supabase CLI installed (`npm install -g supabase`)
- `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` set in environment
- A dedicated **test project** in Supabase (never restore to production directly)

### Steps

1. **Record the target recovery timestamp** — choose a point 24–48 hours in the past when the database was in a known-good state.

2. **Initiate restore via Supabase Dashboard:**
   - Navigate to **Settings → Database → Backups**.
   - Click **Restore to a point in time**.
   - Enter the target timestamp (UTC).
   - Select the **test project** as the restore destination.
   - Confirm and start the restore.

3. **Wait for restore to complete** — typically 15–60 minutes depending on database size.

4. **Verify restore integrity:**
   ```bash
   # Connect to the restored test database
   psql "$RESTORED_DB_URL" -c "\dt"
   psql "$RESTORED_DB_URL" -c "SELECT COUNT(*) FROM users;"
   psql "$RESTORED_DB_URL" -c "SELECT COUNT(*) FROM creator_profiles;"
   psql "$RESTORED_DB_URL" -c "SELECT MAX(created_at) FROM payments;"
   ```

5. **Cross-check row counts** against production metrics from the same timestamp (use Supabase dashboard metrics or application logs).

6. **Document the result** in the quarterly restore log (see section 4 below).

7. **Tear down the test restore** to avoid ongoing charges.

---

## 3. RPO/RTO Validation Checklist

### Recovery Point Objective (RPO) — Target: < 1 hour data loss

- [ ] Supabase PITR WAL archiving frequency confirmed as continuous (not snapshot-based)
- [ ] Last backup timestamp is within the past 60 minutes (check dashboard)
- [ ] Retention window covers at least 7 days in production

### Recovery Time Objective (RTO) — Target: < 4 hours

- [ ] Restore test completed within 4 hours from initiation to verified healthy state
- [ ] Runbook for restore procedure accessible to on-call engineers (link: this document)
- [ ] Supabase support escalation contact documented (support.supabase.com)

### Validation Sign-off

After each quarterly test, record:

| Date | Restore Target Timestamp | Restore Duration | Row Count Match | Operator | Notes |
|------|-------------------------|------------------|-----------------|----------|-------|
|      |                         |                  |                 |          |       |

---

## 4. Related Documentation

- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- Supabase PITR docs: https://supabase.com/docs/guides/platform/backups#point-in-time-recovery
