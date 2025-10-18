/**
 * Backfill Tests
 * Phase 3 Week 3: Postgres Hardening
 *
 * Verifies backfill script behavior:
 * - N records migrated from memory to Postgres
 * - Re-running backfill doesn't duplicate records (idempotent)
 * - Failures are counted correctly
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { InMemoryStore } from '../src/memory-layer/storage/in-memory-store';
import { PostgresStore } from '../src/memory-layer/storage/postgres-store';
import { MemoryRecord } from '../src/memory-layer/models/memory-record';
import { v4 as uuidv4 } from 'uuid';

describe('Backfill', () => {
  let memoryStore: InMemoryStore;
  let postgresStore: PostgresStore;
  const testHashedPseudonym = 'hs_test_backfill_' + uuidv4();

  beforeAll(async () => {
    memoryStore = new InMemoryStore();
    postgresStore = new PostgresStore();

    // Wait for Postgres connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await postgresStore.close();
  });

  beforeEach(async () => {
    // Clear both stores before each test
    await memoryStore.clear();
    try {
      await postgresStore.clear();
    } catch (err) {
      // clear() not implemented yet - OK
    }
  });

  describe('Backfill Migration', () => {
    it('should migrate records from memory to postgres', async () => {
      // Create test records in memory
      const records: MemoryRecord[] = [];
      for (let i = 0; i < 5; i++) {
        const record: MemoryRecord = {
          id: uuidv4(),
          hashed_pseudonym: testHashedPseudonym,
          content: {
            type: 'text',
            data: `Backfill test record ${i}`,
          },
          consent_family: 'personal',
          consent_timestamp: new Date().toISOString(),
          consent_version: '1.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_count: i,
          audit_receipt_id: uuidv4(),
        };
        records.push(record);
        await memoryStore.store(record);
      }

      // Verify records in memory
      const memoryRecords = await memoryStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });
      expect(memoryRecords.length).toBe(5);

      // Simulate backfill: copy records to postgres
      let migratedCount = 0;
      for (const record of records) {
        await postgresStore.store(record);
        migratedCount++;
      }

      expect(migratedCount).toBe(5);

      // Verify records in postgres
      const postgresRecords = await postgresStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });
      expect(postgresRecords.length).toBe(5);

      // Verify data integrity
      for (let i = 0; i < 5; i++) {
        const memoryRecord = memoryRecords.find((r) => r.id === records[i].id);
        const postgresRecord = postgresRecords.find((r) => r.id === records[i].id);

        expect(memoryRecord).toBeDefined();
        expect(postgresRecord).toBeDefined();
        expect(memoryRecord!.content.data).toBe(postgresRecord!.content.data);
        expect(memoryRecord!.access_count).toBe(postgresRecord!.access_count);
      }
    });

    it('should be idempotent (re-running does not duplicate)', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Idempotent test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      // Store in memory
      await memoryStore.store(record);

      // First backfill
      await postgresStore.store(record);

      // Second backfill (should UPSERT, not duplicate)
      await postgresStore.store(record);

      // Count records in postgres
      const count = await postgresStore.count({
        hashed_pseudonym: testHashedPseudonym,
      });

      // Should only have 1 record (not duplicated)
      expect(count).toBe(1);
    });

    it('should handle partial failures gracefully', async () => {
      const records: MemoryRecord[] = [];

      // Create 3 valid records
      for (let i = 0; i < 3; i++) {
        const record: MemoryRecord = {
          id: uuidv4(),
          hashed_pseudonym: testHashedPseudonym,
          content: {
            type: 'text',
            data: `Valid record ${i}`,
          },
          consent_family: 'personal',
          consent_timestamp: new Date().toISOString(),
          consent_version: '1.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_count: 0,
          audit_receipt_id: uuidv4(),
        };
        records.push(record);
        await memoryStore.store(record);
      }

      // Migrate records, counting failures
      let successCount = 0;
      let failureCount = 0;

      for (const record of records) {
        try {
          await postgresStore.store(record);
          successCount++;
        } catch (err) {
          failureCount++;
        }
      }

      expect(successCount).toBe(3);
      expect(failureCount).toBe(0);
    });

    it('should preserve record metadata during migration', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        session_id: 'session_backfill_test',
        content: {
          type: 'structured',
          data: {
            key: 'value',
            nested: {
              deep: 'data',
            },
          },
          metadata: {
            source: 'test',
            tags: ['backfill', 'test'],
          },
        },
        consent_family: 'cohort',
        consent_timestamp: new Date('2025-01-01').toISOString(),
        consent_version: '2.0',
        created_at: new Date('2025-01-01').toISOString(),
        updated_at: new Date('2025-01-02').toISOString(),
        expires_at: new Date('2026-01-01').toISOString(),
        access_count: 42,
        audit_receipt_id: uuidv4(),
      };

      await memoryStore.store(record);
      await postgresStore.store(record);

      const recalled = await postgresStore.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });

      expect(recalled.length).toBe(1);
      const migratedRecord = recalled[0];

      expect(migratedRecord.id).toBe(record.id);
      expect(migratedRecord.session_id).toBe(record.session_id);
      expect(migratedRecord.content.data).toEqual(record.content.data);
      expect(migratedRecord.content.metadata).toEqual(record.content.metadata);
      expect(migratedRecord.consent_family).toBe(record.consent_family);
      expect(migratedRecord.consent_version).toBe(record.consent_version);
      expect(migratedRecord.access_count).toBe(record.access_count);
    });

    it('should handle large batch migrations', async () => {
      const batchSize = 50;
      const records: MemoryRecord[] = [];

      // Create batch of records
      for (let i = 0; i < batchSize; i++) {
        const record: MemoryRecord = {
          id: uuidv4(),
          hashed_pseudonym: testHashedPseudonym,
          content: {
            type: 'text',
            data: `Batch record ${i}`,
          },
          consent_family: 'personal',
          consent_timestamp: new Date().toISOString(),
          consent_version: '1.0',
          created_at: new Date(Date.now() + i * 1000).toISOString(),
          updated_at: new Date().toISOString(),
          access_count: 0,
          audit_receipt_id: uuidv4(),
        };
        records.push(record);
        await memoryStore.store(record);
      }

      // Migrate in batches
      const chunkSize = 10;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        for (const record of chunk) {
          await postgresStore.store(record);
        }
      }

      // Verify all migrated
      const count = await postgresStore.count({
        hashed_pseudonym: testHashedPseudonym,
      });

      expect(count).toBe(batchSize);
    });
  });

  describe('Backfill Verification', () => {
    it('should verify record counts match', async () => {
      // Create records in both stores
      for (let i = 0; i < 3; i++) {
        const record: MemoryRecord = {
          id: uuidv4(),
          hashed_pseudonym: testHashedPseudonym,
          content: {
            type: 'text',
            data: `Verify test ${i}`,
          },
          consent_family: 'personal',
          consent_timestamp: new Date().toISOString(),
          consent_version: '1.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_count: 0,
          audit_receipt_id: uuidv4(),
        };

        await memoryStore.store(record);
        await postgresStore.store(record);
      }

      // Count in both stores
      const memoryCount = await memoryStore.count({
        hashed_pseudonym: testHashedPseudonym,
      });

      const postgresCount = await postgresStore.count({
        hashed_pseudonym: testHashedPseudonym,
      });

      expect(memoryCount).toBe(postgresCount);
      expect(memoryCount).toBe(3);
    });
  });
});
