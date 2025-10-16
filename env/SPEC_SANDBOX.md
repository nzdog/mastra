# spec-sandbox environment

This file documents the sample environment variables and secrets required for the `spec-sandbox`
environment.

## Required Variables

**ANTHROPIC_API_KEY** (Required)
- Anthropic API key for Claude integration
- Example: `ANTHROPIC_API_KEY=sk-ant-...`
- Store in deployment platform's secret manager (Railway, Heroku, GitHub Environments)

## Optional Variables

### Redis Session Storage

**REDIS_URL** (Optional)
- Redis connection URL for persistent session storage
- If not provided, uses in-memory storage (ephemeral)
- Example: `REDIS_URL=redis://localhost:6379`
- Production: `REDIS_URL=redis://:password@hostname:6379`

### CORS Configuration (Phase 1.2)

**CORS_ALLOWED_ORIGINS** (Required in production, optional in development)
- Comma-separated list of allowed origins for API requests
- If not provided, defaults to localhost origins for development
- **Production: MUST be set explicitly (no wildcard allowed)**
- Examples:
  - Development: `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173`
  - Production: `CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
- **CRITICAL:** Throwing error in production if not set (no unsafe defaults)

**CORS_ALLOW_CREDENTIALS** (Optional, default: false)
- Allow credentials (cookies, authorization headers) in CORS requests
- Default: `false` (safer)
- Example: `CORS_ALLOW_CREDENTIALS=true`
- **CRITICAL:** Cannot be `true` with wildcard (`*`) origin (enforced at runtime)

**CORS_MAX_AGE** (Optional, default: 600)
- Preflight cache duration in seconds
- How long browsers cache preflight (OPTIONS) responses
- Default: `600` (10 minutes)
- Example: `CORS_MAX_AGE=3600` (1 hour)

**CORS_ALLOW_METHODS** (Optional, default: GET,POST,PUT,PATCH,DELETE,OPTIONS)
- Allowed HTTP methods for CORS requests
- Default: `GET,POST,PUT,PATCH,DELETE,OPTIONS`
- Example: `CORS_ALLOW_METHODS=GET,POST,DELETE`

**CORS_ALLOW_HEADERS** (Optional, default: Content-Type,Authorization,X-Requested-With,X-API-Version,X-Trace-ID)
- Allowed request headers
- Default: `Content-Type,Authorization,X-Requested-With,X-API-Version,X-Trace-ID`
- Example: `CORS_ALLOW_HEADERS=Content-Type,Authorization,X-Custom-Header`

**CORS_EXPOSE_HEADERS** (Optional, default: X-API-Version,X-Spec-Version)
- Headers exposed to client (can be read by JavaScript)
- Default: `X-API-Version,X-Spec-Version`
- Example: `CORS_EXPOSE_HEADERS=X-API-Version,X-Spec-Version,X-Request-ID`

## Example Configuration

### Development (Local)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional - CORS (development defaults work fine)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_CREDENTIALS=false
CORS_MAX_AGE=600
```

### Production (Railway/Heroku/etc.)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional - Redis for persistent sessions
REDIS_URL=redis://:password@hostname:6379

# Required - CORS (MUST be set explicitly)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOW_CREDENTIALS=false
CORS_MAX_AGE=600
CORS_ALLOW_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOW_HEADERS=Content-Type,Authorization,X-Requested-With,X-API-Version,X-Trace-ID
CORS_EXPOSE_HEADERS=X-API-Version,X-Spec-Version
```

## Security Notes

1. **Never commit real API keys** - Use deployment platform's secret manager
2. **CORS in production** - Always set `CORS_ALLOWED_ORIGINS` explicitly (no wildcard)
3. **Credentials + CORS** - Never set `CORS_ALLOW_CREDENTIALS=true` with wildcard origin
4. **Preflight cache** - Higher `CORS_MAX_AGE` reduces OPTIONS requests but slows origin changes

Configure these in your deployment platform's secret manager (Railway, Heroku, GitHub Environments).
