/**
 * RFC-8785 Canonical JSON Tests for Phase 1.1
 *
 * Ensures deterministic serialization for cryptographic signatures
 * Tests that same object produces identical digest regardless of key order
 */

import * as crypto from 'crypto';
import { canonicalStringify } from '../src/memory-layer/utils/canonical-json';

/**
 * Test: Same object with different key orders produces identical canonical JSON
 */
function testKeyOrderIndependence() {
  const obj1 = {
    root: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
    leaf: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
    event_id: 'evt_1760576878191_tqtgu95zqhr',
    timestamp: '2025-10-16T01:07:58.191Z',
  };

  const obj2 = {
    timestamp: '2025-10-16T01:07:58.191Z',
    event_id: 'evt_1760576878191_tqtgu95zqhr',
    leaf: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
    root: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
  };

  const canonical1 = canonicalStringify(obj1);
  const canonical2 = canonicalStringify(obj2);

  if (canonical1 !== canonical2) {
    console.error('❌ Different key orders produced different canonical JSON');
    console.error('  canonical1:', canonical1);
    console.error('  canonical2:', canonical2);
    process.exit(1);
  }

  console.log('✅ Same object with different key orders produces identical canonical JSON');
  console.log(`   Canonical: ${canonical1}`);
}

/**
 * Test: Canonical JSON produces deterministic hash
 */
function testDeterministicHash() {
  const event = {
    event_id: 'evt_1760576878191_tqtgu95zqhr',
    timestamp: '2025-10-16T01:07:58.191Z',
    event_type: 'HEALTH',
    operation: 'health_check',
    payload: {
      status: 'healthy',
      session_count: 0,
      ledger_height: 4,
    },
    schemaVersion: '1.1.0',
    policyVersion: '2025-01',
    consentScope: ['audit'],
  };

  // Serialize 100 times and verify same hash
  const hashes = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const canonical = canonicalStringify(event);
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');
    hashes.add(hash);
  }

  if (hashes.size !== 1) {
    console.error('❌ Canonical JSON produced multiple different hashes:', hashes);
    process.exit(1);
  }

  console.log('✅ Canonical JSON produces deterministic hash (100 iterations)');
  console.log(`   Hash: ${Array.from(hashes)[0]}`);
}

/**
 * Test: Nested objects are canonicalized recursively
 */
function testNestedObjects() {
  const obj1 = {
    outer: {
      inner: {
        z: 3,
        a: 1,
        m: 2,
      },
    },
  };

  const obj2 = {
    outer: {
      inner: {
        m: 2,
        z: 3,
        a: 1,
      },
    },
  };

  const canonical1 = canonicalStringify(obj1);
  const canonical2 = canonicalStringify(obj2);

  if (canonical1 !== canonical2) {
    console.error('❌ Nested objects not canonicalized correctly');
    console.error('  canonical1:', canonical1);
    console.error('  canonical2:', canonical2);
    process.exit(1);
  }

  // Should have alphabetical key order: a, inner, m, outer, z
  const expected = '{"outer":{"inner":{"a":1,"m":2,"z":3}}}';
  if (canonical1 !== expected) {
    console.error('❌ Canonical JSON does not match expected format');
    console.error('  Got:', canonical1);
    console.error('  Expected:', expected);
    process.exit(1);
  }

  console.log('✅ Nested objects are canonicalized recursively');
  console.log(`   Canonical: ${canonical1}`);
}

/**
 * Test: Arrays preserve order (not sorted)
 */
function testArrayPreservation() {
  const obj1 = {
    items: [3, 1, 2],
    name: 'test',
  };

  const obj2 = {
    name: 'test',
    items: [3, 1, 2],
  };

  const canonical1 = canonicalStringify(obj1);
  const canonical2 = canonicalStringify(obj2);

  if (canonical1 !== canonical2) {
    console.error('❌ Array order not preserved in canonical JSON');
    process.exit(1);
  }

  // Arrays should NOT be sorted, only object keys
  const expected = '{"items":[3,1,2],"name":"test"}';
  if (canonical1 !== expected) {
    console.error('❌ Arrays incorrectly sorted in canonical JSON');
    console.error('  Got:', canonical1);
    console.error('  Expected:', expected);
    process.exit(1);
  }

  console.log('✅ Arrays preserve order (not sorted)');
  console.log(`   Canonical: ${canonical1}`);
}

/**
 * Test: No whitespace in canonical JSON
 */
function testNoWhitespace() {
  const obj = {
    a: 1,
    b: {
      c: 2,
      d: 3,
    },
  };

  const canonical = canonicalStringify(obj);

  if (canonical.includes(' ') || canonical.includes('\n') || canonical.includes('\t')) {
    console.error('❌ Canonical JSON contains whitespace');
    console.error('  Got:', JSON.stringify(canonical));
    process.exit(1);
  }

  console.log('✅ No whitespace in canonical JSON');
  console.log(`   Canonical: ${canonical}`);
}

/**
 * Test: Signature verification uses canonical representation
 */
function testSignatureVerification() {
  // Simulate signing with different key orders
  const signaturePayload1 = {
    root: 'abcd1234',
    leaf: 'efgh5678',
    event_id: 'evt_123',
    timestamp: '2025-01-01T00:00:00Z',
  };

  const signaturePayload2 = {
    timestamp: '2025-01-01T00:00:00Z',
    event_id: 'evt_123',
    leaf: 'efgh5678',
    root: 'abcd1234',
  };

  const canonical1 = canonicalStringify(signaturePayload1);
  const canonical2 = canonicalStringify(signaturePayload2);

  // Create HMAC signatures (simulating Ed25519)
  const secret = 'test_secret';
  const sig1 = crypto.createHmac('sha256', secret).update(canonical1).digest('hex');
  const sig2 = crypto.createHmac('sha256', secret).update(canonical2).digest('hex');

  if (sig1 !== sig2) {
    console.error('❌ Different key orders produced different signatures');
    console.error('  sig1:', sig1);
    console.error('  sig2:', sig2);
    process.exit(1);
  }

  console.log('✅ Signature verification uses canonical representation');
  console.log(`   Signature: ${sig1.substring(0, 32)}...`);
}

// Run all tests
console.log('🧪 Running RFC-8785 Canonical JSON tests...\n');
testKeyOrderIndependence();
testDeterministicHash();
testNestedObjects();
testArrayPreservation();
testNoWhitespace();
testSignatureVerification();
console.log('\n✅ All canonical JSON tests passed');
console.log('\n📋 RFC-8785 Compliance Summary:');
console.log('   - Object keys sorted alphabetically ✓');
console.log('   - Arrays preserve original order ✓');
console.log('   - No whitespace ✓');
console.log('   - Deterministic hash generation ✓');
console.log('   - Signature verification deterministic ✓');
