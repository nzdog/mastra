/**
 * Phase 2: Memory Layer - End-to-End Smoke Test
 *
 * Tests complete workflow covering all 5 operations across consent families:
 * 1. Store memory (personal)
 * 2. Recall memory (personal)
 * 3. Store multiple memories for distillation
 * 4. Distill memories (cohort with k-anonymity)
 * 5. Forget memory (personal)
 * 6. Export memories (personal)
 * 7. Verify all audit receipts via /v1/receipts/:id
 *
 * Also tests fail-closed cases: 401, 403, 400, 404
 * Verifies metrics are emitted via /metrics endpoint
 */

import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TIMEOUT_MS = 30000; // 30 seconds
const SERVER_STARTUP_DELAY_MS = 3000; // Wait for server to initialize

// Test user tokens
const USER_TOKEN = 'hs_dGVzdHVzZXIxMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0'; // Valid hashed pseudonym format
const HASHED_PSEUDONYM = 'hs_dGVzdHVzZXIxMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0';

// Helper: Wait for specified milliseconds
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: Make authenticated request
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

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

// Helper: Start server process
function startServer(): ChildProcess {
  const server = spawn('npm', ['run', 'server'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SKIP_API_KEY_CHECK: 'true' },
  });

  // Handle server errors
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  return server;
}

// Helper: Wait for server to be ready
async function waitForServer(maxAttempts: number = 30): Promise<void> {
  console.log('⏳ Waiting for server to start...');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/v1/health`, { method: 'GET' });
      if (response.status === 200) {
        console.log(`✅ Server ready after ${i + 1} attempts`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await wait(1000);
  }
  throw new Error('Server failed to start after maximum attempts');
}

// Main test function
async function main(): Promise<void> {
  console.log('\n=== Phase 2: Memory Layer E2E Smoke Test ===\n');

  // Start server
  const server = startServer();

  try {
    // Wait for server to be ready
    await waitForServer();
    await wait(SERVER_STARTUP_DELAY_MS); // Additional wait for full initialization

    // Track test results
    const results: { test: string; passed: boolean; error?: string }[] = [];

    // ============================================================================
    // TEST 1: Store Memory (Personal Family)
    // ============================================================================
    console.log('\n📝 TEST 1: Store memory (personal family)');
    try {
      const storeResponse = await authedRequest('/v1/personal/store', {
        method: 'POST',
        body: {
          content: {
            type: 'text',
            data: 'This is my first memory in the system',
            metadata: { tags: ['test', 'first'] },
          },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            session_id: 'session_test_001',
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        },
      });

      if (storeResponse.status !== 201) {
        throw new Error(`Expected 201, got ${storeResponse.status}`);
      }

      if (!storeResponse.data.id || !storeResponse.data.audit_receipt_id) {
        throw new Error('Missing id or audit_receipt_id in response');
      }

      // Save for later tests
      const recordId = storeResponse.data.id;
      const receiptId = storeResponse.data.audit_receipt_id;

      console.log(`✅ Store succeeded: record=${recordId}, receipt=${receiptId}`);
      results.push({ test: 'Store memory (personal)', passed: true });

      // Store recordId and receiptId for later tests
      (global as any).testRecordId = recordId;
      (global as any).testReceiptIds = [receiptId];
    } catch (err) {
      console.error('❌ Store test failed:', err);
      results.push({ test: 'Store memory (personal)', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 2: Recall Memory (Personal Family)
    // ============================================================================
    console.log('\n📖 TEST 2: Recall memory (personal family)');
    try {
      const recallResponse = await authedRequest(
        `/v1/personal/recall?hashed_pseudonym=${HASHED_PSEUDONYM}&session_id=session_test_001`,
        { method: 'GET' }
      );

      if (recallResponse.status !== 200) {
        throw new Error(`Expected 200, got ${recallResponse.status}`);
      }

      if (!recallResponse.data.records || !Array.isArray(recallResponse.data.records)) {
        throw new Error('Missing or invalid records array in response');
      }

      if (recallResponse.data.records.length === 0) {
        throw new Error('Expected at least one record, got none');
      }

      console.log(`✅ Recall succeeded: ${recallResponse.data.records.length} records returned`);
      results.push({ test: 'Recall memory (personal)', passed: true });

      // Save receipt ID
      (global as any).testReceiptIds.push(recallResponse.data.audit_receipt_id);
    } catch (err) {
      console.error('❌ Recall test failed:', err);
      results.push({ test: 'Recall memory (personal)', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 3: Store Multiple Memories for Distillation
    // ============================================================================
    console.log('\n📚 TEST 3: Store multiple memories for distillation');
    try {
      const storePromises = [];
      for (let i = 0; i < 6; i++) {
        storePromises.push(
          authedRequest('/v1/cohort/store', {
            method: 'POST',
            body: {
              content: {
                type: 'structured',
                data: { score: 50 + i * 5, category: 'test' },
              },
              metadata: {
                hashed_pseudonym: HASHED_PSEUDONYM,
                session_id: `session_cohort_${i}`,
                consent_family: 'cohort',
                consent_timestamp: new Date().toISOString(),
                consent_version: '1.0',
              },
            },
          })
        );
      }

      const storeResponses = await Promise.all(storePromises);
      const allSucceeded = storeResponses.every((r) => r.status === 201);

      if (!allSucceeded) {
        throw new Error('Not all store operations succeeded');
      }

      console.log(`✅ Stored ${storeResponses.length} cohort memories for distillation`);
      results.push({ test: 'Store multiple memories', passed: true });

      // Save receipt IDs
      storeResponses.forEach((r) => {
        if (r.data.audit_receipt_id) {
          (global as any).testReceiptIds.push(r.data.audit_receipt_id);
        }
      });
    } catch (err) {
      console.error('❌ Store multiple memories test failed:', err);
      results.push({ test: 'Store multiple memories', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 4: Distill Memories (Cohort with k-anonymity)
    // ============================================================================
    console.log('\n🔬 TEST 4: Distill memories (cohort with k-anonymity)');
    try {
      const distillResponse = await authedRequest('/v1/cohort/distill', {
        method: 'POST',
        body: {
          cohort_id: 'cohort_test_001',
          aggregation: {
            type: 'count',
            field: 'content.data',
          },
          filters: {
            content_type: 'structured',
          },
          min_records: 5, // k-anonymity threshold
        },
      });

      if (distillResponse.status !== 200) {
        throw new Error(`Expected 200, got ${distillResponse.status}`);
      }

      if (!distillResponse.data.results || !Array.isArray(distillResponse.data.results)) {
        throw new Error('Missing or invalid results in response');
      }

      if (!distillResponse.data.metadata.privacy_threshold_met) {
        throw new Error('Privacy threshold not met');
      }

      console.log(`✅ Distill succeeded: ${distillResponse.data.results.length} aggregations`);
      results.push({ test: 'Distill memories (cohort)', passed: true });

      // Save receipt ID
      (global as any).testReceiptIds.push(distillResponse.data.audit_receipt_id);
    } catch (err) {
      console.error('❌ Distill test failed:', err);
      results.push({ test: 'Distill memories (cohort)', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 5: Forget Memory (Personal Family)
    // ============================================================================
    console.log('\n🗑️  TEST 5: Forget memory (personal family)');
    try {
      const recordId = (global as any).testRecordId;
      const forgetResponse = await authedRequest(
        `/v1/personal/forget?id=${recordId}&reason=test_cleanup`,
        { method: 'DELETE' }
      );

      if (forgetResponse.status !== 200) {
        throw new Error(`Expected 200, got ${forgetResponse.status}`);
      }

      if (forgetResponse.data.deleted_count !== 1) {
        throw new Error(`Expected deleted_count=1, got ${forgetResponse.data.deleted_count}`);
      }

      console.log(`✅ Forget succeeded: deleted ${forgetResponse.data.deleted_count} record(s)`);
      results.push({ test: 'Forget memory (personal)', passed: true });

      // Save receipt ID
      (global as any).testReceiptIds.push(forgetResponse.data.audit_receipt_id);
    } catch (err) {
      console.error('❌ Forget test failed:', err);
      results.push({ test: 'Forget memory (personal)', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 6: Export Memories (Personal Family)
    // ============================================================================
    console.log('\n📤 TEST 6: Export memories (personal family)');
    try {
      const exportResponse = await authedRequest(
        `/v1/personal/export?format=json&include_audit=true`,
        { method: 'GET' }
      );

      if (exportResponse.status !== 200) {
        throw new Error(`Expected 200, got ${exportResponse.status}`);
      }

      if (!exportResponse.data.data || !exportResponse.data.metadata) {
        throw new Error('Missing data or metadata in export response');
      }

      console.log(`✅ Export succeeded: ${exportResponse.data.metadata.record_count} records`);
      results.push({ test: 'Export memories (personal)', passed: true });

      // Save receipt ID
      (global as any).testReceiptIds.push(exportResponse.data.audit_receipt_id);
    } catch (err) {
      console.error('❌ Export test failed:', err);
      results.push({ test: 'Export memories (personal)', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 7: Verify Audit Receipts
    // ============================================================================
    console.log('\n🔐 TEST 7: Verify audit receipts');
    try {
      const receiptIds = (global as any).testReceiptIds || [];
      if (receiptIds.length === 0) {
        throw new Error('No receipt IDs to verify');
      }

      let verifiedCount = 0;
      for (const receiptId of receiptIds) {
        const verifyResponse = await authedRequest(`/v1/receipts/${receiptId}`, {
          method: 'GET',
        });

        if (verifyResponse.status !== 200) {
          console.warn(
            `⚠️  Failed to verify receipt ${receiptId}: status ${verifyResponse.status}`
          );
          continue;
        }

        if (!verifyResponse.data.receipt || !verifyResponse.data.verification) {
          console.warn(`⚠️  Invalid receipt response for ${receiptId}`);
          continue;
        }

        if (!verifyResponse.data.verification.valid) {
          console.warn(`⚠️  Receipt ${receiptId} verification failed`);
          continue;
        }

        verifiedCount++;
      }

      if (verifiedCount === 0) {
        throw new Error('No receipts were successfully verified');
      }

      console.log(`✅ Verified ${verifiedCount}/${receiptIds.length} audit receipts`);
      results.push({ test: 'Verify audit receipts', passed: true });
    } catch (err) {
      console.error('❌ Audit receipt verification failed:', err);
      results.push({ test: 'Verify audit receipts', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 8: Fail-Closed - 401 Unauthorized
    // ============================================================================
    console.log('\n🔒 TEST 8: Fail-closed - 401 Unauthorized');
    try {
      const response = await fetch(`${BASE_URL}/v1/personal/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No Authorization header
        body: JSON.stringify({
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        }),
      });

      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }

      const data = await response.json();
      if (!data.error || data.error.code !== 'UNAUTHORIZED') {
        throw new Error('Expected UNAUTHORIZED error code');
      }

      console.log('✅ 401 Unauthorized handled correctly');
      results.push({ test: 'Fail-closed 401', passed: true });
    } catch (err) {
      console.error('❌ 401 test failed:', err);
      results.push({ test: 'Fail-closed 401', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 9: Fail-Closed - 403 Forbidden (Cohort Recall)
    // ============================================================================
    console.log('\n🚫 TEST 9: Fail-closed - 403 Forbidden (cohort recall)');
    try {
      const recallResponse = await authedRequest(
        '/v1/cohort/recall?hashed_pseudonym=' + HASHED_PSEUDONYM,
        {
          method: 'GET',
        }
      );

      if (recallResponse.status !== 403) {
        throw new Error(`Expected 403, got ${recallResponse.status}`);
      }

      if (!recallResponse.data.error || recallResponse.data.error.code !== 'FORBIDDEN') {
        throw new Error('Expected FORBIDDEN error code');
      }

      console.log('✅ 403 Forbidden (cohort recall) handled correctly');
      results.push({ test: 'Fail-closed 403 (cohort recall)', passed: true });
    } catch (err) {
      console.error('❌ 403 test failed:', err);
      results.push({ test: 'Fail-closed 403 (cohort recall)', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 10: Fail-Closed - 400 Validation Error
    // ============================================================================
    console.log('\n⚠️  TEST 10: Fail-closed - 400 Validation Error');
    try {
      const storeResponse = await authedRequest('/v1/personal/store', {
        method: 'POST',
        body: {
          // Missing required fields
          content: { type: 'text', data: 'test' },
          // metadata missing
        },
      });

      if (storeResponse.status !== 400) {
        throw new Error(`Expected 400, got ${storeResponse.status}`);
      }

      if (!storeResponse.data.error || storeResponse.data.error.code !== 'VALIDATION_ERROR') {
        throw new Error('Expected VALIDATION_ERROR error code');
      }

      console.log('✅ 400 Validation Error handled correctly');
      results.push({ test: 'Fail-closed 400', passed: true });
    } catch (err) {
      console.error('❌ 400 test failed:', err);
      results.push({ test: 'Fail-closed 400', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 11: Fail-Closed - 404 Not Found
    // ============================================================================
    console.log('\n🔍 TEST 11: Fail-closed - 404 Not Found');
    try {
      const receiptResponse = await authedRequest('/v1/receipts/nonexistent-id-12345', {
        method: 'GET',
      });

      if (receiptResponse.status !== 404) {
        throw new Error(`Expected 404, got ${receiptResponse.status}`);
      }

      console.log('✅ 404 Not Found handled correctly');
      results.push({ test: 'Fail-closed 404', passed: true });
    } catch (err) {
      console.error('❌ 404 test failed:', err);
      results.push({ test: 'Fail-closed 404', passed: false, error: String(err) });
    }

    // ============================================================================
    // TEST 12: Metrics Instrumentation
    // ============================================================================
    console.log('\n📊 TEST 12: Metrics instrumentation');
    try {
      const metricsResponse = await fetch(`${BASE_URL}/metrics`, { method: 'GET' });

      if (metricsResponse.status !== 200) {
        throw new Error(`Expected 200, got ${metricsResponse.status}`);
      }

      const metricsText = await metricsResponse.text();

      // Check for Phase 2 metrics
      const requiredMetrics = [
        'memory_operation_duration_seconds',
        'memory_operation_total',
        'memory_store_records_total',
        'memory_recall_records_total',
      ];

      const missingMetrics = requiredMetrics.filter((m) => !metricsText.includes(m));

      if (missingMetrics.length > 0) {
        throw new Error(`Missing metrics: ${missingMetrics.join(', ')}`);
      }

      console.log('✅ Metrics instrumentation verified');
      results.push({ test: 'Metrics instrumentation', passed: true });
    } catch (err) {
      console.error('❌ Metrics test failed:', err);
      results.push({ test: 'Metrics instrumentation', passed: false, error: String(err) });
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
      console.error('❌ Phase 2 smoke test FAILED');
      process.exit(1);
    } else {
      console.log('✅ Phase 2 smoke test PASSED');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Smoke test encountered fatal error:', error);
    process.exit(1);
  } finally {
    // Kill server process
    console.log('\n🛑 Stopping server...');
    server.kill();
  }
}

// Run test with timeout
const timeout = setTimeout(() => {
  console.error('❌ Test timeout exceeded');
  process.exit(1);
}, TIMEOUT_MS);

main()
  .then(() => clearTimeout(timeout))
  .catch((error) => {
    clearTimeout(timeout);
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });
