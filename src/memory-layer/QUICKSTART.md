# Memory Layer Phase 2 - Quick Start Guide

## Overview

Phase 2 middleware and storage components are ready for integration. This guide shows you how to use
them.

## Installation

No new dependencies needed! All components use existing packages:

- `express` - Web framework
- `ajv` + `ajv-formats` - Schema validation
- `prom-client` - Metrics

## Basic Setup

### 1. Import Middleware

```typescript
import {
  consentResolver,
  sloMiddleware,
  schemaValidator,
  errorHandler,
  notFoundHandler,
} from './memory-layer/middleware';
```

### 2. Import Storage

```typescript
import { getMemoryStore } from './memory-layer/storage';
```

### 3. Register Middleware (Order Matters!)

```typescript
import express from 'express';

const app = express();

// JSON body parser
app.use(express.json());

// 1. SLO tracking (first, to measure everything)
app.use(sloMiddleware);

// 2. Consent resolution (auth & authz)
app.use(consentResolver);

// 3. Schema validation (after auth)
app.use(schemaValidator);

// 4. Your routes go here
app.post('/v1/:family/store', storeHandler);
app.get('/v1/:family/recall', recallHandler);

// 5. 404 handler (after all routes)
app.use(notFoundHandler);

// 6. Error handler (MUST be last)
app.use(errorHandler);
```

## Example Operation Handler

### Store Operation

```typescript
import { asyncHandler } from './memory-layer/middleware';
import { getMemoryStore } from './memory-layer/storage';
import { getAuditEmitter } from './memory-layer/governance/audit-emitter';
import { randomUUID } from 'crypto';

app.post(
  '/v1/:family/store',
  asyncHandler(async (req, res) => {
    const store = getMemoryStore();
    const auditor = getAuditEmitter();

    // Consent context is already attached by middleware
    const { family, user_id, trace_id } = req.consentContext!;

    // Extract request data (already validated by schema middleware)
    const { content, metadata, expires_at } = req.body;

    // Create memory record
    const record = {
      id: randomUUID(),
      user_id: metadata.user_id,
      session_id: metadata.session_id,
      content,
      consent_family: family,
      consent_timestamp: metadata.consent_timestamp,
      consent_version: metadata.consent_version,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at,
      access_count: 0,
      audit_receipt_id: '', // Will be filled by audit
    };

    // Emit audit event
    const receipt = await auditor.emit(
      'STORE',
      'memory_store',
      { record_id: record.id },
      { consent_level: family, scope: req.consentContext!.scope },
      user_id
    );

    record.audit_receipt_id = receipt.receipt_id;

    // Store in database
    const stored = await store.store(record);

    // Return response
    res.status(201).json({
      id: stored.id,
      user_id: stored.user_id,
      consent_family: stored.consent_family,
      created_at: stored.created_at,
      audit_receipt_id: stored.audit_receipt_id,
    });
  })
);
```

### Recall Operation

```typescript
app.get(
  '/v1/:family/recall',
  asyncHandler(async (req, res) => {
    const store = getMemoryStore();
    const auditor = getAuditEmitter();

    // Consent context from middleware
    const { user_id, trace_id } = req.consentContext!;

    // Query params (already validated)
    const query = {
      user_id: req.query.user_id as string,
      session_id: req.query.session_id as string | undefined,
      since: req.query.since as string | undefined,
      until: req.query.until as string | undefined,
      type: req.query.type as any,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
      sort: (req.query.sort as 'asc' | 'desc') || 'desc',
    };

    // Recall from storage
    const records = await store.recall(query);

    // Count total
    const total = await store.count({ user_id: query.user_id });

    // Emit audit event
    const receipt = await auditor.emit(
      'RECALL',
      'memory_recall',
      {
        record_count: records.length,
        query_params: query,
      },
      { consent_level: req.consentContext!.family, scope: req.consentContext!.scope },
      user_id
    );

    // Return response
    res.json({
      records,
      pagination: {
        total,
        count: records.length,
        offset: query.offset,
        limit: query.limit,
        has_more: query.offset + records.length < total,
      },
      audit_receipt_id: receipt.receipt_id,
      timestamp: new Date().toISOString(),
    });
  })
);
```

### Forget Operation

```typescript
app.delete(
  '/v1/:family/forget',
  asyncHandler(async (req, res) => {
    const store = getMemoryStore();
    const auditor = getAuditEmitter();

    const { user_id, trace_id } = req.consentContext!;

    // Delete request (already validated)
    const forgetRequest = {
      id: req.query.id as string | undefined,
      user_id: req.query.user_id as string | undefined,
      session_id: req.query.session_id as string | undefined,
      reason: req.query.reason as string | undefined,
    };

    // Delete from storage
    const deletedIds = await store.forget(forgetRequest);

    // Emit audit event (GDPR compliance)
    const receipt = await auditor.emit(
      'FORGET',
      'memory_forget',
      {
        deleted_count: deletedIds.length,
        deleted_ids: deletedIds,
        reason: forgetRequest.reason,
      },
      { consent_level: req.consentContext!.family, scope: req.consentContext!.scope },
      user_id
    );

    // Return response
    res.json({
      deleted_count: deletedIds.length,
      deleted_ids: deletedIds,
      audit_receipt_id: receipt.receipt_id,
      timestamp: new Date().toISOString(),
    });
  })
);
```

## Testing Your API

### Store a Memory

```bash
curl -X POST http://localhost:3000/v1/personal/store \
  -H "Authorization: Bearer user_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "type": "text",
      "data": "User prefers dark mode"
    },
    "metadata": {
      "user_id": "user_test123",
      "consent_family": "personal",
      "consent_timestamp": "2025-10-17T00:00:00Z",
      "consent_version": "1.0"
    }
  }'
```

### Recall Memories

```bash
curl -X GET "http://localhost:3000/v1/personal/recall?user_id=user_test123&limit=10" \
  -H "Authorization: Bearer user_test123"
```

### Forget a Memory

```bash
curl -X DELETE "http://localhost:3000/v1/personal/forget?id=<record-id>" \
  -H "Authorization: Bearer user_test123"
```

## Error Handling

All errors return consistent ErrorResponse format:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing Authorization header",
    "trace_id": "trace_1729152000_abc123"
  },
  "timestamp": "2025-10-17T10:00:00Z",
  "path": "/v1/personal/store",
  "method": "POST"
}
```

### Throwing Custom Errors

```typescript
import { MemoryLayerError } from './memory-layer/middleware';
import { ErrorCode } from './memory-layer/models/error-envelope';

// In your handler
if (!record) {
  throw new MemoryLayerError(ErrorCode.NOT_FOUND, 'Memory record not found', { id: recordId });
}
```

## Monitoring

### Prometheus Metrics

Available at `GET /metrics`:

```
# Operation latency
memory_operation_latency_ms{operation="store",family="personal",status="success"}

# SLO violations
slo_violation_total{operation="store",slo="p99"}

# Audit events
audit_events_total{event_type="STORE",operation="memory_store"}
```

### SLO Response Header

Check latency in response:

```
X-SLO-Latency: 45ms
```

### Circuit Breaker Status

When circuit is open:

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable due to SLO violations",
    "details": {
      "operation": "store",
      "violation_count": 12
    }
  }
}
```

## Storage Operations

### Direct Storage Access

```typescript
import { getMemoryStore } from './memory-layer/storage';

const store = getMemoryStore();

// Store
await store.store(record);

// Get by ID
const record = await store.get(recordId);

// Check existence
const exists = await store.exists(recordId);

// Get stats
const stats = await store.getStats();
console.log(stats);
// {
//   total_records: 1543,
//   records_by_family: {
//     personal: 1200,
//     cohort: 300,
//     population: 43
//   },
//   storage_bytes: 2457600
// }

// Clear expired records
const deletedCount = await store.clearExpired();
```

### TTL Cleanup

Run periodically to clear expired records:

```typescript
setInterval(
  async () => {
    const store = getMemoryStore();
    const count = await store.clearExpired();
    if (count > 0) {
      console.log(`Cleared ${count} expired records`);
    }
  },
  60 * 60 * 1000
); // Every hour
```

## Consent Families

### Personal

- Full CRUD access
- All fields visible (including PII)
- User can recall, forget, export

### Cohort

- Anonymized data
- No PII in responses
- Recall returns empty (use distill instead)
- Forget removes content but keeps metadata

### Population

- Aggregated data only
- No individual records
- Only distill operations allowed
- Forget denied (403)

## Development Tips

### 1. Use asyncHandler

Always wrap async routes to catch promise rejections:

```typescript
import { asyncHandler } from './memory-layer/middleware';

app.get(
  '/route',
  asyncHandler(async (req, res) => {
    // Your async code
  })
);
```

### 2. Check Consent Context

The middleware attaches consent context to all requests:

```typescript
if (!req.consentContext) {
  // Not a memory layer route or auth failed
}

const { family, user_id, scope } = req.consentContext;
```

### 3. Emit Audit Events

Always emit audit events for operations:

```typescript
const receipt = await auditor.emit(
  'OPERATION_TYPE',
  'operation_name',
  {
    /* payload */
  },
  { consent_level: family, scope },
  user_id
);
```

### 4. Use Trace IDs

Extract trace ID for logging:

```typescript
const traceId = req.get('X-Trace-ID');
console.log(`[${traceId}] Processing request...`);
```

## Next Steps

1. **Implement Remaining Operations:**
   - POST `/v1/{family}/distill` - Aggregation
   - GET `/v1/{family}/export` - GDPR export

2. **Write Tests:**
   - Unit tests for middleware
   - Integration tests for storage
   - E2E smoke tests

3. **Add Documentation:**
   - API reference
   - Runbooks
   - Deployment guide

## Troubleshooting

### 401 Unauthorized

- Check Authorization header: `Bearer <token>`
- Token must be at least 10 characters

### 403 Forbidden

- Check consent family in URL matches user permissions
- Personal family has all permissions

### 400 Validation Error

- Check request body matches schema
- See error.details for specific validation errors

### 503 Service Unavailable

- Circuit breaker is open due to SLO violations
- Wait for violations to decrease
- Check `/metrics` for violation count

## Resources

- [Middleware README](./middleware/README.md) - Detailed middleware docs
- [Storage README](./storage/README.md) - Detailed storage docs
- [Implementation Summary](./PHASE2_IMPLEMENTATION_SUMMARY.md) - Full implementation details
- [Phase 2 Plan](../../docs/specs/phase-2-implementation-plan.md) - Original specification

## Support

For issues or questions:

1. Check the README files in each component directory
2. Review the implementation summary
3. Check the audit logs at `GET /v1/ledger/root`
4. Review Prometheus metrics at `GET /metrics`
