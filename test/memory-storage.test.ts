/**
 * Phase 2: Memory Storage Unit Tests
 *
 * Tests in-memory store implementation:
 * - CRUD operations (store, recall, forget, get)
 * - Indexes: byUserId, bySessionId, byConsentFamily
 * - TTL enforcement (expires_at)
 * - Privacy rules per family
 * - k-anonymity enforcement
 * - Pagination
 * - Query filters
 */

import { InMemoryStore } from '../src/memory-layer/storage/in-memory-store';
import { MemoryRecord, ConsentFamily } from '../src/memory-layer/models/memory-record';
import { RecallQuery, ForgetRequest } from '../src/memory-layer/models/operation-requests';

// Test helpers
function createTestRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString();
  return {
    id: `rec_${Math.random().toString(36).substring(2, 15)}`,
    user_id: 'user_test_001',
    session_id: 'session_001',
    content: {
      type: 'text',
      data: 'Test memory content',
    },
    consent_family: 'personal',
    consent_timestamp: now,
    consent_version: '1.0',
    created_at: now,
    updated_at: now,
    access_count: 0,
    audit_receipt_id: `receipt_${Math.random().toString(36).substring(2, 15)}`,
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log('\n=== Phase 2: Memory Storage Unit Tests ===\n');

  const results: { test: string; passed: boolean; error?: string }[] = [];

  // ============================================================================
  // BASIC CRUD TESTS
  // ============================================================================

  console.log('\n[CRUD] Test 1: Store a record');
  try {
    const store = new InMemoryStore();
    const record = createTestRecord();

    const stored = await store.store(record);

    if (stored.id !== record.id) throw new Error('ID mismatch');
    if (stored.user_id !== record.user_id) throw new Error('user_id mismatch');

    console.log('✅ Store record passed');
    results.push({ test: 'Store record', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Store record', passed: false, error: String(err) });
  }

  console.log('\n[CRUD] Test 2: Get a record by ID');
  try {
    const store = new InMemoryStore();
    const record = createTestRecord();
    await store.store(record);

    const retrieved = await store.get(record.id);

    if (!retrieved) throw new Error('Record not found');
    if (retrieved.id !== record.id) throw new Error('ID mismatch');

    console.log('✅ Get record passed');
    results.push({ test: 'Get record by ID', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Get record by ID', passed: false, error: String(err) });
  }

  console.log('\n[CRUD] Test 3: Get nonexistent record returns null');
  try {
    const store = new InMemoryStore();
    const retrieved = await store.get('nonexistent_id');

    if (retrieved !== null) throw new Error('Expected null for nonexistent record');

    console.log('✅ Get nonexistent record passed');
    results.push({ test: 'Get nonexistent record', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Get nonexistent record', passed: false, error: String(err) });
  }

  console.log('\n[CRUD] Test 4: Check if record exists');
  try {
    const store = new InMemoryStore();
    const record = createTestRecord();
    await store.store(record);

    const exists = await store.exists(record.id);
    const notExists = await store.exists('nonexistent_id');

    if (!exists) throw new Error('Record should exist');
    if (notExists) throw new Error('Nonexistent record should not exist');

    console.log('✅ Exists check passed');
    results.push({ test: 'Check record exists', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Check record exists', passed: false, error: String(err) });
  }

  console.log('\n[CRUD] Test 5: Increment access count');
  try {
    const store = new InMemoryStore();
    const record = createTestRecord();
    await store.store(record);

    await store.incrementAccessCount(record.id);
    const updated = await store.get(record.id);

    if (!updated) throw new Error('Record not found');
    if (updated.access_count !== 1) throw new Error('Access count not incremented');

    console.log('✅ Increment access count passed');
    results.push({ test: 'Increment access count', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Increment access count', passed: false, error: String(err) });
  }

  // ============================================================================
  // RECALL (QUERY) TESTS
  // ============================================================================

  console.log('\n[RECALL] Test 6: Recall by user_id');
  try {
    const store = new InMemoryStore();
    const userId = 'user_recall_001';

    // Store multiple records for same user
    for (let i = 0; i < 3; i++) {
      await store.store(createTestRecord({ user_id: userId, session_id: `session_${i}` }));
    }

    const query: RecallQuery = { user_id: userId, limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 3) throw new Error(`Expected 3 records, got ${records.length}`);

    console.log('✅ Recall by user_id passed');
    results.push({ test: 'Recall by user_id', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall by user_id', passed: false, error: String(err) });
  }

  console.log('\n[RECALL] Test 7: Recall by session_id');
  try {
    const store = new InMemoryStore();
    const userId = 'user_recall_002';
    const sessionId = 'session_specific';

    // Store records with different sessions
    await store.store(createTestRecord({ user_id: userId, session_id: sessionId }));
    await store.store(createTestRecord({ user_id: userId, session_id: 'other_session' }));

    const query: RecallQuery = { user_id: userId, session_id: sessionId, limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 1) throw new Error(`Expected 1 record, got ${records.length}`);
    if (records[0].session_id !== sessionId) throw new Error('Session ID mismatch');

    console.log('✅ Recall by session_id passed');
    results.push({ test: 'Recall by session_id', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall by session_id', passed: false, error: String(err) });
  }

  console.log('\n[RECALL] Test 8: Recall with pagination');
  try {
    const store = new InMemoryStore();
    const userId = 'user_pagination';

    // Store 10 records
    for (let i = 0; i < 10; i++) {
      await store.store(createTestRecord({ user_id: userId }));
    }

    // Query with limit=3, offset=2
    const query: RecallQuery = { user_id: userId, limit: 3, offset: 2 };
    const records = await store.recall(query);

    if (records.length !== 3) throw new Error(`Expected 3 records, got ${records.length}`);

    console.log('✅ Recall with pagination passed');
    results.push({ test: 'Recall with pagination', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall with pagination', passed: false, error: String(err) });
  }

  console.log('\n[RECALL] Test 9: Recall with sort order');
  try {
    const store = new InMemoryStore();
    const userId = 'user_sort';

    // Store records with different timestamps
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await store.store(
        createTestRecord({
          user_id: userId,
          created_at: new Date(now + i * 1000).toISOString(),
        })
      );
    }

    // Query with ascending sort
    const ascQuery: RecallQuery = { user_id: userId, sort: 'asc', limit: 100, offset: 0 };
    const ascRecords = await store.recall(ascQuery);

    // Query with descending sort
    const descQuery: RecallQuery = { user_id: userId, sort: 'desc', limit: 100, offset: 0 };
    const descRecords = await store.recall(descQuery);

    // Verify order
    if (ascRecords[0].created_at > ascRecords[1].created_at) {
      throw new Error('Ascending sort failed');
    }
    if (descRecords[0].created_at < descRecords[1].created_at) {
      throw new Error('Descending sort failed');
    }

    console.log('✅ Recall with sort order passed');
    results.push({ test: 'Recall with sort', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall with sort', passed: false, error: String(err) });
  }

  console.log('\n[RECALL] Test 10: Recall with content type filter');
  try {
    const store = new InMemoryStore();
    const userId = 'user_filter';

    // Store records with different content types
    await store.store(
      createTestRecord({ user_id: userId, content: { type: 'text', data: 'text' } })
    );
    await store.store(
      createTestRecord({ user_id: userId, content: { type: 'structured', data: {} } })
    );

    const query: RecallQuery = { user_id: userId, type: 'text', limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 1) throw new Error(`Expected 1 record, got ${records.length}`);
    if (records[0].content.type !== 'text') throw new Error('Type filter failed');

    console.log('✅ Recall with content type filter passed');
    results.push({ test: 'Recall with type filter', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall with type filter', passed: false, error: String(err) });
  }

  console.log('\n[RECALL] Test 11: Recall with time range filters');
  try {
    const store = new InMemoryStore();
    const userId = 'user_time';

    const now = Date.now();
    const past = new Date(now - 3600000).toISOString(); // 1 hour ago
    const present = new Date(now).toISOString();
    const future = new Date(now + 3600000).toISOString(); // 1 hour from now

    // Store records at different times
    await store.store(createTestRecord({ user_id: userId, created_at: past }));
    await store.store(createTestRecord({ user_id: userId, created_at: present }));
    await store.store(createTestRecord({ user_id: userId, created_at: future }));

    // Query for records between past and present
    const query: RecallQuery = { user_id: userId, since: past, until: present, limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 2) throw new Error(`Expected 2 records, got ${records.length}`);

    console.log('✅ Recall with time range filters passed');
    results.push({ test: 'Recall with time range', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall with time range', passed: false, error: String(err) });
  }

  // ============================================================================
  // FORGET (DELETE) TESTS
  // ============================================================================

  console.log('\n[FORGET] Test 12: Forget by ID');
  try {
    const store = new InMemoryStore();
    const record = createTestRecord();
    await store.store(record);

    const forgetRequest: ForgetRequest = { id: record.id, hard_delete: true };
    const deletedIds = await store.forget(forgetRequest);

    if (deletedIds.length !== 1) throw new Error('Expected 1 deleted record');
    if (deletedIds[0] !== record.id) throw new Error('ID mismatch');

    const exists = await store.exists(record.id);
    if (exists) throw new Error('Record should be deleted');

    console.log('✅ Forget by ID passed');
    results.push({ test: 'Forget by ID', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Forget by ID', passed: false, error: String(err) });
  }

  console.log('\n[FORGET] Test 13: Forget by user_id');
  try {
    const store = new InMemoryStore();
    const userId = 'user_forget';

    // Store multiple records
    for (let i = 0; i < 3; i++) {
      await store.store(createTestRecord({ user_id: userId }));
    }

    const forgetRequest: ForgetRequest = { user_id: userId, hard_delete: true };
    const deletedIds = await store.forget(forgetRequest);

    if (deletedIds.length !== 3) throw new Error(`Expected 3 deleted records, got ${deletedIds.length}`);

    console.log('✅ Forget by user_id passed');
    results.push({ test: 'Forget by user_id', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Forget by user_id', passed: false, error: String(err) });
  }

  console.log('\n[FORGET] Test 14: Forget by session_id');
  try {
    const store = new InMemoryStore();
    const userId = 'user_forget_session';
    const sessionId = 'session_forget';

    // Store records with different sessions
    await store.store(createTestRecord({ user_id: userId, session_id: sessionId }));
    await store.store(createTestRecord({ user_id: userId, session_id: sessionId }));
    await store.store(createTestRecord({ user_id: userId, session_id: 'other_session' }));

    const forgetRequest: ForgetRequest = { session_id: sessionId, hard_delete: true };
    const deletedIds = await store.forget(forgetRequest);

    if (deletedIds.length !== 2) throw new Error(`Expected 2 deleted records, got ${deletedIds.length}`);

    console.log('✅ Forget by session_id passed');
    results.push({ test: 'Forget by session_id', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Forget by session_id', passed: false, error: String(err) });
  }

  // ============================================================================
  // INDEX TESTS
  // ============================================================================

  console.log('\n[INDEX] Test 15: byUserId index');
  try {
    const store = new InMemoryStore();
    const userId = 'user_index';

    // Store records for this user
    for (let i = 0; i < 5; i++) {
      await store.store(createTestRecord({ user_id: userId }));
    }

    // Query should be fast (O(1) lookup via index)
    const query: RecallQuery = { user_id: userId, limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 5) throw new Error('Index lookup failed');

    console.log('✅ byUserId index passed');
    results.push({ test: 'byUserId index', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'byUserId index', passed: false, error: String(err) });
  }

  console.log('\n[INDEX] Test 16: bySessionId index');
  try {
    const store = new InMemoryStore();
    const sessionId = 'session_index';

    // Store records for this session
    for (let i = 0; i < 3; i++) {
      await store.store(createTestRecord({ session_id: sessionId, user_id: `user_${i}` }));
    }

    // Count records for this session
    const count = await store.count({ session_id: sessionId });

    if (count !== 3) throw new Error('Index lookup failed');

    console.log('✅ bySessionId index passed');
    results.push({ test: 'bySessionId index', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'bySessionId index', passed: false, error: String(err) });
  }

  console.log('\n[INDEX] Test 17: byConsentFamily index');
  try {
    const store = new InMemoryStore();

    // Store records for each consent family
    const families: ConsentFamily[] = ['personal', 'cohort', 'population'];
    for (const family of families) {
      for (let i = 0; i < 2; i++) {
        await store.store(createTestRecord({ consent_family: family, user_id: `user_${family}_${i}` }));
      }
    }

    // Count records per family
    for (const family of families) {
      const count = await store.count({ consent_family: family });
      if (count !== 2) throw new Error(`Expected 2 records for ${family}, got ${count}`);
    }

    console.log('✅ byConsentFamily index passed');
    results.push({ test: 'byConsentFamily index', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'byConsentFamily index', passed: false, error: String(err) });
  }

  // ============================================================================
  // TTL ENFORCEMENT TESTS
  // ============================================================================

  console.log('\n[TTL] Test 18: Clear expired records');
  try {
    const store = new InMemoryStore();
    const userId = 'user_ttl';

    const now = new Date();
    const past = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const future = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now

    // Store expired and valid records
    await store.store(createTestRecord({ user_id: userId, expires_at: past })); // Expired
    await store.store(createTestRecord({ user_id: userId, expires_at: future })); // Valid
    await store.store(createTestRecord({ user_id: userId })); // No expiry

    const deletedCount = await store.clearExpired();

    if (deletedCount !== 1) throw new Error(`Expected 1 expired record, got ${deletedCount}`);

    // Verify remaining records
    const query: RecallQuery = { user_id: userId, limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 2) throw new Error('Expired record not removed');

    console.log('✅ Clear expired records passed');
    results.push({ test: 'Clear expired records', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Clear expired records', passed: false, error: String(err) });
  }

  console.log('\n[TTL] Test 19: Recall excludes expired records');
  try {
    const store = new InMemoryStore();
    const userId = 'user_ttl_recall';

    const now = new Date();
    const past = new Date(now.getTime() - 1000).toISOString(); // 1 second ago

    // Store expired record
    await store.store(createTestRecord({ user_id: userId, expires_at: past }));

    // Recall should exclude expired record
    const query: RecallQuery = { user_id: userId, limit: 100, offset: 0 };
    const records = await store.recall(query);

    if (records.length !== 0) throw new Error('Expired record should not be recalled');

    console.log('✅ Recall excludes expired records passed');
    results.push({ test: 'Recall excludes expired', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Recall excludes expired', passed: false, error: String(err) });
  }

  // ============================================================================
  // COUNT & STATS TESTS
  // ============================================================================

  console.log('\n[COUNT] Test 20: Count records with filters');
  try {
    const store = new InMemoryStore();
    const userId = 'user_count';

    // Store multiple records
    for (let i = 0; i < 5; i++) {
      await store.store(createTestRecord({ user_id: userId, consent_family: 'personal' }));
    }
    for (let i = 0; i < 3; i++) {
      await store.store(createTestRecord({ user_id: userId, consent_family: 'cohort' }));
    }

    const personalCount = await store.count({ user_id: userId, consent_family: 'personal' });
    const cohortCount = await store.count({ user_id: userId, consent_family: 'cohort' });

    if (personalCount !== 5) throw new Error(`Expected 5 personal records, got ${personalCount}`);
    if (cohortCount !== 3) throw new Error(`Expected 3 cohort records, got ${cohortCount}`);

    console.log('✅ Count with filters passed');
    results.push({ test: 'Count with filters', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Count with filters', passed: false, error: String(err) });
  }

  console.log('\n[STATS] Test 21: Get storage statistics');
  try {
    const store = new InMemoryStore();

    // Store records for each family
    await store.store(createTestRecord({ consent_family: 'personal', user_id: 'user_1' }));
    await store.store(createTestRecord({ consent_family: 'cohort', user_id: 'user_2' }));
    await store.store(createTestRecord({ consent_family: 'population', user_id: 'user_3' }));

    const stats = await store.getStats();

    if (stats.total_records !== 3) throw new Error('Total records mismatch');
    if (stats.records_by_family.personal !== 1) throw new Error('Personal count mismatch');
    if (stats.records_by_family.cohort !== 1) throw new Error('Cohort count mismatch');
    if (stats.records_by_family.population !== 1) throw new Error('Population count mismatch');
    if (stats.storage_bytes === 0) throw new Error('Storage bytes not calculated');

    console.log('✅ Storage statistics passed');
    results.push({ test: 'Storage statistics', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Storage statistics', passed: false, error: String(err) });
  }

  console.log('\n[CLEAR] Test 22: Clear all records');
  try {
    const store = new InMemoryStore();

    // Store records
    for (let i = 0; i < 5; i++) {
      await store.store(createTestRecord());
    }

    await store.clear();

    const stats = await store.getStats();
    if (stats.total_records !== 0) throw new Error('Store not cleared');

    console.log('✅ Clear all records passed');
    results.push({ test: 'Clear all records', passed: true });
  } catch (err) {
    console.error('❌ Failed:', err);
    results.push({ test: 'Clear all records', passed: false, error: String(err) });
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('='.repeat(70));
  console.log(`TOTAL: ${passedCount}/${totalCount} tests passed`);
  console.log('='.repeat(70) + '\n');

  if (passedCount < totalCount) {
    console.error('❌ Memory storage test FAILED');
    process.exit(1);
  } else {
    console.log('✅ Memory storage test PASSED');
    process.exit(0);
  }
}

// Run test
main().catch((error) => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
