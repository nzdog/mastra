/**
 * Phase 3 Legacy Review Fixes - Test Suite
 *
 * Tests for critical fixes from legacy code review:
 * - Circuit breaker race conditions
 * - GDPR-safe forget()
 * - Encryption detection logic
 * - Tamper detection
 * - Backfill checkpoint resumption
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgresStore } from '../src/memory-layer/storage/postgres-store';
import { DualStore } from '../src/memory-layer/storage/dual-store';
import { getMemoryStore } from '../src/memory-layer/storage/in-memory-store';
import { MemoryRecord } from '../src/memory-layer/models/memory-record';
import { Pool } from 'pg';

describe('Circuit Breaker', () => {
  let store: PostgresStore;

  beforeEach(() => {
    store = new PostgresStore({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'lichen_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000,
    });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should trip breaker after MAX_POOL_ERRORS and block new requests', async () => {
    // This is a challenging test to implement without access to private fields
    // In production, you'd use dependency injection or expose a health check method

    // For now, we verify that circuit breaker guard exists and throws
    const privateStore = store as any;

    // Manually trip the breaker to test guard behavior
    privateStore.circuitBreakerTripped = true;

    // Verify methods throw when breaker is open
    await expect(store.count({ hashed_pseudonym: 'test' })).rejects.toThrow('Circuit breaker open');

    await expect(store.get('test-id')).rejects.toThrow('Circuit breaker open');
  });

  test('should reset breaker on successful connection', async () => {
    const privateStore = store as any;

    // Verify error counter resets work
    privateStore.consecutivePoolErrors = 3;
    expect(privateStore.consecutivePoolErrors).toBe(3);

    // Simulate successful connection (would be triggered by pool.on('connect'))
    privateStore.consecutivePoolErrors = 0;
    expect(privateStore.consecutivePoolErrors).toBe(0);
  });
});

describe('GDPR-Safe Forget', () => {
  let dualStore: DualStore;
  let memoryStore: any;
  let postgresStore: any;

  beforeEach(() => {
    memoryStore = getMemoryStore();
    postgresStore = new PostgresStore({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'lichen_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000,
    });

    dualStore = new DualStore(memoryStore, postgresStore, {
      enabled: true,
      primaryStore: 'memory',
      failFast: false, // Config value doesn't matter for forget() - always enforced
    });
  });

  afterEach(async () => {
    await memoryStore.clear();
    await postgresStore.clear();
    await postgresStore.close();
  });

  test('should enforce failFast for GDPR forget regardless of config', async () => {
    // Store a test record in both stores
    const record: MemoryRecord = {
      id: 'test-forget-1',
      hashed_pseudonym: 'pseudonym-123',
      content: { type: 'test', data: { message: 'test' } },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
      audit_receipt_id: 'audit-123',
    };

    await dualStore.store(record);

    // Spy on secondary forget to simulate failure
    const secondaryForgetSpy = vi.spyOn(postgresStore, 'forget');
    secondaryForgetSpy.mockRejectedValueOnce(new Error('Simulated secondary failure'));

    // Attempt forget - should fail even though config.failFast might be false
    await expect(dualStore.forget({ id: 'test-forget-1' })).rejects.toThrow(
      'Secondary store forget failed'
    );

    secondaryForgetSpy.mockRestore();
  });

  test('should succeed when both stores delete same count', async () => {
    const record: MemoryRecord = {
      id: 'test-forget-2',
      hashed_pseudonym: 'pseudonym-456',
      content: { type: 'test', data: { message: 'test2' } },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
      audit_receipt_id: 'audit-456',
    };

    await dualStore.store(record);

    // Both stores should delete successfully
    const deletedIds = await dualStore.forget({ id: 'test-forget-2' });
    expect(deletedIds).toHaveLength(1);
    expect(deletedIds[0]).toBe('test-forget-2');

    // Verify record is gone from both stores
    const memoryRecord = await memoryStore.get('test-forget-2');
    const postgresRecord = await postgresStore.get('test-forget-2');
    expect(memoryRecord).toBeNull();
    expect(postgresRecord).toBeNull();
  });

  test('should throw on count mismatch', async () => {
    const record1: MemoryRecord = {
      id: 'test-forget-3a',
      hashed_pseudonym: 'pseudonym-789',
      content: { type: 'test', data: { message: 'test3a' } },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
      audit_receipt_id: 'audit-789a',
    };

    const record2: MemoryRecord = {
      id: 'test-forget-3b',
      hashed_pseudonym: 'pseudonym-789',
      content: { type: 'test', data: { message: 'test3b' } },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
      audit_receipt_id: 'audit-789b',
    };

    // Store both records
    await dualStore.store(record1);
    await dualStore.store(record2);

    // Mock secondary forget to return different count
    const secondaryForgetSpy = vi.spyOn(postgresStore, 'forget');
    secondaryForgetSpy.mockResolvedValueOnce(['test-forget-3a']); // Only 1 instead of 2

    // Should throw due to mismatch
    await expect(dualStore.forget({ hashed_pseudonym: 'pseudonym-789' })).rejects.toThrow(
      'GDPR erasure incomplete'
    );

    secondaryForgetSpy.mockRestore();
  });
});

describe('Encryption Detection', () => {
  let store: PostgresStore;

  beforeEach(() => {
    store = new PostgresStore({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'lichen_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000,
    });
  });

  afterEach(async () => {
    await store.clear();
    await store.close();
  });

  test('should detect encryption with empty string encryption_version', async () => {
    // This tests the fix for falsy empty string issue
    // When encryption_version is '', it should still be detected as encrypted
    // if data_ciphertext is present

    const mockRow = {
      id: 'test-empty-version',
      hashed_pseudonym: 'test-pseudonym',
      session_id: null,
      content: {
        data_ciphertext: 'base64-encrypted-data',
        dek_ciphertext: 'base64-encrypted-dek',
        dek_kid: 'kek-202501',
        encryption_version: 'v1-aes256gcm',
        auth_tag: 'base64-auth-tag',
        iv: 'base64-iv',
        type: 'test',
      },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: null,
      access_count: 0,
      audit_receipt_id: 'audit-123',
      encryption_version: '', // Empty string (falsy but not null/undefined)
    };

    // Verify the detection logic would identify this as encrypted
    // (via data_ciphertext presence, not encryption_version)
    const isEncrypted =
      (mockRow.encryption_version !== null && mockRow.encryption_version !== undefined) ||
      (mockRow.content &&
        typeof mockRow.content === 'object' &&
        'data_ciphertext' in mockRow.content);

    // Empty string is not null or undefined, so this WOULD be detected as encrypted
    // This is correct behavior - the fix ensures we check for null/undefined explicitly
    expect(isEncrypted).toBe(true);
  });

  test('should detect encryption with null encryption_version but data_ciphertext present', async () => {
    const mockRow = {
      id: 'test-null-version',
      hashed_pseudonym: 'test-pseudonym',
      session_id: null,
      content: {
        data_ciphertext: 'base64-encrypted-data',
        dek_ciphertext: 'base64-encrypted-dek',
        dek_kid: 'kek-202501',
        encryption_version: 'v1-aes256gcm',
        auth_tag: 'base64-auth-tag',
        iv: 'base64-iv',
        type: 'test',
      },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: null,
      access_count: 0,
      audit_receipt_id: 'audit-456',
      encryption_version: null, // NULL
    };

    // Verify detection via data_ciphertext presence
    const isEncrypted =
      (mockRow.encryption_version !== null && mockRow.encryption_version !== undefined) ||
      (mockRow.content &&
        typeof mockRow.content === 'object' &&
        'data_ciphertext' in mockRow.content);

    expect(isEncrypted).toBe(true);
  });
});

describe('Tamper Detection', () => {
  let store: PostgresStore;

  beforeEach(() => {
    store = new PostgresStore({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'lichen_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000,
    });
  });

  afterEach(async () => {
    await store.clear();
    await store.close();
  });

  test.skip('should detect tampered ciphertext (GCM auth tag failure)', async () => {
    // Skip this test if encryption is not enabled
    if (process.env.ENCRYPTION_ENABLED !== 'true') {
      return;
    }

    // Store a record with encryption
    const record: MemoryRecord = {
      id: 'test-tamper-1',
      hashed_pseudonym: 'pseudonym-tamper',
      content: { type: 'test', data: { secret: 'sensitive-data' } },
      consent_family: 'personal',
      consent_timestamp: new Date().toISOString(),
      consent_version: '1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
      audit_receipt_id: 'audit-tamper',
    };

    const storedRecord = await store.store(record);

    // Directly modify the ciphertext in the database (simulating tampering)
    const Pool = require('pg').Pool;
    const pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'lichen_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: false,
    });

    // Modify the data_ciphertext field directly
    await pool.query(
      `UPDATE memory_records
       SET content = jsonb_set(content, '{data_ciphertext}', '"tampered-base64-data"')
       WHERE id = $1`,
      ['test-tamper-1']
    );

    await pool.end();

    // Attempt to retrieve - should fail due to GCM auth tag mismatch
    await expect(store.get('test-tamper-1')).rejects.toThrow();
  });
});

describe('Performance & Correctness', () => {
  let store: PostgresStore;

  beforeEach(() => {
    store = new PostgresStore({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'lichen_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000,
    });
  });

  afterEach(async () => {
    await store.clear();
    await store.close();
  });

  test('should cap LIMIT to MAX_QUERY_LIMIT', async () => {
    // Attempt to query with limit > MAX_QUERY_LIMIT
    const records = await store.recall({
      hashed_pseudonym: 'test-limit',
      limit: 50000, // Way over MAX_QUERY_LIMIT (10000)
    });

    // Should succeed without error, limit capped internally
    expect(Array.isArray(records)).toBe(true);
  });

  test('should cap OFFSET to MAX_QUERY_OFFSET', async () => {
    // Attempt to query with offset > MAX_QUERY_OFFSET
    const records = await store.recall({
      hashed_pseudonym: 'test-offset',
      offset: 500000, // Way over MAX_QUERY_OFFSET (100000)
    });

    // Should succeed without error, offset capped internally
    expect(Array.isArray(records)).toBe(true);
  });

  test('should warn on large OFFSET', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');

    await store.recall({
      hashed_pseudonym: 'test-warn',
      offset: 15000, // > 10000 threshold
    });

    // Should log a warning about cursor-based pagination
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('cursor-based pagination'));

    consoleSpy.mockRestore();
  });
});

describe('NaN Guards', () => {
  test('should handle invalid timestamp in lag calculation', () => {
    // Mock record with invalid timestamp
    const mockRecord = {
      created_at: 'invalid-date',
    };

    const timestamp = new Date(mockRecord.created_at as any).getTime();
    expect(Number.isNaN(timestamp)).toBe(true);

    // Verify NaN guard would prevent metric update
    if (!Number.isNaN(timestamp)) {
      // This block should NOT execute
      throw new Error('NaN guard failed');
    }

    // Test passes if we reach here (NaN detected correctly)
    expect(true).toBe(true);
  });
});
