/**
 * Encryption Roundtrip Tests
 * Phase 3 Week 3: Postgres Hardening
 *
 * Verifies encryption wiring in PostgresStore:
 * - Plaintext → encrypt → store → recall → decrypt → plaintext
 * - Metrics are emitted correctly
 * - Errors are handled gracefully
 */

import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MemoryRecord } from '../src/memory-layer/models/memory-record';
import { PostgresStore } from '../src/memory-layer/storage/postgres-store';
import { register } from '../src/observability/metrics';

describe('Encryption Roundtrip', () => {
  let store: PostgresStore;
  const testHashedPseudonym = 'hs_test_encryption_' + uuidv4();

  beforeAll(async () => {
    // Enable encryption for these tests
    process.env.ENCRYPTION_ENABLED = 'true';
    process.env.PERSISTENCE = 'postgres';

    // Initialize store
    store = new PostgresStore();

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup test records
    try {
      await store.clear();
    } catch {
      // clear() not implemented yet - OK
    }

    await store.close();
    process.env.ENCRYPTION_ENABLED = 'false';
  });

  it('should encrypt and decrypt text content', async () => {
    const record: MemoryRecord = {
      id: uuidv4(),
      hashed_pseudonym: testHashedPseudonym,
      session_id: 'session_1',
      content: {
        type: 'text',
        data: 'This is secret text that should be encrypted at rest',
        metadata: { source: 'test' },
      },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
      audit_receipt_id: uuidv4(),
    };

    // Store with encryption
    const stored = await store.store(record);
    expect(stored.id).toBe(record.id);

    // Recall and verify decryption
    const recalled = await store.recall({
      hashed_pseudonym: testHashedPseudonym,
      limit: 10,
    });

    expect(recalled.length).toBeGreaterThan(0);
    const found = recalled.find((r) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found!.content.data).toBe(record.content.data);
    expect(found!.content.type).toBe('text');
  });

  it('should encrypt and decrypt structured content', async () => {
    const record: MemoryRecord = {
      id: uuidv4(),
      hashed_pseudonym: testHashedPseudonym,
      session_id: 'session_2',
      content: {
        type: 'structured',
        data: {
          user_action: 'purchase',
          items: ['item1', 'item2'],
          total: 42.99,
          nested: {
            deep: {
              value: 'encrypted',
            },
          },
        },
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

    const recalled = await store.recall({
      hashed_pseudonym: testHashedPseudonym,
      limit: 10,
    });

    const found = recalled.find((r) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found!.content.data).toEqual(record.content.data);
  });

  it('should emit crypto metrics', async () => {
    // Capture metrics before operation
    const _metricsBefore = await register.metrics();

    const record: MemoryRecord = {
      id: uuidv4(),
      hashed_pseudonym: testHashedPseudonym,
      content: {
        type: 'text',
        data: 'Metrics test content',
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
    await store.recall({ hashed_pseudonym: testHashedPseudonym, limit: 1 });

    // Check metrics after
    const metricsAfter = await register.metrics();

    // Should have crypto_ops_duration_ms metrics
    expect(metricsAfter).toContain('crypto_ops_duration_ms');
    expect(metricsAfter).toContain('op="encrypt"');
    expect(metricsAfter).toContain('op="decrypt"');
  });

  it('should handle encryption disabled mode', async () => {
    // Temporarily disable encryption
    process.env.ENCRYPTION_ENABLED = 'false';

    const record: MemoryRecord = {
      id: uuidv4(),
      hashed_pseudonym: testHashedPseudonym,
      content: {
        type: 'text',
        data: 'Plaintext storage',
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

    const recalled = await store.recall({
      hashed_pseudonym: testHashedPseudonym,
      limit: 10,
    });

    const found = recalled.find((r) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found!.content.data).toBe(record.content.data);

    // Re-enable for other tests
    process.env.ENCRYPTION_ENABLED = 'true';
  });

  it('should preserve metadata during encryption', async () => {
    const record: MemoryRecord = {
      id: uuidv4(),
      hashed_pseudonym: testHashedPseudonym,
      content: {
        type: 'structured',
        data: { value: 'encrypted data' },
        metadata: {
          source: 'test-suite',
          version: '2.0',
          tags: ['encryption', 'roundtrip'],
        },
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

    const recalled = await store.recall({
      hashed_pseudonym: testHashedPseudonym,
      limit: 10,
    });

    const found = recalled.find((r) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found!.content.metadata).toEqual(record.content.metadata);
  });
});
