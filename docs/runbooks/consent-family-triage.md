# Consent Family Triage Guide

**Troubleshooting Authorization and Privacy Issues**

**Version:** 2.0.0
**Audience:** On-call engineers, SREs, support team

---

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [401 Unauthorized Errors](#401-unauthorized-errors)
- [403 Forbidden Errors](#403-forbidden-errors)
- [K-Anonymity Failures](#k-anonymity-failures)
- [DP Budget Exhaustion](#dp-budget-exhaustion)
- [Common Consent Issues](#common-consent-issues)
- [Diagnostic Tools](#diagnostic-tools)
- [Resolution Steps](#resolution-steps)

---

## Overview

This guide helps diagnose and resolve issues related to consent family authorization, k-anonymity enforcement, and differential privacy budget management in the Memory Layer API.

**Consent Families:**
- **Personal:** User-only access, hashed/pseudonymous identifiers only (e.g., sha256(email+salt))
- **Cohort:** Group-level, k-anonymity ≥ 5, no direct identifiers
- **Population:** System-wide, k-anonymity ≥ 100, no direct identifiers

**Common Issues:**
- 401 Unauthorized (missing/invalid auth)
- 403 Forbidden (insufficient permissions)
- K-anonymity threshold failures (< min records)
- DP budget exhaustion (privacy budget depleted)

---

## Quick Reference

### Error Code Mapping

| Error Code              | HTTP Status | Meaning                          | First Action                        |
|-------------------------|-------------|----------------------------------|-------------------------------------|
| `UNAUTHORIZED`          | 401         | Missing/invalid auth token       | Check `Authorization` header        |
| `FORBIDDEN`             | 403         | Insufficient permissions         | Check consent family authorization  |
| `VALIDATION_ERROR`      | 400         | Invalid request body/params      | Validate against OpenAPI schema     |
| `NOT_FOUND`             | 404         | Resource doesn't exist           | Verify resource ID                  |
| `SLO_VIOLATION`         | 503         | Circuit breaker open             | Check SLO metrics, reduce load      |

### Consent Family Operation Matrix

| Family     | Store | Recall | Distill | Forget | Export |
|------------|-------|--------|---------|--------|--------|
| Personal   | ✅    | ✅     | ❌      | ✅     | ✅     |
| Cohort     | ✅    | ✅     | ✅      | ❌     | ❌     |
| Population | ❌    | ❌     | ✅      | ❌     | ❌     |

### Scope Requirements

| Scope     | Personal | Cohort | Population |
|-----------|----------|--------|------------|
| read      | ✅       | ✅     | ❌         |
| write     | ✅       | ❌     | ❌         |
| delete    | ✅       | ❌     | ❌         |
| export    | ✅       | ❌     | ❌         |
| aggregate | ❌       | ✅     | ✅         |

---

## 401 Unauthorized Errors

### Symptoms

- HTTP 401 response
- Error code: `UNAUTHORIZED`
- Message: "Missing Authorization header" or "Invalid or expired token"

### Root Causes

1. **Missing Authorization header**
   - Client didn't send `Authorization` header
   - Header name misspelled (e.g., `Authorisation`)

2. **Invalid token format**
   - Not using Bearer scheme
   - Format: `Bearer <token>` (case-insensitive)

3. **Expired or invalid token**
   - Token expired (check `exp` claim in JWT)
   - Token signature invalid
   - Token revoked

### Diagnostic Steps

1. **Check request headers**
   ```bash
   # Capture request headers
   curl -v -H "Authorization: Bearer user_token123" \
     http://localhost:4099/v1/personal/recall?hashed_pseudonym=user_123
   ```

2. **Verify Authorization header**
   ```bash
   # Should see: Authorization: Bearer <token>
   # Should NOT see: Authorization: user_token123
   ```

3. **Decode JWT token (if using JWT)**
   ```bash
   # Decode token (base64)
   echo "eyJhbGc..." | base64 -d | jq .

   # Check expiration
   # exp claim should be > current timestamp
   ```

4. **Check audit logs**
   ```bash
   # Look for auth failures
   grep "consent_resolution_failed" /var/log/audit-ledger.log | tail -20

   # Check trace ID for correlation
   grep "trace_abc123" /var/log/audit-ledger.log
   ```

### Resolution Steps

#### Client-Side Fix

1. **Add Authorization header**
   ```javascript
   // Correct
   fetch('/v1/personal/store', {
     headers: {
       'Authorization': 'Bearer user_token123',
       'Content-Type': 'application/json'
     }
   });

   // Incorrect
   fetch('/v1/personal/store', {
     headers: {
       'Authorization': 'user_token123'  // Missing "Bearer"
     }
   });
   ```

2. **Verify token validity**
   ```javascript
   // Check token expiration before request
   const tokenPayload = JSON.parse(atob(token.split('.')[1]));
   if (tokenPayload.exp < Date.now() / 1000) {
     // Token expired, refresh it
     token = await refreshToken();
   }
   ```

#### Server-Side Fix

1. **Review token validation logic**
   - Check `validateUserToken()` in `consent-resolver.ts`
   - Ensure JWT signature verification is working
   - Verify token expiration checks

2. **Check auth service health**
   ```bash
   # Verify auth service is responding
   curl http://auth-service/health

   # Check JWKS endpoint
   curl http://auth-service/.well-known/jwks.json
   ```

3. **Enable debug logging**
   ```bash
   export LOG_LEVEL=debug
   # Restart server
   # Check logs for detailed auth flow
   ```

---

## 403 Forbidden Errors

### Symptoms

- HTTP 403 response
- Error code: `FORBIDDEN`
- Message: "Access denied for consent family: {family}"

### Root Causes

1. **User lacks permission for consent family**
   - Personal: User trying to access another user's data
   - Cohort: User not member of cohort
   - Population: User lacks population-level access

2. **Invalid consent family in URL**
   - URL: `/v1/population/recall` (population doesn't support recall)
   - URL: `/v1/personal/distill` (personal doesn't support distill)

3. **Scope mismatch**
   - User has `read` scope but trying to `write`
   - User has `aggregate` scope but trying to `delete`

### Diagnostic Steps

1. **Check request details**
   ```bash
   # Extract from error response
   curl -H "Authorization: Bearer token" \
     http://localhost:4099/v1/population/recall?hashed_pseudonym=user_123

   # Response will show:
   # "error": {
   #   "code": "FORBIDDEN",
   #   "message": "Access denied for consent family: population",
   #   "details": {
   #     "family": "population",
   #     "hashed_pseudonym": "user_123"
   #   }
   # }
   ```

2. **Verify consent family + operation combo**
   - Check [Operation Matrix](#consent-family-operation-matrix)
   - Ensure operation is allowed for family

3. **Check user scopes**
   ```bash
   # Decode token to see scopes
   echo $TOKEN | jwt decode

   # Look for "scope" claim
   # Should match required scope for operation
   ```

4. **Review audit trail**
   ```bash
   # Check consent resolution events
   grep "consent_resolution_failed" /var/log/audit-ledger.log | \
     jq 'select(.data.reason == "forbidden")'
   ```

### Resolution Steps

#### Invalid Consent Family + Operation

**Issue:** Client using wrong family for operation

```bash
# Wrong: population/recall (not allowed)
curl -H "Authorization: Bearer token" \
  http://localhost:4099/v1/population/recall?hashed_pseudonym=user_123

# Correct: cohort/recall or personal/recall
curl -H "Authorization: Bearer token" \
  http://localhost:4099/v1/personal/recall?hashed_pseudonym=user_123
```

**Fix:** Update client to use correct family
- Personal recall: `/v1/personal/recall?hashed_pseudonym={hashed_pseudonym}`
- Cohort recall: `/v1/cohort/recall?hashed_pseudonym={hashed_pseudonym}`
- Population distill: `/v1/population/distill`

#### User Lacks Permission

**Issue:** User trying to access data they don't own

```bash
# Alice trying to access Bob's data
curl -H "Authorization: Bearer alice_token" \
  http://localhost:4099/v1/personal/recall?hashed_pseudonym=bob_123
# Returns 403 Forbidden
```

**Fix:** Update authorization logic

1. **Server-side:** Enforce hashed_pseudonym match
   ```typescript
   // In consent-resolver.ts
   if (family === 'personal' && tokenHashedPseudonym !== requestHashedPseudonym) {
     return { authorized: false, error: 'User can only access own data' };
   }
   ```

2. **Client-side:** Use correct hashed_pseudonym
   ```javascript
   // Use authenticated user's hashed pseudonym
   const hashedPseudonym = getCurrentHashedPseudonym();
   fetch(`/v1/personal/recall?hashed_pseudonym=${hashedPseudonym}`);
   ```

#### Scope Mismatch

**Issue:** User has read scope but trying to write

```bash
# Token has scope: ["read"]
# Trying to store (requires "write" scope)
curl -X POST -H "Authorization: Bearer read_only_token" \
  http://localhost:4099/v1/personal/store
# Returns 403 Forbidden
```

**Fix:** Update token scopes

1. **Request token with correct scopes**
   ```javascript
   // Request write scope
   const token = await getToken({ scopes: ['read', 'write'] });
   ```

2. **Or use operation-specific token**
   ```javascript
   // Read token for recall
   const readToken = await getToken({ scopes: ['read'] });

   // Write token for store
   const writeToken = await getToken({ scopes: ['write'] });
   ```

---

## K-Anonymity Failures

### Symptoms

- HTTP 403 response (during distill operation)
- Error message: "Privacy threshold not met. Minimum {k} records required."
- Metadata includes: `min_records`, `actual_records`, `privacy_threshold_met: false`

### Root Causes

1. **Insufficient data**
   - Cohort: < 5 records
   - Population: < 100 records

2. **Overly restrictive filters**
   - Time range too narrow
   - Too many filters applied
   - Specific field values have low cardinality

3. **Small cohort size**
   - Cohort has < 5 members
   - Recent cohort with little data

### Diagnostic Steps

1. **Check distill response metadata**
   ```bash
   curl -X POST -H "Authorization: Bearer token" \
     http://localhost:4099/v1/cohort/distill \
     -d '{
       "cohort_id": "cohort_premium",
       "aggregation": {"type": "count"},
       "min_records": 5
     }'

   # Response metadata:
   # "metadata": {
   #   "total_records": 50,
   #   "filtered_records": 3,  // < 5
   #   "privacy_threshold_met": false,
   #   "min_records": 5
   # }
   ```

2. **Verify record counts**
   ```bash
   # Count records in cohort
   curl -H "Authorization: Bearer token" \
     "http://localhost:4099/v1/cohort/recall?cohort_id=cohort_premium&limit=1000" \
     | jq '.pagination.total'
   ```

3. **Check filter impact**
   ```bash
   # Test without filters
   curl -X POST -H "Authorization: Bearer token" \
     http://localhost:4099/v1/cohort/distill \
     -d '{"aggregation": {"type": "count"}}'

   # Then add filters incrementally
   curl -X POST -H "Authorization: Bearer token" \
     http://localhost:4099/v1/cohort/distill \
     -d '{
       "aggregation": {"type": "count"},
       "filters": {"since": "2025-10-01T00:00:00Z"}
     }'
   ```

4. **Review audit events**
   ```bash
   # Check for k-anonymity violations
   grep "privacy_threshold_met.*false" /var/log/audit-ledger.log | tail -20
   ```

### Resolution Steps

#### Insufficient Data (Wait for More)

**Issue:** Cohort has only 3 records, needs 5

**Temporary Workaround:**
- Use broader time range
- Combine multiple cohorts
- Use population-level aggregation instead

**Long-term Fix:**
- Wait for more data to accumulate
- Reduce min_records (with privacy review)
- Implement data backfill

```bash
# Broader time range
curl -X POST -H "Authorization: Bearer token" \
  http://localhost:4099/v1/cohort/distill \
  -d '{
    "cohort_id": "cohort_premium",
    "aggregation": {"type": "count"},
    "filters": {
      "since": "2025-01-01T00:00:00Z"  // Expanded from 2025-10-01
    }
  }'
```

#### Overly Restrictive Filters

**Issue:** Filters reduce records below k-anonymity threshold

**Fix:** Relax filters

```bash
# Before (too restrictive)
{
  "filters": {
    "content_type": "structured",
    "since": "2025-10-17T12:00:00Z",
    "until": "2025-10-17T13:00:00Z",  // 1-hour window
    "custom_field": "specific_value"
  }
}

# After (relaxed)
{
  "filters": {
    "content_type": "structured",
    "since": "2025-10-01T00:00:00Z",  // Expanded to 17 days
    "until": "2025-10-17T23:59:59Z"
  }
}
```

#### Small Cohort Size

**Issue:** Cohort permanently has < 5 members

**Options:**

1. **Combine cohorts**
   ```bash
   # Instead of querying single cohort
   # Combine multiple related cohorts

   # Server-side: Support cohort_ids array
   {
     "cohort_ids": ["cohort_a", "cohort_b", "cohort_c"],
     "aggregation": {"type": "count"}
   }
   ```

2. **Use population-level aggregation**
   ```bash
   # Switch to population family
   curl -X POST -H "Authorization: Bearer token" \
     http://localhost:4099/v1/population/distill \
     -d '{"aggregation": {"type": "count"}}'
   ```

3. **Reduce k-anonymity threshold (with approval)**
   ```bash
   # Requires privacy review and approval
   export COHORT_K_ANONYMITY=3  # Reduced from 5

   # Document in privacy review log
   # Get approval from privacy officer
   ```

---

## DP Budget Exhaustion

### Symptoms

- HTTP 403 response (during distill operation)
- Error message: "Differential privacy budget exhausted for cohort/population"
- Metadata includes: `dp_budget_remaining: 0`, `dp_epsilon_used`

### Root Causes

1. **Too many queries**
   - Cohort DP budget depleted (per-cohort limit)
   - Population DP budget depleted (global limit)

2. **High epsilon queries**
   - Each query consumes ε (epsilon) budget
   - High-precision queries consume more budget

3. **Budget not reset**
   - Daily/weekly budget not refreshed
   - Reset job not running

### Diagnostic Steps

1. **Check DP budget status**
   ```bash
   # Query budget endpoint (Phase 3 feature)
   curl -H "Authorization: Bearer token" \
     http://localhost:4099/v1/privacy/budget?cohort_id=cohort_premium

   # Response:
   # {
   #   "cohort_id": "cohort_premium",
   #   "epsilon_total": 10.0,
   #   "epsilon_used": 9.8,
   #   "epsilon_remaining": 0.2,
   #   "reset_at": "2025-10-18T00:00:00Z"
   # }
   ```

2. **Review query history**
   ```bash
   # Check audit log for DP queries
   grep "dp_epsilon_used" /var/log/audit-ledger.log | \
     jq 'select(.data.cohort_id == "cohort_premium")'
   ```

3. **Verify budget reset schedule**
   ```bash
   # Check cron job for budget reset
   crontab -l | grep dp-budget-reset

   # Should see:
   # 0 0 * * * /usr/bin/dp-budget-reset.sh
   ```

### Resolution Steps

#### Budget Exhausted (Wait for Reset)

**Issue:** Cohort DP budget depleted until next reset

**Temporary Workaround:**
- Use cached/pre-computed aggregations
- Switch to non-DP aggregations (if allowed)
- Query different cohort with budget remaining

**Long-term Fix:**
- Increase budget allocation (with privacy review)
- Optimize query efficiency (lower epsilon)
- Implement query result caching

```bash
# Check when budget resets
curl -H "Authorization: Bearer token" \
  http://localhost:4099/v1/privacy/budget?cohort_id=cohort_premium \
  | jq '.reset_at'

# Wait until reset_at timestamp
# Or request budget increase (requires approval)
```

#### High Epsilon Queries

**Issue:** Queries consuming too much budget per request

**Fix:** Optimize epsilon usage

```bash
# Before (high epsilon)
{
  "aggregation": {
    "type": "average",
    "epsilon": 1.0  // High precision, high cost
  }
}

# After (lower epsilon)
{
  "aggregation": {
    "type": "average",
    "epsilon": 0.1  // Lower precision, lower cost
  }
}
```

#### Budget Not Resetting

**Issue:** Reset job not running

**Fix:** Restart reset job

```bash
# Check if job is running
ps aux | grep dp-budget-reset

# Restart job
sudo systemctl restart dp-budget-reset

# Verify logs
tail -f /var/log/dp-budget-reset.log

# Manual reset (emergency)
curl -X POST -H "Authorization: Bearer admin_token" \
  http://localhost:4099/v1/privacy/budget/reset?cohort_id=cohort_premium
```

---

## Common Consent Issues

### Issue 1: User Can't Access Own Data

**Symptom:** 403 error when accessing personal data

**Diagnosis:**
```bash
# Check token hashed_pseudonym vs request hashed_pseudonym
curl -v -H "Authorization: Bearer user_alice_token" \
  "http://localhost:4099/v1/personal/recall?hashed_pseudonym=alice_123"

# Decode token to verify hashed_pseudonym
echo $TOKEN | jwt decode | jq '.hashed_pseudonym'
```

**Resolution:**
- Ensure token `hashed_pseudonym` matches request `hashed_pseudonym`
- Check for typos in hashed pseudonyms
- Verify user exists in auth system

### Issue 2: Cohort Member Can't Access Cohort Data

**Symptom:** 403 error for cohort operations

**Diagnosis:**
```bash
# Verify user is member of cohort
curl -H "Authorization: Bearer admin_token" \
  http://localhost:4099/v1/cohorts/cohort_premium/members \
  | jq '.members[] | select(.hashed_pseudonym == "alice_123")'
```

**Resolution:**
- Add user to cohort membership
- Check cohort authorization logic
- Verify scope includes `aggregate`

### Issue 3: Consent Revoked Mid-Session

**Symptom:** Operations fail after initial success

**Diagnosis:**
```bash
# Check consent revocation events
grep "CONSENT_REVOKE" /var/log/audit-ledger.log | \
  jq 'select(.data.hashed_pseudonym == "alice_123")'
```

**Resolution:**
- Respect revocation immediately
- Clear cached permissions
- Return 403 with consent revocation message

---

## Diagnostic Tools

### 1. Audit Log Query

```bash
# Search by trace ID
grep "trace_abc123" /var/log/audit-ledger.log | jq .

# Search by hashed pseudonym
grep "user_alice" /var/log/audit-ledger.log | jq .

# Search by error type
grep "FORBIDDEN\|UNAUTHORIZED" /var/log/audit-ledger.log | jq .

# Search by consent family
grep "consent_family.*cohort" /var/log/audit-ledger.log | jq .
```

### 2. Metrics Query

```bash
# Check auth failure rate
curl http://localhost:4099/metrics | \
  grep 'audit_events_total{type="CONSENT_GRANT",operation="consent_resolution_failed"}'

# Check consent family usage
curl http://localhost:4099/metrics | \
  grep 'memory_operation_latency_ms' | grep 'family='

# Check k-anonymity violations
curl http://localhost:4099/metrics | \
  grep 'privacy_threshold_failures_total'
```

### 3. Token Inspection

```bash
# Decode JWT token
decode_jwt() {
  local token=$1
  echo $token | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq .
}

decode_jwt "eyJhbGc..."

# Output:
# {
#   "hashed_pseudonym": "alice_123",
#   "scope": ["read", "write"],
#   "exp": 1729180800,
#   "iat": 1729166400
# }
```

### 4. Health Check

```bash
# Check memory layer health
curl http://localhost:4099/readyz | jq .

# Check consent family health
curl http://localhost:4099/readyz | jq '.consent_families'
```

---

## Resolution Steps

### Step-by-Step Resolution Process

1. **Identify Error Type**
   - 401 → [Go to 401 section](#401-unauthorized-errors)
   - 403 → [Go to 403 section](#403-forbidden-errors)
   - K-anonymity → [Go to K-anonymity section](#k-anonymity-failures)
   - DP budget → [Go to DP budget section](#dp-budget-exhaustion)

2. **Gather Context**
   - Trace ID from error response
   - Hashed pseudonym from request
   - Consent family from URL path
   - Operation (store, recall, distill, etc.)

3. **Check Audit Trail**
   ```bash
   grep "$TRACE_ID" /var/log/audit-ledger.log | jq .
   ```

4. **Verify Authorization**
   - Check token validity
   - Verify user permissions
   - Confirm consent family + operation compatibility

5. **Test Fix**
   ```bash
   # Reproduce issue
   curl -v -H "Authorization: Bearer $TOKEN" "$URL"

   # Apply fix
   # ...

   # Verify resolution
   curl -v -H "Authorization: Bearer $NEW_TOKEN" "$URL"
   ```

6. **Document Resolution**
   - Update incident ticket
   - Add to knowledge base
   - Update runbook if new pattern

---

## Related Documentation

- [Phase 2 API Documentation](../specs/phase-2-api.md)
- [Phase 2 Rollout Runbook](./phase-2-rollout.md)
- [OpenAPI Specification](../../openapi/memory-layer-v1.yaml)
- [CHANGELOG](../../CHANGELOG.md)

---

**Invariant:** Memory enriches but never controls.
