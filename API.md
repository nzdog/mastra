# Field Diagnostic Protocol - API Documentation

## Server Setup

```bash
npm run server
# Server runs on http://localhost:3000
```

## Endpoints

### `POST /api/walk/start`

Start a new protocol walk.

**Request:**

```json
{
  "user_input": "What field am I in?"
}
```

**Response:**

```json
{
  "session_id": "uuid",
  "protocol_name": "Field Diagnostic Protocol",
  "theme_number": 1,
  "total_themes": 6,
  "mode": "ENTRY" | "WALK",
  "composer_output": "**Field Diagnostic Protocol**\n\n...",
  "supports": [
    {
      "source": "Field Diagnostic Protocol",
      "theme": "Overview",
      "excerpt": "This protocol helps surface the invisible field..."
    }
  ],
  "state": {
    "current_mode": "ENTRY",
    "current_theme": null,
    "last_response_type": "none",
    "turn_count": 1
  }
}
```

### `POST /api/walk/continue`

Continue an existing protocol walk.

**Request:**

```json
{
  "session_id": "uuid",
  "user_response": "yes, walk me through it"
}
```

**Response:**

```json
{
  "session_id": "uuid",
  "protocol_name": "Field Diagnostic Protocol",
  "theme_number": 1,
  "total_themes": 6,
  "mode": "WALK" | "CONTINUE" | "COMPLETE",
  "composer_output": "**Theme 1 – Surface Behaviors**\n\n...",
  "supports": [
    {
      "source": "Field Diagnostic Protocol",
      "theme": "Surface Behaviors",
      "excerpt": "This theme helps you name the visible habits..."
    }
  ],
  "state": {
    "current_mode": "WALK",
    "current_theme": 1,
    "last_response_type": "theme_questions",
    "turn_count": 2
  }
}
```

### `POST /api/walk/complete`

Complete the protocol and optionally generate a field diagnosis summary.

**Request:**

```json
{
  "session_id": "uuid",
  "generate_summary": true
}
```

**Response:**

```json
{
  "completed": true,
  "summary_html": "Based on what you've surfaced, you're in a field I'd call **Velocity Over Depth**..."
}
```

### `GET /api/session/:id`

Get the current state of a session (debugging).

**Response:**

```json
{
  "session_id": "uuid",
  "created_at": "2025-10-04T09:00:00.000Z",
  "last_accessed": "2025-10-04T09:05:00.000Z",
  "state": {
    "active_protocol": "field_diagnostic",
    "mode": "WALK",
    "theme_index": 2,
    "last_response": "interpretation_and_completion",
    "turn_counter": 5
  }
}
```

### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "active_sessions": 3,
  "timestamp": "2025-10-04T09:00:00.000Z"
}
```

## Response Fields

### `mode`

- `ENTRY`: Presenting protocol overview
- `WALK`: Presenting theme questions
- `CONTINUE`: Showing interpretation + completion prompt
- `COMPLETE`: Field diagnosis (final summary)

### `composer_output`

Markdown-formatted text from the agent. Parse this for display.

Common sections:

- `**Theme N – Title**` - Theme heading
- `**Frame:**` - Theme purpose
- `**Guiding Questions:**` - Questions (as bullets)
- `**Completion Prompt:**` - Quote after user shares reflection

### `supports`

Array of protocol excerpts that provide context:

- `source`: Protocol name
- `theme`: Theme title or "Overview"
- `excerpt`: Relevant text from protocol

## Session Management

- **TTL**: 1 hour of inactivity
- **Storage**: In-memory (ephemeral)
- **Cleanup**: Automatic every 10 minutes
- **Auth**: None (MVP)

## Example Flow

```javascript
// 1. Start protocol
const startRes = await fetch('http://localhost:3000/api/walk/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_input: 'What field am I in?' }),
});
const { session_id } = await startRes.json();

// 2. Continue through themes
const continueRes = await fetch('http://localhost:3000/api/walk/continue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id,
    user_response: 'yes, walk me through it',
  }),
});
const walkData = await continueRes.json();

// 3. Complete protocol
const completeRes = await fetch('http://localhost:3000/api/walk/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id,
    generate_summary: true,
  }),
});
const { summary_html } = await completeRes.json();
```

## Error Responses

All errors return:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

Common status codes:

- `400` - Bad request (missing fields)
- `404` - Session not found or expired
- `500` - Internal server error
