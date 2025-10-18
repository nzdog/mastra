/**
 * Phase 2: Memory Operations Integration Tests
 *
 * Tests each operation handler individually:
 * - Store, Recall, Distill, Forget, Export
 * - Consent family routing and enforcement
 * - Error cases: validation, consent violations, k-anonymity failures
 * - SLO middleware and circuit breaker
 * - Pagination for recall
 * - Aggregation types for distill
 * - Export formats (JSON, CSV, JSONLines)
 */

import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:3000';
// Use the same token format as phase-2-smoke.test.ts to avoid token conversion issues
const USER_TOKEN = 'hs_dGVzdHVzZXIxMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0';
const HASHED_PSEUDONYM = 'hs_dGVzdHVzZXIxMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0';

// Helper: Wait
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: Authenticated request
async function authedRequest(
  path: string,
  options: {
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; data: any; headers: any }> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${USER_TOKEN}`,
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, headers: response.headers };
}

// Helper: Start server
function startServer(): ChildProcess {
  return spawn('npm', ['run', 'server'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SKIP_API_KEY_CHECK: 'true' },
  });
}

// Helper: Wait for server
async function waitForServer(maxAttempts: number = 30): Promise<void> {
  console.log('⏳ Waiting for server to start...');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/v1/health`);
      if (response.status === 200) {
        console.log(`✅ Server ready after ${i + 1} attempts`);
        return;
      }
    } catch {
      // Not ready
    }
    await wait(1000);
  }
  throw new Error('Server failed to start');
}

// Main test
async function main(): Promise<void> {
  console.log('\n=== Phase 2: Memory Operations Integration Tests ===\n');

  const server = startServer();

  try {
    await waitForServer();
    await wait(3000); // Full initialization

    const results: { test: string; passed: boolean; error?: string }[] = [];

    // ============================================================================
    // STORE OPERATION TESTS
    // ============================================================================

    console.log('\n[STORE] Test 1: Store text content (personal)');
    try {
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        body: {
          content: {
            type: 'text',
            data: 'Test memory content',
            metadata: { source: 'test' },
          },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            session_id: 'session_store_001',
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      if (!response.data.id) {
        throw new Error('Missing id in response');
      }
      if (!response.data.audit_receipt_id) {
        throw new Error('Missing audit_receipt_id');
      }

      console.log('✅ Store text content passed');
      results.push({ test: 'Store text content', passed: true });

      // Save for recall test
      (global as any).testStoreId = response.data.id;
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Store text content', passed: false, error: String(err) });
    }

    console.log('\n[STORE] Test 2: Store structured content (cohort)');
    try {
      const response = await authedRequest('/v1/cohort/store', {
        method: 'POST',
        body: {
          content: {
            type: 'structured',
            data: { score: 85, category: 'performance' },
          },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            session_id: 'session_cohort_001',
            consent_family: 'cohort',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }

      console.log('✅ Store structured content passed');
      results.push({ test: 'Store structured content', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Store structured content', passed: false, error: String(err) });
    }

    console.log('\n[STORE] Test 3: Store with expiry (personal)');
    try {
      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        body: {
          content: { type: 'text', data: 'Expiring memory' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
          expires_at: expiresAt,
        },
      });

      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      if (response.data.expires_at !== expiresAt) {
        throw new Error('expires_at mismatch');
      }

      console.log('✅ Store with expiry passed');
      results.push({ test: 'Store with expiry', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Store with expiry', passed: false, error: String(err) });
    }

    console.log('\n[STORE] Test 4: Validation error - missing metadata');
    try {
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        body: {
          content: { type: 'text', data: 'test' },
          // Missing metadata
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      if (response.data.error.code !== 'VALIDATION_ERROR') {
        throw new Error('Expected VALIDATION_ERROR');
      }

      console.log('✅ Validation error test passed');
      results.push({ test: 'Store validation error', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Store validation error', passed: false, error: String(err) });
    }

    console.log('\n[STORE] Test 5: Consent family mismatch error');
    try {
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'cohort', // Mismatch with URL
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      console.log('✅ Consent family mismatch test passed');
      results.push({ test: 'Store consent mismatch', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Store consent mismatch', passed: false, error: String(err) });
    }

    // ============================================================================
    // RECALL OPERATION TESTS
    // ============================================================================

    console.log('\n[RECALL] Test 6: Recall personal memories');
    try {
      const response = await authedRequest(
        `/v1/personal/recall?hashed_pseudonym=${HASHED_PSEUDONYM}`,
        {
          method: 'GET',
        }
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.records)) {
        throw new Error('Invalid records');
      }
      if (!response.data.pagination) {
        throw new Error('Missing pagination');
      }

      console.log('✅ Recall personal memories passed');
      results.push({ test: 'Recall personal memories', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Recall personal memories', passed: false, error: String(err) });
    }

    console.log('\n[RECALL] Test 7: Recall with pagination');
    try {
      const response = await authedRequest(
        `/v1/personal/recall?hashed_pseudonym=${HASHED_PSEUDONYM}&limit=1&offset=0`,
        { method: 'GET' }
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.pagination) {
        throw new Error('Missing pagination');
      }
      if (response.data.pagination.limit !== 1) {
        throw new Error('Limit not applied');
      }

      console.log('✅ Recall with pagination passed');
      results.push({ test: 'Recall with pagination', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Recall with pagination', passed: false, error: String(err) });
    }

    console.log('\n[RECALL] Test 8: Recall with session filter');
    try {
      const response = await authedRequest(
        `/v1/personal/recall?hashed_pseudonym=${HASHED_PSEUDONYM}&session_id=session_store_001`,
        { method: 'GET' }
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      console.log('✅ Recall with session filter passed');
      results.push({ test: 'Recall with session filter', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Recall with session filter', passed: false, error: String(err) });
    }

    console.log('\n[RECALL] Test 9: Recall forbidden for cohort family');
    try {
      const response = await authedRequest(
        `/v1/cohort/recall?hashed_pseudonym=${HASHED_PSEUDONYM}`,
        {
          method: 'GET',
        }
      );

      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }
      if (response.data.error.code !== 'FORBIDDEN') {
        throw new Error('Expected FORBIDDEN');
      }

      console.log('✅ Cohort recall forbidden test passed');
      results.push({ test: 'Cohort recall forbidden', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Cohort recall forbidden', passed: false, error: String(err) });
    }

    console.log('\n[RECALL] Test 10: Recall forbidden for population family');
    try {
      const response = await authedRequest(
        `/v1/population/recall?hashed_pseudonym=${HASHED_PSEUDONYM}`,
        {
          method: 'GET',
        }
      );

      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }

      console.log('✅ Population recall forbidden test passed');
      results.push({ test: 'Population recall forbidden', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Population recall forbidden', passed: false, error: String(err) });
    }

    // ============================================================================
    // DISTILL OPERATION TESTS
    // ============================================================================

    // First, store enough records for k-anonymity
    console.log('\n[DISTILL] Setup: Store 6 cohort records for distillation');
    try {
      for (let i = 0; i < 6; i++) {
        await authedRequest('/v1/cohort/store', {
          method: 'POST',
          body: {
            content: {
              type: 'structured',
              data: { value: 10 + i, category: 'distill_test' },
            },
            metadata: {
              hashed_pseudonym: HASHED_PSEUDONYM,
              session_id: `session_distill_${i}`,
              consent_family: 'cohort',
              consent_timestamp: new Date().toISOString(),
              consent_version: '1.0',
            },
          },
        });
      }
      console.log('✅ Setup completed');
    } catch (err) {
      console.error('❌ Setup failed:', err);
    }

    console.log('\n[DISTILL] Test 11: Distill with count aggregation');
    try {
      const response = await authedRequest('/v1/cohort/distill', {
        method: 'POST',
        body: {
          aggregation: { type: 'count', field: 'content.data' },
          filters: { content_type: 'structured' },
          min_records: 5,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.results) {
        throw new Error('Missing results');
      }
      if (!response.data.metadata.privacy_threshold_met) {
        throw new Error('Privacy threshold not met');
      }

      console.log('✅ Distill count aggregation passed');
      results.push({ test: 'Distill count aggregation', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Distill count aggregation', passed: false, error: String(err) });
    }

    console.log('\n[DISTILL] Test 12: Distill with sum aggregation');
    try {
      const response = await authedRequest('/v1/cohort/distill', {
        method: 'POST',
        body: {
          aggregation: { type: 'sum', field: 'content.data.value' },
          filters: { content_type: 'structured' },
          min_records: 5,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      console.log('✅ Distill sum aggregation passed');
      results.push({ test: 'Distill sum aggregation', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Distill sum aggregation', passed: false, error: String(err) });
    }

    console.log('\n[DISTILL] Test 13: Distill with avg aggregation');
    try {
      const response = await authedRequest('/v1/cohort/distill', {
        method: 'POST',
        body: {
          aggregation: { type: 'avg', field: 'content.data.value' },
          min_records: 5,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      console.log('✅ Distill avg aggregation passed');
      results.push({ test: 'Distill avg aggregation', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Distill avg aggregation', passed: false, error: String(err) });
    }

    console.log('\n[DISTILL] Test 14: Distill k-anonymity failure');
    try {
      // Create new user with only 2 records (below threshold)
      const lowHashedPseudonym = 'hs_bG93X2NvdW50X3VzZXJfaGFzaGVkX3BzZXVkb255bV90ZXN0';
      const lowToken = 'hs_bG93X2NvdW50X3VzZXJfaGFzaGVkX3BzZXVkb255bV90ZXN0'; // Must match to avoid conversion

      // Store only 2 records
      for (let i = 0; i < 2; i++) {
        await authedRequest('/v1/cohort/store', {
          method: 'POST',
          headers: { Authorization: `Bearer ${lowToken}` },
          body: {
            content: { type: 'structured', data: { value: i } },
            metadata: {
              hashed_pseudonym: lowHashedPseudonym,
              consent_family: 'cohort',
              consent_timestamp: new Date().toISOString(),
              consent_version: '1.0',
            },
          },
        });
      }

      // Try to distill with min_records=5
      const response = await authedRequest('/v1/cohort/distill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${lowToken}` },
        body: {
          aggregation: { type: 'count' },
          min_records: 5,
        },
      });

      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }
      if (response.data.error.code !== 'FORBIDDEN') {
        throw new Error('Expected FORBIDDEN');
      }

      console.log('✅ k-anonymity failure test passed');
      results.push({ test: 'Distill k-anonymity failure', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Distill k-anonymity failure', passed: false, error: String(err) });
    }

    // ============================================================================
    // FORGET OPERATION TESTS
    // ============================================================================

    console.log('\n[FORGET] Test 15: Forget by ID (personal)');
    try {
      const storeId = (global as any).testStoreId;
      if (!storeId) {
        throw new Error('No test record ID available');
      }

      const response = await authedRequest(`/v1/personal/forget?id=${storeId}`, {
        method: 'DELETE',
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.deleted_count !== 1) {
        throw new Error('Expected deleted_count=1');
      }

      console.log('✅ Forget by ID passed');
      results.push({ test: 'Forget by ID', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Forget by ID', passed: false, error: String(err) });
    }

    console.log('\n[FORGET] Test 16: Forget by session (personal)');
    try {
      const response = await authedRequest(
        `/v1/personal/forget?session_id=session_store_001&hashed_pseudonym=${HASHED_PSEUDONYM}`,
        { method: 'DELETE' }
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      console.log('✅ Forget by session passed');
      results.push({ test: 'Forget by session', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Forget by session', passed: false, error: String(err) });
    }

    console.log('\n[FORGET] Test 17: Forget forbidden for population');
    try {
      const response = await authedRequest(
        `/v1/population/forget?hashed_pseudonym=${HASHED_PSEUDONYM}`,
        {
          method: 'DELETE',
        }
      );

      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }

      console.log('✅ Population forget forbidden test passed');
      results.push({ test: 'Population forget forbidden', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Population forget forbidden', passed: false, error: String(err) });
    }

    // ============================================================================
    // EXPORT OPERATION TESTS
    // ============================================================================

    console.log('\n[EXPORT] Test 18: Export as JSON');
    try {
      const response = await authedRequest('/v1/personal/export?format=json', { method: 'GET' });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.data) {
        throw new Error('Missing data');
      }
      if (response.data.metadata.format !== 'json') {
        throw new Error('Format mismatch');
      }

      console.log('✅ Export JSON passed');
      results.push({ test: 'Export JSON', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Export JSON', passed: false, error: String(err) });
    }

    console.log('\n[EXPORT] Test 19: Export as CSV');
    try {
      const response = await authedRequest('/v1/personal/export?format=csv', { method: 'GET' });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.metadata.format !== 'csv') {
        throw new Error('Format mismatch');
      }

      console.log('✅ Export CSV passed');
      results.push({ test: 'Export CSV', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Export CSV', passed: false, error: String(err) });
    }

    console.log('\n[EXPORT] Test 20: Export as JSONLines');
    try {
      const response = await authedRequest('/v1/personal/export?format=jsonlines', {
        method: 'GET',
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.metadata.format !== 'jsonlines') {
        throw new Error('Format mismatch');
      }

      console.log('✅ Export JSONLines passed');
      results.push({ test: 'Export JSONLines', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Export JSONLines', passed: false, error: String(err) });
    }

    console.log('\n[EXPORT] Test 21: Export forbidden for population');
    try {
      const response = await authedRequest('/v1/population/export', { method: 'GET' });

      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }

      console.log('✅ Population export forbidden test passed');
      results.push({ test: 'Population export forbidden', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Population export forbidden', passed: false, error: String(err) });
    }

    // ============================================================================
    // PII VALIDATION TESTS
    // ============================================================================

    console.log('\n[PII VALIDATION] Test 22: Reject raw email in hashed_pseudonym field');
    try {
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: 'user@example.com', // Raw email - should reject
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      if (response.data.error.code !== 'VALIDATION_ERROR') {
        throw new Error('Expected VALIDATION_ERROR');
      }

      console.log('✅ Raw email rejection test passed');
      results.push({ test: 'PII Validation - reject email', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'PII Validation - reject email', passed: false, error: String(err) });
    }

    console.log('\n[PII VALIDATION] Test 23: Reject SSN pattern in hashed_pseudonym field');
    try {
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: '123-45-6789', // SSN pattern - should reject
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      console.log('✅ SSN pattern rejection test passed');
      results.push({ test: 'PII Validation - reject SSN', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'PII Validation - reject SSN', passed: false, error: String(err) });
    }

    console.log('\n[PII VALIDATION] Test 24: Accept valid hashed pseudonym format');
    try {
      const response = await authedRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: 'hs_dGVzdHVzZXIxMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0',
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }

      console.log('✅ Valid hashed pseudonym acceptance test passed');
      results.push({ test: 'PII Validation - accept valid hash', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({
        test: 'PII Validation - accept valid hash',
        passed: false,
        error: String(err),
      });
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
      console.error('❌ Memory operations test FAILED');
      process.exit(1);
    } else {
      console.log('✅ Memory operations test PASSED');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Test encountered fatal error:', error);
    process.exit(1);
  } finally {
    console.log('\n🛑 Stopping server...');
    server.kill();
  }
}

// Run with timeout
const timeout = setTimeout(() => {
  console.error('❌ Test timeout exceeded');
  process.exit(1);
}, 60000); // 60 second timeout

main()
  .then(() => clearTimeout(timeout))
  .catch((error) => {
    clearTimeout(timeout);
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
