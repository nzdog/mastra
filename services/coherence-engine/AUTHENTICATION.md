# Authentication & Authorization

## Current State

⚠️ **WARNING**: The Coherence Engine API currently has **NO authentication**. All endpoints are publicly accessible.

## Production Requirements

Before deploying to production, you **MUST** implement authentication. Here are recommended approaches:

### Option 1: API Key Authentication (Simplest)

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// Apply to routes
app.post('/coherence/*', apiKeyAuth, handler);
```

**Environment Variables:**

- `API_KEY`: Secret API key for authentication

### Option 2: JWT Token Authentication (Recommended)

```typescript
// middleware/jwt-auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

**Dependencies:**

```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

**Environment Variables:**

- `JWT_SECRET`: Secret key for signing/verifying tokens

### Option 3: OAuth 2.0 / OpenID Connect (Enterprise)

For enterprise deployments, consider integrating with:

- Auth0
- AWS Cognito
- Okta
- Azure AD

## Security Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Rate Limiting**: Already configured (100 requests per 15 minutes)
3. **CORS**: Configure allowed origins via `CORS_ORIGIN` environment variable
4. **API Keys**: Store in environment variables, never commit to code
5. **Token Rotation**: Implement token refresh mechanisms for JWT
6. **Audit Logging**: Log all authentication attempts

## Implementation Checklist

- [ ] Choose authentication method
- [ ] Install required dependencies
- [ ] Create authentication middleware
- [ ] Apply middleware to protected routes
- [ ] Set up environment variables
- [ ] Update documentation for API consumers
- [ ] Test authentication flow
- [ ] Configure HTTPS certificates
- [ ] Set up monitoring and alerts

## Example Usage

### With API Key

```bash
curl -X POST http://localhost:3000/coherence/evaluate \
  -H "x-api-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"founder_state": {...}}'
```

### With JWT

```bash
curl -X POST http://localhost:3000/coherence/evaluate \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"founder_state": {...}}'
```

## Excluded Endpoints

Consider leaving these endpoints **without** authentication for health checks:

- `GET /health` - Required for load balancer health checks

## Further Reading

- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
