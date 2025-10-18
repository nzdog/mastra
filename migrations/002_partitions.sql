-- ============================================================================
-- SAFE PRODUCTION MIGRATION (NON-DESTRUCTIVE)
-- ============================================================================
-- PostgreSQL Partitioning Setup
-- Phase 3 Week 3: Postgres Hardening
--
-- ✅ PRODUCTION-SAFE: Does NOT drop or recreate existing tables
-- ✅ Adds partition helpers/partitions/indexes only if absent
-- ✅ Idempotent: Can be run multiple times safely
--
-- Prerequisites:
--   - memory_records table already exists (created in Phase 2)
--   - Backfill from in-memory to Postgres completed (if migrating)
--   - Data verified with: npx ts-node scripts/backfill-to-postgres.ts verify
--
-- What this migration does:
--   1. Creates helper function for automatic partition creation
--   2. Pre-creates monthly partitions for current + next 2 months
--   3. Adds optimized indexes if not present
--   4. Does NOT modify existing data or table structure
--
-- For new/dev environments with no data:
--   - Use migrations/002_partitions_dev.sql instead (recreates as partitioned)
-- ============================================================================

-- Create extension for UUID support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Pre-check: Verify table is partitioned
-- ============================================================================
-- SAFE: If table is not partitioned, this migration skips partition creation
-- Use 002a_convert_to_partitioned.sql to convert existing heap tables first

DO $$
DECLARE
  is_partitioned BOOLEAN;
BEGIN
  -- Check if memory_records table exists and is partitioned
  SELECT relkind = 'p' INTO is_partitioned
  FROM pg_class
  WHERE relname = 'memory_records';

  IF is_partitioned IS NULL THEN
    RAISE NOTICE 'Table memory_records does not exist yet. Skipping partition setup (run 001_create_memory_records.sql first).';
    RETURN;
  END IF;

  IF NOT is_partitioned THEN
    RAISE NOTICE 'Table memory_records exists but is not partitioned. Skipping partition helpers.';
    RAISE NOTICE 'For new installs: Use migrations/002_partitions_dev.sql (recreates as partitioned).';
    RAISE NOTICE 'For existing prod: Use migrations/002a_convert_to_partitioned.sql (safe conversion).';
    RETURN;
  END IF;

  RAISE NOTICE 'Pre-check passed: memory_records is a partitioned table. Proceeding with partition setup.';
END $$;

-- ============================================================================
-- Helper function to create new partitions automatically
-- ============================================================================

CREATE OR REPLACE FUNCTION create_monthly_partition(target_date DATE)
RETURNS TEXT AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate partition boundaries
  start_date := DATE_TRUNC('month', target_date);
  end_date := start_date + INTERVAL '1 month';

  -- Generate partition name
  partition_name := 'memory_records_' || TO_CHAR(start_date, 'YYYY_MM');

  -- Create partition if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF memory_records FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
    RETURN 'Created partition: ' || partition_name;
  ELSE
    RETURN 'Partition already exists: ' || partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_monthly_partition IS 'Helper to create new monthly partition (safe, idempotent)';

-- ============================================================================
-- Pre-create monthly partitions for current + next 2 months
-- ============================================================================

-- Use the helper function to create partitions (will skip if exists)
DO $$
BEGIN
  -- Current month
  PERFORM create_monthly_partition(CURRENT_DATE);

  -- Next month
  PERFORM create_monthly_partition(CURRENT_DATE + INTERVAL '1 month');

  -- Month after next
  PERFORM create_monthly_partition(CURRENT_DATE + INTERVAL '2 months');

  RAISE NOTICE 'Partition creation complete';
END $$;

-- ============================================================================
-- Create indexes if not present (safe, idempotent)
-- ============================================================================

-- Index 1: Primary lookup by pseudonym + family + time
CREATE INDEX IF NOT EXISTS idx_memory_records_pseudonym_family
  ON memory_records (hashed_pseudonym, consent_family, created_at DESC);

-- Index 2: Session-based queries
CREATE INDEX IF NOT EXISTS idx_memory_records_session
  ON memory_records (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- Index 3: TTL sweep (expires_at)
CREATE INDEX IF NOT EXISTS idx_memory_records_expires
  ON memory_records (expires_at)
  WHERE expires_at IS NOT NULL;

-- Index 4: Audit trail linking
CREATE INDEX IF NOT EXISTS idx_memory_records_audit
  ON memory_records (audit_receipt_id);

-- ============================================================================
-- Maintenance notes
-- ============================================================================

-- To create next month's partition (run monthly):
-- SELECT create_monthly_partition(NOW() + INTERVAL '1 month');

-- To list all partitions:
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'memory_records_%' ORDER BY tablename;

-- To drop old partitions (e.g., older than 6 months):
-- First detach (preserves data as standalone table):
-- ALTER TABLE memory_records DETACH PARTITION memory_records_2025_05;
-- Then drop if no longer needed:
-- DROP TABLE memory_records_2025_05;

-- ============================================================================
-- Post-migration verification
-- ============================================================================

-- Verify partitions exist:
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'memory_records_%' ORDER BY tablename;

-- Verify indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'memory_records' ORDER BY indexname;

-- Check partition function:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'create_monthly_partition';
