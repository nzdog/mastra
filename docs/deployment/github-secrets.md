# GitHub Secrets Configuration

This document lists the required secrets for the spec-sandbox deployment environment.

## Required Secrets

Configure these in GitHub Settings → Secrets and variables → Actions:

### Repository Secrets

1. **ANTHROPIC_API_KEY**
   - Description: Anthropic API key for Claude integration
   - Required: Yes
   - Used in: CI tests and deployments

2. **RAILWAY_TOKEN**
   - Description: Railway API token for deployments
   - Required: Yes (for automatic deployments)
   - How to get: Run `railway login` and then `railway token`
   - Used in: deploy-feature-branch.yml workflow

3. **RAILWAY_PROJECT_ID**
   - Description: Railway project ID
   - Required: Yes (for automatic deployments)
   - How to get: Run `railway status` in your project directory
   - Used in: deploy-feature-branch.yml workflow

## Environment Configuration

### spec-sandbox Environment

Create a new environment in GitHub Settings → Environments → New environment:

- **Name**: `spec-sandbox`
- **Deployment branches**: Selected branches → `feature/memory-layer-spec`
- **Required reviewers**: (Optional) Add reviewers if you want approval before deployment
- **Wait timer**: (Optional) Set delay before deployment

### Environment Secrets (Optional)

If you want environment-specific secrets, you can set them in the spec-sandbox environment:

- ANTHROPIC_API_KEY (can override repository secret)
- Custom variables for spec-sandbox

## Railway Environment Variables

These should be set in Railway dashboard for the spec-sandbox environment:

```bash
NODE_ENV=staging
ENVIRONMENT_NAME=spec-sandbox
BRANCH_NAME=feature/memory-layer-spec
ENABLE_AUDIT_LOGGING=true
ENABLE_MEMORY_LAYER_SPEC=true
ENABLE_POLICY_GATES=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
```

## Setup Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Get your token (for RAILWAY_TOKEN secret)
railway token

# Get project ID (for RAILWAY_PROJECT_ID secret)
railway status

# Run setup script
./scripts/setup-branch-deployment.sh
```

## Verification

After setup, verify the deployment workflow by:

1. Push to `feature/memory-layer-spec` branch
2. Check GitHub Actions workflow run
3. Verify deployment in Railway dashboard
4. Test the deployed endpoint: `curl https://your-spec-sandbox-url.railway.app/health`
