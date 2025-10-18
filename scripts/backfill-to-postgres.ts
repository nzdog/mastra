/**
 * Backfill Script: Memory → Postgres
 * Phase 3 Week 3: Postgres Hardening
 *
 * Migrates all records from in-memory store to Postgres.
 * - Idempotent: Uses UPSERT (ON CONFLICT) to skip existing records
 * - Respects encryption settings (encryption handled by store layer)
 * - Records metrics for monitoring progress
 * - Can be run multiple times safely
 */

import { getMemoryStore } from '../src/memory-layer/storage/in-memory-store';
import { getPostgresStore } from '../src/memory-layer/storage/postgres-store';
import { backfillRecordsTotal, backfillFailuresTotal } from '../src/observability/metrics';

/**
 * Backfill configuration
 */
interface BackfillConfig {
  batchSize: number;
  dryRun: boolean;
  consentFamily?: string; // Optional filter
}

/**
 * Load backfill config from environment
 */
function loadBackfillConfig(): BackfillConfig {
  return {
    batchSize: parseInt(process.env.BACKFILL_BATCH_SIZE || '100', 10),
    dryRun: process.env.BACKFILL_DRY_RUN === 'true',
    consentFamily: process.env.BACKFILL_CONSENT_FAMILY,
  };
}

/**
 * Backfill all records from memory to Postgres
 */
async function backfillToPostgres(): Promise<void> {
  const config = loadBackfillConfig();
  const memoryStore = getMemoryStore();
  const postgresStore = getPostgresStore();

  console.log('[Backfill] Starting backfill from memory to Postgres');
  console.log('[Backfill] Config:', config);

  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  try {
    // Get all records from memory store
    // Note: Using internal access since we need all records across all pseudonyms
    const memoryStoreInternal = memoryStore as any;
    const allRecords = memoryStoreInternal.records || new Map();

    console.log(`[Backfill] Found ${allRecords.size} records in memory store`);

    // Process in batches
    const recordsArray = Array.from(allRecords.values());
    const filteredRecords = config.consentFamily
      ? recordsArray.filter((r: any) => r.consent_family === config.consentFamily)
      : recordsArray;

    console.log(`[Backfill] Processing ${filteredRecords.length} records (after filtering)`);

    for (let i = 0; i < filteredRecords.length; i += config.batchSize) {
      const batch = filteredRecords.slice(i, i + config.batchSize);
      console.log(`[Backfill] Processing batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(filteredRecords.length / config.batchSize)} (${batch.length} records)`);

      for (const record of batch) {
        totalProcessed++;

        try {
          if (config.dryRun) {
            console.log(`[Backfill] [DRY RUN] Would migrate record ${record.id}`);
            totalSkipped++;
            continue;
          }

          // Store in Postgres (UPSERT - will skip if already exists)
          await postgresStore.store(record);
          totalSucceeded++;
          backfillRecordsTotal.inc({ status: 'success' });

          if (totalSucceeded % 100 === 0) {
            console.log(`[Backfill] Progress: ${totalSucceeded}/${filteredRecords.length} migrated`);
          }
        } catch (err: any) {
          totalFailed++;
          backfillFailuresTotal.inc({ reason: err.message || 'unknown' });
          console.error(`[Backfill] Failed to migrate record ${record.id}:`, err.message);

          // Continue processing other records
        }
      }

      // Small delay between batches to avoid overwhelming Postgres
      if (i + config.batchSize < filteredRecords.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log('[Backfill] Backfill complete');
    console.log(`[Backfill] Total processed: ${totalProcessed}`);
    console.log(`[Backfill] Total succeeded: ${totalSucceeded}`);
    console.log(`[Backfill] Total failed: ${totalFailed}`);
    console.log(`[Backfill] Total skipped (dry run): ${totalSkipped}`);

    if (totalFailed > 0) {
      console.warn(`[Backfill] WARNING: ${totalFailed} records failed to migrate`);
      process.exit(1);
    }

    if (config.dryRun) {
      console.log('[Backfill] DRY RUN complete - no data was written');
    }

    process.exit(0);
  } catch (err) {
    console.error('[Backfill] Fatal error during backfill:', err);
    backfillFailuresTotal.inc({ reason: 'fatal_error' });
    process.exit(1);
  } finally {
    // Close connections
    try {
      await postgresStore.close();
    } catch (err) {
      console.error('[Backfill] Error closing Postgres connection:', err);
    }
  }
}

/**
 * Verify backfill (compare record counts)
 */
async function verifyBackfill(): Promise<void> {
  const memoryStore = getMemoryStore();
  const postgresStore = getPostgresStore();

  console.log('[Backfill] Verifying backfill...');

  try {
    const memoryStats = await memoryStore.getStats();
    const postgresStats = await postgresStore.getStats();

    console.log('[Backfill] Memory store stats:', memoryStats);
    console.log('[Backfill] Postgres store stats:', postgresStats);

    if (memoryStats.total_records === postgresStats.total_records) {
      console.log('✅ [Backfill] Verification passed: Record counts match');
    } else {
      console.warn('⚠️ [Backfill] Verification warning: Record counts differ');
      console.warn(`   Memory: ${memoryStats.total_records}, Postgres: ${postgresStats.total_records}`);
    }

    // Compare by consent family
    console.log('[Backfill] Records by consent family:');
    console.log('   Memory:', memoryStats.records_by_family);
    console.log('   Postgres:', postgresStats.records_by_family);
  } catch (err) {
    console.error('[Backfill] Verification failed:', err);
  } finally {
    await postgresStore.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2] || 'backfill';

  switch (command) {
    case 'backfill':
      await backfillToPostgres();
      break;

    case 'verify':
      await verifyBackfill();
      break;

    case 'help':
      console.log('Backfill Script: Memory → Postgres');
      console.log('');
      console.log('Usage:');
      console.log('  npm run backfill                    # Run backfill');
      console.log('  npm run backfill verify             # Verify backfill results');
      console.log('  npm run backfill help               # Show this help');
      console.log('');
      console.log('Environment variables:');
      console.log('  BACKFILL_BATCH_SIZE=100             # Records per batch (default: 100)');
      console.log('  BACKFILL_DRY_RUN=true               # Dry run mode (no writes)');
      console.log('  BACKFILL_CONSENT_FAMILY=personal    # Filter by consent family');
      console.log('  ENCRYPTION_ENABLED=true             # Enable encryption during migration');
      console.log('');
      console.log('Examples:');
      console.log('  BACKFILL_DRY_RUN=true npm run backfill');
      console.log('  BACKFILL_CONSENT_FAMILY=personal npm run backfill');
      console.log('  ENCRYPTION_ENABLED=true npm run backfill');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "npm run backfill help" for usage information');
      process.exit(1);
  }
}

// Run main
main().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
