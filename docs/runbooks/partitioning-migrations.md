# PostgreSQL Partitioning Migrations

**Phase 3 Week 3: Postgres Hardening**

This runbook explains the partitioning migration strategy for the memory_records table, including when to use each migration file and how to safely migrate production data.

## Overview

The memory_records table uses monthly partitioning by `created_at` timestamp for scalability. Two migration files are provided:

1. **`migrations/002_partitions.sql`** - PRODUCTION-SAFE (non-destructive)
2. **`migrations/002_partitions_dev.sql`** - DEV-ONLY (destructive, drops table)

## Migration Files

### Production-Safe Migration (002_partitions.sql)

**Use this for:**
- **NEW INSTALLS ONLY** - Fresh database with no existing memory_records table
- Setting up partitioned table infrastructure from scratch
- Post-initial deployment (before any data exists)

**What it does:**
- Creates partition helper function (`create_monthly_partition`)
- Pre-creates partitions for current + next 2 months
- Adds indexes with `IF NOT EXISTS` (idempotent)
- Does NOT drop or modify existing table structure
- Does NOT delete any data

**Assumptions:**
- `memory_records` table does NOT exist yet (or is partitioned already)
- This is a brand new install OR
- You have already converted to partitioned (see conversion runbook below)

**Limitations:**
- **Cannot convert existing heap table to partitioned table**
- If you have Phase 2 data in a heap table, you MUST use the conversion procedure (see below)
- Only adds partition infrastructure and indexes

**⚠️ Important:**
If you have existing Phase 2 data in a non-partitioned memory_records table, DO NOT use this migration directly. Follow the "Heap-to-Partitioned Conversion Procedure" section below.

### Dev-Only Migration (002_partitions_dev.sql)

**⚠️ DANGEROUS - Use this ONLY for:**
- Brand new development environments
- Testing environments with no critical data
- After verified backfill and cutover (drops old table)

**What it does:**
- **DROPS** existing memory_records table (CASCADE)
- Recreates table as partitioned by `created_at`
- Creates all indexes
- Creates 6 months of partitions
- Creates partition helper function

**⚠️ Warning:**
- **WILL DELETE ALL DATA** in memory_records table
- Irreversible without backup
- **MUST NOT** be run on production with existing data
- CI gates will block this file on main/master branches

## Heap-to-Partitioned Conversion Procedure

**Use this section if:**
- You have existing Phase 2 data in a non-partitioned memory_records table
- You want to convert to partitioned table without data loss
- You are upgrading from Phase 2 to Phase 3.1 with existing production data

### Conversion Steps (Zero-Downtime)

This procedure uses pg_dump/restore with table rename to convert from heap to partitioned:

1. **Enable dual-write mode** (writes to both old and new tables):
   ```bash
   export PERSISTENCE=dual-write
   export DUAL_WRITE_PRIMARY=memory
   ```

2. **Create new partitioned table** (using migration 002a_convert_to_partitioned.sql):
   ```bash
   # This creates memory_records_partitioned (new table)
   psql -U postgres -d lichen_memory -f migrations/002a_convert_to_partitioned.sql
   ```

3. **Copy existing data** into new partitioned table:
   ```bash
   # Copies data from memory_records (heap) to memory_records_partitioned
   psql -U postgres -d lichen_memory <<'EOF'
   INSERT INTO memory_records_partitioned
   SELECT * FROM memory_records
   ON CONFLICT (id) DO NOTHING;
   EOF
   ```

4. **Verify data parity**:
   ```sql
   SELECT COUNT(*) FROM memory_records;
   SELECT COUNT(*) FROM memory_records_partitioned;
   ```

5. **Atomic table swap** (downtime < 1 second):
   ```sql
   BEGIN;
   ALTER TABLE memory_records RENAME TO memory_records_old;
   ALTER TABLE memory_records_partitioned RENAME TO memory_records;
   COMMIT;
   ```

6. **Verify application** (writes now go to partitioned table):
   ```bash
   # Check recent writes
   SELECT COUNT(*) FROM memory_records WHERE created_at > NOW() - INTERVAL '5 minutes';
   ```

7. **Drop old table** after verification (wait 24-48 hours):
   ```sql
   DROP TABLE memory_records_old;
   ```

**Note:** See `migrations/002a_convert_to_partitioned.sql` for the detailed SQL commands.

## Migration Strategy

### For New Installs (No Existing Data)

**Steps:**

1. **Run production-safe migration:**
   ```bash
   psql -U postgres -d lichen_memory -f migrations/002_partitions.sql
   ```

2. **Verify partition setup:**
   ```sql
   SELECT tablename FROM pg_tables WHERE tablename LIKE 'memory_records_%' ORDER BY tablename;
   ```

3. **Start server:**
   ```bash
   export PERSISTENCE=postgres
   npm run server
   ```

### For Production (With Existing Phase 2 Data)

**Prerequisites:**
1. Dual-write mode enabled and running
2. Backfill completed and verified
3. Data parity confirmed between memory and Postgres

**Steps:**

1. **Enable dual-write mode:**
   ```bash
   export PERSISTENCE=dual-write
   export DUAL_WRITE_PRIMARY=memory
   export DUAL_WRITE_FAIL_FAST=false
   ```

2. **Run backfill script:**
   ```bash
   # Dry run first
   BACKFILL_DRY_RUN=true npx ts-node scripts/backfill-to-postgres.ts

   # Actual backfill
   npx ts-node scripts/backfill-to-postgres.ts backfill

   # Verify data parity
   npx ts-node scripts/backfill-to-postgres.ts verify
   ```

3. **Run production-safe migration:**
   ```bash
   psql -U postgres -d lichen_memory -f migrations/002_partitions.sql
   ```

4. **Verify partition setup:**
   ```sql
   -- List partitions
   SELECT tablename FROM pg_tables
   WHERE tablename LIKE 'memory_records_%'
   ORDER BY tablename;

   -- Verify helper function
   SELECT proname FROM pg_proc WHERE proname = 'create_monthly_partition';

   -- Test partition creation
   SELECT create_monthly_partition(NOW() + INTERVAL '3 months');
   ```

5. **Switch primary to Postgres:**
   ```bash
   export DUAL_WRITE_PRIMARY=postgres
   ```

6. **Monitor for 24-48 hours:**
   - Check metrics: `dual_write_failures_total`
   - Verify write latency acceptable
   - Confirm no data loss

7. **Final cutover:**
   ```bash
   export PERSISTENCE=postgres
   export DUAL_WRITE_ENABLED=false
   ```

### For Development (New Environment)

**Use when:**
- Setting up brand new development database
- No existing data to preserve
- Fast iteration required

**Steps:**

1. **Run dev-only migration:**
   ```bash
   psql -U postgres -d lichen_memory -f migrations/002_partitions_dev.sql
   ```

2. **Verify setup:**
   ```bash
   psql -U postgres -d lichen_memory -c "\d memory_records"
   ```

3. **Start server:**
   ```bash
   export PERSISTENCE=postgres
   npm run server
   ```

## Partition Maintenance

### Monthly Partition Creation

**Automated (recommended):**
```sql
-- Schedule this monthly via cron or scheduler
SELECT create_monthly_partition(NOW() + INTERVAL '1 month');
```

**Manual:**
```sql
-- Create partition for specific month
SELECT create_monthly_partition('2026-05-01'::DATE);
```

### Dropping Old Partitions

**Detach first (preserves data):**
```sql
-- Detach partition (keeps table, removes from partition set)
ALTER TABLE memory_records DETACH PARTITION memory_records_2025_01;

-- Now safe to drop
DROP TABLE memory_records_2025_01;
```

**Direct drop (deletes data):**
```sql
-- ⚠️ Deletes all data in partition
DROP TABLE memory_records_2025_01;
```

### Listing Partitions

```sql
-- All partitions
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE tablename LIKE 'memory_records_%'
ORDER BY tablename;

-- Partition bounds
SELECT
  child.relname AS partition_name,
  pg_get_expr(child.relpartbound, child.oid) AS partition_bounds
FROM pg_inherits
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
WHERE parent.relname = 'memory_records'
ORDER BY child.relname;
```

## Rollback Procedures

### If Migration Fails

**Production-safe migration (002_partitions.sql):**
- No rollback needed - migration is idempotent and non-destructive
- Simply fix issue and re-run

**Dev-only migration (002_partitions_dev.sql):**
- Restore from backup
- Re-run Phase 2 table creation
- Re-run backfill if applicable

### If Cutover Has Issues

1. **Revert to dual-write with memory primary:**
   ```bash
   export PERSISTENCE=dual-write
   export DUAL_WRITE_PRIMARY=memory
   ```

2. **Investigate Postgres issues:**
   - Check logs for errors
   - Verify partition exists for current date
   - Check index health

3. **If data loss detected:**
   - Enable dual-write with Postgres primary
   - Re-run backfill from memory (if memory still has data)
   - Verify parity before cutover

## CI/CD Integration

### CI Gates

The following gates protect production:

1. **Destructive SQL blocker:**
   - Fails on main/master if `DROP TABLE` found in `migrations/*.sql`
   - Excludes files ending in `_dev.sql`

2. **Safe migration banner validator:**
   - Ensures `002_partitions.sql` contains "SAFE PRODUCTION MIGRATION"

3. **Partition validation:**
   - Verifies helper function exists in safe migration
   - Checks `IF NOT EXISTS` patterns used

### Deployment Pipeline

**Staging:**
```bash
# Use safe migration
psql $STAGING_DB -f migrations/002_partitions.sql
```

**Production:**
```bash
# Use safe migration (post-backfill)
psql $PROD_DB -f migrations/002_partitions.sql
```

**Never deploy:**
- `migrations/002_partitions_dev.sql` to production
- Any migration containing `DROP TABLE` to production

## Troubleshooting

### "Partition does not exist for date"

**Cause:** No partition exists for the record's `created_at` date

**Solution:**
```sql
-- Create missing partition
SELECT create_monthly_partition('2026-06-01'::DATE);
```

### "Relation already exists"

**Cause:** Partition or index already exists

**Solution:**
- Safe to ignore if using production migration (it's idempotent)
- Check existing partitions: `\d memory_records`

### "Cannot convert heap table to partitioned"

**Cause:** Trying to partition an existing non-partitioned table

**Solution:**
- Production: Continue using heap table, add partitions for new data
- Dev: Use `002_partitions_dev.sql` to recreate as partitioned

### High write latency after partitioning

**Causes:**
- Partition routing overhead
- Missing partition for current month
- Index bloat

**Solutions:**
```sql
-- Verify partition exists for NOW()
SELECT create_monthly_partition(NOW());

-- Check index health
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE 'memory_records%'
ORDER BY idx_scan DESC;

-- Reindex if needed
REINDEX TABLE CONCURRENTLY memory_records;
```

## References

- [PostgreSQL Partitioning Documentation](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Phase 3 Week 3 Implementation Plan](../../spec/README.md)
- [Backfill Script](../../scripts/backfill-to-postgres.ts)
- [Dual-Write Adapter](../../src/memory-layer/storage/dual-store.ts)
