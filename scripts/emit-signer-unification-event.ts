/**
 * Emit Governance Correction Event: Signer Unification
 *
 * Phase 1.2: One-time script to emit a GOVERNANCE_OVERRIDE event noting
 * the correction of the LedgerSink/JWKS key divergence issue.
 *
 * Run once after deploying the SignerRegistry refactor.
 *
 * Usage:
 *   npx ts-node scripts/emit-signer-unification-event.ts
 */

import { getAuditEmitter } from '../src/memory-layer/governance/audit-emitter';
import { getSignerRegistry } from '../src/memory-layer/governance/signer-registry';

async function emitGovernanceCorrection() {
  console.log('🔧 Emitting Governance Correction Event...\n');

  try {
    const emitter = getAuditEmitter();
    const registry = await getSignerRegistry();

    const currentKid = registry.getCurrentKid();

    const receipt = await emitter.emit('GOVERNANCE_OVERRIDE', 'signer_unification', {
      correction_type: 'key_divergence_fix',
      description:
        'Unified CryptoSigner usage to prevent LedgerSink/JWKS key mismatch. ' +
        'Prior to Phase 1.2, LedgerSink created its own CryptoSigner instance, ' +
        'causing signatures to use a different key than published in JWKS. ' +
        'This created a critical security issue where external verifiers could not verify signatures.',
      changes: [
        'Introduced SignerRegistry as single source of truth for signing keys',
        'Refactored LedgerSink to use SignerRegistry.getActiveSigner()',
        'Refactored JWKS Manager to use SignerRegistry.getVerificationSigners()',
        'Implemented RFC 7638 JWK thumbprint for stable kid generation',
        'Added grace period support for key rotation (48 hours)',
        'Added health check to detect kid mismatches',
        'Added metrics: audit_jwks_mismatch_total, audit_ledger_signer_kid_info, audit_jwks_active_kid_info',
        'Added CI test to verify signatures using JWKS',
      ],
      unified_kid: currentKid,
      impact:
        'All future receipts will use the unified signer. ' +
        'External verifiers can now successfully verify signatures using JWKS. ' +
        'Historical receipts signed with divergent keys remain verifiable using archived keys.',
      phase: '1.2',
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Governance correction event emitted');
    console.log(`   Receipt ID: ${receipt.receipt_id}`);
    console.log(`   Unified kid: ${currentKid}`);
    console.log(`   Ledger height: ${receipt.ledger_height}`);
    console.log(`   Event ID: ${receipt.event_id}`);

    console.log('\n📋 Event Details:');
    console.log(`   Timestamp: ${receipt.timestamp}`);
    console.log(`   Merkle root: ${receipt.merkle_root}`);

    console.log('\n🔐 Signature (base64):');
    console.log(`   ${receipt.signature.substring(0, 64)}...`);

    console.log('\n✅ Signer unification governance correction complete');
    console.log('   This event serves as an immutable audit trail of the fix.');
  } catch (error) {
    console.error('\n❌ Failed to emit governance correction event:', error);
    process.exit(1);
  }
}

// Run the script
emitGovernanceCorrection()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
