# Memory Layer Middleware

Phase 2 middleware components for the Memory Layer API.

## Components

### 1. Consent Resolver Middleware (`consent-resolver.ts`)

Extracts consent family from URL path and validates user authorization.

**Features:**

- Extracts consent family from path: `/v1/{family}/{operation}`
- Validates Bearer token authentication
- Checks user authorization for consent family
- Attaches `consentContext` to request
- Emits audit events for consent resolution
- Fail-closed security: 401 if no auth, 403 if not authorized

**Usage:**

```typescript
import { consentResolver } from './middleware/consent-resolver';

app.use(consentResolver);
```

**Request Enhancement:**

```typescript
req.consentContext = {
  family: 'personal' | 'cohort' | 'population',
  hashed_pseudonym: 'user_abc123',
  scope: ['read', 'write', 'delete'],
  trace_id: 'trace_...',
};
```

### 2. SLO Middleware (`slo-middleware.ts`)

Tracks request latency and enforces Service Level Objectives with circuit breaker.

**Features:**

- Tracks latency per operation
- Emits Prometheus histogram: `memory_operation_latency_ms`
- Checks against SLO targets (p99 thresholds)
- Increments `slo_violation_total` on violations
- Adds `X-SLO-Latency` response header
- Circuit breaker: 503 if violation rate > 50% in last 10 requests

**SLO Targets (p99):**

- `store`: 500ms
- `recall`: 1000ms
- `distill`: 5000ms
- `forget`: 500ms
- `export`: 10000ms

**Usage:**

```typescript
import { sloMiddleware } from './middleware/slo-middleware';

app.use(sloMiddleware);
```

### 3. Schema Validator Middleware (`schema-validator.ts`)

Validates request bodies against memory-schema.json using Ajv.

**Features:**

- Validates POST body and GET query params
- Uses Ajv with format validators (date-time, uuid)
- Returns 400 with detailed validation errors
- Supports all operation schemas: store, recall, distill, forget, export

**Usage:**

```typescript
import { schemaValidator } from './middleware/schema-validator';

app.use(schemaValidator);
```

**Error Response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "validation_errors": [
        {
          "field": "hashed_pseudonym",
          "message": "must be string",
          "params": {}
        }
      ]
    }
  }
}
```

### 4. Error Handler Middleware (`error-handler.ts`)

Global error handler that converts all errors to ErrorResponse format.

**Features:**

- Catches all uncaught errors
- Converts to ErrorResponse envelope
- Structured error logging
- Trace ID propagation
- Includes `MemoryLayerError` class for typed errors
- Includes `notFoundHandler` for 404 routes
- Includes `asyncHandler` wrapper for async route handlers

**Usage:**

```typescript
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/error-handler';

// Register routes
app.get(
  '/v1/personal/recall',
  asyncHandler(async (req, res) => {
    // Your async route logic
  })
);

// 404 handler (after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);
```

**MemoryLayerError Usage:**

```typescript
import { MemoryLayerError } from './middleware/error-handler';
import { ErrorCode } from '../models/error-envelope';

throw new MemoryLayerError(ErrorCode.NOT_FOUND, 'Memory record not found', { id: 'abc123' });
```

## Middleware Stack Order

The middleware must be registered in this order:

```typescript
import {
  consentResolver,
  sloMiddleware,
  schemaValidator,
  errorHandler,
  notFoundHandler,
} from './memory-layer/middleware';

// 1. SLO tracking (first, to measure all requests)
app.use(sloMiddleware);

// 2. Consent resolution (authentication & authorization)
app.use(consentResolver);

// 3. Schema validation (validate after auth)
app.use(schemaValidator);

// 4. Register your routes here
app.post('/v1/:family/store', storeHandler);
app.get('/v1/:family/recall', recallHandler);
// ... etc

// 5. 404 handler (after all routes)
app.use(notFoundHandler);

// 6. Error handler (must be last)
app.use(errorHandler);
```

## Testing

Each middleware includes comprehensive error handling and can be tested in isolation:

```typescript
import { consentResolver } from './middleware/consent-resolver';
import request from 'supertest';
import express from 'express';

const app = express();
app.use(consentResolver);
app.get('/v1/personal/test', (req, res) => {
  res.json({ context: req.consentContext });
});

// Test unauthorized access
await request(app).get('/v1/personal/test').expect(401);

// Test authorized access
await request(app).get('/v1/personal/test').set('Authorization', 'Bearer valid_token').expect(200);
```

## Metrics

All middleware emits Prometheus metrics:

**SLO Middleware:**

- `memory_operation_latency_ms` - Histogram of operation latencies
- `slo_violation_total` - Counter of SLO violations

**Consent Resolver:**

- Emits audit events via `AuditEmitter` (tracked in `audit_events_total`)

## Security

All middleware follows **fail-closed** security principles:

- Missing auth → 401 Unauthorized
- Invalid consent family → 403 Forbidden
- Invalid schema → 400 Bad Request
- SLO exceeded → 503 Service Unavailable
- Unexpected errors → 500 Internal Server Error

All errors include trace IDs for correlation with audit logs.
