# Canary CORS Rollout Runbook

**Phase 1.2: CORS Hardening & Verification**

This runbook provides a gradual, low-risk approach to rolling out CORS configuration changes using canary deployment principles.

## Purpose

When making significant CORS changes (e.g., adding multiple new origins, changing credentials policy), use a canary approach to validate changes with minimal user impact.

## When to Use This Runbook

- **High-risk CORS changes:**
  - Adding many new origins at once
  - Enabling `CORS_ALLOW_CREDENTIALS` for the first time
  - Significant changes to allowed methods/headers
  - Migrating from old CORS package to new config

- **Production environments** with active users
- **Changes affecting user-facing APIs** (not just internal tools)

## Canary Deployment Strategy

### Phase 1: Canary Environment (0-5% of traffic)

**Goal:** Validate changes with minimal risk

1. **Create canary deployment**
   ```bash
   # Railway example: Create new service
   railway service create memory-layer-canary

   # Deploy with new CORS config
   railway variables set CORS_ALLOWED_ORIGINS="<new-origins>" --service memory-layer-canary
   railway deploy --service memory-layer-canary
   ```

2. **Route small percentage of traffic**
   - Use load balancer rules (if available)
   - Or: Share canary URL with internal testers only
   - Monitor for 1 hour minimum

3. **Validation steps** (see [Canary Validation Checklist](#canary-validation-checklist))

### Phase 2: Expanded Canary (5-25% of traffic)

**Goal:** Validate under realistic load

1. **Increase traffic percentage**
   ```bash
   # Update load balancer weights
   # Or: Roll out to specific user segments
   ```

2. **Monitor for 2-4 hours**
   - Check CORS rejection rate (should be stable)
   - Check preflight latency (should be < 50ms P99)
   - Check user error rates (should not increase)

3. **Validation steps** (see [Expanded Canary Validation](#expanded-canary-validation))

### Phase 3: Full Rollout (100% of traffic)

**Goal:** Complete the migration

1. **Apply changes to production**
   ```bash
   railway variables set CORS_ALLOWED_ORIGINS="<new-origins>" --service memory-layer-prod
   railway deploy --service memory-layer-prod
   ```

2. **Monitor for 24 hours**
   - Watch for CORS-related errors
   - Check metrics for anomalies
   - Be ready for rollback

3. **Decommission canary** (after validation)
   ```bash
   railway service delete memory-layer-canary
   ```

## Canary Validation Checklist

### Pre-Canary Setup

- [ ] **Document current baseline metrics**
  ```bash
  # Production baseline (before canary)
  curl -s https://prod.yourdomain.com/metrics | grep cors > baseline-cors-metrics.txt
  curl -s https://prod.yourdomain.com/metrics | grep audit_events_total >> baseline-metrics.txt
  ```

- [ ] **Create canary deployment**
  - Separate Railway service (or equivalent)
  - Same code, new CORS config
  - Isolated database/Redis (if needed)

- [ ] **Prepare rollback plan**
  - Document canary service name
  - Save old CORS config
  - Have production config ready to restore

### Canary Validation (0-5% traffic, 1 hour)

- [ ] **Verify canary health**
  ```bash
  curl -i https://canary.yourdomain.com/readyz
  # Should return 200 OK
  ```

- [ ] **Test valid origins (all configured origins)**
  ```bash
  # Test each origin individually
  for origin in "https://yourdomain.com" "https://www.yourdomain.com" "https://new-domain.com"; do
    echo "Testing origin: $origin"
    curl -H "Origin: $origin" -i https://canary.yourdomain.com/readyz | grep -i access-control
  done
  ```

- [ ] **Test invalid origin (should reject)**
  ```bash
  curl -H "Origin: https://evil.com" -i https://canary.yourdomain.com/readyz | grep -i access-control
  # Should NOT have access-control-allow-origin header
  ```

- [ ] **Test preflight for each origin**
  ```bash
  for origin in "https://yourdomain.com" "https://www.yourdomain.com"; do
    echo "Testing preflight for: $origin"
    curl -X OPTIONS \
      -H "Origin: $origin" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: Content-Type,Authorization" \
      -i https://canary.yourdomain.com/readyz
  done
  ```

- [ ] **Check canary CORS metrics**
  ```bash
  watch -n 10 'curl -s https://canary.yourdomain.com/metrics | grep cors'
  ```

- [ ] **Compare canary vs production metrics**
  ```bash
  # Canary
  curl -s https://canary.yourdomain.com/metrics | grep cors_reject_total
  # Production
  curl -s https://prod.yourdomain.com/metrics | grep cors_reject_total
  # Reject rate should be similar (or lower if we added missing origins)
  ```

- [ ] **Test from real frontend**
  - Point staging frontend to canary API
  - Test key user flows (login, data fetching, etc.)
  - Check browser console for CORS errors
  - Verify network tab shows correct CORS headers

### Expanded Canary Validation (5-25% traffic, 2-4 hours)

- [ ] **Monitor CORS rejection rate**
  ```bash
  # Should be stable (not increasing)
  watch -n 30 'curl -s https://canary.yourdomain.com/metrics | grep cors_reject_total'
  ```

- [ ] **Monitor preflight latency**
  ```bash
  # P99 should be < 50ms
  curl -s https://canary.yourdomain.com/metrics | grep cors_preflight_duration_ms
  ```

- [ ] **Check server logs for unexpected rejections**
  ```bash
  railway logs --service memory-layer-canary --follow | grep "CORS: Rejected"
  # Should only see malicious/invalid origins, not legitimate ones
  ```

- [ ] **Monitor user-facing error rates**
  ```bash
  # Check audit events for increased failures
  curl -s https://canary.yourdomain.com/metrics | grep audit_events_total
  # Filter by event_type="HEALTH" operation="health_check"
  ```

- [ ] **User feedback**
  - Check support tickets for CORS-related issues
  - Monitor analytics for drop in API success rate
  - Check browser error tracking (Sentry, etc.)

### Full Rollout Validation (100% traffic, 24 hours)

- [ ] **Apply to production**
  - Use same CORS config as validated canary
  - Deploy to production service

- [ ] **Immediate validation (first 15 minutes)**
  - Health check returns 200
  - CORS headers present for valid origins
  - No increase in error rates
  - No spike in support tickets

- [ ] **Extended monitoring (24 hours)**
  - CORS rejection rate stable
  - Preflight latency stable
  - User error rates stable
  - No CORS-related incidents

- [ ] **Decommission canary**
  ```bash
  # After 24 hours of successful production rollout
  railway service delete memory-layer-canary
  ```

## Rollback Procedure

### Rollback from Canary (Phase 1/2)

- [ ] **Stop routing traffic to canary**
  ```bash
  # Update load balancer to 0% canary traffic
  # Or: Remove canary URL from frontend config
  ```

- [ ] **Analyze what went wrong**
  - Check canary logs: `railway logs --service memory-layer-canary`
  - Check CORS metrics for patterns
  - Document failure reason

- [ ] **Fix and retry**
  - Update CORS config based on findings
  - Redeploy canary with fix
  - Restart validation

### Rollback from Production (Phase 3)

- [ ] **Immediate rollback**
  ```bash
  # Restore previous CORS config from backup
  railway variables set CORS_ALLOWED_ORIGINS="<previous-value>" --service memory-layer-prod
  railway redeploy --service memory-layer-prod
  ```

- [ ] **Verify rollback successful**
  ```bash
  curl -H "Origin: <expected-origin>" -i https://prod.yourdomain.com/readyz
  # Should work again
  ```

- [ ] **Incident postmortem**
  - Document what went wrong
  - Update canary validation checklist
  - Plan next attempt

## Metrics to Monitor

### Critical Metrics (Monitor continuously)

1. **CORS Rejection Rate**
   ```promql
   rate(cors_reject_total[5m])
   ```
   - **Expected:** Low and stable (only malicious origins)
   - **Alert if:** Increases by >10x

2. **Preflight Latency (P99)**
   ```promql
   histogram_quantile(0.99, cors_preflight_duration_ms)
   ```
   - **Expected:** < 50ms
   - **Alert if:** > 100ms

3. **CORS Preflight Volume**
   ```promql
   rate(cors_preflight_total[5m])
   ```
   - **Expected:** Proportional to API request rate
   - **Alert if:** Spikes unexpectedly (indicates cache not working)

### Secondary Metrics (Check periodically)

4. **Audit Event Success Rate**
   ```promql
   rate(audit_events_total{event_type!="HEALTH"}[5m])
   ```
   - Should not decrease after CORS change

5. **API Request Success Rate** (from frontend)
   - **Expected:** > 99.9%
   - **Alert if:** Drops below baseline

## Comparison: Canary vs Direct Rollout

| Factor                  | Direct Rollout    | Canary Rollout        |
| ----------------------- | ----------------- | --------------------- |
| **Risk**                | High              | Low                   |
| **Rollback complexity** | Affects all users | Affects canary only   |
| **Time to deploy**      | 1 hour            | 4-8 hours             |
| **Confidence level**    | Moderate          | High                  |
| **Best for**            | Low-risk changes  | High-risk changes     |
| **Cost**                | Single deployment | Dual deployments      |

## Decision Tree: Use Canary?

```
Is this a high-risk CORS change?
├─ Yes (adding many origins, enabling credentials, etc.)
│  └─ Use canary rollout (this runbook)
├─ No (adding 1-2 origins, minor config tweaks)
│  └─ Use direct rollout (cors-change-checklist.md)
└─ Unsure?
   └─ Ask: "If this breaks, how many users are affected?"
      ├─ > 1000 users → Use canary
      └─ < 1000 users → Direct rollout OK
```

## Example: Adding New Frontend Domain

**Scenario:** Adding `https://app.newdomain.com` to CORS allowlist

### Phase 1: Canary (1 hour)

```bash
# Deploy canary with new origin
railway variables set \
  CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com,https://app.newdomain.com" \
  --service memory-layer-canary

railway deploy --service memory-layer-canary

# Test new origin
curl -H "Origin: https://app.newdomain.com" -i https://canary.yourdomain.com/readyz
# Should return: access-control-allow-origin: https://app.newdomain.com

# Monitor for 1 hour
watch -n 60 'curl -s https://canary.yourdomain.com/metrics | grep cors'
```

### Phase 2: Expanded Canary (2 hours)

```bash
# Route 10% of traffic to canary (via load balancer)
# Monitor CORS metrics, user error rates

# If all looks good, increase to 25%
# Monitor for 2 more hours
```

### Phase 3: Full Rollout

```bash
# Apply to production
railway variables set \
  CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com,https://app.newdomain.com" \
  --service memory-layer-prod

railway deploy --service memory-layer-prod

# Monitor for 24 hours
# Decommission canary after validation
railway service delete memory-layer-canary
```

## Emergency Contacts

- **Deployment Platform:** Railway (railway.app/dashboard)
- **Monitoring:** `/metrics` endpoint
- **Logs:** `railway logs --service <service-name> --follow`
- **Rollback:** Restore previous environment variables

## Change Log

| Date       | Change                          | Canary Duration | Result  |
| ---------- | ------------------------------- | --------------- | ------- |
| 2025-10-16 | Initial CORS hardening (Phase 1.2) | N/A (direct)    | Success |

---

**Last Updated:** 2025-10-16
**Maintained By:** Core Team
**Related Runbooks:** cors-change-checklist.md, key-rotation.md
