/**
 * Phase 2: Memory Middleware Unit Tests
 *
 * Tests individual middleware components:
 * - Consent resolver: auth extraction, family validation, fail-closed
 * - Schema validator: valid/invalid requests
 * - SLO middleware: latency tracking, circuit breaker
 * - Error handler: error envelope format
 */

import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:3000';
// Use pre-hashed token (43+ chars after hs_ prefix to meet schema requirement)
const VALID_TOKEN = 'hs_dXNlcl9taWRkbGV3YXJlX3Rlc3RfMTIzNDU2Nzg5MDEyMzQ1Ng';
// Hashed pseudonym matches VALID_TOKEN (consent-resolver passes through hs_ tokens)
const HASHED_PSEUDONYM = 'hs_dXNlcl9taWRkbGV3YXJlX3Rlc3RfMTIzNDU2Nzg5MDEyMzQ1Ng';

// Helper: Wait
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: Make request
async function makeRequest(
  path: string,
  options: {
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; data: unknown; headers: Record<string, string> }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown;
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
      const response = await fetch(`${BASE_URL}/readyz`);
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
  console.log('\n=== Phase 2: Memory Middleware Unit Tests ===\n');

  const server = startServer();

  try {
    await waitForServer();
    await wait(3000); // Full initialization

    const results: { test: string; passed: boolean; error?: string }[] = [];

    // ============================================================================
    // CONSENT RESOLVER TESTS
    // ============================================================================

    console.log('\n[CONSENT RESOLVER] Test 1: Valid auth header extraction');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Should succeed (201) or fail with validation (400), not auth error (401)
      if (response.status === 401) {
        throw new Error('Auth header not properly extracted');
      }

      console.log('✅ Auth header extraction passed');
      results.push({ test: 'Auth header extraction', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Auth header extraction', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 2: Missing Authorization header (fail-closed 401)');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        // No Authorization header
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }
      if (!response.data.error) {
        throw new Error('Missing error in response');
      }
      if (response.data.error.code !== 'UNAUTHORIZED') {
        throw new Error('Expected UNAUTHORIZED error code');
      }

      console.log('✅ Missing auth header test passed');
      results.push({ test: 'Missing auth (401)', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Missing auth (401)', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 3: Invalid token format (fail-closed 401)');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: 'InvalidFormat' }, // Not "Bearer <token>"
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }

      console.log('✅ Invalid token format test passed');
      results.push({ test: 'Invalid token format (401)', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Invalid token format (401)', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 4: Invalid consent family in URL');
    try {
      const response = await makeRequest('/v1/invalid_family/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
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

      console.log('✅ Invalid consent family test passed');
      results.push({ test: 'Invalid consent family (400)', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Invalid consent family (400)', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 5: Valid personal family routing');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test personal' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Should not fail with family-related errors
      if (response.status === 400 && response.data.error.message.includes('family')) {
        throw new Error('Family routing failed');
      }

      console.log('✅ Personal family routing passed');
      results.push({ test: 'Personal family routing', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Personal family routing', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 6: Valid cohort family routing');
    try {
      const response = await makeRequest('/v1/cohort/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test cohort' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'cohort',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Should not fail with family-related errors
      if (response.status === 400 && response.data.error.message.includes('family')) {
        throw new Error('Family routing failed');
      }

      console.log('✅ Cohort family routing passed');
      results.push({ test: 'Cohort family routing', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Cohort family routing', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 7: Valid population family routing');
    try {
      const response = await makeRequest('/v1/population/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test population' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'population',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Should not fail with family-related errors
      if (response.status === 400 && response.data.error.message.includes('family')) {
        throw new Error('Family routing failed');
      }

      console.log('✅ Population family routing passed');
      results.push({ test: 'Population family routing', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Population family routing', passed: false, error: String(err) });
    }

    console.log('\n[CONSENT RESOLVER] Test 8: Trace ID generation');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test trace' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Check if trace_id is present in response (either success or error)
      const hasTraceId =
        (response.data.trace_id && response.data.trace_id.startsWith('trace_')) ||
        (response.data.error && response.data.error.trace_id);

      if (!hasTraceId) {
        throw new Error('Trace ID not generated');
      }

      console.log('✅ Trace ID generation passed');
      results.push({ test: 'Trace ID generation', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Trace ID generation', passed: false, error: String(err) });
    }

    // ============================================================================
    // ERROR HANDLER TESTS
    // ============================================================================

    console.log('\n[ERROR HANDLER] Test 9: Error envelope structure (400)');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          // Missing required fields to trigger validation error
          content: { type: 'text', data: 'test' },
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      // Check error envelope structure
      if (!response.data.error) {
        throw new Error('Missing error object');
      }
      if (!response.data.error.code) {
        throw new Error('Missing error.code');
      }
      if (!response.data.error.message) {
        throw new Error('Missing error.message');
      }
      if (!response.data.timestamp) {
        throw new Error('Missing timestamp');
      }
      if (!response.data.path) {
        throw new Error('Missing path');
      }
      if (!response.data.method) {
        throw new Error('Missing method');
      }

      console.log('✅ Error envelope structure test passed');
      results.push({ test: 'Error envelope structure', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Error envelope structure', passed: false, error: String(err) });
    }

    console.log('\n[ERROR HANDLER] Test 10: Error envelope structure (401)');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        // No auth header
        body: { content: { type: 'text', data: 'test' } },
      });

      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }

      // Check error envelope
      if (response.data.error.code !== 'UNAUTHORIZED') {
        throw new Error('Expected UNAUTHORIZED code');
      }

      console.log('✅ 401 error envelope test passed');
      results.push({ test: '401 error envelope', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: '401 error envelope', passed: false, error: String(err) });
    }

    console.log('\n[ERROR HANDLER] Test 11: Error envelope structure (403)');
    try {
      const response = await makeRequest('/v1/cohort/recall?hashed_pseudonym=' + HASHED_PSEUDONYM, {
        method: 'GET',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
      });

      if (response.status !== 403) {
        throw new Error(`Expected 403, got ${response.status}`);
      }

      // Check error envelope
      if (response.data.error.code !== 'FORBIDDEN') {
        throw new Error('Expected FORBIDDEN code');
      }

      console.log('✅ 403 error envelope test passed');
      results.push({ test: '403 error envelope', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: '403 error envelope', passed: false, error: String(err) });
    }

    console.log('\n[ERROR HANDLER] Test 12: Error envelope structure (404)');
    try {
      const response = await makeRequest('/v1/receipts/nonexistent-id-12345', {
        method: 'GET',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
      });

      if (response.status !== 404) {
        throw new Error(`Expected 404, got ${response.status}`);
      }

      // Check error message
      if (!response.data.error) {
        throw new Error('Missing error object');
      }

      console.log('✅ 404 error envelope test passed');
      results.push({ test: '404 error envelope', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: '404 error envelope', passed: false, error: String(err) });
    }

    // ============================================================================
    // SCHEMA VALIDATOR TESTS
    // ============================================================================

    console.log('\n[SCHEMA VALIDATOR] Test 13: Valid store request schema');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: {
            type: 'text',
            data: 'Valid schema test',
          },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            session_id: 'session_schema_001',
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Should succeed with 201
      if (response.status !== 201) {
        throw new Error(`Expected 201, got ${response.status}`);
      }

      console.log('✅ Valid schema test passed');
      results.push({ test: 'Valid store schema', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Valid store schema', passed: false, error: String(err) });
    }

    console.log('\n[SCHEMA VALIDATOR] Test 14: Invalid schema - missing content');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          // Missing content field
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      console.log('✅ Missing content test passed');
      results.push({ test: 'Invalid schema (missing content)', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'Invalid schema (missing content)', passed: false, error: String(err) });
    }

    console.log('\n[SCHEMA VALIDATOR] Test 15: Invalid schema - missing metadata');
    try {
      const response = await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'test' },
          // Missing metadata
        },
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      console.log('✅ Missing metadata test passed');
      results.push({ test: 'Invalid schema (missing metadata)', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({
        test: 'Invalid schema (missing metadata)',
        passed: false,
        error: String(err),
      });
    }

    // ============================================================================
    // SLO MIDDLEWARE TESTS
    // ============================================================================

    console.log('\n[SLO MIDDLEWARE] Test 16: Response time tracking (check metrics)');
    try {
      // Make a request
      await makeRequest('/v1/personal/store', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VALID_TOKEN}` },
        body: {
          content: { type: 'text', data: 'slo test' },
          metadata: {
            hashed_pseudonym: HASHED_PSEUDONYM,
            consent_family: 'personal',
            consent_timestamp: new Date().toISOString(),
            consent_version: '1.0',
          },
        },
      });

      // Check metrics endpoint for operation duration metrics
      const metricsResponse = await fetch(`${BASE_URL}/metrics`);
      const metricsText = await metricsResponse.text();

      if (!metricsText.includes('memory_operation_duration_seconds')) {
        throw new Error('SLO duration metric not found');
      }

      console.log('✅ Response time tracking passed');
      results.push({ test: 'SLO response time tracking', passed: true });
    } catch (err) {
      console.error('❌ Failed:', err);
      results.push({ test: 'SLO response time tracking', passed: false, error: String(err) });
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
      console.error('❌ Memory middleware test FAILED');
      process.exit(1);
    } else {
      console.log('✅ Memory middleware test PASSED');
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
}, 60000);

main()
  .then(() => clearTimeout(timeout))
  .catch((error) => {
    clearTimeout(timeout);
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
