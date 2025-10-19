# Deployment Guide: spec-sandbox Environment

This guide explains how to deploy and manage the `feature/memory-layer-phase-3.2` branch in a separate deployment environment.

## Overview

The spec-sandbox environment is a dedicated deployment for testing the Memory Layer Specification implementation. It runs independently from the main production environment.

### Architecture

```
┌─────────────────────────────────────────┐
│  GitHub Repository                       │
│  ├── main branch → production (Railway) │
│  └── feature/memory-layer-phase-3.2          │
│      └── spec-sandbox (Railway)         │
└─────────────────────────────────────────┘
```

## Initial Setup

### 1. Railway Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Run automated setup script
./scripts/setup-branch-deployment.sh
```

The script will:
- Create `spec-sandbox` environment in Railway
- Link the feature branch
- Configure environment variables
- Generate a deployment domain

### 2. GitHub Secrets Setup

Configure these secrets in GitHub (Settings → Secrets and variables → Actions):

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `ANTHROPIC_API_KEY` | Claude API key | From Anthropic Console |
| `RAILWAY_TOKEN` | Railway API token | Run `railway token` |
| `RAILWAY_PROJECT_ID` | Railway project ID | Run `railway status` |

See [github-secrets.md](./github-secrets.md) for detailed instructions.

### 3. Create GitHub Environment

1. Go to Settings → Environments → New environment
2. Name: `spec-sandbox`
3. Deployment branches: Select `feature/memory-layer-phase-3.2`
4. (Optional) Add required reviewers
5. Save

## Deployment Process

### Automatic Deployment

Deployments happen automatically on every push to `feature/memory-layer-phase-3.2`:

```bash
git push origin feature/memory-layer-phase-3.2
```

The GitHub Actions workflow will:
1. Run tests and linters
2. Execute policy gates (ADR, spec, audit checks)
3. Build the Docker image
4. Deploy to Railway spec-sandbox
5. Run health checks
6. Post deployment summary

### Manual Deployment

To deploy manually via Railway CLI:

```bash
# Switch to spec-sandbox environment
railway environment spec-sandbox

# Deploy
railway up

# View logs
railway logs

# Get deployment URL
railway domain
```

### Manual Deployment via GitHub Actions

Trigger a manual deployment from GitHub:

1. Go to Actions → Deploy Feature Branch
2. Click "Run workflow"
3. Select branch: `feature/memory-layer-phase-3.2`
4. Click "Run workflow"

## Environment Configuration

### Environment Variables (Railway)

Set these in Railway dashboard for spec-sandbox:

```bash
NODE_ENV=staging
ENVIRONMENT_NAME=spec-sandbox
BRANCH_NAME=feature/memory-layer-phase-3.2
ENABLE_AUDIT_LOGGING=true
ENABLE_MEMORY_LAYER_SPEC=true
ENABLE_POLICY_GATES=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
```

### Feature Flags

The spec-sandbox environment has specific feature flags enabled:

- `ENABLE_AUDIT_LOGGING`: Enables audit event logging
- `ENABLE_MEMORY_LAYER_SPEC`: Activates Memory Layer Spec features
- `ENABLE_POLICY_GATES`: Enforces policy gate checks

## Monitoring & Verification

### Health Check

```bash
curl https://your-spec-sandbox-url.railway.app/health
```

Expected response:
```json
{
  "service": "field-diagnostic-agent",
  "version": "git-sha",
  "status": "ok",
  "checks": {
    "audit_sink": { "status": "ok" },
    "metrics": { "status": "ok" }
  }
}
```

### View Logs

```bash
# Via Railway CLI
railway logs --environment spec-sandbox

# Via GitHub Actions
# Go to Actions → Deploy Feature Branch → Click on latest run
```

### Deployment Status

Check deployment status:
- Railway Dashboard: https://railway.app/dashboard
- GitHub Actions: https://github.com/nzdog/mastra/actions
- Deployment URL: Get via `railway domain --environment spec-sandbox`

## Policy Gates

The deployment includes policy gates that must pass:

1. ✅ ADR 0001 exists (`docs/adr/0001-memory-layer-spec.md`)
2. ✅ Spec index exists (`spec/README.md`)
3. ✅ Audit emitter stub present (`service/audit/`)
4. ✅ Build passes
5. ✅ Tests pass (or continue-on-error)

## Troubleshooting

### Deployment Fails

```bash
# Check Railway logs
railway logs --environment spec-sandbox --tail

# Check GitHub Actions logs
# Go to Actions tab and click on failed workflow
```

### Environment Variables Not Set

```bash
# List current variables
railway variables --environment spec-sandbox

# Set a variable
railway variables set KEY=value --environment spec-sandbox
```

### Domain Issues

```bash
# Regenerate domain
railway domain --environment spec-sandbox
```

### Health Check Fails

```bash
# Check if service is running
railway status --environment spec-sandbox

# Check logs for errors
railway logs --environment spec-sandbox --tail
```

## Rollout Phases

The spec-sandbox supports the rollout phases from the Memory Layer Spec:

1. **Shadow** (current) - Deployed independently, no production traffic
2. **Canary** - Small percentage of production traffic
3. **Graduated** - Larger traffic split
4. **Regional** - Geographic rollout
5. **Full** - Complete rollout

## Cleanup

To remove the spec-sandbox environment:

```bash
# Via Railway CLI
railway environment delete spec-sandbox

# Via Railway Dashboard
# Go to Project → Environments → spec-sandbox → Delete
```

## Related Documentation

- [GitHub Secrets Configuration](./github-secrets.md)
- [Memory Layer Spec](../../spec/README.md)
- [ADR 0001](../adr/0001-memory-layer-spec.md)
- [Tracking Issue #11](https://github.com/nzdog/mastra/issues/11)
