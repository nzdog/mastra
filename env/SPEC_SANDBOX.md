# spec-sandbox environment

This file documents the sample environment variables and secrets required for the `spec-sandbox`
environment.

Required (sample names, do not commit real secrets):

- ANTHROPIC_API_KEY=**anthropic_key**
- REDIS_URL=redis://host:6379
- ALLOWED_ORIGINS=http://localhost:3000

Configure these in your deployment platform's secret manager (Railway, Heroku, GitHub Environments).
