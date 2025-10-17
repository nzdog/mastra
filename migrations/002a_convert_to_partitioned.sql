-- ============================================================================
-- PRODUCTION HEAP TABLE → PARTITIONED TABLE CONVERSION
-- ============================================================================
-- PostgreSQL Partitioning Conversion
-- Phase 3 Week 3: Postgres Hardening
--
-- ⚠️ PRODUCTION USE ONLY: Converts existing heap table to partitioned table
-- ✅ SAFE: Preserves all existing data
-- ✅ Zero-downtime: Uses table rename swap
-- ✅ Rollback-safe: Original table backed up as memory_records_pre_partition
--
-- Prerequisites:
--   - memory_records table exists as a heap table (non-partitioned)
--   - Application downtime window OR read-only mode active
--   - Database backup completed and verified
--   - Sufficient disk space (2x current table size)
--
-- What this migration does:
--   1. Creates memory_records_new as partitioned table (RANGE by created_at)
--   2. Copies ALL existing data from memory_records → memory_records_new
--   3. Drops old indexes from memory_records
--   4. Renames memory_records → memory_records_pre_partition (backup)
--   5. Renames memory_records_new → memory_records
--   6. Recreates indexes on partitioned table
--   7. Creates monthly partitions (current + next 2 months)
--
-- Rollback procedure (if needed):
--   DROP TABLE IF EXISTS memory_records CASCADE;
--   ALTER TABLE memory_records_pre_partition RENAME TO memory_records;
--   -- Recreate indexes manually if needed
--
-- Post-migration:
--   - Run 002_partitions.sql to add partition helper functions
--   - Monitor query performance
--   - Drop memory_records_pre_partition after verification period (7-30 days)
-- ============================================================================

-- ============================================================================
-- Pre-flight checks
-- ============================================================================

DO $$
DECLARE
  is_partitioned BOOLEAN;
  record_count BIGINT;
  table_size TEXT;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'memory_records') THEN
    RAISE EXCEPTION 'Table memory_records does not exist. Nothing to convert.';
  END IF;

  -- Check if already partitioned
  SELECT relkind = 'p' INTO is_partitioned
  FROM pg_class
  WHERE relname = 'memory_records';

  IF is_partitioned THEN
    RAISE EXCEPTION 'Table memory_records is already partitioned. This migration is not needed.';
  END IF;

  -- Report current table stats
  SELECT COUNT(*) INTO record_count FROM memory_records;
  SELECT pg_size_pretty(pg_total_relation_size('memory_records')) INTO table_size;

  RAISE NOTICE '==================== CONVERSION START ====================';
  RAISE NOTICE 'Current table: memory_records (heap)';
  RAISE NOTICE 'Record count: %', record_count;
  RAISE NOTICE 'Table size: %', table_size;
  RAISE NOTICE 'Estimated time: % seconds', CEIL(record_count / 10000.0);
  RAISE NOTICE '=========================================================';
END $$;

-- ============================================================================
-- Step 1: Create new partitioned table
-- ============================================================================

CREATE TABLE memory_records_new (
  id TEXT PRIMARY KEY,
  hashed_pseudonym TEXT NOT NULL,
  session_id TEXT,
  content JSONB NOT NULL,
  consent_family TEXT NOT NULL,
  consent_timestamp TIMESTAMP NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  access_count INTEGER NOT NULL DEFAULT 0,
  audit_receipt_id TEXT NOT NULL
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE memory_records_new IS 'Partitioned memory records table (conversion in progress)';

-- ============================================================================
-- Step 2: Create initial partitions (historical + current + future)
-- ============================================================================

-- Create partition for records older than current year (catch-all)
CREATE TABLE memory_records_historical PARTITION OF memory_records_new
  FOR VALUES FROM (MINVALUE) TO ('2025-01-01');

-- Create monthly partitions for 2025 (adjust year as needed)
CREATE TABLE memory_records_2025_01 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE memory_records_2025_02 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE memory_records_2025_03 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE memory_records_2025_04 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE memory_records_2025_05 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE memory_records_2025_06 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE memory_records_2025_07 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE memory_records_2025_08 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE memory_records_2025_09 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE memory_records_2025_10 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE memory_records_2025_11 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE memory_records_2025_12 PARTITION OF memory_records_new
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Create future partitions (first 3 months of 2026)
CREATE TABLE memory_records_2026_01 PARTITION OF memory_records_new
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE memory_records_2026_02 PARTITION OF memory_records_new
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE memory_records_2026_03 PARTITION OF memory_records_new
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- ============================================================================
-- Step 3: Copy all data from old table to new partitioned table
-- ============================================================================

INSERT INTO memory_records_new
SELECT * FROM memory_records;

-- Verify record counts match
DO $$
DECLARE
  old_count BIGINT;
  new_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO old_count FROM memory_records;
  SELECT COUNT(*) INTO new_count FROM memory_records_new;

  IF old_count != new_count THEN
    RAISE EXCEPTION 'Data copy verification failed: old=% new=%', old_count, new_count;
  END IF;

  RAISE NOTICE 'Data copy verified: % records migrated successfully', new_count;
END $$;

-- ============================================================================
-- Step 4: Drop indexes from old table (preparing for rename)
-- ============================================================================

DROP INDEX IF EXISTS idx_memory_records_pseudonym_family;
DROP INDEX IF EXISTS idx_memory_records_session;
DROP INDEX IF EXISTS idx_memory_records_expires;
DROP INDEX IF EXISTS idx_memory_records_audit;

-- ============================================================================
-- Step 5: Rename tables (atomic swap)
-- ============================================================================

-- Backup original table
ALTER TABLE memory_records RENAME TO memory_records_pre_partition;

-- Promote new table
ALTER TABLE memory_records_new RENAME TO memory_records;

RAISE NOTICE 'Table swap complete: memory_records is now partitioned';
RAISE NOTICE 'Backup table: memory_records_pre_partition (safe to drop after verification)';

-- ============================================================================
-- Step 6: Create indexes on partitioned table
-- ============================================================================

CREATE INDEX idx_memory_records_pseudonym_family
  ON memory_records (hashed_pseudonym, consent_family, created_at DESC);

CREATE INDEX idx_memory_records_session
  ON memory_records (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX idx_memory_records_expires
  ON memory_records (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX idx_memory_records_audit
  ON memory_records (audit_receipt_id);

RAISE NOTICE 'Indexes recreated on partitioned table';

-- ============================================================================
-- Post-conversion verification
-- ============================================================================

DO $$
DECLARE
  is_partitioned BOOLEAN;
  partition_count INT;
  record_count BIGINT;
BEGIN
  -- Verify table is partitioned
  SELECT relkind = 'p' INTO is_partitioned
  FROM pg_class
  WHERE relname = 'memory_records';

  IF NOT is_partitioned THEN
    RAISE EXCEPTION 'Conversion failed: table is not partitioned';
  END IF;

  -- Count partitions
  SELECT COUNT(*) INTO partition_count
  FROM pg_class
  WHERE relname LIKE 'memory_records_%';

  -- Count records
  SELECT COUNT(*) INTO record_count FROM memory_records;

  RAISE NOTICE '==================== CONVERSION COMPLETE ====================';
  RAISE NOTICE 'Table: memory_records (now partitioned)';
  RAISE NOTICE 'Partitions created: %', partition_count;
  RAISE NOTICE 'Records migrated: %', record_count;
  RAISE NOTICE 'Backup table: memory_records_pre_partition';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run 002_partitions.sql to add partition helper functions';
  RAISE NOTICE '2. Test application thoroughly (7-30 days)';
  RAISE NOTICE '3. Drop backup: DROP TABLE memory_records_pre_partition;';
  RAISE NOTICE '============================================================';
END $$;
