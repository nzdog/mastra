# Rate Limiting Implementation

## Overview

Rate limiting has been successfully implemented across all API endpoints to prevent abuse, protect
against DoS attacks, and control API costs.

## Installation

```bash
npm install express-rate-limit
```

## Configuration

### 1. General API Rate Limiter

- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Applied to:**
  - `GET /api/protocols`
  - `GET /api/session/:id`

### 2. AI Endpoint Rate Limiter (Strict)

- **Window:** 15 minutes
- **Max Requests:** 20 per IP
- **Applied to:**
  - `POST /api/walk/start` (with session creation limiter)
  - `POST /api/walk/continue`
  - `POST /api/walk/complete`
- **Purpose:** Protects against API cost explosion (Anthropic charges per token)

### 3. Session Creation Rate Limiter (Very Strict)

- **Window:** 1 hour
- **Max Requests:** 10 per IP
- **Applied to:**
  - `POST /api/walk/start`
- **Purpose:** Prevents session spam and resource exhaustion

### 4. Metrics Endpoint Rate Limiter

- **Window:** 1 minute
- **Max Requests:** 10 per IP
- **Applied to:**
  - `GET /api/metrics`
- **Purpose:** Prevents metrics endpoint abuse

## Rate Limit Headers

All rate-limited endpoints return the following headers:

```
RateLimit-Policy: <max>;w=<window_seconds>
RateLimit-Limit: <max_requests>
RateLimit-Remaining: <remaining_requests>
RateLimit-Reset: <seconds_until_reset>
```

### Example Response Headers

```
RateLimit-Policy: 100;w=900
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 883
```

## Rate Limit Exceeded Response

When a rate limit is exceeded, the API returns:

**Status Code:** `429 Too Many Requests`

**Response Body:**

```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": "15 minutes"
}
```

For AI endpoints specifically:

```json
{
  "error": "Too many AI requests from this IP. Please wait before continuing.",
  "retryAfter": "15 minutes",
  "note": "AI operations are rate-limited to prevent API cost abuse."
}
```

## Testing Rate Limits

### Test General API Limiter

```bash
# Check rate limit headers
curl -i http://localhost:3000/api/protocols | grep RateLimit

# Make multiple requests to see countdown
for i in {1..5}; do
  curl -s -i http://localhost:3000/api/protocols | grep "RateLimit-Remaining"
done
```

### Test AI Endpoint Limiter

```bash
# Test with actual protocol walk start
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "test"}' \
  -i | grep RateLimit
```

## Security Benefits

✅ **Prevents API Cost Explosion**

- AI endpoints limited to 20 requests per 15 minutes per IP
- Session creation limited to 10 per hour per IP
- Protects against accidental or malicious token consumption

✅ **Prevents DoS Attacks**

- General endpoints limited to 100 requests per 15 minutes
- Metrics endpoint limited to 10 per minute
- Server remains responsive under attack

✅ **Resource Protection**

- In-memory session store protected from exhaustion
- Redis connections (if enabled) protected from overload
- Node.js event loop remains unblocked

## Additional Security Measures Implemented

1. **Request Size Limiting:** `express.json({ limit: '1mb' })`
   - Prevents memory exhaustion from large payloads

2. **Multiple Rate Limiters on Critical Endpoints**
   - `/api/walk/start` has BOTH session creation limiter AND AI limiter
   - Provides defense in depth

## Monitoring

Rate limit statistics can be observed in:

- Response headers on every request
- Server logs (when limits are exceeded)
- Future: Consider adding rate limit metrics to `/api/metrics` endpoint

## Configuration via Environment Variables (Optional)

To make rate limits configurable, add to `.env`:

```env
# Optional: Override default rate limits
API_RATE_LIMIT=100
AI_RATE_LIMIT=20
SESSION_RATE_LIMIT=10
METRICS_RATE_LIMIT=10
```

Then update `src/server.ts` to read from environment variables.

## Next Steps for Enhanced Security

1. **Authentication/Authorization** - Add API keys or JWT tokens
2. **IP Whitelisting** - Allow trusted IPs to bypass rate limits
3. **Redis-based Rate Limiting** - Share rate limit state across multiple server instances
4. **Custom Rate Limit Keys** - Rate limit by user ID instead of IP
5. **Sliding Window** - More sophisticated rate limiting algorithm

## Related Security Improvements

See `SECURITY_REVIEW.md` for additional security recommendations including:

- CORS configuration hardening
- Input validation and sanitization
- Error message sanitization
- Security headers (helmet)
