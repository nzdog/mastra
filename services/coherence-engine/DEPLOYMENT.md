# Deployment Guide — Coherence Engine

## Pre-Deployment Checklist

Before deploying to any environment, verify:

- [ ] All tests pass: `npm test`
- [ ] No linter errors: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] Example script runs: `npm run example`
- [ ] Dev server starts: `npm run dev`
- [ ] Production build succeeds: `npm run build`

## Environment Variables

### Required

None (all defaults work out of the box)

### Optional

- `PORT` — HTTP server port (default: 3000)
- `NODE_ENV` — Environment (development/production)

## Installation

```bash
cd services/coherence-engine
npm install
```

## Production Build

```bash
npm run build
```

This creates a `dist/` directory with compiled JavaScript.

## Running in Production

### Direct Node

```bash
npm run build
npm start
```

### With PM2

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name coherence-engine
pm2 save
pm2 startup
```

### Docker (Example)

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t coherence-engine .
docker run -p 3000:3000 coherence-engine
```

## Health Checks

The service exposes a health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "service": "coherence-engine",
  "version": "1.0.0",
  "timestamp": "2024-11-17T12:00:00.000Z"
}
```

## Monitoring

### Key Metrics to Track

1. **Request Rate**
   - `/coherence/stabilise-only` requests per minute
   - `/coherence/evaluate` requests per minute

2. **Response Times**
   - p50, p95, p99 latency

3. **Classification Distribution**
   - % STABLE
   - % DRIFT
   - % DISTORTION
   - % PRE_COLLAPSE

4. **Error Rates**
   - 400 errors (bad requests)
   - 500 errors (should be ZERO)

5. **Drift Violations**
   - Should be ZERO in production (log as CRITICAL if detected)

### Logging

The service logs:

- All HTTP requests with timestamps
- CRITICAL errors if drift is detected in outputs
- Server startup info

Consider adding structured logging (e.g., Winston, Pino) for production.

## Load Testing

Before production deployment, run load tests:

```bash
# Using Apache Bench
ab -n 1000 -c 10 -p test-payload.json -T application/json http://localhost:3000/coherence/stabilise-only

# Using Artillery
artillery quick --count 100 --num 10 http://localhost:3000/coherence/stabilise-only
```

Expected performance:

- Latency: < 50ms p95
- Throughput: > 100 req/sec (single instance)

## Scaling

The service is stateless and horizontally scalable:

1. Run multiple instances behind a load balancer
2. No shared state between instances
3. No database dependencies (Phase 1)
4. No session storage

## Security

### CORS

CORS is enabled by default. In production, configure allowed origins:

Edit `api/server.ts`:

```typescript
app.use(
  cors({
    origin: ['https://your-app.com', 'https://app.lichen.protocol'],
  })
);
```

### Rate Limiting

Consider adding rate limiting for production:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.use('/coherence', limiter);
```

### Input Validation

All inputs are validated. Invalid requests return 400.

## Troubleshooting

### Server won't start

1. Check port is available: `lsof -i :3000`
2. Check dependencies installed: `npm install`
3. Check TypeScript compiled: `npm run build`

### Tests failing

1. Check Node version: `node --version` (requires 20+)
2. Clean install: `rm -rf node_modules && npm install`
3. Check for TypeScript errors: `npm run type-check`

### Drift violations in production

**This is a CRITICAL bug.** Drift should NEVER appear in outputs.

1. Check logs for violation details
2. Identify which output builder produced drift
3. Fix the output builder
4. Deploy hotfix immediately
5. Review all outputs since bug introduced

### High latency

1. Check CPU/memory usage
2. Profile with `node --prof`
3. Consider caching classification results (with TTL)

## Rollback Plan

If deployment fails:

1. Revert to previous version
2. Check health endpoint
3. Verify tests pass on reverted version
4. Investigate failure cause

## Phase 2 Migration

When Phase 2 (Amplification) is ready:

1. Deploy Phase 2 alongside Phase 1 (canary deployment)
2. Route 10% traffic to Phase 2
3. Monitor drift violations and accuracy
4. Gradually increase traffic to Phase 2
5. Sunset Phase 1 after full validation

## Support

For deployment issues, contact the Lichen Protocol engineering team.

---

**Status:** Phase 1 Deployment Ready ✅
