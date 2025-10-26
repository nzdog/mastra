# Phase 2 Rollout Runbook

**Memory Layer API - Consent Families Implementation**

**Version:** 2.0.0
**Status:** Phase 2 Complete
**Rollout Strategy:** Shadow → Canary → Graduated → Regional → Full

---

## Table of Contents

- [Overview](#overview)
- [Pre-Rollout Checklist](#pre-rollout-checklist)
- [Shadow Deployment](#shadow-deployment)
- [Canary Rollout](#canary-rollout)
- [Graduated Rollout](#graduated-rollout)
- [Regional Rollout](#regional-rollout)
- [Full Rollout](#full-rollout)
- [Toggle Flags](#toggle-flags)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring Checklist](#monitoring-checklist)
- [Troubleshooting](#troubleshooting)

---

## Overview

Phase 2 introduces consent-aware memory operations across three consent families (personal, cohort, population). This runbook guides the progressive rollout from shadow deployment to full production.

**Key Features:**
- Five memory operations: Store, Recall, Distill, Forget, Export
- Three consent families with k-anonymity enforcement
- SLO-enforced latency targets with circuit breakers
- Comprehensive audit trail and metrics

**Rollout Timeline:**
- Shadow: 1 week (dual-write, no reads)
- Canary: 1 week (1% traffic)
- Graduated: 2 weeks (5% → 25% → 50%)
- Regional: 1 week (region by region)
- Full: 100% traffic

---

## Pre-Rollout Checklist

### 1. Code & Tests

- [ ] All Phase 2 unit tests passing (`npm test`)
- [ ] Integration tests for all five operations passing
- [ ] E2E tests for consent family enforcement passing
- [ ] Schema validation tests passing
- [ ] SLO middleware tests passing (circuit breaker, latency tracking)

### 2. Infrastructure

- [ ] Memory store configured (in-memory or persistent)
- [ ] Audit ledger initialized (`.ledger/` directory)
- [ ] Metrics endpoint accessible (`/metrics`)
- [ ] JWKS endpoint accessible (`/v1/keys/jwks`)
- [ ] Health endpoint includes memory layer status (`/readyz`)

### 3. Configuration

- [ ] Environment variables set (see [Environment Setup](../specs/environment-setup.md))
- [ ] CORS configuration validated for memory endpoints
- [ ] Bearer token authentication configured
- [ ] SLO targets reviewed and approved
- [ ] Circuit breaker thresholds configured (50% violation rate)

### 4. Observability

- [ ] Prometheus scraping `/metrics` endpoint
- [ ] Grafana dashboards for memory operations created
- [ ] Alerts configured for:
  - SLO violations (p99 latency)
  - Circuit breaker open events
  - K-anonymity threshold failures
  - Auth failures (401/403 spike)
- [ ] Audit log monitoring configured
- [ ] Trace ID correlation working (distributed tracing)

### 5. Documentation

- [ ] API documentation reviewed (`docs/specs/phase-2-api.md`)
- [ ] OpenAPI spec published (`openapi/memory-layer-v1.yaml`)
- [ ] Runbooks accessible to on-call engineers
- [ ] Incident response procedures updated

### 6. Security

- [ ] Penetration testing completed
- [ ] Auth/authz logic reviewed (fail-closed)
- [ ] PII leakage prevention verified (k-anonymity)
- [ ] Audit trail completeness verified
- [ ] GDPR compliance reviewed (forget, export)

---

## Shadow Deployment

**Duration:** 1 week
**Goal:** Validate dual-write without serving reads

### Steps

1. **Deploy shadow mode**
   ```bash
   # Set feature flag
   export MEMORY_LAYER_MODE=shadow

   # Deploy to shadow environment
   npm run deploy:shadow
   ```

2. **Enable dual-write**
   - All store operations write to both old and new memory layers
   - Reads continue from old layer
   - Compare write latency and success rates

3. **Monitor shadow metrics**
   ```bash
   # Check shadow write success rate
   curl http://localhost:4099/metrics | grep memory_operation_latency_ms

   # Check for errors
   curl http://localhost:4099/metrics | grep slo_violation_total
   ```

4. **Validate audit trail**
   - Verify all shadow writes emit audit events
   - Check audit receipt IDs are generated
   - Confirm Merkle chain integrity

5. **Data consistency check**
   - Compare shadow data with old layer
   - Validate consent family assignment
   - Check expiration timestamps

### Success Criteria

- [ ] Shadow write success rate ≥ 99.9%
- [ ] Shadow write p99 latency ≤ SLO targets
- [ ] No circuit breaker events
- [ ] 100% audit trail coverage
- [ ] Zero data consistency errors

---

## Canary Rollout

**Duration:** 1 week
**Goal:** Serve 1% of read traffic from new layer

### Steps

1. **Enable canary mode**
   ```bash
   # Set feature flag
   export MEMORY_LAYER_MODE=canary
   export MEMORY_LAYER_CANARY_PERCENT=1

   # Deploy to production
   npm run deploy:canary
   ```

2. **Route 1% of read traffic**
   - Use consistent hashing by hashed_pseudonym
   - Ensure same users always hit canary
   - Monitor canary vs baseline metrics

3. **Monitor canary health**
   ```bash
   # Check canary error rate
   curl http://localhost:4099/metrics | grep memory_operation_latency_ms{status="error"}

   # Check canary p99 latency
   curl http://localhost:4099/metrics | grep memory_operation_latency_ms{quantile="0.99"}
   ```

4. **User experience validation**
   - Monitor user-reported issues
   - Check for auth failures (401/403)
   - Validate consent family enforcement
   - Confirm GDPR operations (forget, export) work

5. **Gradual increase**
   - Day 1-2: 1%
   - Day 3-4: 2%
   - Day 5-7: 5%

### Success Criteria

- [ ] Canary error rate ≤ baseline + 0.1%
- [ ] Canary p99 latency ≤ SLO targets
- [ ] Zero circuit breaker events
- [ ] Zero auth/authz failures
- [ ] Zero GDPR compliance issues

### Rollback Trigger

- Canary error rate > baseline + 1%
- Canary p99 latency > SLO targets
- Circuit breaker opens
- Auth failure spike (> 1% of requests)

---

## Graduated Rollout

**Duration:** 2 weeks
**Goal:** Gradually increase traffic to 50%

### Steps

1. **Increase traffic incrementally**
   ```bash
   # Week 1: 5% → 10% → 25%
   export MEMORY_LAYER_CANARY_PERCENT=5
   # Monitor for 2 days

   export MEMORY_LAYER_CANARY_PERCENT=10
   # Monitor for 2 days

   export MEMORY_LAYER_CANARY_PERCENT=25
   # Monitor for 3 days

   # Week 2: 25% → 50%
   export MEMORY_LAYER_CANARY_PERCENT=50
   # Monitor for 7 days
   ```

2. **Monitor at each stage**
   - Error rates (4xx, 5xx)
   - Latency distributions (p50, p95, p99)
   - SLO violations
   - Circuit breaker events
   - K-anonymity threshold failures

3. **Load testing**
   - Simulate peak traffic
   - Test circuit breaker behavior
   - Validate k-anonymity enforcement under load

4. **Consent family validation**
   - Personal: Verify pseudonymous identifier enforcement (no raw PII)
   - Cohort: Verify k=5 enforcement
   - Population: Verify k=100 enforcement

### Success Criteria

- [ ] Error rate ≤ 0.1% across all stages
- [ ] p99 latency ≤ SLO targets
- [ ] Zero circuit breaker events
- [ ] K-anonymity enforcement 100% effective
- [ ] Audit trail 100% complete

---

## Regional Rollout

**Duration:** 1 week
**Goal:** Roll out region by region

### Steps

1. **Select pilot region**
   - Choose low-traffic region first
   - Enable 100% traffic in pilot region
   ```bash
   export MEMORY_LAYER_REGION=us-west-1
   export MEMORY_LAYER_CANARY_PERCENT=100
   ```

2. **Monitor regional metrics**
   - Regional error rates
   - Regional latency distributions
   - Cross-region consistency

3. **Expand to all regions**
   - Day 1: Pilot region (us-west-1)
   - Day 2: us-east-1
   - Day 3: eu-west-1
   - Day 4: ap-southeast-1
   - Day 5-7: Remaining regions

4. **Validate global consistency**
   - Cross-region data replication
   - Audit trail consistency
   - Consent family enforcement

### Success Criteria

- [ ] All regions ≤ 0.1% error rate
- [ ] All regions meet SLO targets
- [ ] Cross-region consistency 100%
- [ ] Audit trail replicated globally

---

## Full Rollout

**Duration:** Ongoing
**Goal:** 100% traffic on new layer, deprecate old layer

### Steps

1. **Enable full rollout**
   ```bash
   export MEMORY_LAYER_MODE=full
   export MEMORY_LAYER_CANARY_PERCENT=100
   ```

2. **Monitor for 1 week**
   - Full production traffic
   - No rollback flag available
   - 24/7 monitoring

3. **Deprecate old layer**
   - Week 1: Stop dual-writes
   - Week 2: Archive old layer data
   - Week 3: Decommission old layer

4. **Final validation**
   - GDPR compliance audit
   - Security audit
   - Performance audit

### Success Criteria

- [ ] 100% traffic on new layer
- [ ] Error rate ≤ 0.05%
- [ ] p99 latency ≤ SLO targets
- [ ] Zero critical incidents
- [ ] Old layer safely decommissioned

---

## Toggle Flags

### Environment Variables

| Flag                          | Values               | Description                           |
|-------------------------------|----------------------|---------------------------------------|
| `MEMORY_LAYER_MODE`           | shadow/canary/full   | Deployment mode                       |
| `MEMORY_LAYER_CANARY_PERCENT` | 0-100                | Percentage of traffic to new layer    |
| `MEMORY_LAYER_REGION`         | region-name          | Region for regional rollout           |
| `MEMORY_LAYER_CIRCUIT_BREAKER_ENABLED` | true/false | Enable circuit breaker |
| `MEMORY_LAYER_K_ANONYMITY_ENABLED` | true/false     | Enable k-anonymity enforcement        |

### Feature Flags (LaunchDarkly / Similar)

```json
{
  "memory-layer-enabled": {
    "type": "boolean",
    "default": false,
    "targeting": [
      {"variation": true, "users": ["canary-users"]}
    ]
  },
  "memory-layer-canary-percent": {
    "type": "number",
    "default": 0,
    "range": [0, 100]
  }
}
```

---

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

**Trigger:** Critical failure (error rate > 5%, p99 > 2x SLO)

1. **Disable new layer**
   ```bash
   export MEMORY_LAYER_MODE=shadow
   export MEMORY_LAYER_CANARY_PERCENT=0

   # Redeploy immediately
   npm run deploy:rollback
   ```

2. **Route all traffic to old layer**
   - Update load balancer
   - Flush CDN cache
   - Verify traffic switch

3. **Incident response**
   - Page on-call engineer
   - Create incident ticket
   - Begin root cause analysis

### Gradual Rollback (< 30 minutes)

**Trigger:** Elevated error rate (> 1%), SLO violations

1. **Reduce canary percentage**
   ```bash
   # Reduce to previous stable level
   export MEMORY_LAYER_CANARY_PERCENT=25  # from 50%
   ```

2. **Monitor for 10 minutes**
   - Check if error rate decreases
   - Validate latency improves

3. **Further reduce if needed**
   ```bash
   export MEMORY_LAYER_CANARY_PERCENT=5
   ```

4. **Full rollback if unresolved**
   ```bash
   export MEMORY_LAYER_CANARY_PERCENT=0
   ```

### Data Recovery

**Trigger:** Data loss or corruption detected

1. **Stop writes immediately**
   ```bash
   export MEMORY_LAYER_WRITE_ENABLED=false
   ```

2. **Assess data integrity**
   - Check audit trail
   - Verify Merkle chain
   - Compare with backups

3. **Restore from backup**
   ```bash
   # Restore from latest snapshot
   npm run restore:memory-layer -- --snapshot=2025-10-17T12:00:00Z
   ```

4. **Validate restoration**
   - Verify record counts
   - Check consent family assignments
   - Confirm audit trail continuity

---

## Monitoring Checklist

### Real-Time Metrics

- [ ] `memory_operation_latency_ms` - Operation latency by family/operation/status
- [ ] `slo_violation_total` - SLO violations by operation
- [ ] `audit_events_total` - Audit event counts by type
- [ ] `audit_ledger_height` - Current ledger height
- [ ] HTTP status codes (200, 201, 400, 401, 403, 404, 500, 503)

### Alerts

- [ ] **Critical:** Circuit breaker open
- [ ] **Critical:** Error rate > 1%
- [ ] **Critical:** p99 latency > SLO target
- [ ] **Warning:** K-anonymity threshold failures
- [ ] **Warning:** Auth failure rate > 0.5%
- [ ] **Info:** Canary traffic percentage change

### Dashboards

- [ ] Memory Operations Overview (all operations, families)
- [ ] SLO Compliance (latency percentiles, violation counts)
- [ ] Consent Family Metrics (auth success/failure, family usage)
- [ ] Audit Trail Health (ledger height, signature failures)
- [ ] Error Analysis (error codes, trace IDs)

### Log Queries

```bash
# Check for errors
grep "ERROR" /var/log/memory-layer.log | tail -100

# Check SLO violations
grep "SLO: p99 violation" /var/log/memory-layer.log | tail -50

# Check auth failures
grep "Rejected origin\|UNAUTHORIZED\|FORBIDDEN" /var/log/memory-layer.log | tail -50
```

---

## Troubleshooting

### High Error Rate

**Symptom:** Error rate > 1%

**Diagnosis:**
1. Check error code distribution
   ```bash
   curl http://localhost:4099/metrics | grep error_total
   ```

2. Identify error types
   - 400: Validation errors (check request schemas)
   - 401: Auth failures (check Bearer tokens)
   - 403: Forbidden (check consent family authorization)
   - 500: Internal errors (check logs)
   - 503: Circuit breaker open (check SLO violations)

**Resolution:**
- 400: Review API documentation, fix client requests
- 401: Verify auth service, check token validity
- 403: Review consent family permissions
- 500: Check server logs, restart if needed
- 503: Rollback to reduce load

### SLO Violations

**Symptom:** p99 latency > SLO target

**Diagnosis:**
1. Check operation latency distribution
   ```bash
   curl http://localhost:4099/metrics | grep memory_operation_latency_ms
   ```

2. Identify slow operations
   - Store: Database write slowness
   - Recall: Query optimization needed
   - Distill: Aggregation overhead
   - Forget: Cascading deletes
   - Export: Large data export

**Resolution:**
- Optimize database queries
- Add indexes for common filters
- Implement query result caching
- Reduce aggregation complexity
- Implement async export with callbacks

### Circuit Breaker Open

**Symptom:** 503 errors, circuit breaker open

**Diagnosis:**
1. Check violation count
   ```bash
   curl http://localhost:4099/metrics | grep slo_violation_total
   ```

2. Identify root cause
   - Database slowness
   - High traffic volume
   - Resource exhaustion

**Resolution:**
1. **Immediate:** Reduce traffic
   ```bash
   export MEMORY_LAYER_CANARY_PERCENT=0
   ```

2. **Short-term:** Scale infrastructure
   - Add database replicas
   - Increase server capacity
   - Enable caching

3. **Long-term:** Optimize code
   - Profile slow operations
   - Optimize algorithms
   - Implement request coalescing

### K-Anonymity Threshold Failures

**Symptom:** 403 errors for distill operations

**Diagnosis:**
1. Check aggregation request
   - Cohort: min 5 records required
   - Population: min 100 records required

2. Verify data availability
   ```bash
   # Check record counts by family
   curl -H "Authorization: Bearer admin_token" \
     http://localhost:4099/v1/cohort/distill \
     -d '{"aggregation": {"type": "count"}}'
   ```

**Resolution:**
- Wait for more data to accumulate
- Lower min_records threshold (with privacy review)
- Use broader time ranges
- Combine cohorts to increase sample size

---

## Related Documentation

- [Phase 2 API Documentation](../specs/phase-2-api.md)
- [Consent Family Triage Guide](./consent-family-triage.md)
- [OpenAPI Specification](../../openapi/memory-layer-v1.yaml)
- [CHANGELOG](../../CHANGELOG.md)

---

**Invariant:** Memory enriches but never controls.
