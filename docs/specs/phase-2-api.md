# Phase 2 API Documentation

Memory Layer API Reference for consent-aware memory operations.

**Version:** 1.0.0
**Status:** Phase 2 Complete
**Branch:** `feature/memory-layer-phase-2`

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Consent Families](#consent-families)
- [Endpoints](#endpoints)
- [Request/Response Examples](#requestresponse-examples)
- [Error Codes](#error-codes)
- [SLO Targets](#slo-targets)
- [Rate Limiting](#rate-limiting)
- [Headers](#headers)

---

## Overview

The Memory Layer API provides consent-aware memory operations across three consent families: personal, cohort, and population. All operations emit audit events and return audit receipt IDs for governance tracking.

**Base URL:** `http://localhost:4099/v1` (development)

**Key Features:**
- Consent family-based access control
- Cryptographic audit trail (Ed25519 signatures)
- SLO-enforced latency targets
- Circuit breaker for SLO violations
- Comprehensive error envelopes

---

## Authentication

All memory operation endpoints require Bearer token authentication.

**Header:**
```
Authorization: Bearer <token>
```

**Token Validation:**
- Tokens must be at least 10 characters
- Format: `Bearer <token>`
- Invalid or expired tokens return `401 Unauthorized`

**Development Mode:**
- Accepts any token matching the format above
- Extracts user_id from token (e.g., `user_abc123` from token `user_abc123`)

**Production:**
- JWT tokens with signature verification
- Token expiration enforcement
- Scope validation per consent family

---

## Consent Families

Consent families define data sharing boundaries and access rules.

### Consent Family Capability Matrix

| Family       | PII Allowed | Operations Allowed              | Min K-Anonymity | DP Budget |
|--------------|-------------|---------------------------------|-----------------|-----------|
| **Personal** | Yes         | store, recall, forget, export   | N/A             | N/A       |
| **Cohort**   | No          | store, recall, distill          | 5               | Per-cohort |
| **Population** | No        | distill                         | 100             | Global    |

### Personal Family

- **Access:** User-only, includes PII
- **Use Cases:** User preferences, session history, personalized recommendations
- **Operations:** Store, recall, forget, export
- **Authorization:** User must own the data (user_id match)

### Cohort Family

- **Access:** Group-level aggregated data, no PII
- **Use Cases:** Cohort analytics, A/B testing, feature usage by segment
- **Operations:** Store, recall, distill
- **K-Anonymity:** Minimum 5 records required for aggregation
- **Authorization:** User must be member of cohort

### Population Family

- **Access:** System-wide aggregated data, no PII
- **Use Cases:** Global metrics, system-wide trends, population statistics
- **Operations:** Distill only (no individual record access)
- **K-Anonymity:** Minimum 100 records required for aggregation
- **Authorization:** User must have population-level access

---

## Endpoints

### Health Check

**GET** `/v1/health`

Returns service health status and audit system metrics.

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-17T12:00:00Z",
  "version": "1.0.0",
  "audit_system": {
    "ledger_height": 1234,
    "last_receipt_timestamp": "2025-10-17T11:59:58Z",
    "merkle_chain_valid": true
  }
}
```

---

### Store Operation

**POST** `/v1/{family}/store`

Stores a new memory record with consent family validation.

**Path Parameters:**
- `family` (string, required): Consent family (`personal`, `cohort`)

**Request Body:**
```json
{
  "content": {
    "type": "text|structured|embedding",
    "data": "<content>",
    "metadata": {}
  },
  "metadata": {
    "user_id": "string",
    "session_id": "string (optional)",
    "consent_family": "personal|cohort",
    "consent_timestamp": "ISO 8601",
    "consent_version": "string"
  },
  "expires_at": "ISO 8601 (optional)"
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_12345",
  "session_id": "session_abc123",
  "consent_family": "personal",
  "created_at": "2025-10-17T12:00:00Z",
  "expires_at": "2025-10-24T12:00:00Z",
  "audit_receipt_id": "receipt_xyz789",
  "timestamp": "2025-10-17T12:00:00Z"
}
```

**SLO Target:** 500ms (p99)

---

### Recall Operation

**GET** `/v1/{family}/recall`

Retrieves memory records with consent family enforcement.

**Path Parameters:**
- `family` (string, required): Consent family (`personal`, `cohort`)

**Query Parameters:**
- `user_id` (string, required): User identifier
- `session_id` (string, optional): Session filter
- `since` (ISO 8601, optional): Filter records created after this timestamp
- `until` (ISO 8601, optional): Filter records created before this timestamp
- `type` (string, optional): Content type filter (`text`, `structured`, `embedding`)
- `limit` (integer, optional): Max results (default: 100, max: 1000)
- `offset` (integer, optional): Pagination offset (default: 0)
- `sort` (string, optional): Sort order (`asc`, `desc`, default: `desc`)

**Response (200 OK):**
```json
{
  "records": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user_12345",
      "session_id": "session_abc123",
      "content": {
        "type": "text",
        "data": "User completed tutorial",
        "metadata": {}
      },
      "consent_family": "personal",
      "consent_timestamp": "2025-10-17T12:00:00Z",
      "consent_version": "1.0",
      "created_at": "2025-10-17T12:00:00Z",
      "updated_at": "2025-10-17T12:00:00Z",
      "access_count": 1,
      "audit_receipt_id": "receipt_xyz789"
    }
  ],
  "pagination": {
    "total": 1,
    "count": 1,
    "offset": 0,
    "limit": 100,
    "has_more": false
  },
  "query": {
    "user_id": "user_12345",
    "session_id": "session_abc123",
    "since": "2025-10-01T00:00:00Z"
  },
  "audit_receipt_id": "receipt_recall_123",
  "timestamp": "2025-10-17T12:00:01Z"
}
```

**SLO Target:** 1000ms (p99)

---

### Distill Operation

**POST** `/v1/{family}/distill`

Aggregates data with consent family enforcement and k-anonymity.

**Path Parameters:**
- `family` (string, required): Consent family (`cohort`, `population`)

**Request Body:**
```json
{
  "cohort_id": "cohort_premium_users (optional, required for cohort)",
  "aggregation": {
    "type": "count|average|sum|min|max|distribution",
    "field": "field_name (optional, for structured data)",
    "time_bucket": "hour|day|week|month (optional)"
  },
  "filters": {
    "content_type": "text|structured|embedding (optional)",
    "consent_family": "cohort|population (optional)",
    "since": "ISO 8601 (optional)",
    "until": "ISO 8601 (optional)"
  },
  "min_records": 5
}
```

**Response (200 OK):**
```json
{
  "cohort_id": "cohort_premium_users",
  "consent_family": "cohort",
  "results": [
    {
      "type": "count",
      "value": 47,
      "record_count": 47,
      "time_bucket": "day",
      "bucket_timestamp": "2025-10-17T00:00:00Z"
    }
  ],
  "metadata": {
    "total_records": 50,
    "filtered_records": 47,
    "privacy_threshold_met": true,
    "min_records": 5,
    "time_range": {
      "start": "2025-10-17T00:00:00Z",
      "end": "2025-10-17T23:59:59Z"
    }
  },
  "audit_receipt_id": "receipt_distill_456",
  "timestamp": "2025-10-17T12:00:02Z"
}
```

**K-Anonymity Requirements:**
- Cohort: Minimum 5 records
- Population: Minimum 100 records

**SLO Target:** 5000ms (p99)

---

### Forget Operation

**DELETE** `/v1/{family}/forget`

Deletes memory records with consent family enforcement. Supports GDPR right to be forgotten.

**Path Parameters:**
- `family` (string, required): Consent family (`personal`)

**Query Parameters:**
- `id` (string, optional): Specific memory record ID to delete
- `user_id` (string, optional): Delete all memories for this user
- `session_id` (string, optional): Delete all memories for this session
- `reason` (string, optional): Deletion reason (for audit trail)
- `hard_delete` (boolean, optional): Hard delete vs soft delete (default: false)

**Note:** At least one of `id`, `user_id`, or `session_id` must be provided.

**Response (200 OK):**
```json
{
  "deleted_count": 3,
  "deleted_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "hard_delete": false,
  "metadata": {
    "user_id": "user_12345",
    "reason": "GDPR data deletion request"
  },
  "audit_receipt_id": "receipt_forget_789",
  "timestamp": "2025-10-17T12:00:03Z"
}
```

**SLO Target:** 500ms (p99)

---

### Export Operation

**GET** `/v1/{family}/export`

Exports user data with consent family enforcement. Supports GDPR data portability.

**Path Parameters:**
- `family` (string, required): Consent family (`personal`)

**Query Parameters:**
- `user_id` (string, required): User identifier
- `format` (string, required): Export format (`json`, `csv`, `jsonlines`)
- `consent_families` (array, optional): Filter by families (comma-separated)
- `since` (ISO 8601, optional): Filter records created after this timestamp
- `until` (ISO 8601, optional): Filter records created before this timestamp
- `include_deleted` (boolean, optional): Include soft-deleted records (default: false)
- `include_audit` (boolean, optional): Include audit trail (default: false)

**Response (200 OK):**
```json
{
  "export_url": "https://exports.example.com/user_12345_export.json",
  "data": {
    "records": []
  },
  "metadata": {
    "user_id": "user_12345",
    "format": "json",
    "record_count": 42,
    "size_bytes": 15360,
    "time_range": {
      "start": "2025-01-01T00:00:00Z",
      "end": "2025-10-17T12:00:00Z"
    },
    "consent_families": ["personal"],
    "includes_deleted": false,
    "includes_audit": false
  },
  "expires_at": "2025-10-24T12:00:00Z",
  "audit_receipt_id": "receipt_export_012",
  "timestamp": "2025-10-17T12:00:04Z"
}
```

**SLO Target:** 10000ms (p99)

---

## Request/Response Examples

### Example 1: Store Personal Text Memory

**Request:**
```bash
curl -X POST http://localhost:4099/v1/personal/store \
  -H "Authorization: Bearer user_alice123" \
  -H "Content-Type: application/json" \
  -H "X-Trace-ID: trace_abc123" \
  -d '{
    "content": {
      "type": "text",
      "data": "User completed onboarding tutorial"
    },
    "metadata": {
      "user_id": "user_alice123",
      "session_id": "session_xyz789",
      "consent_family": "personal",
      "consent_timestamp": "2025-10-17T12:00:00Z",
      "consent_version": "1.0"
    }
  }'
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_alice123",
  "session_id": "session_xyz789",
  "consent_family": "personal",
  "created_at": "2025-10-17T12:00:00.123Z",
  "audit_receipt_id": "receipt_1729166400123_abc",
  "timestamp": "2025-10-17T12:00:00.123Z"
}
```

---

### Example 2: Recall Personal Memories

**Request:**
```bash
curl -X GET "http://localhost:4099/v1/personal/recall?user_id=user_alice123&limit=10" \
  -H "Authorization: Bearer user_alice123"
```

**Response (200):**
```json
{
  "records": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user_alice123",
      "session_id": "session_xyz789",
      "content": {
        "type": "text",
        "data": "User completed onboarding tutorial",
        "metadata": {}
      },
      "consent_family": "personal",
      "consent_timestamp": "2025-10-17T12:00:00Z",
      "consent_version": "1.0",
      "created_at": "2025-10-17T12:00:00.123Z",
      "updated_at": "2025-10-17T12:00:00.123Z",
      "access_count": 1,
      "audit_receipt_id": "receipt_1729166400123_abc"
    }
  ],
  "pagination": {
    "total": 1,
    "count": 1,
    "offset": 0,
    "limit": 10,
    "has_more": false
  },
  "query": {
    "user_id": "user_alice123"
  },
  "audit_receipt_id": "receipt_1729166401456_def",
  "timestamp": "2025-10-17T12:00:01.456Z"
}
```

---

### Example 3: Distill Cohort Aggregation

**Request:**
```bash
curl -X POST http://localhost:4099/v1/cohort/distill \
  -H "Authorization: Bearer cohort_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "cohort_id": "cohort_premium_users",
    "aggregation": {
      "type": "count",
      "field": "feature_name"
    },
    "filters": {
      "content_type": "structured",
      "consent_family": "cohort"
    },
    "min_records": 5
  }'
```

**Response (200):**
```json
{
  "cohort_id": "cohort_premium_users",
  "consent_family": "cohort",
  "results": [
    {
      "type": "count",
      "value": {
        "dark_mode": 23,
        "export_data": 15,
        "advanced_filters": 9
      },
      "record_count": 47
    }
  ],
  "metadata": {
    "total_records": 50,
    "filtered_records": 47,
    "privacy_threshold_met": true,
    "min_records": 5
  },
  "audit_receipt_id": "receipt_1729166402789_ghi",
  "timestamp": "2025-10-17T12:00:02.789Z"
}
```

---

### Example 4: Forget User Data (GDPR)

**Request:**
```bash
curl -X DELETE "http://localhost:4099/v1/personal/forget?user_id=user_alice123&reason=GDPR%20deletion%20request" \
  -H "Authorization: Bearer user_alice123"
```

**Response (200):**
```json
{
  "deleted_count": 12,
  "deleted_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "hard_delete": false,
  "metadata": {
    "user_id": "user_alice123",
    "reason": "GDPR deletion request"
  },
  "audit_receipt_id": "receipt_1729166403012_jkl",
  "timestamp": "2025-10-17T12:00:03.012Z"
}
```

---

### Example 5: Export User Data (GDPR)

**Request:**
```bash
curl -X GET "http://localhost:4099/v1/personal/export?user_id=user_alice123&format=json&include_audit=true" \
  -H "Authorization: Bearer user_alice123"
```

**Response (200):**
```json
{
  "data": {
    "records": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "content": {
          "type": "text",
          "data": "User completed onboarding tutorial"
        },
        "created_at": "2025-10-17T12:00:00.123Z"
      }
    ]
  },
  "metadata": {
    "user_id": "user_alice123",
    "format": "json",
    "record_count": 1,
    "size_bytes": 256,
    "time_range": {
      "start": "2025-10-17T00:00:00Z",
      "end": "2025-10-17T12:00:00Z"
    },
    "consent_families": ["personal"],
    "includes_deleted": false,
    "includes_audit": true
  },
  "audit_receipt_id": "receipt_1729166404345_mno",
  "timestamp": "2025-10-17T12:00:04.345Z"
}
```

---

## Error Codes

All errors follow a standardized error envelope structure.

### Error Envelope Structure

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "additional": "context"
    },
    "trace_id": "trace_abc123"
  },
  "timestamp": "2025-10-17T12:00:00Z",
  "path": "/v1/personal/store",
  "method": "POST"
}
```

### Error Code Reference

| Code                    | HTTP Status | Description                                      | Resolution                                     |
|-------------------------|-------------|--------------------------------------------------|------------------------------------------------|
| `VALIDATION_ERROR`      | 400         | Request validation failed                        | Check request body/query params against schema |
| `UNAUTHORIZED`          | 401         | Authentication required or failed                | Provide valid Bearer token                     |
| `FORBIDDEN`             | 403         | Authenticated but lacks permission               | Check consent family authorization             |
| `NOT_FOUND`             | 404         | Requested resource not found                     | Verify resource ID or query parameters         |
| `CONFLICT`              | 409         | Resource conflict (e.g., duplicate ID)           | Use different ID or handle existing resource   |
| `SLO_VIOLATION`         | 503         | Service Level Objective violation                | Circuit breaker open, retry after delay        |
| `INTERNAL_ERROR`        | 500         | Unexpected server error                          | Contact support with trace_id                  |
| `SERVICE_UNAVAILABLE`   | 503         | Service temporarily unavailable                  | Retry with exponential backoff                 |

### Common Error Scenarios

#### 1. Missing Authorization Header

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing Authorization header"
  },
  "timestamp": "2025-10-17T12:00:00Z",
  "path": "/v1/personal/store",
  "method": "POST"
}
```

#### 2. Invalid Consent Family

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid consent family in path. Must be one of: personal, cohort, population",
    "details": {
      "path": "/v1/invalid/store",
      "valid_families": ["personal", "cohort", "population"]
    }
  },
  "timestamp": "2025-10-17T12:00:00Z",
  "path": "/v1/invalid/store",
  "method": "POST"
}
```

#### 3. K-Anonymity Threshold Not Met

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Privacy threshold not met. Minimum 5 records required for cohort aggregation.",
    "details": {
      "consent_family": "cohort",
      "min_records": 5,
      "actual_records": 3
    }
  },
  "timestamp": "2025-10-17T12:00:00Z",
  "path": "/v1/cohort/distill",
  "method": "POST"
}
```

#### 4. Circuit Breaker Open (SLO Violation)

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable due to SLO violations. Operation: distill",
    "details": {
      "operation": "distill",
      "violation_count": 15,
      "trace_id": "trace_abc123"
    }
  },
  "timestamp": "2025-10-17T12:00:00Z",
  "path": "/v1/cohort/distill",
  "method": "POST"
}
```

---

## SLO Targets

Service Level Objectives (SLOs) define latency targets for each operation at the 99th percentile (p99).

### SLO Target Table

| Operation | p99 Latency Target | Circuit Breaker Threshold |
|-----------|-------------------|---------------------------|
| Store     | 500ms             | 50% violation rate over 1 min |
| Recall    | 1000ms            | 50% violation rate over 1 min |
| Distill   | 5000ms            | 50% violation rate over 1 min |
| Forget    | 500ms             | 50% violation rate over 1 min |
| Export    | 10000ms           | 50% violation rate over 1 min |
| Health    | 100ms             | N/A |

### SLO Enforcement

1. **Latency Tracking:** Every request is tracked with a start timestamp
2. **SLO Header:** Response includes `X-SLO-Latency` header (e.g., `245ms`)
3. **Violation Detection:** If latency exceeds p99 target, violation is recorded
4. **Circuit Breaker:** If violation rate exceeds 50% over 1-minute window, circuit opens
5. **Recovery:** Circuit closes automatically when violation rate drops below threshold

### Circuit Breaker Behavior

**Closed (Normal Operation):**
- All requests processed normally
- Latency violations recorded
- If violations exceed threshold → Open

**Open (Service Unavailable):**
- Returns `503 SERVICE_UNAVAILABLE` immediately
- Error response includes violation count
- Clients should retry with exponential backoff
- Circuit closes when violation rate drops

**Monitoring:**
- Prometheus metric: `slo_violation_total{operation, slo}`
- Prometheus metric: `memory_operation_latency_ms{operation, family, status}`

---

## Rate Limiting

**Current Status:** No rate limiting implemented in Phase 2

**Planned for Phase 3:**
- Per-user rate limits: 100 req/min (personal), 10 req/min (cohort/population)
- Per-IP rate limits: 1000 req/min
- Burst allowance: 2x rate limit for 10 seconds
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Headers

### Request Headers

| Header          | Required | Description                                      |
|-----------------|----------|--------------------------------------------------|
| `Authorization` | Yes*     | Bearer token for authentication (*except /health) |
| `Content-Type`  | For POST | Must be `application/json`                       |
| `X-Trace-ID`    | No       | Optional trace ID for request correlation        |

### Response Headers

| Header            | Always Present | Description                              |
|-------------------|----------------|------------------------------------------|
| `X-API-Version`   | Yes            | API version (e.g., `1.0.0`)              |
| `X-Spec-Version`  | Yes            | Specification version (e.g., `1.0`)      |
| `X-SLO-Latency`   | For operations | Request latency in milliseconds          |
| `Content-Type`    | Yes            | Always `application/json`                |

---

## Related Documentation

- [OpenAPI Specification](../../openapi/memory-layer-v1.yaml)
- [Phase 2 Rollout Runbook](../runbooks/phase-2-rollout.md)
- [Consent Family Triage Guide](../runbooks/consent-family-triage.md)
- [CHANGELOG](../../CHANGELOG.md)

---

**Invariant:** Memory enriches but never controls.
