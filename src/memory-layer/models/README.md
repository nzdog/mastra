# Memory Layer Models - Phase 2

TypeScript data models and JSON schemas for the Memory Layer APIs & Consent Families.

## Overview

This directory contains all core data models, request/response types, error handling structures, and
JSON schemas for validating memory operations.

## Files

### Core Models

#### `memory-record.ts`

Defines the core `MemoryRecord` interface and related types:

- **MemoryRecord**: Primary data structure for stored memories
- **ConsentFamily**: `'personal' | 'cohort' | 'population'`
- **ContentType**: `'text' | 'structured' | 'embedding'`
- **MemoryContent**: Content wrapper with type, data, and metadata

**Key Features:**

- Hashed/pseudonymous identifiers only in `personal` consent family (e.g., sha256(email+salt))
- All records include audit receipt IDs
- Automatic expiration support via `expires_at`
- Access tracking with `access_count`
- **Privacy Invariant**: NO raw emails, names, SSNs, or direct identifiers

**Helper Functions:**

```typescript
allowsPII(family: ConsentFamily): boolean
requiresAggregation(family: ConsentFamily): boolean
createMemoryRecord(partial): Omit<MemoryRecord, 'id' | 'created_at' | 'updated_at' | 'audit_receipt_id'>
```

#### `error-envelope.ts`

Standard error response structure for consistent API error handling:

- **ErrorCode**: Enum with 8 standard error codes
- **ErrorResponse**: Standardized error envelope
- **ERROR_HTTP_STATUS**: Mapping of error codes to HTTP status codes

**Error Codes:**

- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `INTERNAL_ERROR` (500)
- `SLO_VIOLATION` (503)
- `SERVICE_UNAVAILABLE` (503)

**Helper Functions:**

```typescript
createErrorResponse(code, message, details, req, traceId?): ErrorResponse
getStatusCode(code: ErrorCode): number
isErrorResponse(obj): obj is ErrorResponse
```

### Request Models

#### `operation-requests.ts`

Request structures for all memory operations:

**StoreRequest**

- Store new memories with content, metadata, and consent info
- Required fields: `content`, `metadata.user_id`, `metadata.consent_family`,
  `metadata.consent_timestamp`, `metadata.consent_version`

**RecallQuery**

- Retrieve personal memories with filtering and pagination
- Required: `user_id`
- Optional: `session_id`, `since`, `until`, `type`, `limit`, `offset`, `sort`

**DistillRequest**

- Aggregate cohort/population data with privacy thresholds
- Required: `aggregation.type`
- Aggregation types: `count`, `average`, `sum`, `min`, `max`, `distribution`
- Optional: `cohort_id`, `filters`, `min_records` (default: 10)

**ForgetRequest**

- Delete memories (GDPR right to be forgotten)
- At least one of: `id`, `user_id`, `session_id`
- Optional: `reason`, `hard_delete`

**ExportRequest**

- Export user data (GDPR data portability)
- Required: `user_id`, `format` (`json` | `csv` | `jsonlines`)
- Optional: `filters`, `include_audit`

**Validation Functions:**

```typescript
validateStoreRequest(req): req is StoreRequest
validateRecallQuery(query): query is RecallQuery
validateForgetRequest(req): req is ForgetRequest
```

### Response Models

#### `operation-responses.ts`

Response structures for all memory operations. All responses extend `BaseResponse` with
`audit_receipt_id` and `timestamp`.

**StoreResponse**

- Returns: `id`, `user_id`, `session_id`, `consent_family`, `created_at`, `expires_at`

**RecallResponse**

- Returns: `records[]`, `pagination`, `query` metadata
- Pagination includes: `total`, `count`, `offset`, `limit`, `has_more`

**DistillResponse**

- Returns: `results[]`, `metadata`, `consent_family`, `cohort_id`
- Each result includes: `type`, `value`, `record_count`, `time_bucket`
- Metadata includes privacy threshold validation

**ForgetResponse**

- Returns: `deleted_count`, `deleted_ids[]`, `hard_delete`, `metadata`

**ExportResponse**

- Returns: `export_url` or `data`, `metadata`, `expires_at`
- Metadata includes: format, record count, size, time range, consent families

**Helper Functions:**

```typescript
createBaseResponse(audit_receipt_id): BaseResponse
createPaginationMetadata(total, count, offset, limit): Pagination
isStoreResponse(obj): obj is StoreResponse
isRecallResponse(obj): obj is RecallResponse
```

### Central Export

#### `index.ts`

Barrel export for all models - import everything from here:

```typescript
import {
  MemoryRecord,
  ConsentFamily,
  ErrorCode,
  createErrorResponse,
  StoreRequest,
  RecallResponse,
  // ... all types and helpers
} from '../memory-layer/models';
```

## Validation Schema

### `../validation/memory-schema.json`

JSON Schema (Draft 7) for validating MemoryRecord and all request types using Ajv.

**Included Definitions:**

- `MemoryRecord` - Main schema
- `StoreRequest` - Store operation validation
- `RecallQuery` - Recall query validation
- `DistillRequest` - Distillation request validation
- `ForgetRequest` - Forget request validation
- `ExportRequest` - Export request validation

**Key Validations:**

- UUID format for `id` and `audit_receipt_id`
- ISO 8601 date-time format for timestamps
- Semantic versioning for `consent_version`
- Content type enum enforcement
- Min/max constraints on numeric fields
- Required field enforcement

## Usage Example

```typescript
import {
  MemoryRecord,
  ConsentFamily,
  StoreRequest,
  createErrorResponse,
  ErrorCode,
  validateStoreRequest,
} from './memory-layer/models';

// Create a store request
const storeReq: StoreRequest = {
  content: {
    type: 'text',
    data: 'User preference: dark mode enabled',
  },
  metadata: {
    user_id: 'user-123',
    session_id: 'session-abc',
    consent_family: 'personal',
    consent_timestamp: new Date().toISOString(),
    consent_version: '1.0',
  },
  expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
};

// Validate request
if (!validateStoreRequest(storeReq)) {
  const error = createErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    'Invalid store request',
    { details: 'Missing required fields' },
    { path: '/memory/store', method: 'POST' }
  );
  return error;
}

// Check consent family rules
import { allowsPII } from './memory-layer/models';
if (!allowsPII(storeReq.metadata.consent_family)) {
  // Strip PII before storage
}
```

## Architecture Principles

1. **Governance by Design**: Every response includes `audit_receipt_id` for traceability
2. **Consent Boundaries**: Hashed/pseudonymous identifiers only in `personal` family, aggregation
   required for `cohort`/`population`
3. **Type Safety**: Full TypeScript typing with runtime validators
4. **Error Consistency**: Standardized error envelopes across all APIs
5. **GDPR Compliance**: Built-in support for right to be forgotten and data portability
6. **Privacy Thresholds**: Distillation includes `min_records` to prevent re-identification
7. **Privacy Invariant**: Memory enriches but never controls. NO raw PII, ever.

## Testing

Run the model validation test:

```bash
npx tsx test/memory-models.test.ts
```

## Next Steps (Phase 2 Continued)

- [ ] Implement HTTP handlers using these models
- [ ] Add Ajv runtime validation middleware
- [ ] Create in-memory storage backend
- [ ] Implement consent boundary enforcement
- [ ] Add metrics for memory operations
