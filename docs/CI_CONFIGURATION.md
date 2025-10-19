# CI/CD Configuration Guide

This document explains how to configure CI/CD environments for the Mastra Lichen Agent.

## Required Environment Variables

### Core Variables

#### `SKIP_API_KEY_CHECK`
- **Purpose:** Allows tests and development servers to run without `ANTHROPIC_API_KEY`
- **CI Value:** `true`
- **Production:** Should be `false` or unset
- **Required:** Yes (for CI/test environments)

#### `NODE_ENV`
- **Purpose:** Specifies the runtime environment
- **CI Value:** `test`
- **Production:** `production`
- **Required:** Yes

### Database Configuration (Postgres Tests)

#### `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- **Purpose:** PostgreSQL connection parameters
- **CI Values:**
  ```
  PGHOST=localhost
  PGPORT=5432
  PGDATABASE=lichen_memory_test
  PGUSER=postgres
  PGPASSWORD=postgres
  ```
- **Required:** Yes (for integration tests with Postgres)

**Note:** The CI uses `PGUSER=postgres`, not `root`. Ensure your database service is configured accordingly.

### Encryption & KMS

#### `ENCRYPTION_ENABLED`
- **Purpose:** Enable/disable encryption features
- **CI Value:** `true` or `false` (depends on test)
- **Production:** `true`

#### `KMS_PROVIDER`
- **Purpose:** Specify KMS provider for key management
- **CI Value:** `memory` (for tests only)
- **Production:** `aws`, `gcp`, or custom provider (NOT `memory`)
- **Warning:** `memory` provider is **INSECURE** and must never be used in production

#### `DEV_KEK_BASE64`
- **Purpose:** Base64-encoded KEK for development/testing
- **CI Value:** `dGVzdC1rZWstZm9yLWNpLXRlc3Rpbmctb25seS0zMi1ieXRlcw==`
- **Production:** Use secure KMS instead
- **Required:** Only when `KMS_PROVIDER=memory`

### Ledger Configuration

#### `LEDGER_ENABLED`
- **Purpose:** Enable/disable audit ledger
- **CI Value:** `false` (for most tests)
- **Production:** `true` (recommended)

#### `LEDGER_OPTIONAL`
- **Purpose:** Allow server to start even if ledger fails
- **CI Value:** `true`
- **Production:** `false` (enforce ledger in production)

### Authentication (Production Only)

#### `AUTH_PROVIDER`
- **Purpose:** Specify authentication provider
- **Feature Branches:** `mock` (allowed)
- **Main/Master Branch:** `jwks` (**REQUIRED**)
- **Production:** `jwks` with valid `JWKS_URL`

#### `JWKS_URL`
- **Purpose:** JWKS endpoint for JWT verification
- **Example:** `https://your-auth-provider.com/.well-known/jwks.json`
- **Required:** Only when `AUTH_PROVIDER=jwks`

### Optional Secrets (CI)

#### `ANTHROPIC_API_KEY`
- **Purpose:** API key for Anthropic services (used by agent functionality)
- **CI:** Optional (use `SKIP_API_KEY_CHECK=true` to bypass)
- **Production:** Required if agent features are used
- **How to set:** Add as GitHub repository secret

## GitHub Actions Secrets

To configure secrets in GitHub:

1. Go to: **Repository → Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add the following secrets as needed:

| Secret Name | Required for CI | Description |
|-------------|----------------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key (tests work without it via `SKIP_API_KEY_CHECK`) |
| `POSTGRES_PASSWORD` | No | Already set in workflows |

## CI Workflow Configurations

### Integration Tests (`test.yml`)

**Environment:**
```yaml
env:
  PGHOST: localhost
  PGUSER: postgres
  PGPASSWORD: postgres
  PGDATABASE: lichen_memory_test
  NODE_ENV: test
  PERSISTENCE: postgres
  ENCRYPTION_ENABLED: true
  KMS_PROVIDER: memory
  LEDGER_ENABLED: false
  LEDGER_OPTIONAL: true
  SKIP_API_KEY_CHECK: true
```

**Database:** Uses PostgreSQL 14 service container

### Policy Gates (`policy-gates.yml`)

**Key Checks:**
- ✅ No `user_id` references (must use `hashed_pseudonym`)
- ✅ No email or SSN patterns in code
- ✅ `AUTH_PROVIDER=mock` only allowed on feature branches
- ✅ Error envelope compliance
- ✅ CORS configuration
- ✅ Rate limiting presence

### Standard CI (`ci.yml`)

**Features:**
- Lint and Prettier checks
- Tests with `continue-on-error: true` (allows tests to fail without blocking)
- Dependency review on PRs

## Troubleshooting

### "Error: ANTHROPIC_API_KEY not found"

**Solution:** Set `SKIP_API_KEY_CHECK=true` in test environment OR add `ANTHROPIC_API_KEY` to GitHub secrets.

### "role 'root' does not exist"

**Solution:** The CI uses `PGUSER=postgres`. Update your local configuration or CI env vars to use `postgres` instead of `root`.

### "AUTH_PROVIDER=mock detected on production branch"

**Solution:** This check only applies to `main`/`master` branches:
- **Feature branches:** `AUTH_PROVIDER=mock` is allowed
- **Production branches:** Must use `AUTH_PROVIDER=jwks` with valid `JWKS_URL`
- **Note:** `.env.example` files are ignored by this check

### Tests Fail with "Cannot connect to database"

**Verify:**
1. PostgreSQL service is running in CI
2. `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` are set correctly
3. Database migrations were applied

## Example .env for CI

```bash
# Core
NODE_ENV=test
SKIP_API_KEY_CHECK=true

# Database
PGHOST=localhost
PGPORT=5432
PGDATABASE=lichen_memory_test
PGUSER=postgres
PGPASSWORD=postgres

# Encryption (test-only KMS)
ENCRYPTION_ENABLED=true
KMS_PROVIDER=memory
DEV_KEK_BASE64=dGVzdC1rZWstZm9yLWNpLXRlc3Rpbmctb25seS0zMi1ieXRlcw==

# Ledger
LEDGER_ENABLED=false
LEDGER_OPTIONAL=true

# Auth (feature branch)
AUTH_PROVIDER=mock
```

## Production Checklist

Before deploying to production:

- [ ] `AUTH_PROVIDER=jwks` with valid `JWKS_URL`
- [ ] `KMS_PROVIDER` is NOT `memory` (use aws/gcp/secure provider)
- [ ] `LEDGER_ENABLED=true` and `LEDGER_OPTIONAL=false`
- [ ] `ENCRYPTION_ENABLED=true`
- [ ] `ANTHROPIC_API_KEY` is set (if using agent features)
- [ ] `NODE_ENV=production`
- [ ] Database credentials are secure (not test credentials)
- [ ] `SKIP_API_KEY_CHECK` is unset or `false`

## Further Reading

- [Environment Setup Specs](./specs/environment-setup.md)
- [Phase 3 Example Config](./../.env.phase3.example)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
