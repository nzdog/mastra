/**
 * PostgresStore Integration Tests
 * Phase 3 Week 3: Postgres Hardening
 *
 * Verifies PostgresStore implementation:
 * - CRUD operations
 * - Query filtering (session_id, time range, type)
 * - Count operations
 * - Expiration handling
 * - Partitioning support
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgresStore } from '../src/memory-layer/storage/postgres-store';
import { MemoryRecord } from '../src/memory-layer/models/memory-record';
import { v4 as uuidv4 } from 'uuid';

describe('PostgresStore', () => {
  let store: PostgresStore;
  const testHashedPseudonym = 'hs_test_postgres_' + uuidv4();
  const testRecords: MemoryRecord[] = [];

  beforeAll(async () => {
    process.env.PERSISTENCE = 'postgres';
    process.env.ENCRYPTION_ENABLED = 'false'; // Disable for basic tests

    store = new PostgresStore();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup test records
    try {
      await store.clear();
    } catch (err) {
      // clear() not implemented yet - OK
    }

    await store.close();
  });

  beforeEach(() => {
    testRecords.length = 0;
  });

  describe('store()', () => {
    it('should store a new memory record', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        session_id: 'session_store_1',
        content: {
          type: 'text',
          data: 'Test memory content',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      const stored = await store.store(record);

      expect(stored.id).toBe(record.id);
      expect(stored.hashed_pseudonym).toBe(record.hashed_pseudonym);
      expect(stored.content.data).toBe(record.content.data);
      testRecords.push(stored);
    });

    it('should update existing record on conflict', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Initial content',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 5,
        audit_receipt_id: uuidv4(),
      };

      await store.store(record);

      // Update with new content
      const updated = {
        ...record,
        content: { type: 'text' as const, data: 'Updated content' },
        access_count: 10,
      };
      const result = await store.store(updated);

      expect(result.content.data).toBe('Updated content');
      expect(result.access_count).toBe(10);
    });

    it('should handle JSONB content correctly', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'structured',
          data: {
            nested: {
              object: {
                with: 'multiple',
                levels: ['array', 'values'],
              },
            },
            number: 42,
            boolean: true,
          },
        },
        consent_family: 'cohort',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      const stored = await store.store(record);
      expect(stored.content.data).toEqual(record.content.data);
    });

    it('should throw on missing hashed_pseudonym', async () => {
      const invalidRecord: any = {
        id: uuidv4(),
        // hashed_pseudonym missing
        content: {
          type: 'text',
          data: 'Test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await expect(store.store(invalidRecord)).rejects.toThrow('hashed_pseudonym is required');
    });

    it('should throw on invalid consent_family', async () => {
      const invalidRecord: any = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Test',
        },
        consent_family: 'invalid_family',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await expect(store.store(invalidRecord)).rejects.toThrow(
        'consent_family must be one of [personal, cohort, population]'
      );
    });
  });

  describe('recall()', () => {
    beforeEach(async () => {
      // Insert test records
      for (let i = 0; i < 5; i++) {
        const record: MemoryRecord = {
          id: uuidv4(),
          hashed_pseudonym: testHashedPseudonym,
          session_id: i < 3 ? 'session_recall_1' : 'session_recall_2',
          content: {
            type: 'text',
            data: `Test content ${i}`,
          },
          consent_family: 'personal',
          consent_timestamp: new Date().toISOString(),
          consent_version: '1.0',
          created_at: new Date(Date.now() + i * 1000).toISOString(),
          updated_at: new Date().toISOString(),
          access_count: i,
          audit_receipt_id: uuidv4(),
        };
        testRecords.push(await store.store(record));
      }
    });

    it('should recall records by hashed_pseudonym', async () => {
      const records = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 10,
      });

      expect(records.length).toBeGreaterThanOrEqual(5);
      records.forEach((r) => {
        expect(r.hashed_pseudonym).toBe(testHashedPseudonym);
      });
    });

    it('should filter by session_id', async () => {
      const records = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        session_id: 'session_recall_1',
        limit: 10,
      });

      expect(records.length).toBe(3);
      records.forEach((r) => {
        expect(r.session_id).toBe('session_recall_1');
      });
    });

    it('should support limit and offset', async () => {
      const page1 = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 2,
        offset: 0,
      });

      const page2 = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 2,
        offset: 2,
      });

      expect(page1.length).toBe(2);
      expect(page2.length).toBeGreaterThanOrEqual(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should support ascending/descending sort', async () => {
      const asc = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        sort: 'asc',
        limit: 10,
      });

      const desc = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        sort: 'desc',
        limit: 10,
      });

      expect(asc.length).toBeGreaterThan(0);
      expect(desc.length).toBeGreaterThan(0);

      // Verify sort order
      if (asc.length >= 2) {
        expect(new Date(asc[0].created_at).getTime()).toBeLessThanOrEqual(
          new Date(asc[1].created_at).getTime()
        );
      }

      if (desc.length >= 2) {
        expect(new Date(desc[0].created_at).getTime()).toBeGreaterThanOrEqual(
          new Date(desc[1].created_at).getTime()
        );
      }
    });

    it('should filter by time range (since/until)', async () => {
      const now = Date.now();
      const since = new Date(now - 2000).toISOString();
      const until = new Date(now + 10000).toISOString();

      const records = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        since,
        until,
        limit: 10,
      });

      expect(records.length).toBeGreaterThan(0);
      records.forEach((r) => {
        expect(new Date(r.created_at).getTime()).toBeGreaterThanOrEqual(new Date(since).getTime());
        expect(new Date(r.created_at).getTime()).toBeLessThanOrEqual(new Date(until).getTime());
      });
    });

    it('should filter by content type', async () => {
      const records = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        type: 'text',
        limit: 10,
      });

      expect(records.length).toBeGreaterThan(0);
      records.forEach((r) => {
        expect(r.content.type).toBe('text');
      });
    });

    it('should exclude expired records', async () => {
      const expiredRecord: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Expired content',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 10000).toISOString(), // Expired 10s ago
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      await store.store(expiredRecord);

      const records = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        limit: 100,
      });

      const found = records.find((r) => r.id === expiredRecord.id);
      expect(found).toBeUndefined();
    });
  });

  describe('count()', () => {
    beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        const record: MemoryRecord = {
          id: uuidv4(),
          hashed_pseudonym: testHashedPseudonym,
          session_id: 'session_count_1',
          content: {
            type: 'text',
            data: `Count test ${i}`,
          },
          consent_family: 'personal',
          consent_timestamp: new Date().toISOString(),
          consent_version: '1.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_count: 0,
          audit_receipt_id: uuidv4(),
        };
        await store.store(record);
      }
    });

    it('should count records by hashed_pseudonym', async () => {
      const count = await store.count({
        hashed_pseudonym: testHashedPseudonym,
      });

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('should count with filters', async () => {
      const count = await store.count({
        hashed_pseudonym: testHashedPseudonym,
        session_id: 'session_count_1',
      });

      expect(count).toBe(3);
    });

    it('should count by consent_family', async () => {
      const count = await store.count({
        hashed_pseudonym: testHashedPseudonym,
        consent_family: 'personal',
      });

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('partitioning support', () => {
    it('should insert into correct partition', async () => {
      const record: MemoryRecord = {
        id: uuidv4(),
        hashed_pseudonym: testHashedPseudonym,
        content: {
          type: 'text',
          data: 'Partition test',
        },
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
        created_at: '2025-11-15T10:00:00.000Z', // Should go into 2025_11 partition
        updated_at: new Date().toISOString(),
        access_count: 0,
        audit_receipt_id: uuidv4(),
      };

      const stored = await store.store(record);
      expect(stored.id).toBe(record.id);

      // Verify can recall
      const recalled = await store.recall({
        hashed_pseudonym: testHashedPseudonym,
        since: '2025-11-01T00:00:00.000Z',
        until: '2025-12-01T00:00:00.000Z',
        limit: 10,
      });

      const found = recalled.find((r) => r.id === record.id);
      expect(found).toBeDefined();
    });
  });
});
