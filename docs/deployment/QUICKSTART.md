# spec-sandbox Quick Start

Quick reference for deploying the Memory Layer Spec branch.

## One-Time Setup (5 minutes)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Run setup script
./scripts/setup-branch-deployment.sh

# 3. Add GitHub Secrets (via GitHub UI)
# Settings → Secrets and variables → Actions → New repository secret
# - RAILWAY_TOKEN (get via: railway token)
# - RAILWAY_PROJECT_ID (get via: railway status)
# - ANTHROPIC_API_KEY

# 4. Create GitHub Environment
# Settings → Environments → New environment
# Name: spec-sandbox
# Deployment branch: feature/memory-layer-phase-3.2
```

## Daily Usage

### Deploy Changes

```bash
# Automatic (just push)
git push origin feature/memory-layer-phase-3.2

# Manual via Railway
railway up --environment spec-sandbox
```

### Check Status

```bash
# View logs
railway logs --environment spec-sandbox

# Get URL
railway domain --environment spec-sandbox

# Health check
curl $(railway domain --environment spec-sandbox)/health
```

### View in Browser

- Railway Dashboard: https://railway.app/dashboard
- GitHub Actions: https://github.com/nzdog/mastra/actions
- Tracking Issue: https://github.com/nzdog/mastra/issues/11

## Common Commands

```bash
# Switch to spec-sandbox env
railway environment spec-sandbox

# Deploy now
railway up

# Stream logs
railway logs --tail

# Set variable
railway variables set KEY=value

# Get deployment URL
railway domain

# Check status
railway status
```

## Troubleshooting

```bash
# Deployment failed?
railway logs --tail

# Need to redeploy?
railway up --force

# Variables not working?
railway variables
railway variables set KEY=value

# Health check failing?
curl $(railway domain)/health
railway logs | grep -i error
```

## File Reference

| File | Purpose |
|------|---------|
| `.github/workflows/deploy-feature-branch.yml` | Auto-deploy workflow |
| `.env.spec-sandbox` | Environment template |
| `railway.spec-sandbox.json` | Railway config |
| `scripts/setup-branch-deployment.sh` | Setup automation |
| `docs/deployment/README.md` | Full documentation |

## Help

- Full docs: `docs/deployment/README.md`
- GitHub secrets: `docs/deployment/github-secrets.md`
- Railway docs: https://docs.railway.app
- Tracking issue: https://github.com/nzdog/mastra/issues/11
