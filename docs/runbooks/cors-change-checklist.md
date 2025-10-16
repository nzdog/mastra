# CORS Configuration Change Checklist

**Phase 1.2: CORS Hardening & Verification**

This runbook provides a step-by-step checklist for safely modifying CORS configuration in production environments.

## Purpose

CORS (Cross-Origin Resource Sharing) configuration changes can break frontend access if not done carefully. This checklist ensures safe, validated changes with proper rollback procedures.

## When to Use This Runbook

- Adding new allowed origins (e.g., new frontend domain)
- Removing deprecated origins
- Changing credentials policy (CORS_ALLOW_CREDENTIALS)
- Modifying preflight cache duration (CORS_MAX_AGE)
- Updating allowed methods or headers

## Prerequisites

- [ ] Access to deployment platform (Railway/Heroku/etc.)
- [ ] Access to monitoring dashboard (metrics endpoint)
- [ ] Backup of current CORS configuration
- [ ] Test environment configured with proposed changes

## Safety Checklist

### Pre-Change Validation

- [ ] **Document current configuration**
  ```bash
  # Production
  echo "Current CORS_ALLOWED_ORIGINS: $CORS_ALLOWED_ORIGINS"
  echo "Current CORS_ALLOW_CREDENTIALS: $CORS_ALLOW_CREDENTIALS"
  echo "Current CORS_MAX_AGE: $CORS_MAX_AGE"

  # Save to file
  env | grep CORS > cors-config-backup-$(date +%Y%m%d-%H%M%S).txt
  ```

- [ ] **Verify proposed changes are valid**
  - Origins are valid URLs (https:// for production)
  - No wildcard (*) with credentials enabled
  - Methods are valid HTTP verbs (GET, POST, PUT, PATCH, DELETE, OPTIONS)
  - Headers are valid header names

- [ ] **Test in staging/development first**
  ```bash
  # Development
  CORS_ALLOWED_ORIGINS="http://localhost:3000,https://staging.yourdomain.com" npm run server

  # Test with curl
  curl -H "Origin: https://staging.yourdomain.com" -i http://localhost:3000/v1/health
  ```

- [ ] **Check current CORS metrics baseline**
  ```bash
  curl -s http://localhost:3000/metrics | grep cors
  # Look for: cors_preflight_total, cors_reject_total, cors_preflight_duration_ms
  ```

### Change Procedure

- [ ] **Announce change window**
  - Notify team of CORS configuration change
  - Document expected impact (if any)
  - Have rollback plan ready

- [ ] **Apply configuration change**
  ```bash
  # Railway example
  railway variables set CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com,https://new-domain.com"

  # Or via Railway dashboard:
  # 1. Navigate to project > Variables
  # 2. Update CORS_ALLOWED_ORIGINS
  # 3. Click "Deploy" to restart with new config
  ```

- [ ] **Wait for deployment to complete**
  - Monitor deployment logs for errors
  - Check for server restart confirmation
  - Verify new config loaded: Look for `🌐 CORS Configuration:` in logs

### Post-Change Validation

- [ ] **Verify health endpoint**
  ```bash
  curl -i https://your-deployment-url.railway.app/v1/health
  # Should return 200 OK
  ```

- [ ] **Test valid origin (should work)**
  ```bash
  curl -H "Origin: https://yourdomain.com" -i https://your-deployment-url.railway.app/v1/health
  # Should return: access-control-allow-origin: https://yourdomain.com
  ```

- [ ] **Test invalid origin (should be rejected)**
  ```bash
  curl -H "Origin: https://evil.com" -i https://your-deployment-url.railway.app/v1/health
  # Should NOT return: access-control-allow-origin header
  ```

- [ ] **Test preflight (OPTIONS)**
  ```bash
  curl -X OPTIONS \
    -H "Origin: https://yourdomain.com" \
    -H "Access-Control-Request-Method: GET" \
    -i https://your-deployment-url.railway.app/v1/health
  # Should return: access-control-max-age, access-control-allow-methods
  ```

- [ ] **Verify security headers**
  ```bash
  curl -i https://your-deployment-url.railway.app/v1/health | grep -i "referrer-policy"
  curl -i https://your-deployment-url.railway.app/v1/health | grep -i "x-content-type-options"
  curl -i https://your-deployment-url.railway.app/v1/health | grep -i "permissions-policy"
  ```

- [ ] **Check CORS metrics**
  ```bash
  curl -s https://your-deployment-url.railway.app/metrics | grep cors
  # Verify metrics are incrementing:
  # - cors_preflight_total (should increase with OPTIONS requests)
  # - cors_reject_total (should increase with invalid origins)
  # - cors_preflight_duration_ms (histogram buckets)
  ```

- [ ] **Test from actual frontend**
  - Open frontend in browser
  - Open browser console (F12 > Console)
  - Verify no CORS errors
  - Check network tab for CORS headers on API requests
  - Test preflight cache (second request should skip OPTIONS)

### Monitoring & Verification (First 15 Minutes)

- [ ] **Monitor CORS rejection rate**
  ```bash
  # Should be low (only invalid/malicious origins)
  watch -n 5 'curl -s https://your-deployment-url.railway.app/metrics | grep cors_reject_total'
  ```

- [ ] **Monitor preflight duration**
  ```bash
  # Should be under 50ms (P99)
  watch -n 5 'curl -s https://your-deployment-url.railway.app/metrics | grep cors_preflight_duration_ms'
  ```

- [ ] **Check server logs for rejections**
  ```bash
  # Look for: 🚫 CORS: Rejected origin="..."
  # Unexpected rejections indicate configuration error
  railway logs --follow
  ```

- [ ] **User-facing validation**
  - Test key user flows (login, API calls, etc.)
  - Verify no CORS errors in browser console
  - Check analytics for drop in API success rate

## Rollback Procedure

If issues are detected:

- [ ] **Immediate rollback**
  ```bash
  # Restore previous CORS config from backup
  railway variables set CORS_ALLOWED_ORIGINS="<previous-value-from-backup>"

  # Force redeploy
  railway redeploy
  ```

- [ ] **Verify rollback successful**
  ```bash
  curl -H "Origin: <expected-origin>" -i https://your-deployment-url.railway.app/v1/health
  # Should work again
  ```

- [ ] **Document rollback reason**
  - Note what went wrong
  - Update change checklist with lessons learned

## Common Issues & Troubleshooting

### Issue: Frontend gets CORS errors after change

**Symptom:**
```
Access to fetch at 'https://api.yourdomain.com/v1/health' from origin 'https://yourdomain.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

**Diagnosis:**
```bash
# Check if origin is in allowed list
curl -s https://your-deployment-url.railway.app/metrics | grep cors_reject_total
# If increasing, origin is being rejected

# Check server logs
railway logs | grep "CORS: Rejected"
```

**Fix:**
- Verify origin in `CORS_ALLOWED_ORIGINS` matches exactly (including protocol, subdomain, port)
- Check for typos in origin URL
- Ensure no trailing slashes

### Issue: Preflight requests failing

**Symptom:**
```
Access to fetch at '...' has been blocked by CORS policy: Response to preflight
request doesn't pass access control check.
```

**Diagnosis:**
```bash
curl -X OPTIONS -H "Origin: https://yourdomain.com" -i https://your-deployment-url.railway.app/v1/health
# Check for Access-Control-Allow-Methods, Access-Control-Max-Age headers
```

**Fix:**
- Verify `CORS_ALLOW_METHODS` includes required method (GET, POST, etc.)
- Verify `CORS_ALLOW_HEADERS` includes required headers (Content-Type, Authorization, etc.)

### Issue: Credentials not working

**Symptom:**
```
Access to fetch at '...' has been blocked by CORS policy: The value of the
'Access-Control-Allow-Credentials' header in the response is '' which must be 'true'
when the request's credentials mode is 'include'.
```

**Diagnosis:**
```bash
curl -H "Origin: https://yourdomain.com" -i https://your-deployment-url.railway.app/v1/health | grep -i credentials
```

**Fix:**
- Set `CORS_ALLOW_CREDENTIALS=true` in environment variables
- Ensure `CORS_ALLOWED_ORIGINS` is NOT wildcard (*)

### Issue: High preflight latency

**Symptom:**
- Every API request is slow (2x expected latency)
- Browser makes OPTIONS request before every real request

**Diagnosis:**
```bash
curl -s https://your-deployment-url.railway.app/metrics | grep cors_preflight_duration_ms
# Check P99 latency
```

**Fix:**
- Increase `CORS_MAX_AGE` to reduce preflight frequency (e.g., 3600 = 1 hour)
- Verify preflight handler is optimized (should be < 10ms)

## Validation Checklist (Copy/Paste for PRs)

```markdown
## CORS Configuration Change Validation

- [ ] Pre-change backup created: `cors-config-backup-YYYYMMDD-HHMMSS.txt`
- [ ] Tested in staging/development
- [ ] No wildcard (*) with credentials enabled
- [ ] Valid origin receives CORS headers (curl test passed)
- [ ] Invalid origin rejected (curl test passed)
- [ ] Preflight OPTIONS works (curl test passed)
- [ ] Security headers present (Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
- [ ] CORS metrics incrementing correctly
- [ ] Frontend tested in browser (no console errors)
- [ ] Monitored for 15 minutes (no unexpected rejections)
- [ ] Rollback procedure documented and tested
```

## Emergency Contacts

- **Deployment Platform:** Railway (railway.app/dashboard)
- **Monitoring:** `/metrics` endpoint
- **Logs:** `railway logs --follow`
- **Rollback:** Restore previous environment variables

## Change Log

| Date       | Change                          | Changed By | Result  |
| ---------- | ------------------------------- | ---------- | ------- |
| 2025-10-16 | Initial CORS hardening (Phase 1.2) | Core Team  | Success |

---

**Last Updated:** 2025-10-16
**Maintained By:** Core Team
**Related Runbooks:** canary-cors.md, key-rotation.md
