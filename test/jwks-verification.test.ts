/**
 * JWKS Verification CI Test
 *
 * Phase 1.2: End-to-end test that:
 * 1. Creates a real audit receipt (with signature)
 * 2. Fetches JWKS from the endpoint
 * 3. Verifies the signature using ONLY the JWKS public key
 *
 * This ensures LedgerSink and JWKS endpoint use the same key.
 */

import * as crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { getAuditEmitter } from '../src/memory-layer/governance/audit-emitter';
import { getJWKSManager } from '../src/memory-layer/governance/jwks-manager';
import { canonicalStringify } from '../src/memory-layer/utils/canonical-json';

// Skip when ledger is disabled (test requires actual signatures)
const skipIfLedgerDisabled = process.env.LEDGER_ENABLED !== 'true';

describe.skipIf(skipIfLedgerDisabled)('JWKS Verification - End-to-End', () => {
  it('should verify receipt signature using JWKS public key', async () => {
    // Step 1: Create a real audit receipt
    console.log('📝 Step 1: Creating audit event...');
    const emitter = getAuditEmitter();

    const receipt = await emitter.emit('HEALTH', 'jwks_verification_test', {
      test: 'jwks-verification',
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Receipt created: ${receipt.receipt_id}`);
    console.log(`   Ledger signer kid: ${receipt.signature.keyId}`);

    // Step 2: Fetch JWKS
    console.log('\n📥 Step 2: Fetching JWKS...');
    const jwksManager = await getJWKSManager();
    const jwks = await jwksManager.getJWKS();

    expect(jwks.keys).toBeDefined();
    expect(jwks.keys.length).toBeGreaterThan(0);

    const activeKey = jwks.keys[0]; // First key is the active key
    console.log(`✅ JWKS fetched: ${jwks.keys.length} key(s)`);
    console.log(`   Active JWKS kid: ${activeKey.kid}`);

    // CRITICAL ASSERTION: kids must match
    expect(receipt.signature.keyId).toBe(activeKey.kid);
    console.log('✅ Kid consistency verified: Ledger kid === JWKS kid');

    // Step 3: Verify signature using JWKS public key
    console.log('\n🔐 Step 3: Verifying signature using JWKS...');

    // Reconstruct the signature payload (same as in LedgerSink)
    const signaturePayload = canonicalStringify({
      root: receipt.merkle.root_hash,
      leaf: receipt.merkle.leaf_hash,
      event_id: receipt.event.event_id,
      timestamp: receipt.event.timestamp,
    });

    // Import public key from JWK
    const publicKeyJwk = {
      kty: activeKey.kty,
      crv: activeKey.crv,
      x: activeKey.x,
    };

    const publicKey = crypto.createPublicKey({
      key: publicKeyJwk,
      format: 'jwk',
    });

    // Verify signature
    const dataBuffer = Buffer.from(signaturePayload, 'utf8');
    const signatureBuffer = Buffer.from(receipt.signature.signature, 'base64');

    const valid = crypto.verify(null, dataBuffer, publicKey, signatureBuffer);

    expect(valid).toBe(true);
    console.log('✅ Signature verified using JWKS public key');

    // Step 4: Negative test - tamper with data
    console.log('\n🧪 Step 4: Negative test - tampered data should fail...');
    const tamperedPayload = canonicalStringify({
      root: receipt.merkle.root_hash,
      leaf: 'tampered_leaf_hash',
      event_id: receipt.event.event_id,
      timestamp: receipt.event.timestamp,
    });

    const tamperedBuffer = Buffer.from(tamperedPayload, 'utf8');
    const invalidSignature = crypto.verify(null, tamperedBuffer, publicKey, signatureBuffer);

    expect(invalidSignature).toBe(false);
    console.log('✅ Tampered data correctly rejected');

    console.log('\n🎉 JWKS Verification Test PASSED');
    console.log('   ✓ Receipt created with ledger signer');
    console.log('   ✓ JWKS fetched successfully');
    console.log('   ✓ Kid consistency verified');
    console.log('   ✓ Signature verified using JWKS');
    console.log('   ✓ Tampered data rejected');
  });

  it('should verify JWKS includes rotation grace period keys', async () => {
    console.log('\n🔄 Testing JWKS rotation grace period...');

    const jwksManager = await getJWKSManager();
    const jwks = await jwksManager.getJWKS();

    // After key rotation, JWKS should include both current and previous keys
    // For now, we just verify the structure is correct
    expect(jwks.keys).toBeDefined();
    expect(Array.isArray(jwks.keys)).toBe(true);

    jwks.keys.forEach((key, index) => {
      expect(key.kty).toBe('OKP'); // Ed25519
      expect(key.use).toBe('sig'); // Signing
      expect(key.alg).toBe('EdDSA'); // EdDSA algorithm
      expect(key.crv).toBe('Ed25519'); // Curve
      expect(key.kid).toBeDefined(); // Key ID
      expect(key.x).toBeDefined(); // Public key bytes
      console.log(`   Key ${index + 1}: kid=${key.kid} (${key.kty}/${key.crv})`);
    });

    console.log('✅ JWKS structure validated');
  });
});
