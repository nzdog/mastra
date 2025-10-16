/**
 * CORS Smoke Test
 *
 * Phase 1.2: Validates CORS configuration hardening
 *
 * Tests:
 * 1. Valid origin (allowed) receives CORS headers
 * 2. Invalid origin (not in allowlist) is rejected (no CORS headers)
 * 3. Preflight OPTIONS request works with valid origin
 * 4. Credentials policy is safe (cannot be true with wildcard)
 * 5. Security headers are present (Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
 */

import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let server: ChildProcess | null = null;

  try {
    // Start server with explicit CORS config
    console.log('🚀 Starting server with test CORS config...');
    server = spawn('npm', ['run', 'server'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        SKIP_API_KEY_CHECK: 'true',
        // Test config: only allow localhost:3000
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
        CORS_ALLOW_CREDENTIALS: 'false',
        CORS_MAX_AGE: '600',
      },
    });

    // Wait for server to boot
    await wait(2000);

    // Test 1: Valid origin receives CORS headers
    console.log('✅ Test 1: Valid origin receives CORS headers');
    const validOriginRes = await fetch('http://localhost:3000/v1/health', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    if (validOriginRes.status !== 200) {
      throw new Error(`Expected 200 but got ${validOriginRes.status}`);
    }

    const allowOriginHeader = validOriginRes.headers.get('access-control-allow-origin');
    if (allowOriginHeader !== 'http://localhost:3000') {
      throw new Error(
        `Expected Access-Control-Allow-Origin: http://localhost:3000 but got ${allowOriginHeader}`
      );
    }

    const allowMethodsHeader = validOriginRes.headers.get('access-control-allow-methods');
    if (!allowMethodsHeader) {
      throw new Error('Missing Access-Control-Allow-Methods header');
    }

    console.log('   ✓ Valid origin receives CORS headers');

    // Test 2: Invalid origin is rejected (no CORS headers)
    console.log('✅ Test 2: Invalid origin is rejected (no CORS headers)');
    const invalidOriginRes = await fetch('http://localhost:3000/v1/health', {
      headers: {
        Origin: 'https://evil.com',
      },
    });

    if (invalidOriginRes.status !== 200) {
      throw new Error(`Expected 200 (no CORS rejection) but got ${invalidOriginRes.status}`);
    }

    const invalidAllowOriginHeader = invalidOriginRes.headers.get('access-control-allow-origin');
    if (invalidAllowOriginHeader) {
      throw new Error(
        `Expected no Access-Control-Allow-Origin header for invalid origin, but got ${invalidAllowOriginHeader}`
      );
    }

    console.log('   ✓ Invalid origin rejected (no CORS headers)');

    // Test 3: Preflight OPTIONS request works with valid origin
    console.log('✅ Test 3: Preflight OPTIONS request works with valid origin');
    const preflightRes = await fetch('http://localhost:3000/v1/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    if (preflightRes.status !== 200) {
      throw new Error(`Expected 200 for preflight but got ${preflightRes.status}`);
    }

    const preflightAllowOrigin = preflightRes.headers.get('access-control-allow-origin');
    if (preflightAllowOrigin !== 'http://localhost:3000') {
      throw new Error(
        `Expected Access-Control-Allow-Origin: http://localhost:3000 in preflight but got ${preflightAllowOrigin}`
      );
    }

    const preflightMaxAge = preflightRes.headers.get('access-control-max-age');
    if (!preflightMaxAge) {
      throw new Error('Missing Access-Control-Max-Age header in preflight');
    }

    console.log(`   ✓ Preflight OPTIONS request works (Max-Age: ${preflightMaxAge}s)`);

    // Test 4: Credentials policy is safe (Access-Control-Allow-Credentials should not be set when false)
    console.log('✅ Test 4: Credentials policy is safe');
    const credentialsHeader = validOriginRes.headers.get('access-control-allow-credentials');
    if (credentialsHeader === 'true') {
      // If credentials are allowed, verify origin is NOT wildcard
      if (allowOriginHeader === '*') {
        throw new Error(
          'SECURITY VIOLATION: Access-Control-Allow-Credentials: true with wildcard origin'
        );
      }
    }
    // We expect credentials to be false (not set) in this test
    if (credentialsHeader) {
      console.log(`   ⚠️  Warning: Access-Control-Allow-Credentials is set to ${credentialsHeader}`);
    }
    console.log('   ✓ Credentials policy is safe (no wildcard with credentials)');

    // Test 5: Security headers are present
    console.log('✅ Test 5: Security headers are present');
    const referrerPolicy = validOriginRes.headers.get('referrer-policy');
    if (referrerPolicy !== 'no-referrer') {
      throw new Error(`Expected Referrer-Policy: no-referrer but got ${referrerPolicy}`);
    }

    const xContentTypeOptions = validOriginRes.headers.get('x-content-type-options');
    if (xContentTypeOptions !== 'nosniff') {
      throw new Error(
        `Expected X-Content-Type-Options: nosniff but got ${xContentTypeOptions}`
      );
    }

    const permissionsPolicy = validOriginRes.headers.get('permissions-policy');
    if (!permissionsPolicy || !permissionsPolicy.includes('geolocation=()')) {
      throw new Error(
        `Expected Permissions-Policy with geolocation=() but got ${permissionsPolicy}`
      );
    }

    console.log('   ✓ Security headers present (Referrer-Policy, X-Content-Type-Options, Permissions-Policy)');

    // Test 6: Metrics endpoint reports CORS metrics
    console.log('✅ Test 6: Metrics endpoint reports CORS metrics');
    const metricsRes = await fetch('http://localhost:3000/metrics');
    if (metricsRes.status !== 200) {
      throw new Error(`Expected 200 for /metrics but got ${metricsRes.status}`);
    }

    const metricsText = await metricsRes.text();
    if (!metricsText.includes('cors_preflight_total')) {
      throw new Error('Missing cors_preflight_total metric');
    }

    if (!metricsText.includes('cors_reject_total')) {
      throw new Error('Missing cors_reject_total metric');
    }

    if (!metricsText.includes('cors_preflight_duration_ms')) {
      throw new Error('Missing cors_preflight_duration_ms metric');
    }

    console.log('   ✓ CORS metrics present in /metrics endpoint');

    console.log('\n🎉 All CORS smoke tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CORS smoke test failed:', err);
    process.exit(2);
  } finally {
    // Kill server process
    if (server) {
      server.kill();
    }
  }
}

main();
