# API Key Authentication

This server implements API key authentication to protect endpoints from unauthorized access.

## Overview

All API endpoints (except `/health`) require a valid API key to be provided in the `X-API-Key`
header.

## Configuration

### Setting Up API Keys

1. Generate secure API keys using a cryptographically secure method:

   ```bash
   # Generate a random 32-byte hex key
   openssl rand -hex 32
   ```

2. Add your API keys to the `.env` file (comma-separated):

   ```env
   API_KEYS=abc123def456ghi789jkl012,xyz789mno345pqr678stu901
   ```

3. Distribute API keys securely to authorized clients

### Environment Variables

- `API_KEYS` (required): Comma-separated list of valid API keys

## Usage

### Making Authenticated Requests

Include the API key in the `X-API-Key` header:

```bash
# Example: Start protocol walk
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{"user_input": "What field am I in?"}'
```

### JavaScript/TypeScript Example

```typescript
const response = await fetch('http://localhost:3000/api/walk/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here',
  },
  body: JSON.stringify({
    user_input: 'What field am I in?',
  }),
});
```

## Protected Endpoints

The following endpoints require authentication:

- `POST /api/walk/start` - Start new protocol walk
- `POST /api/walk/continue` - Continue protocol walk
- `POST /api/walk/complete` - Complete protocol
- `GET /api/protocols` - List available protocols

## Unprotected Endpoints

The following endpoints do NOT require authentication:

- `GET /health` - Health check endpoint (public for monitoring)
- `GET /` - Frontend application
- `GET /test` - Test interface
- Static assets (logos, etc.)

## Error Responses

### Missing API Key

```json
{
  "error": "Authentication required",
  "message": "Please provide an API key in the X-API-Key header",
  "code": "MISSING_API_KEY"
}
```

**Status Code:** 401 Unauthorized

### Invalid API Key

```json
{
  "error": "Invalid API key",
  "message": "The provided API key is not valid",
  "code": "INVALID_API_KEY"
}
```

**Status Code:** 401 Unauthorized

## Security Considerations

### Best Practices

1. **Use Strong Keys**: Generate API keys with at least 32 bytes of entropy
2. **Keep Keys Secret**: Never commit API keys to version control
3. **Use HTTPS**: Always use HTTPS in production to prevent key interception
4. **Rotate Keys**: Regularly rotate API keys (e.g., every 90 days)
5. **Monitor Usage**: Review security logs for failed authentication attempts
6. **Limit Distribution**: Only share API keys with authorized clients

### Key Storage

- Store API keys in environment variables, not in code
- Use secret management services in production (AWS Secrets Manager, HashiCorp Vault, etc.)
- Never log full API keys (the system logs only the first 8 characters)

### Monitoring

Failed authentication attempts are logged with:

- IP address of the requester
- Timestamp
- First 8 characters of the invalid key
- Security event type: `auth_failure`

Example log entry:

```json
{
  "timestamp": "2025-10-14T12:00:00.000Z",
  "level": "security",
  "event": "auth_failure",
  "details": {
    "reason": "Invalid API key",
    "apiKey": "abc12345..."
  },
  "ip": "192.168.1.100"
}
```

## Implementation Details

The authentication is implemented in `src/auth.ts`:

- **Middleware**: `authenticateApiKey` - Validates API keys
- **Configuration**: API keys loaded from `API_KEYS` environment variable
- **Logging**: Failed attempts logged with partial key and IP address
- **Performance**: API keys stored in memory for fast validation

## Migration Guide

If you have existing clients using the API without authentication:

1. **Generate API keys** for each client
2. **Update clients** to include the `X-API-Key` header
3. **Deploy updated server** with `API_KEYS` configured
4. **Monitor logs** for authentication failures
5. **Assist clients** with any integration issues

## FAQ

**Q: Can I use multiple API keys?** A: Yes, provide multiple comma-separated keys in the `API_KEYS`
environment variable.

**Q: How do I revoke an API key?** A: Remove the key from the `API_KEYS` environment variable and
restart the server.

**Q: Are API keys case-sensitive?** A: Yes, API keys are case-sensitive and must match exactly.

**Q: Can I use API keys with query parameters instead of headers?** A: No, API keys must be provided
in the `X-API-Key` header for security reasons. Query parameters are logged in server access logs
and browser history.

**Q: What happens if `API_KEYS` is not configured?** A: The server will log a warning on startup,
and all authenticated requests will fail with 401.

## Additional Security Features

This authentication layer works in conjunction with other security features:

- **Rate Limiting**: Prevents brute-force attacks on API keys
- **CORS**: Restricts which origins can make requests
- **Input Validation**: Prevents injection attacks
- **Session Fingerprinting**: Detects session hijacking
- **Structured Logging**: Tracks security events for auditing
