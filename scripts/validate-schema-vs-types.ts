/**
 * Schema ↔ TypeScript Alignment Validator
 * Phase 3.2: CI script to prevent schema drift
 *
 * This script validates that JSON Schema definitions match TypeScript models.
 * It tests canonical fixtures against both:
 * 1. JSON Schema validation (AJV)
 * 2. TypeScript runtime type guards
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as memorySchema from '../src/memory-layer/validation/memory-schema.json';
import {
  validateStoreRequest,
  validateRecallQuery,
  validateForgetRequest,
} from '../src/memory-layer/models/operation-requests';

// Initialize AJV
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Compile schemas
const storeRequestSchema = ajv.compile(memorySchema.definitions.StoreRequest);
const recallQuerySchema = ajv.compile(memorySchema.definitions.RecallQuery);
const forgetRequestSchema = ajv.compile(memorySchema.definitions.ForgetRequest);

// Test fixtures
const fixtures = {
  validStoreRequest: {
    content: {
      type: 'text',
      data: 'Test memory content',
    },
    metadata: {
      hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
      consent_family: 'personal',
      consent_timestamp: '2025-01-15T12:00:00Z',
      consent_version: '1.0',
    },
  },
  validRecallQuery: {
    hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
    limit: 100,
    offset: 0,
  },
  validForgetRequest: {
    id: '550e8400-e29b-41d4-a716-446655440000',
  },
  invalidStoreRequest_noMetadata: {
    content: {
      type: 'text',
      data: 'Test',
    },
    // Missing metadata field
  },
  invalidStoreRequest_badFamily: {
    content: {
      type: 'text',
      data: 'Test',
    },
    metadata: {
      hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
      consent_family: 'invalid_family', // Not a valid enum value
      consent_timestamp: '2025-01-15T12:00:00Z',
      consent_version: '1.0',
    },
  },
};

let failures = 0;

console.log('='.repeat(80));
console.log('Schema ↔ TypeScript Alignment Validator');
console.log('='.repeat(80));
console.log('');

// Test: Valid StoreRequest
console.log('[TEST] Valid StoreRequest');
const validStoreRequestSchemaResult = storeRequestSchema(fixtures.validStoreRequest);
const validStoreRequestTsResult = validateStoreRequest(fixtures.validStoreRequest);

if (validStoreRequestSchemaResult !== validStoreRequestTsResult) {
  console.error(
    `  ❌ MISMATCH: Schema=${validStoreRequestSchemaResult}, TS=${validStoreRequestTsResult}`
  );
  failures++;
} else if (!validStoreRequestSchemaResult) {
  console.error(`  ❌ FAIL: Both rejected valid fixture`);
  failures++;
} else {
  console.log(`  ✅ PASS: Both accepted valid fixture`);
}

// Test: Invalid StoreRequest (no metadata)
console.log('[TEST] Invalid StoreRequest (no metadata)');
const invalidStoreRequestSchemaResult = storeRequestSchema(fixtures.invalidStoreRequest_noMetadata);
const invalidStoreRequestTsResult = validateStoreRequest(fixtures.invalidStoreRequest_noMetadata);

if (invalidStoreRequestSchemaResult !== invalidStoreRequestTsResult) {
  console.error(
    `  ❌ MISMATCH: Schema=${invalidStoreRequestSchemaResult}, TS=${invalidStoreRequestTsResult}`
  );
  failures++;
} else if (invalidStoreRequestSchemaResult) {
  console.error(`  ❌ FAIL: Both accepted invalid fixture`);
  failures++;
} else {
  console.log(`  ✅ PASS: Both rejected invalid fixture`);
}

// Test: Invalid StoreRequest (bad consent_family)
console.log('[TEST] Invalid StoreRequest (bad consent_family)');
const invalidFamilySchemaResult = storeRequestSchema(fixtures.invalidStoreRequest_badFamily);

if (invalidFamilySchemaResult) {
  console.error(`  ❌ FAIL: Schema accepted invalid consent_family`);
  console.error(`  Schema errors:`, storeRequestSchema.errors);
  failures++;
} else {
  console.log(`  ✅ PASS: Schema rejected invalid consent_family`);
}

// Test: Valid RecallQuery
console.log('[TEST] Valid RecallQuery');
const validRecallQuerySchemaResult = recallQuerySchema(fixtures.validRecallQuery);
const validRecallQueryTsResult = validateRecallQuery(fixtures.validRecallQuery);

if (validRecallQuerySchemaResult !== validRecallQueryTsResult) {
  console.error(
    `  ❌ MISMATCH: Schema=${validRecallQuerySchemaResult}, TS=${validRecallQueryTsResult}`
  );
  failures++;
} else if (!validRecallQuerySchemaResult) {
  console.error(`  ❌ FAIL: Both rejected valid fixture`);
  failures++;
} else {
  console.log(`  ✅ PASS: Both accepted valid fixture`);
}

// Test: Valid ForgetRequest
console.log('[TEST] Valid ForgetRequest');
const validForgetRequestSchemaResult = forgetRequestSchema(fixtures.validForgetRequest);
const validForgetRequestTsResult = validateForgetRequest(fixtures.validForgetRequest);

if (validForgetRequestSchemaResult !== validForgetRequestTsResult) {
  console.error(
    `  ❌ MISMATCH: Schema=${validForgetRequestSchemaResult}, TS=${validForgetRequestTsResult}`
  );
  failures++;
} else if (!validForgetRequestSchemaResult) {
  console.error(`  ❌ FAIL: Both rejected valid fixture`);
  failures++;
} else {
  console.log(`  ✅ PASS: Both accepted valid fixture`);
}

console.log('');
console.log('='.repeat(80));
console.log(`Results: ${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} FAILURES`}`);
console.log('='.repeat(80));

if (failures > 0) {
  process.exit(1);
}
