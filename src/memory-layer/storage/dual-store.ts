/**
 * Dual-Write Migration Adapter
 * Phase 3 Week 3: Postgres Hardening
 *
 * Implements dual-write pattern for zero-downtime migration from memory to Postgres.
 * - Writes to both memory (primary) and Postgres (secondary)
 * - Reads from memory with fallback to Postgres
 * - Records metrics for monitoring migration progress
 */

import { MemoryStore, QueryFilters } from './memory-store-interface';
import { MemoryRecord } from '../models/memory-record';
import { RecallQuery, ForgetRequest } from '../models/operation-requests';
import {
  dualWriteRecordsTotal,
  dualWriteFailuresTotal,
  dualWriteLagSeconds,
} from '../../observability/metrics';

/**
 * Dual-write configuration
 */
export interface DualStoreConfig {
  enabled: boolean;
  primaryStore: 'memory' | 'postgres';
  failFast: boolean; // If true, fail request if secondary write fails
}

/**
 * Timeout constant for secondary store operations
 * Prevents hanging on secondary store failures
 */
const SECONDARY_STORE_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Wrap a promise with a timeout
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Operation name for error messages
 * @returns Promise that rejects if timeout is exceeded
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
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
    const secondaryStoreType = this.config.primaryStore === 'memory' ? 'postgres' : 'memory';

    // Write to primary store (always required)
    let primaryResult: MemoryRecord;
    try {
      primaryResult = await this.primaryStore.store(record);
    } catch (err) {
      dualWriteFailuresTotal.inc({
        store: this.config.primaryStore,
        reason: 'primary_store_failed',
      });
      console.error('[DualStore] Primary store failed:', err);
      throw err; // Always fail on primary store failure
    }

    // Write to secondary store (best-effort unless failFast) with timeout
    try {
      await withTimeout(
        this.secondaryStore.store(record),
        SECONDARY_STORE_TIMEOUT_MS,
        'Secondary store write'
      );
      // Success: Both stores written
      dualWriteRecordsTotal.inc({
        primary_store: this.config.primaryStore,
        secondary_store: secondaryStoreType,
        status: 'both_success',
      });
    } catch (err) {
      const reason = (err as Error).message?.includes('timed out')
        ? 'secondary_store_timeout'
        : 'secondary_store_failed';
      dualWriteFailuresTotal.inc({
        store: secondaryStoreType,
        reason,
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
        // Update lag metric if we had to fallback - calculate real lag
        // Results should be sorted by created_at DESC (newest first)
        const newest = secondaryResults[0];

        if (!newest.created_at) {
          console.warn('[DualStore] Cannot calculate lag: missing created_at timestamp');
          // Do not set metric - avoid false zero lag
        } else {
          const createdTimestamp = new Date(newest.created_at as any).getTime();

          // NaN guard: Invalid date parsing should not set metric
          if (Number.isNaN(createdTimestamp)) {
            console.warn(`[DualStore] Invalid created_at timestamp: ${newest.created_at}`);
          } else {
            const lagSeconds = Math.max(0, (Date.now() - createdTimestamp) / 1000);
            dualWriteLagSeconds.set({ store: 'secondary_fallback' }, lagSeconds);
          }
        }
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
   * Forget: Delete from both stores with mismatch detection
   *
   * GDPR Compliance: This method ALWAYS enforces failFast=true semantics regardless
   * of config. GDPR erasure must be atomic across both stores.
   *
   * Deletes records from both primary and secondary stores. If secondary store
   * fails or returns different count, throws error (no claim of success).
   *
   * @param request - ForgetRequest specifying what to delete
   * @returns Array of deleted IDs from primary store
   * @throws Error if secondary deletion fails or counts mismatch
   */
  async forget(request: ForgetRequest): Promise<string[]> {
    const secondaryStoreType = this.config.primaryStore === 'memory' ? 'postgres' : 'memory';

    // Delete from primary store (required)
    let primaryDeleted: string[];
    try {
      primaryDeleted = await this.primaryStore.forget(request);
    } catch (err) {
      dualWriteFailuresTotal.inc({
        store: this.config.primaryStore,
        reason: 'forget_failed',
      });
      console.error('[DualStore] Primary forget failed:', err);
      throw err; // Always fail on primary failure
    }

    // Only proceed if primary succeeded and deleted records
    if (primaryDeleted.length === 0) {
      // No records to delete - success (no secondary attempt needed)
      return primaryDeleted;
    }

    // Delete from secondary store (MUST succeed for GDPR compliance) with timeout
    try {
      const secondaryDeleted = await withTimeout(
        this.secondaryStore.forget(request),
        SECONDARY_STORE_TIMEOUT_MS,
        'Secondary store forget'
      );

      // Check for count mismatch - this is a GDPR violation
      if (primaryDeleted.length !== secondaryDeleted.length) {
        const diff = Math.abs(primaryDeleted.length - secondaryDeleted.length);
        console.error(
          `[DualStore] GDPR VIOLATION: Forget count mismatch: primary=${primaryDeleted.length}, secondary=${secondaryDeleted.length} (diff=${diff}, ids=${primaryDeleted.length})`
        );
        dualWriteFailuresTotal.inc({
          store: secondaryStoreType,
          reason: 'forget_mismatch',
        });

        // GDPR requires atomic deletion - surface failure
        throw new Error(
          `GDPR erasure incomplete: primary deleted ${primaryDeleted.length} records, secondary deleted ${secondaryDeleted.length}`
        );
      }

      // Success: Both stores deleted same count
      return primaryDeleted;
    } catch (err) {
      dualWriteFailuresTotal.inc({
        store: secondaryStoreType,
        reason: 'forget_failed',
      });
      console.error(`[DualStore] Secondary forget failed (${primaryDeleted.length} ids):`, err);

      // GDPR requires atomic deletion - always fail
      throw new Error(
        `Secondary store forget failed (${primaryDeleted.length} records affected): ${(err as Error).message}`
      );
    }
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
