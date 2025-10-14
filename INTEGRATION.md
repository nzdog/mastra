# Frontend Integration Guide

## ✅ Backend API Ready

The Field Diagnostic Protocol agent is now wrapped with a REST API that your frontend can connect
to.

## Quick Start

### 1. Start the Backend

```bash
npm run server
```

Server runs on `http://localhost:3000`

### 2. Test with Simple HTML

Open `test-frontend.html` in your browser to test the full integration:

```bash
open test-frontend.html
```

This demonstrates:

- Starting a protocol session
- Continuing through themes
- Displaying composer output
- Showing protocol supports
- Session state management

### 3. Connect Your Frontend

Your frontend can now call the API endpoints documented in `API.md`.

## What's Included

### ✅ Gap 1: Supports Data (COMPLETE)

Backend now returns `supports` array with protocol excerpts:

```json
{
  "supports": [
    {
      "source": "Field Diagnostic Protocol",
      "theme": "Surface Behaviors",
      "excerpt": "This theme helps you name the visible habits..."
    }
  ]
}
```

**Implementation:**

- `extractSupports()` function in `src/server.ts:100`
- Extracts theme purpose and "why this matters" as supports
- Provides protocol overview in ENTRY mode
- Real protocol content, not dummy data

### ⚠️ Gap 2: Summary Generation (NEEDS FRONTEND)

Backend provides field diagnosis via `/api/walk/complete`:

```javascript
POST /api/walk/complete
{
  "session_id": "uuid",
  "generate_summary": true
}

// Returns:
{
  "completed": true,
  "summary_html": "Based on what you've surfaced, you're in a field..."
}
```

**What's needed:**

- Frontend modal/view to display `summary_html`
- Triggered when mode === 'COMPLETE'
- Markdown rendering of the field diagnosis

### ✅ Gap 3: CORS (COMPLETE)

CORS is enabled for all origins (development):

```typescript
app.use(cors());
```

For production, configure specific origins:

```typescript
app.use(
  cors({
    origin: 'https://your-frontend-domain.com',
  })
);
```

## API Response Structure

Every `/start` and `/continue` response includes:

```json
{
  "session_id": "uuid",
  "protocol_name": "Field Diagnostic Protocol",
  "theme_number": 1,
  "total_themes": 6,
  "mode": "ENTRY" | "WALK" | "CONTINUE" | "COMPLETE",
  "composer_output": "**Theme 1 – Surface Behaviors**\n\n...",
  "supports": [...],
  "state": {
    "current_mode": "WALK",
    "current_theme": 1,
    "last_response_type": "theme_questions",
    "turn_count": 3
  }
}
```

## Parsing Composer Output

The `composer_output` field contains markdown. Parse it for your UI:

```javascript
function parseComposerOutput(markdown) {
  const sections = {};

  // Extract theme title
  const titleMatch = markdown.match(/\*\*Theme (\d+) – (.+?)\*\*/);
  if (titleMatch) {
    sections.themeNumber = parseInt(titleMatch[1]);
    sections.themeTitle = titleMatch[2];
  }

  // Extract frame
  const frameMatch = markdown.match(/\*\*Frame:\*\* (.+)/);
  if (frameMatch) {
    sections.frame = frameMatch[1];
  }

  // Extract guiding questions
  const questionsSection = markdown.match(/\*\*Guiding Questions:\*\*\n([\s\S]+?)(?=\n\n|$)/);
  if (questionsSection) {
    sections.questions = questionsSection[1]
      .split('\n')
      .filter((line) => line.startsWith('•'))
      .map((line) => line.replace('• ', '').trim());
  }

  // Extract completion prompt
  const completionMatch = markdown.match(/\*\*Completion Prompt:\*\*\n"(.+?)"/);
  if (completionMatch) {
    sections.completionPrompt = completionMatch[1];
  }

  return sections;
}
```

## Session Management

- **In-memory storage** (sessions cleared on server restart)
- **1-hour TTL** (sessions expire after 1 hour of inactivity)
- **Auto-cleanup** every 10 minutes
- **No auth required** (add JWT/session cookies for production)

## Error Handling

All errors return:

```json
{
  "error": "Session not found or expired",
  "message": "Detailed error message"
}
```

Handle in frontend:

```javascript
if (!response.ok) {
  const error = await response.json();
  console.error(error.error, error.message);
  // Show error to user
}
```

## Production Checklist

Before deploying:

1. ✅ Add authentication (JWT or session cookies)
2. ✅ Configure CORS for specific origins
3. ✅ Add rate limiting
4. ✅ Use persistent session storage (Redis/database)
5. ✅ Add request logging
6. ✅ Set up monitoring
7. ✅ Use environment variables for configuration
8. ✅ Enable HTTPS

## Files Reference

- **`src/server.ts`** - Express API wrapper
- **`API.md`** - Complete API documentation
- **`test-frontend.html`** - Simple test interface
- **`package.json`** - Added `"server": "tsx src/server.ts"` script

## Next Steps

1. **Test the integration**
   - Run `npm run server`
   - Open `test-frontend.html`
   - Walk through a complete protocol

2. **Wire up your actual frontend**
   - Use the API endpoints from `API.md`
   - Parse `composer_output` for your UI
   - Display `supports` in your supports strip
   - Handle session state

3. **Add summary modal**
   - Detect when `mode === 'COMPLETE'`
   - Call `/api/walk/complete` with `generate_summary: true`
   - Display `summary_html` in a modal or dedicated view

**The field is wired. The breath flows through.**
