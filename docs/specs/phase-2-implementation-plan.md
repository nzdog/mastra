# Phase 2 Implementation Plan: APIs & Consent Families

**Status:** Planning
**Branch:** `feature/memory-layer-phase-3.2` → `phase-2-apis-consent`
**Version:** 0.2.0-alpha
**Owner:** Core Team
**Created:** 2025-10-16
**Updated:** 2025-10-16

---

## Overview

Phase 2 builds on the governance and audit foundation established in Phase 1 to implement the six core Memory Layer operations across three API families (Personal, Cohort, Population). This phase introduces consent-aware APIs, error envelopes, SLO enforcement, and comprehensive versioning.

---

## Prerequisites (Phase 1 Complete)

✅ **Phase 0:** Foundations - Long-lived branch, ADR, CI gates
✅ **Phase 1.0:** Governance & Audit - Merkle-chained ledger, signed receipts
✅ **Phase 1.1:** Audit Hardening - Ed25519 + JWKS, schema validation, canonical JSON
✅ **Phase 1.2:** Metrics & Verification - Prometheus instrumentation, CORS hardening

---

## Goals

### Primary Goals
1. **Implement Six Core Operations:** Store, Recall, Distill, Forget, Export, Health
2. **Three API Families:** Personal, Cohort, Population consent levels
3. **Error Envelope Standard:** Consistent error responses with tracing
4. **SLO Enforcement:** Latency thresholds (p50, p95, p99) and availability targets
5. **Version Headers:** API version negotiation and deprecation warnings

### Secondary Goals
1. **Consent-Aware Routing:** Automatic consent family resolution
2. **Operation-Level Audit Events:** Each operation emits audit receipts
3. **Data Model:** Define memory record schema (Store input/output)
4. **Query Interface:** Recall query language and filters
5. **Distillation Engine:** Aggregation and summarization logic

---

## Architecture

### API Structure

```
/v1/{family}/{operation}
```

**Families:**
- `/v1/personal/*` - Individual user consent (highest privacy)
- `/v1/cohort/*` - Group-level consent (anonymized within cohort)
- `/v1/population/*` - Population-level consent (aggregated statistics)

**Operations:**
- `POST /v1/{family}/store` - Store memory record
- `GET /v1/{family}/recall` - Query and retrieve memories
- `POST /v1/{family}/distill` - Aggregate/summarize memories
- `DELETE /v1/{family}/forget` - Delete specific memories
- `GET /v1/{family}/export` - Export user data (GDPR compliance)
- `GET /readyz` - System health (existing, family-agnostic)

### Data Model

**Memory Record Schema:**
```typescript
interface MemoryRecord {
  // Identity
  id: string;                    // UUID v4
  user_id: string;               // Pseudonymized user identifier
  session_id?: string;           // Optional session context

  // Content
  content: {
    type: 'text' | 'structured' | 'embedding';
    data: string | object | number[];
    metadata?: Record<string, any>;
  };

  // Consent
  consent_family: 'personal' | 'cohort' | 'population';
  consent_timestamp: string;     // ISO 8601
  consent_version: string;       // Consent policy version

  // Lifecycle
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  expires_at?: string;           // ISO 8601, null = never
  access_count: number;          // Recall frequency

  // Audit
  audit_receipt_id: string;      // Links to governance ledger
}
```

**Error Envelope:**
```typescript
interface ErrorResponse {
  error: {
    code: string;                // Machine-readable error code
    message: string;             // Human-readable message
    details?: Record<string, any>;
    trace_id: string;            // Request tracing ID (X-Trace-ID)
  };
  timestamp: string;             // ISO 8601
  path: string;                  // Request path
  method: string;                // HTTP method
}
```

### Consent Resolution

**Consent Family Resolution Logic:**
1. Check `Authorization` header for user token
2. Extract user consent preferences from token/session
3. Route request to appropriate family handler
4. Validate operation is allowed for consent level
5. Emit audit event with consent context

**Family Capabilities Matrix:**

| Operation | Personal | Cohort | Population |
|-----------|----------|--------|------------|
| Store     | ✅ Full   | ✅ Anonymized | ✅ Aggregated |
| Recall    | ✅ Full   | ❌ Denied | ❌ Denied |
| Distill   | ✅ Personal | ✅ Cohort-level | ✅ Population-level |
| Forget    | ✅ Full   | ⚠️ Cohort-wide | ❌ Denied |
| Export    | ✅ Full   | ⚠️ Anonymized | ❌ Denied |
| Health    | ✅ N/A    | ✅ N/A | ✅ N/A |

---

## Implementation Tasks

### Task 1: Data Model & Schema (Week 1)

**Files:**
- `src/memory-layer/models/memory-record.ts` - Memory record interface
- `src/memory-layer/models/error-envelope.ts` - Error response interface
- `src/memory-layer/validation/memory-schema.json` - JSON schema for validation
- `test/models/memory-record.test.ts` - Model tests

**Acceptance Criteria:**
- [x] Memory record schema defined and validated
- [x] Error envelope schema defined
- [x] JSON schema validation with Ajv
- [x] Unit tests for all models

**Audit Event:**
```typescript
{
  event_type: 'SCHEMA_DEFINED',
  timestamp: '...',
  details: {
    schema_version: 'v2.0.0',
    model: 'MemoryRecord'
  }
}
```

---

### Task 2: Storage Layer (Week 1-2)

**Files:**
- `src/memory-layer/storage/memory-store.ts` - In-memory storage (dev)
- `src/memory-layer/storage/memory-store-interface.ts` - Storage abstraction
- `test/storage/memory-store.test.ts` - Storage tests

**Acceptance Criteria:**
- [x] In-memory store with CRUD operations
- [x] Index by user_id, session_id, consent_family
- [x] Expiration handling (TTL)
- [x] Audit event emission on Store/Forget
- [x] Unit tests with 90%+ coverage

**Note:** PostgreSQL/DynamoDB integration deferred to Phase 3

---

### Task 3: Store Operation (Week 2)

**Endpoint:** `POST /v1/{family}/store`

**Files:**
- `src/memory-layer/api/store.ts` - Store endpoint handler
- `src/memory-layer/operations/store-operation.ts` - Store business logic
- `test/api/store.test.ts` - E2E store tests

**Request:**
```typescript
POST /v1/personal/store
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": {
    "type": "text",
    "data": "User said: I prefer dark mode"
  },
  "metadata": {
    "context": "settings",
    "confidence": 0.95
  },
  "expires_at": "2026-10-16T00:00:00Z"  // Optional
}
```

**Response:**
```typescript
201 Created
Location: /v1/personal/recall?id=<uuid>

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "usr_abc123",
  "consent_family": "personal",
  "created_at": "2025-10-16T12:00:00Z",
  "audit_receipt_id": "rcpt_xyz789"
}
```

**Acceptance Criteria:**
- [x] Store handler validates consent family
- [x] Generates UUID for memory record
- [x] Validates schema with Ajv
- [x] Emits audit event with receipt
- [x] Returns 201 Created with Location header
- [x] Error handling (400, 401, 403, 500)
- [x] E2E tests for all families

---

### Task 4: Recall Operation (Week 2-3)

**Endpoint:** `GET /v1/{family}/recall`

**Files:**
- `src/memory-layer/api/recall.ts` - Recall endpoint handler
- `src/memory-layer/operations/recall-operation.ts` - Query logic
- `src/memory-layer/query/query-parser.ts` - Query language parser
- `test/api/recall.test.ts` - E2E recall tests

**Request:**
```typescript
GET /v1/personal/recall?user_id=usr_abc123&limit=10&since=2025-10-01T00:00:00Z
Authorization: Bearer <token>
```

**Response:**
```typescript
200 OK

{
  "records": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "content": { ... },
      "created_at": "2025-10-16T12:00:00Z",
      "access_count": 3
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 42,
    "next": "/v1/personal/recall?offset=10&limit=10"
  },
  "audit_receipt_id": "rcpt_abc456"
}
```

**Query Parameters:**
- `user_id` - Filter by user (required for personal)
- `session_id` - Filter by session (optional)
- `since` - Filter by created_at >= timestamp (optional)
- `until` - Filter by created_at <= timestamp (optional)
- `type` - Filter by content.type (optional)
- `limit` - Page size (default: 20, max: 100)
- `offset` - Pagination offset (default: 0)

**Acceptance Criteria:**
- [x] Query parser supports all filters
- [x] Pagination with next/prev links
- [x] Increments access_count on each recall
- [x] Emits audit event with receipt
- [x] Returns 200 OK or 404 if no records
- [x] Error handling (400, 401, 403, 500)
- [x] E2E tests for all query combinations

---

### Task 5: Distill Operation (Week 3)

**Endpoint:** `POST /v1/{family}/distill`

**Files:**
- `src/memory-layer/api/distill.ts` - Distill endpoint handler
- `src/memory-layer/operations/distill-operation.ts` - Aggregation logic
- `src/memory-layer/aggregation/summarizer.ts` - Summary generation
- `test/api/distill.test.ts` - E2E distill tests

**Request:**
```typescript
POST /v1/cohort/distill
Authorization: Bearer <token>
Content-Type: application/json

{
  "cohort_id": "cohort_xyz",
  "aggregation": "count",           // count | avg | sum | summarize
  "filters": {
    "type": "text",
    "since": "2025-10-01T00:00:00Z"
  }
}
```

**Response:**
```typescript
200 OK

{
  "cohort_id": "cohort_xyz",
  "result": {
    "count": 1543,
    "summary": "Most users prefer dark mode (73%)"
  },
  "consent_family": "cohort",
  "timestamp": "2025-10-16T12:00:00Z",
  "audit_receipt_id": "rcpt_distill123"
}
```

**Acceptance Criteria:**
- [x] Supports count, avg, sum aggregations
- [x] Summarize uses Claude API for text summarization
- [x] Respects consent family (no PII in cohort/population)
- [x] Emits audit event with receipt
- [x] Returns 200 OK with aggregation result
- [x] Error handling (400, 401, 403, 500)
- [x] E2E tests for all aggregation types

---

### Task 6: Forget Operation (Week 3-4)

**Endpoint:** `DELETE /v1/{family}/forget`

**Files:**
- `src/memory-layer/api/forget.ts` - Forget endpoint handler
- `src/memory-layer/operations/forget-operation.ts` - Deletion logic
- `test/api/forget.test.ts` - E2E forget tests

**Request:**
```typescript
DELETE /v1/personal/forget?id=550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response:**
```typescript
204 No Content

{
  "deleted_count": 1,
  "audit_receipt_id": "rcpt_forget456"
}
```

**Acceptance Criteria:**
- [x] Supports deletion by id, user_id, session_id
- [x] Personal family: full deletion
- [x] Cohort family: anonymization (content deleted, metadata retained)
- [x] Population family: deny operation (403 Forbidden)
- [x] Emits audit event with receipt (GDPR compliance proof)
- [x] Returns 204 No Content
- [x] Error handling (400, 401, 403, 404, 500)
- [x] E2E tests for all families and scenarios

---

### Task 7: Export Operation (Week 4)

**Endpoint:** `GET /v1/{family}/export`

**Files:**
- `src/memory-layer/api/export.ts` - Export endpoint handler
- `src/memory-layer/operations/export-operation.ts` - Export logic
- `src/memory-layer/export/json-exporter.ts` - JSON export formatter
- `test/api/export.test.ts` - E2E export tests

**Request:**
```typescript
GET /v1/personal/export?user_id=usr_abc123&format=json
Authorization: Bearer <token>
```

**Response:**
```typescript
200 OK
Content-Type: application/json
Content-Disposition: attachment; filename="memory-export-usr_abc123-20251016.json"

{
  "export_metadata": {
    "user_id": "usr_abc123",
    "export_timestamp": "2025-10-16T12:00:00Z",
    "consent_family": "personal",
    "total_records": 42
  },
  "records": [ ... ],
  "audit_receipt_id": "rcpt_export789"
}
```

**Acceptance Criteria:**
- [x] Supports JSON format (CSV deferred to later)
- [x] Personal family: full export with all fields
- [x] Cohort family: anonymized export (no user_id, session_id)
- [x] Population family: deny operation (403 Forbidden)
- [x] Emits audit event with receipt (GDPR compliance proof)
- [x] Returns 200 OK with export file
- [x] Content-Disposition header for download
- [x] Error handling (400, 401, 403, 500)
- [x] E2E tests for all families

---

### Task 8: SLO Enforcement (Week 4-5)

**Files:**
- `src/memory-layer/observability/slo-middleware.ts` - SLO enforcement middleware
- `src/memory-layer/observability/latency-tracker.ts` - Request latency tracking
- `test/observability/slo.test.ts` - SLO tests

**SLO Targets:**
- `store`: p50 < 50ms, p95 < 200ms, p99 < 500ms
- `recall`: p50 < 100ms, p95 < 300ms, p99 < 1000ms
- `distill`: p50 < 500ms, p95 < 2000ms, p99 < 5000ms
- `forget`: p50 < 50ms, p95 < 200ms, p99 < 500ms
- `export`: p50 < 1000ms, p95 < 5000ms, p99 < 10000ms
- `health`: p50 < 20ms, p95 < 50ms, p99 < 100ms

**Metrics:**
```typescript
operation_latency_ms{operation="store", family="personal", status="success"}
slo_violation_total{operation="store", slo="p99"}
```

**Acceptance Criteria:**
- [x] Middleware tracks request latency per operation
- [x] Prometheus metrics for p50, p95, p99
- [x] SLO violation counter when thresholds exceeded
- [x] Response header: `X-SLO-Budget-Remaining: 95%`
- [x] Circuit breaker when SLO violations > 5% in 1 minute
- [x] E2E tests with simulated slow operations

---

### Task 9: Version Headers & Deprecation (Week 5)

**Files:**
- `src/memory-layer/versioning/version-middleware.ts` - Version negotiation
- `src/memory-layer/versioning/deprecation-policy.ts` - Deprecation warnings
- `test/versioning/version.test.ts` - Version tests

**Request Headers:**
- `X-API-Version: 2.0` - Client requests specific version
- `Accept: application/vnd.lichen.v2+json` - Content negotiation

**Response Headers:**
- `X-API-Version: 2.0` - Current API version
- `X-Spec-Version: 0.2.0` - Memory Layer spec version
- `X-Deprecation-Warning: Version 1.0 will be deprecated on 2026-01-01`

**Acceptance Criteria:**
- [x] Middleware parses X-API-Version header
- [x] Defaults to latest version if not specified
- [x] Returns 400 if unsupported version requested
- [x] Deprecation warnings for old versions
- [x] Version reported in /readyz endpoint
- [x] E2E tests for version negotiation

---

### Task 10: Error Handling & Tracing (Week 5)

**Files:**
- `src/memory-layer/errors/error-envelope.ts` - Error response builder
- `src/memory-layer/tracing/trace-id-middleware.ts` - Trace ID injection
- `test/errors/error-handling.test.ts` - Error tests

**Error Codes:**
- `VALIDATION_ERROR` - Request validation failed (400)
- `UNAUTHORIZED` - Missing or invalid token (401)
- `FORBIDDEN` - Operation not allowed for consent family (403)
- `NOT_FOUND` - Record not found (404)
- `CONFLICT` - Record already exists (409)
- `SLO_VIOLATION` - SLO budget exhausted (429)
- `INTERNAL_ERROR` - Server error (500)
- `SERVICE_UNAVAILABLE` - Maintenance mode (503)

**Acceptance Criteria:**
- [x] All errors return consistent ErrorResponse format
- [x] Trace ID injected in all requests (X-Trace-ID)
- [x] Trace ID included in error responses
- [x] Trace ID logged with all audit events
- [x] E2E tests for all error codes

---

## Testing Strategy

### Unit Tests
- Models: MemoryRecord, ErrorResponse validation
- Operations: Store, Recall, Distill, Forget, Export logic
- Query parser: All filter combinations
- Aggregation: Count, avg, sum, summarize

### Integration Tests
- Storage layer: CRUD operations with indexes
- Consent resolution: Family routing logic
- SLO enforcement: Latency tracking and circuit breaking
- Version negotiation: Header parsing and deprecation

### E2E Tests
- All 6 operations across 3 families (18 test cases)
- Error scenarios: 400, 401, 403, 404, 409, 429, 500, 503
- Pagination: Large result sets with next/prev links
- Export: Full user data export (GDPR compliance)

### Smoke Tests
- `test/phase-2-smoke.test.ts` - End-to-end workflow
  1. Store memory (personal)
  2. Recall memory (personal)
  3. Distill memories (cohort)
  4. Forget memory (personal)
  5. Export memories (personal)
  6. Verify all audit receipts

---

## CI/CD Policy Gates

**New Gates for Phase 2:**

```yaml
# .github/workflows/policy-gates.yml

- name: 'Gate: Memory schema validation'
  run: npm run test:memory-schema

- name: 'Gate: Consent family routing'
  run: npm run test:consent-routing

- name: 'Gate: SLO enforcement'
  run: |
    npm run server &
    sleep 5
    npm run test:slo-smoke
    pkill -f "npm run server"

- name: 'Gate: Error envelope compliance'
  run: npm run test:error-envelope

- name: 'Gate: Phase 2 smoke test'
  run: npm run test:phase-2-smoke
```

---

## Documentation

**New Documentation Files:**
- `docs/specs/memory-api-reference.md` - API endpoint documentation
- `docs/specs/consent-families.md` - Consent model explanation
- `docs/specs/error-codes.md` - Complete error code reference
- `docs/runbooks/memory-operations.md` - Operational guide for memory operations
- `docs/runbooks/consent-migration.md` - Guide for migrating users between consent families

**Updated Documentation:**
- `README.md` - Add Phase 2 status and API examples
- `CHANGELOG.md` - Phase 2 release notes
- `env/SPEC_SANDBOX.md` - Add Phase 2 environment variables

---

## Metrics & Observability

**New Prometheus Metrics:**
```typescript
// Operation metrics
memory_operation_total{operation, family, status}
memory_operation_duration_ms{operation, family}

// Storage metrics
memory_records_total{family}
memory_storage_bytes{family}

// SLO metrics
slo_violation_total{operation, slo}
slo_budget_remaining{operation}

// Error metrics
error_responses_total{operation, family, code}
```

**Grafana Dashboard:**
- Operation throughput by family
- Latency percentiles (p50, p95, p99)
- SLO violation trends
- Error rate by operation
- Storage capacity by family

---

## Rollout Plan

### Week 1-2: Development
- Implement data models and storage layer
- Store and Recall operations
- Unit and integration tests

### Week 3-4: Operations
- Distill, Forget, Export operations
- SLO enforcement and version headers
- Error handling and tracing

### Week 5: Testing & Hardening
- E2E smoke tests
- CI gate integration
- Documentation and runbooks

### Week 6: Deployment
- Deploy to `spec-sandbox` environment
- Monitor SLO metrics for 48 hours
- Gradual rollout to staging
- Production readiness review

---

## Dependencies

### Required Packages
- `ajv` - JSON schema validation (already installed)
- `uuid` - UUID generation
- `prom-client` - Prometheus metrics (already installed)
- `express-rate-limit` - SLO circuit breaking (optional)

### Optional Packages (Future)
- `@anthropic-ai/sdk` - For distill summarization (if using Claude)
- `pg` or `@aws-sdk/client-dynamodb` - Persistent storage (Phase 3)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Consent model complexity | High | Start with simple personal/cohort/population, expand later |
| SLO budget exhaustion | Medium | Circuit breaker to prevent cascading failures |
| Query performance (large datasets) | High | Add indexes on user_id, session_id, created_at |
| Storage scalability | High | Deferred to Phase 3 with persistent DB |
| GDPR compliance gaps | Critical | Comprehensive audit logging for all operations |

---

## Success Criteria

### Phase 2 Complete When:
- [x] All 6 operations implemented and tested
- [x] All 3 consent families working correctly
- [x] SLO enforcement with circuit breaker
- [x] Error envelope standard adopted
- [x] Version headers implemented
- [x] 90%+ unit test coverage
- [x] E2E smoke test passing
- [x] CI gates passing
- [x] Documentation complete
- [x] Deployed to spec-sandbox

---

## Phase 3 Preview

**Phase 3 - Privacy, Security, Governance:**
- Token-rotation pseudonymization
- Differential privacy + k-anonymity checks
- AES-256 at-rest encryption
- TLS 1.3 in-transit encryption
- Key rotation ≤90 days
- Access control matrix
- Threat detection hooks

---

## References

- [Phase 1.1 Implementation Plan](./phase-1.1-implementation-plan.md)
- [ADR 0001: Memory Layer Architecture](../adrs/0001-memory-layer-architecture.md)
- [Memory Layer Specification](./memory-layer-spec.md)
- [GitHub Issue #11](https://github.com/nzdog/mastra/issues/11)

---

**Last Updated:** 2025-10-16
**Next Review:** 2025-10-23
**Owner:** Core Team
