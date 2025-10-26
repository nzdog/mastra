# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Generate Production API Keys

```bash
# Generate 2-3 secure production keys
openssl rand -hex 32  # Key 1 (primary - for frontend)
openssl rand -hex 32  # Key 2 (backup or mobile)
openssl rand -hex 32  # Key 3 (optional - for partners)
```

**IMPORTANT:**

- Use DIFFERENT keys for production than development
- Store keys securely (password manager, secrets vault)
- Never commit production keys to git

### 2. Configure Environment Variables

Set these in your deployment platform:

#### Required Variables

```env
# Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-api03-...

# Production API keys (comma-separated)
API_KEYS=prod_key_1,prod_key_2,prod_key_3

# Enable production mode
NODE_ENV=production

# Your production domain(s)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

#### Optional Variables

```env
# If using Redis for session persistence
REDIS_URL=redis://your-redis-url

# Custom port (usually not needed)
PORT=3000
```

### 3. Platform-Specific Setup

#### Railway

1. Go to your project dashboard
2. Click **"Variables"** tab
3. Add each environment variable
4. Click **"Deploy"**

Railway will automatically:

- Deploy your code
- Load environment variables
- Provide a public URL

#### Heroku

```bash
# Set environment variables
heroku config:set ANTHROPIC_API_KEY=your_key
heroku config:set API_KEYS=key1,key2
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com

# Deploy
git push heroku main
```

#### Vercel

```bash
# Add environment variables in dashboard or CLI
vercel env add ANTHROPIC_API_KEY production
vercel env add API_KEYS production
vercel env add NODE_ENV production
vercel env add ALLOWED_ORIGINS production

# Deploy
vercel --prod
```

#### DigitalOcean App Platform

1. Go to your app settings
2. Navigate to **"Environment Variables"**
3. Add each variable
4. Click **"Save"**

### 4. Update Your Frontend

#### Frontend Environment Variables

Create `.env.production`:

```env
VITE_API_URL=https://your-api-domain.railway.app
VITE_API_KEY=your_production_key_1
```

#### Frontend API Calls

Update all API calls to include the key:

```javascript
// Example: src/api/client.js
const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

export async function startWalk(userInput) {
  const response = await fetch(`${API_URL}/api/walk/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ user_input: userInput }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function continueWalk(sessionId, userResponse) {
  const response = await fetch(`${API_URL}/api/walk/continue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      session_id: sessionId,
      user_response: userResponse,
    }),
  });

  return response.json();
}
```

### 5. Verify Deployment

After deploying, test your API:

```bash
# Test without API key (should fail)
curl https://your-api-domain.railway.app/api/protocols
# Expected: {"error":"Authentication required",...}

# Test with API key (should succeed)
curl -H "X-API-Key: your_production_key_1" \
  https://your-api-domain.railway.app/api/protocols
# Expected: {"protocols":[...]}

# Test health endpoint (should work without key)
curl https://your-api-domain.railway.app/health
# Expected: {"status":"ok",...}
```

### 6. Security Verification

Check that security features are enabled:

```bash
# 1. Check security headers
curl -I https://your-api-domain.railway.app/health

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# 2. Verify authentication
curl -I https://your-api-domain.railway.app/api/protocols
# Should return: 401 Unauthorized

# 3. Verify CORS
curl -H "Origin: https://malicious.com" \
  -H "X-API-Key: your_key" \
  https://your-api-domain.railway.app/api/protocols
# Should fail with CORS error

# 4. Verify no-origin blocking (production only)
curl -H "X-API-Key: your_key" \
  https://your-api-domain.railway.app/api/protocols
# Should fail in production with "Requests without origin are not allowed"
```

## Production Security Checklist

- [ ] Different API keys for production vs development
- [ ] `NODE_ENV=production` set
- [ ] `ALLOWED_ORIGINS` configured with your domain
- [ ] API keys stored securely (not in code)
- [ ] Frontend configured to use production API key
- [ ] HTTPS enabled (automatic with Railway/Heroku/Vercel)
- [ ] Tested authentication (requests fail without key)
- [ ] Tested CORS (unauthorized origins blocked)
- [ ] Verified security headers present
- [ ] Monitored first few requests for errors

## API Key Management

### Distribution

**Who gets which key:**

- **Key 1:** Your primary frontend application
- **Key 2:** Mobile app or alternative client
- **Key 3:** Partner integrations or backup

### Rotation

To rotate a key:

1. Generate new key: `openssl rand -hex 32`
2. Add new key to production `API_KEYS` (don't remove old yet)
3. Update clients to use new key
4. Wait 24-48 hours for rollout
5. Remove old key from `API_KEYS`

### Revocation

To revoke a compromised key immediately:

1. Remove the key from `API_KEYS` environment variable
2. Redeploy (Railway auto-deploys on env change)
3. Update affected clients with new key

## Monitoring

### Watch for Authentication Failures

Check your logs for:

- Failed authentication attempts
- Repeated 401 errors from same IP
- Invalid API key patterns

### Security Events to Monitor

The server logs these security events:

- `auth_failure` - Invalid API key attempts
- `rate_limit_exceeded` - Too many requests
- `cors_violation` - Unauthorized origins
- `prompt_injection_detected` - Suspicious inputs
- `session_fingerprint_mismatch` - Possible session hijacking

### Set Up Alerts

Configure alerts in your platform:

**Railway:**

- Enable log streaming
- Use external log aggregation (Datadog, Logtail)

**Heroku:**

- `heroku logs --tail` for live logs
- Use Heroku logging add-ons

**Vercel:**

- Built-in logging in dashboard
- Integrate with log monitoring services

## Troubleshooting

### "Authentication required" in production

**Cause:** API key not included in request

**Fix:**

```javascript
// Make sure X-API-Key header is set
headers: {
  'X-API-Key': import.meta.env.VITE_API_KEY
}
```

### "Invalid API key" error

**Cause:** Key doesn't match production `API_KEYS`

**Fix:**

1. Check environment variable is set correctly
2. Verify no typos in key
3. Ensure production key is used (not dev key)

### CORS errors in production

**Cause:** Frontend domain not in `ALLOWED_ORIGINS`

**Fix:**

```env
# Add your frontend domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### "No origin" errors

**Cause:** `NODE_ENV=production` blocks requests without origin

**Fix:**

- Browsers automatically send origin (no fix needed)
- For curl testing, add: `-H "Origin: https://yourdomain.com"`
- For server-to-server, add your server domain to `ALLOWED_ORIGINS`

## Rollback Plan

If deployment has issues:

1. **Railway:** Click "Rollback" to previous deployment
2. **Heroku:** `heroku rollback` or redeploy previous version
3. **Vercel:** Revert to previous deployment in dashboard

## Support

For issues:

1. Check server logs in your platform dashboard
2. Review `IMPLEMENTATION_COMPLETE.md` for full feature list
3. See `AUTHENTICATION.md` for API key details
4. See `TESTING.md` for test scenarios

## Quick Reference

### Production Environment Variables

```env
ANTHROPIC_API_KEY=<your-anthropic-key>
API_KEYS=<key1>,<key2>,<key3>
NODE_ENV=production
ALLOWED_ORIGINS=<your-domains>
```

### Test Commands

```bash
# Health check (no auth)
curl https://your-domain/health

# API call (with auth)
curl -H "X-API-Key: key" https://your-domain/api/protocols

# Check security headers
curl -I https://your-domain/health | grep -E "(X-Frame|X-Content|Strict)"
```

### Frontend Setup

```javascript
// API client with authentication
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': import.meta.env.VITE_API_KEY,
};
```

---

**Ready to deploy!** 🚀

Follow this guide step-by-step and your production deployment will be secure and working.
