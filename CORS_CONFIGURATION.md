# CORS Configuration

## Overview

CORS (Cross-Origin Resource Sharing) has been properly configured to prevent unauthorized domains
from accessing the API. This protects against CSRF attacks, unauthorized API usage, and data theft.

## Configuration

### Default Allowed Origins (Development)

When `ALLOWED_ORIGINS` environment variable is not set, the following origins are allowed:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
```

### Production Configuration

For production, set the `ALLOWED_ORIGINS` environment variable with a comma-separated list of
authorized domains:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## How It Works

### Origin Validation

The CORS middleware validates every incoming request's `Origin` header:

```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

### Security Features

1. **Origin Whitelist**: Only explicitly allowed origins can access the API
2. **Credentials Support**: Allows cookies and authentication headers from allowed origins
3. **Method Restriction**: Only `GET`, `POST`, and `OPTIONS` methods are allowed
4. **Header Restriction**: Only `Content-Type` and `Authorization` headers are allowed
5. **Logging**: Unauthorized access attempts are logged for monitoring

## Response Headers

Allowed origins receive the following CORS headers:

```
Access-Control-Allow-Origin: <requesting-origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Testing

### Test 1: No Origin (curl, mobile apps)

```bash
curl -i http://localhost:3000/api/protocols
# Expected: 200 OK, no Access-Control-Allow-Origin header
```

### Test 2: Allowed Origin

```bash
curl -i -H "Origin: http://localhost:3000" http://localhost:3000/api/protocols
# Expected: 200 OK, Access-Control-Allow-Origin: http://localhost:3000
```

### Test 3: Unauthorized Origin (Blocked)

```bash
curl -i -H "Origin: https://malicious-site.com" http://localhost:3000/api/protocols
# Expected: 500 Internal Server Error, "Not allowed by CORS"
```

**Server Logs:**

```
🚫 CORS: Blocked request from unauthorized origin: https://malicious-site.com
```

## Security Benefits

### ✅ Prevents CSRF Attacks

- Only allowed origins can make authenticated requests
- Blocks malicious sites from stealing user data
- Protects against cross-site request forgery

### ✅ Controls API Access

- Unauthorized domains cannot consume your API
- Prevents API key theft via XSS on third-party sites
- Protects against bandwidth/cost abuse from external sites

### ✅ Data Protection

- User data only accessible from trusted domains
- Prevents embedding your API in unauthorized applications
- Protects against data scraping from malicious origins

## Common Scenarios

### Scenario 1: Adding a New Production Domain

Add the new domain to the `ALLOWED_ORIGINS` environment variable:

```env
# Before
ALLOWED_ORIGINS=https://yourdomain.com

# After
ALLOWED_ORIGINS=https://yourdomain.com,https://newdomain.com
```

Restart the server for changes to take effect.

### Scenario 2: Development with Custom Port

If running frontend on a custom port (e.g., 5174):

```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174
```

### Scenario 3: Subdomain Support

Add each subdomain explicitly:

```env
ALLOWED_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com,https://admin.yourdomain.com
```

### Scenario 4: Railway/Heroku Deployment

Railway provides a domain like `your-app.railway.app`:

```env
ALLOWED_ORIGINS=https://your-app.railway.app
```

## Error Handling

### When CORS Blocks a Request

**Client receives:**

- Status Code: `500 Internal Server Error`
- Error Message: `Error: Not allowed by CORS`

**Server logs:**

```
🚫 CORS: Blocked request from unauthorized origin: https://unauthorized-domain.com
```

### Common Issues

#### Issue 1: "No 'Access-Control-Allow-Origin' header present"

**Cause:** Frontend is running on a different origin than allowed

**Solution:** Add the frontend origin to `ALLOWED_ORIGINS`

#### Issue 2: "CORS policy blocks credentials"

**Cause:** `credentials: true` requires specific origin (not `*`)

**Solution:** Already handled by our configuration (specific origins only)

#### Issue 3: "Preflight request failed"

**Cause:** Browser sends OPTIONS request before actual request

**Solution:** Already handled by `optionsSuccessStatus: 200`

## Development vs Production

### Development (Default)

```javascript
// No ALLOWED_ORIGINS environment variable
allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
```

- Allows local development
- No configuration required
- Works with most local dev servers

### Production (Configured)

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

- Explicitly allows only production domains
- Blocks all other origins
- Maximum security

## Integration with Other Security Features

CORS works alongside other security measures:

1. **Rate Limiting** - Limits requests per IP, CORS limits requests per origin
2. **Input Validation** - Validates request payload, CORS validates request origin
3. **Authentication** (future) - Validates user identity, CORS validates request source

## Monitoring

Watch server logs for blocked requests:

```bash
# Start server
npm run server

# Monitor logs for CORS blocks
# You'll see: 🚫 CORS: Blocked request from unauthorized origin: <origin>
```

Consider setting up alerts for repeated CORS blocks from the same origin (potential attack).

## Best Practices

### ✅ DO

- Use specific origins, not wildcards
- Set `ALLOWED_ORIGINS` in production
- Log blocked requests for monitoring
- Update allowed origins when deploying new domains
- Test CORS configuration before deploying

### ❌ DON'T

- Never use `origin: '*'` in production
- Don't add untrusted domains to allowed list
- Don't disable CORS "to fix errors" - fix the origin instead
- Don't allow `http://` origins in production (use `https://`)

## Troubleshooting

### Problem: Frontend can't reach API

1. Check frontend is running on an allowed origin
2. Check `ALLOWED_ORIGINS` environment variable
3. Check server logs for CORS blocks
4. Verify origin includes protocol and port (e.g., `http://localhost:3000`, not `localhost:3000`)

### Problem: Works in development, fails in production

1. Verify `ALLOWED_ORIGINS` is set in production environment
2. Ensure production origin matches exactly (including `https://`, `www.`, etc.)
3. Check for trailing slashes in URLs
4. Verify environment variable is loaded (check Railway/Heroku dashboard)

## Related Documentation

- `RATE_LIMITING.md` - API rate limiting configuration
- `INPUT_VALIDATION.md` - Input validation and sanitization
- `SECURITY_REVIEW.md` - Complete security audit findings
- `.env.example` - Environment variable configuration

## Configuration File

Main configuration location: `src/server.ts:400-432`

## Summary

CORS configuration provides essential security without degrading UX:

- ✅ Blocks unauthorized origins
- ✅ Allows legitimate domains
- ✅ Configurable via environment variable
- ✅ Logs suspicious activity
- ✅ Supports development and production
- ✅ Returns clear error messages

**Status:** ✅ Fully implemented and tested
