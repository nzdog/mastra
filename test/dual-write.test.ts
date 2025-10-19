/**
 * Dual-Write Tests
 * Phase 3 Week 3: Postgres Hardening
 *
 * Verifies dual-write migration adapter behavior:
 * - Memory success + Postgres failure → request succeeds, metric incremented
 * - Recall falls back to Postgres when memory empty
 * - Metrics are recorded correctly
 */

import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MemoryRecord } from '../src/memory-layer/models/memory-record';
import { DualStore } from '../src/memory-layer/storage/dual-store';
import { InMemoryStore } from '../src/memory-layer/storage/in-memory-store';
import { PostgresStore } from '../src/memory-layer/storage/postgres-store';
import { register } from '../src/observability/metrics';

// Skip these tests when Postgres is not available (PERSISTENCE=memory in CI/test env)
const skipIfNoPostgres = process.env.PERSISTENCE === 'memory';

describe.skipIf(skipIfNoPostgres)('DualStore', () => {
  let memoryStore: InMemoryStore;
  let postgresStore: PostgresStore;
  let dualStore: DualStore;
  const testHashedPseudonym = 'hs_test_dualwrite_' + uuidv4();

  beforeAll(async () => {
    process.env.DUAL_WRITE_ENABLED = 'true';
    process.env.DUAL_WRITE_PRIMARY = 'memory';
    process.env.DUAL_WRITE_FAIL_FAST = 'false';

    memoryStore = new InMemoryStore();
    postgresStore = new PostgresStore();
    dualStore = new DualStore(memoryStore, postgresStore);

    // Wait for Postgres connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await dualStore.close();
  });

  beforeEach(async () => {
    // Clear both stores before each test
    await memoryStore.clear();
    try {
      await postgresStore.clear();
    } catch {
      // clear() not implemented yet - OK
    }
  });

  describe('store()', () => {
    it('should write to both memory and postgres', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Dual write test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      const stored = await dualStore.store(record);
      expect(stored.id).toBe(record.id);

      // Verify written to memory
      const memoryRecords = await memoryStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });
      expect(memoryRecords.length).toBe(1);
      expect(memoryRecords[0].id).toBe(record.id);

      // Verify written to postgres
      const postgresRecords = await postgresStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });
      expect(postgresRecords.length).toBe(1);
      expect(postgresRecords[0].id).toBe(record.id);
    });

    it('should succeed if primary succeeds and secondary fails (failFast=false)', async () => {
      // Create a failing postgres store mock
      const failingPostgres = {
        ...postgresStore,
        store: async () => {
          throw new Error('Postgres store failed');
        },
      } as unknown as PostgresStore;

      const dualStoreWithFailure = new DualStore(memoryStore, failingPostgres, {
        enabled: true,
        primaryStore: 'memory',
        failFast: false,
      });

      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Primary only test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      // Should succeed because failFast=false
      const stored = await dualStoreWithFailure.store(record);
      expect(stored.id).toBe(record.id);

      // Verify written to memory
      const memoryRecords = await memoryStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });
      expect(memoryRecords.length).toBeGreaterThan(0);
    });

    it('should emit dual-write metrics', async () => {
      const _metricsBefore = await register.metrics();

      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Metrics test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await dualStore.store(record);

      const metricsAfter = await register.metrics();

      // Should have dual_write_records_total metric
      expect(metricsAfter).toContain('dual_write_records_total');
      expect(metricsAfter).toContain('primary_store="memory"');
      expect(metricsAfter).toContain('secondary_store="postgres"');
    });
  });

  describe('recall()', () => {
    it('should read from memory (primary)', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Primary recall test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await dualStore.store(record);

      const recalled = await dualStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });

      expect(recalled.length).toBeGreaterThan(0);
      expect(recalled[0].id).toBe(record.id);
    });

    it('should fallback to postgres when memory is empty', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Fallback test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      // Write directly to postgres (bypass dual store)
      await postgresStore.store(record);

      // Clear memory
      await memoryStore.clear();

      // Recall should fallback to postgres
      const recalled = await dualStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });

      expect(recalled.length).toBe(1);
      expect(recalled[0].id).toBe(record.id);
      expect(recalled[0].content.data).toBe('Fallback test');
    });

    it('should fallback to postgres if memory recall fails', async () => {
      // Create a failing memory store mock
      const failingMemory = {
        ...memoryStore,
        recall: async () => {
          throw new Error('Memory recall failed');
        },
      } as unknown as InMemoryStore;

      const dualStoreWithFailure = new DualStore(failingMemory, postgresStore);

      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Fallback on error test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      // Write to postgres
      await postgresStore.store(record);

      // Recall should fallback to postgres
      const recalled = await dualStoreWithFailure.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });

      expect(recalled.length).toBeGreaterThan(0);
    });
  });

  describe('count()', () => {
    it('should count from primary store', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Count test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await dualStore.store(record);

      const count = await dualStore.count({
        hashed_pseudonym: testHashedPseudonym,
      });

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('getStats()', () => {
    it('should aggregate stats from both stores', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Stats test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await dualStore.store(record);

      const stats = await dualStore.getStats();

      expect(stats.total_records).toBeGreaterThan(0);
      expect(stats.records_by_family).toBeDefined();
    });
  });
});
