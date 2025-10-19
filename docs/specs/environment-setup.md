# spec-sandbox Environment Configuration

**Environment:** `spec-sandbox` **Platform:** Railway **Branch:** `feature/memory-layer-phase-3.2`
**Purpose:** Isolated deployment for Memory Layer Specification validation

## Required Secrets

Configure these secrets in your deployment platform (Railway/GitHub):

### GitHub Secrets

Set these in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

| Secret Name          | Description                      | Example Value        | Required |
| -------------------- | -------------------------------- | -------------------- | -------- |
| `RAILWAY_TOKEN`      | Railway API token for deployment | `YOUR_RAILWAY_TOKEN` | Yes      |
| `RAILWAY_PROJECT_ID` | Railway project ID               | `YOUR_PROJECT_ID`    | Yes      |
| `ANTHROPIC_API_KEY`  | Anthropic Claude API key         | `sk-ant-api03-...`   | Yes      |

### Railway Environment Variables

Set these in Railway dashboard for the `spec-sandbox` environment:

| Variable Name              | Description                                      | Example Value                              | Required (Prod) |
| -------------------------- | ------------------------------------------------ | ------------------------------------------ | --------------- |
| `ANTHROPIC_API_KEY`        | Anthropic Claude API key                         | `sk-ant-api03-...`                         | Yes             |
| `PORT`                     | Server port (auto-set by Railway)                | `3000`                                     | No (auto)       |
| `NODE_ENV`                 | Environment mode                                 | `production`                               | No              |
| `REDIS_URL`                | Redis connection string (for persistent sessions)| `redis://...`                              | No              |
| **CORS Configuration (Phase 1.2)**                                                                                     |
| `CORS_ALLOWED_ORIGINS`     | CORS allowed origins (comma-separated)           | `https://yourdomain.com`                   | **Yes**         |
| `CORS_ALLOW_CREDENTIALS`   | Allow credentials (cookies, auth headers)        | `false`                                    | No              |
| `CORS_MAX_AGE`             | Preflight cache duration (seconds)               | `600`                                      | No              |
| `CORS_ALLOW_METHODS`       | Allowed HTTP methods                             | `GET,POST,PUT,PATCH,DELETE,OPTIONS`        | No              |
| `CORS_ALLOW_HEADERS`       | Allowed request headers                          | `Content-Type,Authorization`               | No              |
| `CORS_EXPOSE_HEADERS`      | Headers exposed to client                        | `X-API-Version,X-Spec-Version`             | No              |
| **Backward Compatibility (Phase 3.2 - TEMPORARY)**                                                                     |
| `COMPAT_ALLOW_LEGACY_METADATA` | Accept StoreRequest without metadata field   | `true` (dev/staging only)                  | No              |
| `COMPAT_ALLOW_LEGACY_FAMILY`   | Accept legacy consent_family aliases         | `true` (dev/staging only)                  | No              |

## Setup Instructions

### 1. GitHub Secrets Setup

```bash
# Add Railway token
gh secret set RAILWAY_TOKEN --body "YOUR_RAILWAY_TOKEN"

# Add Railway project ID
gh secret set RAILWAY_PROJECT_ID --body "YOUR_PROJECT_ID"

# Add Anthropic API key
gh secret set ANTHROPIC_API_KEY --body "sk-ant-api03-..."
```

### 2. Railway Environment Setup

1. Log in to [Railway Dashboard](https://railway.app/)
2. Navigate to your project
3. Create a new environment named `spec-sandbox`
4. Add environment variables:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `ALLOWED_ORIGINS`: Your frontend domain (optional)
   - `REDIS_URL`: Redis connection string (optional)

### 3. Deploy to spec-sandbox

Push to `feature/memory-layer-phase-3.2` branch to trigger automatic deployment:

```bash
git push origin feature/memory-layer-phase-3.2
```

Or trigger manual deployment via GitHub Actions:

```bash
gh workflow run deploy-feature-branch.yml
```

### 4. Verify Deployment

After deployment completes, verify the endpoints:

```bash
# Legacy health check
curl https://YOUR_DEPLOYMENT_URL/health

# Memory Layer spec-compliant health check
curl https://YOUR_DEPLOYMENT_URL/readyz | jq '.'

# List available protocols
curl https://YOUR_DEPLOYMENT_URL/api/protocols | jq '.'
```

## Monitoring

### Health Check Response

The `/readyz` endpoint returns comprehensive status:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2025-10-16T...",
  "components": {
    "storage": { "status": "healthy", "message": "...", "last_check": "..." },
    "audit": { "status": "healthy", "message": "...", "last_check": "..." },
    "governance": { "status": "healthy", "message": "...", "last_check": "..." },
    "privacy": { "status": "healthy", "message": "...", "last_check": "..." }
  },
  "metrics": {
    "active_sessions": 0,
    "total_operations_24h": 0,
    "audit_ledger_height": 0,
    "last_audit_receipt_timestamp": null
  },
  "compliance": {
    "consent_coverage": 100,
    "encryption_enabled": false,
    "key_rotation_status": "current",
    "last_key_rotation": null
  },
  "slos": {
    "store_p99_latency_ms": 0,
    "recall_p99_latency_ms": 0,
    "availability_percentage": 100
  }
}
```

### Audit Verification

Check audit emitter status:

```bash
curl https://YOUR_DEPLOYMENT_URL/readyz | jq '.components.audit'
curl https://YOUR_DEPLOYMENT_URL/readyz | jq '.metrics.audit_ledger_height'
```

### Troubleshooting

**Deployment fails:**

- Check GitHub Actions logs for specific error
- Verify all required secrets are set
- Check Railway logs for runtime errors

**Health check returns unhealthy:**

- Check Railway logs for component errors
- Verify ANTHROPIC_API_KEY is set correctly
- Check audit emitter initialization

**CORS errors (Phase 1.2):**

- **Symptom:** Browser console shows CORS policy errors
- **Fix:** Add your frontend domain to `CORS_ALLOWED_ORIGINS` environment variable
- **Format:** `CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
- **Critical:** In production, `CORS_ALLOWED_ORIGINS` MUST be set (no wildcard allowed)
- **Preflight cache:** OPTIONS requests cached for `CORS_MAX_AGE` seconds (default: 600)
- **Credentials:** If you need cookies/auth headers, set `CORS_ALLOW_CREDENTIALS=true` (but never with wildcard origin)
- **Monitoring:** Check `/metrics` endpoint for `cors_preflight_total` and `cors_reject_total` counters
- **Validation:** Server logs will show `🚫 CORS: Rejected origin="https://evil.com"` for disallowed origins

**Backward Compatibility Flags (Phase 3.2):**

- **Deprecation Window:** 3-6 months from Phase 3.2 release
- **COMPAT_ALLOW_LEGACY_METADATA:** Temporarily accept requests without `metadata` field
  - Server will synthesize metadata from legacy top-level fields
  - Logs: `[CompatShim] Synthesizing metadata for legacy request`
  - Metrics: `compat_legacy_store_requests_total{reason="missing_metadata"}`
  - **Action Required:** Update clients to include `metadata` field in StoreRequest
- **COMPAT_ALLOW_LEGACY_FAMILY:** Temporarily accept legacy consent_family aliases
  - Maps: `individual` → `personal`, `group` → `cohort`, `aggregate` → `population`
  - Logs: `[CompatShim] Mapped legacy consent_family '...' -> '...'`
  - Metrics: `compat_legacy_store_requests_total{reason="legacy_family"}`
  - **Action Required:** Update clients to use canonical values: `personal`, `cohort`, `population`
- **Production:** These flags should ONLY be enabled during migration period, then disabled

## Security Notes

- Never commit secrets to the repository
- Use GitHub Secrets for CI/CD credentials
- Use Railway environment variables for runtime configuration
- Rotate API keys regularly (≤90 days for production)
- Enable encryption at rest in Phase 3

## Phase Progression

**Phase 0 (Current):**

- ✅ Basic health monitoring
- ✅ Audit emitter stub
- ✅ In-memory sessions

**Phase 1 (Next):**

- [ ] Merkle-chained audit ledger
- [ ] Cryptographic signatures
- [ ] Signed audit receipts

**Phase 2+:**

- [ ] Redis for persistent sessions
- [ ] Full encryption (AES-256 at-rest, TLS 1.3 in-transit)
- [ ] Key rotation automation
- [ ] Advanced monitoring and alerting

---

**Last Updated:** 2025-10-16 **Maintained by:** Core Team
