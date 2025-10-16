/**
 * JSON Schema Validation Tests for Phase 1.1
 *
 * Validates AuditEvent and SignedAuditReceipt against JSON Schema
 * Runs as part of CI policy gates
 */

import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Load schemas
const auditEventSchema = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../src/memory-layer/schemas/audit-event.schema.json'),
    'utf8'
  )
);

const auditReceiptSchema = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../src/memory-layer/schemas/audit-receipt.schema.json'),
    'utf8'
  )
);

// Initialize Ajv validator
const ajv = new Ajv({ allErrors: true, strict: false }); // strict: false to avoid strict mode errors
addFormats(ajv);

// Add schemas to registry (receipt schema references event schema)
ajv.addSchema(auditEventSchema);
ajv.addSchema(auditReceiptSchema);

const validateEvent = ajv.getSchema('https://lichen-protocol.org/schemas/audit-event.json');
const validateReceipt = ajv.getSchema('https://lichen-protocol.org/schemas/audit-receipt.json');

if (!validateEvent || !validateReceipt) {
  console.error('❌ Failed to load schemas');
  process.exit(1);
}

/**
 * Test: Valid AuditEvent passes schema validation
 */
function testValidAuditEvent() {
  const validEvent = {
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

  const valid = validateEvent(validEvent);
  if (!valid) {
    console.error('❌ Valid AuditEvent failed validation:', validateEvent.errors);
    process.exit(1);
  }

  console.log('✅ Valid AuditEvent passes schema validation');
}

/**
 * Test: Invalid AuditEvent (missing required field) fails validation
 */
function testInvalidAuditEvent() {
  const invalidEvent = {
    // Missing event_id (required field)
    timestamp: '2025-10-16T01:07:58.191Z',
    event_type: 'HEALTH',
    operation: 'health_check',
    payload: {},
    schemaVersion: '1.1.0',
    policyVersion: '2025-01',
    consentScope: ['audit'],
  };

  const valid = validateEvent(invalidEvent);
  if (valid) {
    console.error('❌ Invalid AuditEvent passed validation (should have failed)');
    process.exit(1);
  }

  console.log('✅ Invalid AuditEvent correctly fails schema validation');
}

/**
 * Test: Valid SignedAuditReceipt passes schema validation
 */
function testValidReceipt() {
  const validReceipt = {
    event: {
      event_id: 'evt_1760576878191_tqtgu95zqhr',
      timestamp: '2025-10-16T01:07:58.191Z',
      event_type: 'HEALTH',
      operation: 'health_check',
      payload: { status: 'healthy' },
      schemaVersion: '1.1.0',
      policyVersion: '2025-01',
      consentScope: ['audit'],
    },
    merkle: {
      leaf_hash: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
      root_hash: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
      proof: {
        leaf: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
        siblings: [
          '6d276dcf6f19b12cb58df00fb768f4340ae91bf0d4c04354153996af80ddcb52',
        ],
        path: ['left'],
        root: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
      },
      index: 4,
    },
    signature: {
      signature: '79cubBcivBjAU5UJDDHfLf2CpR1k5n2AKlx/bdFBlTfuI7NtH1/VOjsjPk+aCyHM5dfO964JHaF7ptl/mKgpDQ==',
      algorithm: 'Ed25519',
      alg: 'EdDSA',
      keyId: 'key_1760576878187_dd08fda6',
      timestamp: '2025-10-16T01:07:58.191Z',
    },
    ledger_height: 5,
    receipt_id: 'rcpt_1760576878191_4_evt1760',
  };

  const valid = validateReceipt(validReceipt);
  if (!valid) {
    console.error('❌ Valid receipt failed validation:', validateReceipt.errors);
    process.exit(1);
  }

  console.log('✅ Valid SignedAuditReceipt passes schema validation');
}

/**
 * Test: Receipt with invalid Merkle hash format fails validation
 */
function testInvalidMerkleHash() {
  const invalidReceipt = {
    event: {
      event_id: 'evt_1760576878191_tqtgu95zqhr',
      timestamp: '2025-10-16T01:07:58.191Z',
      event_type: 'HEALTH',
      operation: 'health_check',
      payload: { status: 'healthy' },
      schemaVersion: '1.1.0',
      policyVersion: '2025-01',
      consentScope: ['audit'],
    },
    merkle: {
      leaf_hash: 'invalid_hash_format',  // Invalid: not 64 hex chars
      root_hash: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
      proof: {
        leaf: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
        siblings: [],
        path: [],
        root: 'a4573ca7237a39d1bc9d83227e176c7c2719cea4feb6cafee972361f57235a5b',
      },
      index: 4,
    },
    signature: {
      signature: '79cubBcivBjAU5UJDDHfLf2CpR1k5n2AKlx/bdFBlTfuI7NtH1/VOjsjPk+aCyHM5dfO964JHaF7ptl/mKgpDQ==',
      algorithm: 'Ed25519',
      alg: 'EdDSA',
      keyId: 'key_1760576878187_dd08fda6',
      timestamp: '2025-10-16T01:07:58.191Z',
    },
    ledger_height: 5,
    receipt_id: 'rcpt_1760576878191_4_evt1760',
  };

  const valid = validateReceipt(invalidReceipt);
  if (valid) {
    console.error('❌ Invalid Merkle hash passed validation (should have failed)');
    process.exit(1);
  }

  console.log('✅ Invalid Merkle hash correctly fails schema validation');
}

// Run all tests
console.log('🧪 Running JSON Schema validation tests...\n');
testValidAuditEvent();
testInvalidAuditEvent();
testValidReceipt();
testInvalidMerkleHash();
console.log('\n✅ All schema validation tests passed');
