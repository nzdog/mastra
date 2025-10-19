/**
 * Hard Delete + Receipt Verification E2E Test
 * Verifies that hard delete is irreversible and receipt validates against Merkle root
 */

import { strict as assert } from 'assert';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4099';
const VALID_HASHED_PSEUDONYM = 'hs_dGVzdHVzZXIxMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0';

async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/readyz`);
      if (res.ok) {
        return;
      }
    } catch {
      // Server not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Server did not start in time');
}

async function testHardDeleteVerification() {
  console.log('🧪 Hard Delete + Receipt Verification E2E Test');

  await waitForServer();

  // 1. Store a memory
  console.log('  1. Storing memory...');
  const storeRes = await fetch(`${BASE_URL}/v1/personal/store`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test_token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: { type: 'text', data: 'sensitive data to be deleted' },
      metadata: {
        hashed_pseudonym: VALID_HASHED_PSEUDONYM,
        consent_family: 'personal',
        consent_timestamp: new Date().toISOString(),
        consent_version: '1.0',
      },
    }),
  });

  assert.strictEqual(storeRes.status, 201, 'Store should succeed');
  const storeData = await storeRes.json();
  const recordId = storeData.id;
  const storeReceiptId = storeData.audit_receipt_id;

  console.log(`     ✓ Stored record: ${recordId}`);
  console.log(`     ✓ Store receipt: ${storeReceiptId}`);

  // 2. Verify record exists
  console.log('  2. Verifying record exists...');
  const recallBeforeRes = await fetch(
    `${BASE_URL}/v1/personal/recall?hashed_pseudonym=${VALID_HASHED_PSEUDONYM}`,
    {
      headers: { Authorization: 'Bearer test_token' },
    }
  );

  const recallBeforeData = await recallBeforeRes.json();
  assert.ok(
    recallBeforeData.records.some((r) => r.id === recordId),
    'Record should exist before delete'
  );
  console.log('     ✓ Record confirmed in storage');

  // 3. Hard delete
  console.log('  3. Executing hard delete...');
  const forgetRes = await fetch(`${BASE_URL}/v1/personal/forget`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer test_token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hashed_pseudonym: VALID_HASHED_PSEUDONYM,
      memory_ids: [recordId],
      hard_delete: true,
    }),
  });

  assert.strictEqual(forgetRes.status, 200, 'Forget should succeed');
  const forgetData = await forgetRes.json();
  const forgetReceiptId = forgetData.audit_receipt_id;

  assert.ok(forgetData.deleted_ids.includes(recordId), 'Should confirm deletion');
  console.log(`     ✓ Hard deleted record: ${recordId}`);
  console.log(`     ✓ Forget receipt: ${forgetReceiptId}`);

  // 4. Verify record is irretrievable
  console.log('  4. Verifying record is irretrievable...');
  const recallAfterRes = await fetch(
    `${BASE_URL}/v1/personal/recall?hashed_pseudonym=${VALID_HASHED_PSEUDONYM}`,
    {
      headers: { Authorization: 'Bearer test_token' },
    }
  );

  const recallAfterData = await recallAfterRes.json();
  assert.ok(
    !recallAfterData.records.some((r) => r.id === recordId),
    'Record should NOT exist after hard delete'
  );
  console.log('     ✓ Record confirmed irretrievable');

  // 5. Fetch forget receipt
  console.log('  5. Fetching forget receipt...');
  const receiptRes = await fetch(`${BASE_URL}/v1/receipts/${forgetReceiptId}`);
  assert.strictEqual(receiptRes.status, 200, 'Receipt fetch should succeed');

  const receipt = await receiptRes.json();
  assert.strictEqual(receipt.event_type, 'MEMORY_FORGET_COMPLETED', 'Should be forget event');
  assert.strictEqual(receipt.payload.hard_delete, true, 'Should indicate hard delete');
  assert.ok(receipt.signature, 'Receipt should be signed');
  console.log('     ✓ Receipt fetched and validated');

  // 6. Verify receipt against Merkle root
  console.log('  6. Verifying receipt against Merkle root...');
  const rootRes = await fetch(`${BASE_URL}/v1/ledger/root`);
  assert.strictEqual(rootRes.status, 200, 'Root fetch should succeed');

  const rootData = await rootRes.json();
  assert.ok(rootData.merkle_root, 'Should have Merkle root');

  const verifyRes = await fetch(`${BASE_URL}/v1/receipts/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receipt_id: forgetReceiptId,
      expected_root: rootData.merkle_root,
    }),
  });

  assert.strictEqual(verifyRes.status, 200, 'Verification should succeed');
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyData.valid, true, 'Receipt should verify against Merkle root');
  console.log('     ✓ Receipt verified against Merkle root');

  console.log('\n✅ Hard Delete Verification Test PASSED\n');
}

// Run test
testHardDeleteVerification().catch((err) => {
  console.error('\n❌ Hard Delete Verification Test FAILED');
  console.error(err);
  process.exit(1);
});
