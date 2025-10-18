#!/usr/bin/env bash
set -euo pipefail

############################
# Branch Deployment Setup Script
# Creates a separate Railway environment for feature/memory-layer-spec
############################

echo "==> Setting up spec-sandbox deployment environment"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if logged in to Railway
echo "==> Checking Railway authentication"
railway whoami || {
    echo "Please login to Railway:"
    railway login
}

# Get project ID
echo "==> Getting Railway project information"
railway status

# Create new environment in Railway project
echo "==> Creating spec-sandbox environment"
railway environment create spec-sandbox || echo "Environment may already exist"

# Switch to spec-sandbox environment
railway environment spec-sandbox

# Link to the branch
echo "==> Linking to feature/memory-layer-spec branch"
railway link --environment spec-sandbox

# Set environment variables
echo "==> Setting environment variables"
echo "Please set the following variables in Railway dashboard:"
echo "  - ANTHROPIC_API_KEY"
echo "  - NODE_ENV=staging"
echo "  - ENVIRONMENT_NAME=spec-sandbox"
echo "  - BRANCH_NAME=feature/memory-layer-spec"
echo "  - ENABLE_AUDIT_LOGGING=true"
echo "  - ENABLE_MEMORY_LAYER_SPEC=true"
echo "  - ENABLE_POLICY_GATES=true"
echo ""
echo "Or set them via CLI:"
read -p "Do you want to set ANTHROPIC_API_KEY now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -sp "Enter ANTHROPIC_API_KEY: " api_key
    echo
    railway variables set ANTHROPIC_API_KEY="$api_key"
fi

railway variables set NODE_ENV=staging
railway variables set ENVIRONMENT_NAME=spec-sandbox
railway variables set BRANCH_NAME=feature/memory-layer-spec
railway variables set ENABLE_AUDIT_LOGGING=true
railway variables set ENABLE_MEMORY_LAYER_SPEC=true
railway variables set ENABLE_POLICY_GATES=true

# Generate domain
echo "==> Generating domain for spec-sandbox"
railway domain || echo "Domain may already exist"

# Show deployment info
echo ""
echo "==> Setup complete!"
echo ""
echo "To deploy manually:"
echo "  railway up --environment spec-sandbox"
echo ""
echo "To view logs:"
echo "  railway logs --environment spec-sandbox"
echo ""
echo "To get deployment URL:"
echo "  railway domain --environment spec-sandbox"
echo ""
echo "GitHub Actions will automatically deploy on push to feature/memory-layer-spec"
