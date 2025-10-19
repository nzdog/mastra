/**
 * Dual-Write Migration Adapter
 * Phase 3 Week 3: Postgres Hardening
 *
 * Implements dual-write pattern for zero-downtime migration from memory to Postgres.
 * - Writes to both memory (primary) and Postgres (secondary)
 * - Reads from memory with fallback to Postgres
 * - Records metrics for monitoring migration progress
 */

import {
  dualWriteRecordsTotal,
  dualWriteFailuresTotal,
  dualWriteLagSeconds,
} from '../../observability/metrics';
import { MemoryRecord } from '../models/memory-record';
import { RecallQuery, ForgetRequest } from '../models/operation-requests';
import { MemoryStore, QueryFilters } from './memory-store-interface';

/**
 * Dual-write configuration
 */
export interface DualStoreConfig {
  enabled: boolean;
  primaryStore: 'memory' | 'postgres';
  failFast: boolean; // If true, fail request if secondary write fails
}

/**
 * Load dual-write config from environment
 */
function loadDualStoreConfig(): DualStoreConfig {
  return {
    enabled: process.env.DUAL_WRITE_ENABLED === 'true',
    primaryStore: (process.env.DUAL_WRITE_PRIMARY || 'memory') as 'memory' | 'postgres',
    failFast: process.env.DUAL_WRITE_FAIL_FAST === 'true',
  };
}

/**
 * DualStore: Writes to both memory and Postgres, reads from memory with fallback
 */
export class DualStore implements MemoryStore {
  private primaryStore: MemoryStore;
  private secondaryStore: MemoryStore;
  private config: DualStoreConfig;

  constructor(memoryStore: MemoryStore, postgresStore: MemoryStore, config?: DualStoreConfig) {
    this.config = config || loadDualStoreConfig();

    if (this.config.primaryStore === 'memory') {
      this.primaryStore = memoryStore;
      this.secondaryStore = postgresStore;
    } else {
      this.primaryStore = postgresStore;
      this.secondaryStore = memoryStore;
    }

    console.log('[DualStore] Initialized with primary:', this.config.primaryStore);
  }

  /**
   * Store: Write to primary, then secondary
   * Primary write failure → fail request
   * Secondary write failure → log, record metric, continue if not failFast
   */
  async store(record: MemoryRecord): Promise<MemoryRecord> {
    // Write to primary store (always required)
    let primaryResult: MemoryRecord;
    try {
      primaryResult = await this.primaryStore.store(record);
      dualWriteRecordsTotal.inc({
        primary_store: this.config.primaryStore,
        secondary_store: this.config.primaryStore === 'memory' ? 'postgres' : 'memory',
        status: 'primary_success',
      });
    } catch (err) {
      dualWriteFailuresTotal.inc({
        store: this.config.primaryStore,
        reason: 'primary_store_failed',
      });
      console.error('[DualStore] Primary store failed:', err);
      throw err; // Always fail on primary store failure
    }

    // Write to secondary store (best-effort unless failFast)
    try {
      await this.secondaryStore.store(record);
      dualWriteRecordsTotal.inc({
        primary_store: this.config.primaryStore,
        secondary_store: this.config.primaryStore === 'memory' ? 'postgres' : 'memory',
        status: 'both_success',
      });
    } catch (err) {
      const secondaryStoreType = this.config.primaryStore === 'memory' ? 'postgres' : 'memory';
      dualWriteFailuresTotal.inc({
        store: secondaryStoreType,
        reason: 'secondary_store_failed',
      });
      console.error('[DualStore] Secondary store failed:', err);

      if (this.config.failFast) {
        throw new Error('Secondary store write failed (failFast=true)');
      }

      // Continue if not failFast - request succeeds even if secondary fails
      dualWriteRecordsTotal.inc({
        primary_store: this.config.primaryStore,
        secondary_store: secondaryStoreType,
        status: 'primary_only',
      });
    }

    return primaryResult;
  }

  /**
   * Recall: Read from primary, fallback to secondary if empty
   */
  async recall(query: RecallQuery): Promise<MemoryRecord[]> {
    // Try primary store first
    try {
      const primaryResults = await this.primaryStore.recall(query);

      if (primaryResults.length > 0) {
        return primaryResults;
      }

      // Fallback to secondary if primary returned no results
      console.log('[DualStore] Primary returned no results, falling back to secondary');
      const secondaryResults = await this.secondaryStore.recall(query);

      if (secondaryResults.length > 0) {
        // Update lag metric if we had to fallback
        dualWriteLagSeconds.set({ store: 'secondary_fallback' }, 1);
      }

      return secondaryResults;
    } catch (err) {
      // If primary fails, try secondary
      console.error('[DualStore] Primary recall failed, trying secondary:', err);
      dualWriteFailuresTotal.inc({
        store: this.config.primaryStore,
        reason: 'recall_failed_using_fallback',
      });

      return await this.secondaryStore.recall(query);
    }
  }

  /**
   * Count: Use primary store
   */
  async count(filters: QueryFilters): Promise<number> {
    try {
      return await this.primaryStore.count(filters);
    } catch (err) {
      console.error('[DualStore] Primary count failed, trying secondary:', err);
      return await this.secondaryStore.count(filters);
    }
  }

  /**
   * Forget: Delete from both stores with atomicity requirement
   * Phase 3.2: GDPR compliance - secondary delete MUST succeed and match counts
   *
   * Ignores failFast setting for deletes (GDPR requirement)
   */
  async forget(request: ForgetRequest): Promise<string[]> {
    // Step 1: Delete from primary store
    let primaryDeleted: string[];
    try {
      primaryDeleted = await this.primaryStore.forget(request);
      console.log(`[DualStore] Primary delete succeeded: ${primaryDeleted.length} records`);
    } catch (err) {
      dualWriteFailuresTotal.inc({
        store: this.config.primaryStore,
        reason: 'primary_forget_failed',
      });
      console.error('[DualStore] Primary forget failed:', err);
      throw err; // Always fail on primary delete failure
    }

    // Step 2: Delete from secondary store (REQUIRED for GDPR)
    let secondaryDeleted: string[];
    try {
      secondaryDeleted = await this.secondaryStore.forget(request);
      console.log(`[DualStore] Secondary delete succeeded: ${secondaryDeleted.length} records`);
    } catch (err) {
      const secondaryStoreType = this.config.primaryStore === 'memory' ? 'postgres' : 'memory';
      dualWriteFailuresTotal.inc({
        store: secondaryStoreType,
        reason: 'secondary_forget_failed',
      });
      console.error('[DualStore] Secondary forget failed:', err);

      // Phase 3.2: GDPR requirement - secondary delete failure is CRITICAL
      throw new Error(
        `[DualStore] Secondary delete failed (GDPR violation risk). ` +
          `Primary deleted ${primaryDeleted.length} records but secondary failed: ${(err as Error).message}`
      );
    }

    // Step 3: Verify delete counts match (Phase 3.2: atomicity check)
    if (primaryDeleted.length !== secondaryDeleted.length) {
      dualWriteFailuresTotal.inc({
        store: 'dual-write',
        reason: 'forget_count_mismatch',
      });

      const error = new Error(
        `[DualStore] Delete count mismatch (GDPR consistency violation). ` +
          `Primary deleted ${primaryDeleted.length} but secondary deleted ${secondaryDeleted.length}. ` +
          `Request: ${JSON.stringify(request)}`
      );
      console.error(error.message);
      throw error;
    }

    console.log(
      `[DualStore] Dual delete successful: ${primaryDeleted.length} records from both stores`
    );
    return primaryDeleted;
  }

  /**
   * Get: Read from primary, fallback to secondary
   */
  async get(id: string): Promise<MemoryRecord | null> {
    try {
      const result = await this.primaryStore.get(id);
      if (result) {
        return result;
      }

      // Fallback to secondary
      return await this.secondaryStore.get(id);
    } catch (err) {
      console.error('[DualStore] Primary get failed, trying secondary:', err);
      return await this.secondaryStore.get(id);
    }
  }

  /**
   * IncrementAccessCount: Update in both stores
   */
  async incrementAccessCount(id: string): Promise<MemoryRecord | null> {
    const primaryResult = await this.primaryStore.incrementAccessCount(id);

    try {
      await this.secondaryStore.incrementAccessCount(id);
    } catch (err) {
      console.error('[DualStore] Secondary incrementAccessCount failed:', err);
      // Continue - primary succeeded
    }

    return primaryResult;
  }

  /**
   * Exists: Check primary, fallback to secondary
   */
  async exists(id: string): Promise<boolean> {
    try {
      const existsInPrimary = await this.primaryStore.exists(id);
      if (existsInPrimary) {
        return true;
      }

      // Fallback to secondary
      return await this.secondaryStore.exists(id);
    } catch (err) {
      console.error('[DualStore] Primary exists failed, trying secondary:', err);
      return await this.secondaryStore.exists(id);
    }
  }

  /**
   * ClearExpired: Clear from both stores
   */
  async clearExpired(): Promise<number> {
    let totalCleared = 0;

    try {
      totalCleared += await this.primaryStore.clearExpired();
    } catch (err) {
      console.error('[DualStore] Primary clearExpired failed:', err);
    }

    try {
      totalCleared += await this.secondaryStore.clearExpired();
    } catch (err) {
      console.error('[DualStore] Secondary clearExpired failed:', err);
    }

    return totalCleared;
  }

  /**
   * GetStats: Aggregate stats from both stores
   */
  async getStats(): Promise<{
    total_records: number;
    records_by_family: Record<string, number>;
    storage_bytes: number;
  }> {
    const primaryStats = await this.primaryStore.getStats();
    const secondaryStats = await this.secondaryStore.getStats();

    // Aggregate (use max for total_records to avoid double-counting)
    return {
      total_records: Math.max(primaryStats.total_records, secondaryStats.total_records),
      records_by_family: primaryStats.records_by_family, // Use primary as source of truth
      storage_bytes: primaryStats.storage_bytes + secondaryStats.storage_bytes,
    };
  }

  /**
   * Clear: Clear both stores (for testing)
   */
  async clear(): Promise<void> {
    await Promise.all([this.primaryStore.clear(), this.secondaryStore.clear()]);
  }

  /**
   * Close: Close both stores (for graceful shutdown)
   */
  async close(): Promise<void> {
    const primaryClose = (this.primaryStore as any).close;
    const secondaryClose = (this.secondaryStore as any).close;

    await Promise.all([
      primaryClose ? primaryClose.call(this.primaryStore) : Promise.resolve(),
      secondaryClose ? secondaryClose.call(this.secondaryStore) : Promise.resolve(),
    ]);
  }
}

/**
 * Singleton instance
 */
let dualStoreInstance: DualStore | null = null;

export function getDualStore(memoryStore: MemoryStore, postgresStore: MemoryStore): DualStore {
  if (!dualStoreInstance) {
    dualStoreInstance = new DualStore(memoryStore, postgresStore);
  }
  return dualStoreInstance;
}

/**
 * Reset instance (for testing)
 */
export function resetDualStore(): void {
  dualStoreInstance = null;
}
