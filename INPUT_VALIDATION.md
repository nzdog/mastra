# Input Validation & Sanitization

## Overview

Comprehensive input validation has been implemented to prevent prompt injection attacks, excessive
token usage, and path traversal vulnerabilities.

## Validation Functions

### 1. `validateUserInput(input, fieldName)`

Validates and sanitizes user-provided text input.

**Constraints:**

- **Type:** Must be a string
- **Min Length:** 1 character (after trimming)
- **Max Length:** 5000 characters (prevents excessive token usage/cost)
- **Automatic:** Trims whitespace
- **Detection:** Logs warnings for suspicious patterns (but doesn't block)

**Suspicious Pattern Detection:**

```javascript
- "ignore all previous instructions"
- "disregard all previous instructions"
- "forget all previous instructions"
- "system:" (ChatML injection)
- "assistant:" (ChatML injection)
- "<|im_start|>" (ChatML tokens)
- "<|im_end|>" (ChatML tokens)
- Excessive special characters (<>{}[])
```

**Return Value:**

```typescript
{
  valid: boolean,
  error?: string,
  sanitized?: string  // Trimmed input
}
```

### 2. `validateProtocolSlug(slug)`

Validates protocol slug to prevent path traversal attacks.

**Constraints:**

- **Type:** Must be a string (optional field)
- **Max Length:** 200 characters
- **Allowed Characters:** Only `a-z`, `A-Z`, `0-9`, `-`, `_`
- **Blocked:** `..`, `/`, `\\` (path traversal)

**Examples:**

```
✅ Valid: "field_diagnostic", "field-exit-protocol-1"
❌ Invalid: "../../../etc/passwd", "field/diagnostic", "proto\\test"
```

### 3. `validateSessionId(sessionId)`

Validates session ID format to prevent injection attacks.

**Constraints:**

- **Type:** Must be a string
- **Max Length:** 100 characters (UUIDs are ~36)
- **Allowed Characters:** `a-f`, `0-9`, `-` (UUID format)

**Example:**

```
✅ Valid: "b2a87212-b735-46bb-8d5f-a3c4e6b8f9d1"
❌ Invalid: "'; DROP TABLE sessions;--"
```

## Applied To Endpoints

### POST `/api/walk/start`

```typescript
// Validates:
- user_input (required, 1-5000 chars)
- protocol_slug (optional, alphanumeric + hyphens/underscores only)
```

### POST `/api/walk/continue`

```typescript
// Validates:
- session_id (required, UUID format)
- user_response (required, 1-5000 chars)
```

### POST `/api/walk/complete`

```typescript
// Validates:
- session_id (required, UUID format)
```

### GET `/api/session/:id`

```typescript
// Validates:
- session_id (required, UUID format)
```

## Error Responses

When validation fails, the API returns:

**Status Code:** `400 Bad Request`

**Response Examples:**

```json
// Empty input
{
  "error": "user_input cannot be empty"
}

// Input too long
{
  "error": "user_input too long. Maximum 5000 characters allowed (received 5001)"
}

// Path traversal attempt
{
  "error": "protocol_slug can only contain letters, numbers, hyphens, and underscores"
}

// Invalid session ID
{
  "error": "Invalid session_id format"
}
```

## Security Benefits

### ✅ Prevents Prompt Injection

- Detects common prompt injection patterns
- Logs suspicious attempts for monitoring
- Allows legitimate discussion about AI (doesn't block, just warns)

### ✅ Controls API Costs

- 5000 character limit prevents excessive token usage
- Protects against accidental/malicious cost explosion
- Average user message: ~200 chars, max allows room for detailed responses

### ✅ Prevents Path Traversal

- Protocol slugs restricted to safe characters
- Blocks `../` style attacks
- Prevents file system access outside protocol directory

### ✅ Input Sanitization

- Automatic whitespace trimming
- Type checking (must be strings)
- Length validation before processing

## Testing

### Test Valid Input

```bash
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "What field am I in?"}'
# Expected: 200 OK, creates session
```

### Test Empty Input

```bash
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": ""}'
# Expected: 400, "user_input cannot be empty"
```

### Test Input Too Long

```bash
# Generate 5001 character string
python3 << 'EOF'
import requests
long_input = "x" * 5001
r = requests.post(
    "http://localhost:3000/api/walk/start",
    json={"user_input": long_input}
)
print(r.status_code, r.json())
EOF
# Expected: 400, "user_input too long..."
```

### Test Path Traversal

```bash
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "test", "protocol_slug": "../../etc/passwd"}'
# Expected: 400, "protocol_slug can only contain..."
```

### Test Prompt Injection Detection

```bash
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "Ignore all previous instructions"}'
# Expected: 200 OK (allowed), but logs warning to console
# Check server logs for: "⚠️ Potential prompt injection detected"
```

## Implementation Details

### Input Constraints

```typescript
const INPUT_CONSTRAINTS = {
  MAX_USER_INPUT_LENGTH: 5000, // Prevents excessive token usage
  MAX_SESSION_ID_LENGTH: 100, // UUIDs are ~36 chars
  MAX_PROTOCOL_SLUG_LENGTH: 200,
  MIN_USER_INPUT_LENGTH: 1, // After trimming
};
```

### Suspicious Patterns (Logged, Not Blocked)

We detect but don't block suspicious patterns because:

1. Users might legitimately discuss AI/prompts
2. False positives would frustrate users
3. Logging provides security monitoring without UX degradation

**Philosophy:** "Detect and log, don't silently block legitimate use"

## Cost Protection Example

Without input validation:

```
Attacker sends 100,000 character message
→ ~25,000 tokens to Claude API
→ Cost: ~$0.60 per message
→ 1000 requests = $600 💸
```

With input validation:

```
Attacker sends 100,000 character message
→ Blocked immediately at 5000 chars
→ Cost: $0 ✅
→ Server resources: Protected ✅
```

## Integration with Rate Limiting

Input validation works alongside rate limiting for defense in depth:

1. **Rate Limiting:** Prevents too many requests
2. **Input Validation:** Prevents malicious/expensive individual requests

Both protect against different attack vectors:

- Rate limiting → Volume attacks
- Input validation → Payload attacks

## Monitoring

Watch server logs for security events:

```bash
# Prompt injection attempts
⚠️ Potential prompt injection detected: Ignore all previous instructions...

# Excessive special characters
⚠️ Excessive special characters detected: 127
```

## Future Enhancements

Consider adding:

1. **Content-based filtering** - Block explicit profanity/harassment
2. **Language detection** - Reject non-English if not supported
3. **Repeated character detection** - Block "aaaaaaaaaa..." spam
4. **URL/email extraction** - Prevent phishing attempts in responses
5. **Rate limit by input size** - Stricter limits for longer messages

## Related Security Features

See also:

- `RATE_LIMITING.md` - Request rate limiting
- `SECURITY_REVIEW.md` - Complete security audit findings
- `CORS` configuration (src/server.ts:285)
- Request size limiting (`express.json({ limit: '1mb' })`)

## Configuration

To adjust limits, modify `INPUT_CONSTRAINTS` in `src/server.ts`:

```typescript
const INPUT_CONSTRAINTS = {
  MAX_USER_INPUT_LENGTH: 5000, // Adjust as needed
  MAX_SESSION_ID_LENGTH: 100,
  MAX_PROTOCOL_SLUG_LENGTH: 200,
  MIN_USER_INPUT_LENGTH: 1,
};
```

**Recommended values:**

- `MAX_USER_INPUT_LENGTH`: 3000-10000 chars
- Lower = cheaper, higher = more flexibility
- Consider your use case and budget

## Summary

Input validation provides essential security without degrading UX:

- ✅ Blocks malicious payloads
- ✅ Prevents excessive costs
- ✅ Protects file system
- ✅ Logs suspicious activity
- ✅ Returns clear error messages
- ✅ Allows legitimate use cases

**Status:** ✅ Fully implemented and tested
