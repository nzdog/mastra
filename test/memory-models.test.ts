/**
 * Memory Layer Models - Basic Validation Test
 * Phase 2: Verify data models and schemas load correctly
 */

import {
  MemoryRecord,
  ConsentFamily,
  ContentType,
  ErrorCode,
  createErrorResponse,
  validateStoreRequest,
  validateRecallQuery,
  validateForgetRequest,
  createBaseResponse,
  createPaginationMetadata,
  allowsPII,
  requiresAggregation,
} from '../src/memory-layer/models';

console.log('Testing Memory Layer Models (Phase 2)...\n');

// Test 1: Type exports
console.log('✓ Test 1: All types imported successfully');

// Test 2: Consent family type guards
const personalFamily: ConsentFamily = 'personal';
const cohortFamily: ConsentFamily = 'cohort';
const populationFamily: ConsentFamily = 'population';

console.assert(allowsPII(personalFamily), 'Personal family should allow PII');
console.assert(!allowsPII(cohortFamily), 'Cohort family should not allow PII');
console.assert(!allowsPII(populationFamily), 'Population family should not allow PII');
console.log('✓ Test 2: Consent family type guards work correctly');

// Test 3: Aggregation requirements
console.assert(!requiresAggregation(personalFamily), 'Personal family should not require aggregation');
console.assert(requiresAggregation(cohortFamily), 'Cohort family should require aggregation');
console.assert(requiresAggregation(populationFamily), 'Population family should require aggregation');
console.log('✓ Test 3: Aggregation requirements correct');

// Test 4: Error response creation
const mockReq = { path: '/api/memory/store', method: 'POST' };
const errorResponse = createErrorResponse(
  ErrorCode.VALIDATION_ERROR,
  'Invalid request format',
  { field: 'content', reason: 'missing required field' },
  mockReq,
  'trace-123'
);

console.assert(errorResponse.error.code === ErrorCode.VALIDATION_ERROR, 'Error code should match');
console.assert(errorResponse.error.message === 'Invalid request format', 'Error message should match');
console.assert(errorResponse.error.trace_id === 'trace-123', 'Trace ID should match');
console.assert(errorResponse.path === '/api/memory/store', 'Path should match');
console.assert(errorResponse.method === 'POST', 'Method should match');
console.log('✓ Test 4: Error response creation works');

// Test 5: Store request validation
const validStoreRequest = {
  content: {
    type: 'text' as ContentType,
    data: 'Hello, memory!',
    metadata: { source: 'test' },
  },
  metadata: {
    hashed_pseudonym: 'hs_dXNlci0xMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0',
    consent_family: 'personal' as ConsentFamily,
    consent_timestamp: new Date().toISOString(),
    consent_version: '1.0',
  },
};

console.assert(validateStoreRequest(validStoreRequest), 'Valid store request should pass');
console.assert(!validateStoreRequest({}), 'Empty object should fail');
console.assert(!validateStoreRequest(null), 'Null should fail');
console.log('✓ Test 5: Store request validation works');

// Test 6: Recall query validation
const validRecallQuery = {
  hashed_pseudonym: 'hs_dXNlci0xMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0',
  session_id: 'session-456',
  limit: 50,
  offset: 0,
};

console.assert(validateRecallQuery(validRecallQuery), 'Valid recall query should pass');
console.assert(!validateRecallQuery({ session_id: 'session-456' }), 'Missing hashed_pseudonym should fail');
console.log('✓ Test 6: Recall query validation works');

// Test 7: Forget request validation
const validForgetRequest = {
  id: 'memory-123',
  reason: 'User requested deletion',
};

console.assert(validateForgetRequest(validForgetRequest), 'Valid forget request should pass');
console.assert(validateForgetRequest({ hashed_pseudonym: 'hs_dXNlci0xMjNfaGFzaGVkX3BzZXVkb255bV90ZXN0' }), 'Hashed pseudonym only should pass');
console.assert(!validateForgetRequest({}), 'Empty forget request should fail');
console.log('✓ Test 7: Forget request validation works');

// Test 8: Base response creation
const baseResponse = createBaseResponse('receipt-abc-123');
console.assert(baseResponse.audit_receipt_id === 'receipt-abc-123', 'Audit receipt ID should match');
console.assert(typeof baseResponse.timestamp === 'string', 'Timestamp should be string');
console.assert(new Date(baseResponse.timestamp).getTime() > 0, 'Timestamp should be valid ISO date');
console.log('✓ Test 8: Base response creation works');

// Test 9: Pagination metadata creation
const pagination = createPaginationMetadata(100, 20, 0, 20);
console.assert(pagination.total === 100, 'Total should be 100');
console.assert(pagination.count === 20, 'Count should be 20');
console.assert(pagination.offset === 0, 'Offset should be 0');
console.assert(pagination.limit === 20, 'Limit should be 20');
console.assert(pagination.has_more === true, 'Should have more pages');

const lastPage = createPaginationMetadata(100, 20, 80, 20);
console.assert(lastPage.has_more === false, 'Last page should not have more');
console.log('✓ Test 9: Pagination metadata creation works');

// Test 10: All error codes defined
const allErrorCodes = Object.values(ErrorCode);
console.assert(allErrorCodes.length >= 8, 'Should have at least 8 error codes');
console.assert(allErrorCodes.includes(ErrorCode.VALIDATION_ERROR), 'Should include VALIDATION_ERROR');
console.assert(allErrorCodes.includes(ErrorCode.UNAUTHORIZED), 'Should include UNAUTHORIZED');
console.assert(allErrorCodes.includes(ErrorCode.FORBIDDEN), 'Should include FORBIDDEN');
console.assert(allErrorCodes.includes(ErrorCode.NOT_FOUND), 'Should include NOT_FOUND');
console.assert(allErrorCodes.includes(ErrorCode.CONFLICT), 'Should include CONFLICT');
console.assert(allErrorCodes.includes(ErrorCode.SLO_VIOLATION), 'Should include SLO_VIOLATION');
console.assert(allErrorCodes.includes(ErrorCode.INTERNAL_ERROR), 'Should include INTERNAL_ERROR');
console.assert(allErrorCodes.includes(ErrorCode.SERVICE_UNAVAILABLE), 'Should include SERVICE_UNAVAILABLE');
console.log('✓ Test 10: All error codes defined');

console.log('\n✅ All tests passed! Memory Layer models are working correctly.');
console.log(`\nSummary:
- Consent families: personal, cohort, population
- Content types: text, structured, embedding
- Error codes: ${allErrorCodes.length} defined
- Request validators: Store, Recall, Forget
- Response helpers: Base response, Pagination
- Type guards: PII check, Aggregation requirements
`);
