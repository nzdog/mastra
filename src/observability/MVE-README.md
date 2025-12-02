# MVE (Minimum Viable Experiment) - Week 1 Observability

**Part of:** Dual-Observation Experiment for Memory Architecture
**Plan:** `~/.claude/plans/parsed-swimming-avalanche.md`
**Safe to remove after:** Memory layer implementation complete

## What This Is

A lightweight observability system that logs three types of events during diagnostic walks:
1. **Classification** - What intent the agent detected
2. **Mode Decision** - Which mode the agent entered (ENTRY/WALK/CLOSE)
3. **Theme Answer** - User's response to theme questions, with spotlight pattern detection

## Files Created

- `src/observability/mve-types.ts` - Event types and Observer interface
- `src/observability/mve-json-sink.ts` - JSONL file writer with buffering
- `scripts/mve-analyze.ts` - Analysis script for JSONL files

## Files Modified

- `src/agent.ts` - Added 3 observation hooks (search for `// MVE:`)
- `.env.example` - Added `OBSERVABILITY_ENABLED` flag
- `package.json` - Added `mve:analyze` script

## Quick Start

### 1. Enable Observability

Create/edit `.env`:
```bash
OBSERVABILITY_ENABLED=true
```

### 2. Initialize Observer in Your Code

```typescript
import { FieldDiagnosticAgent } from './agent';
import { JsonSink } from './observability/mve-json-sink';

const observer = new JsonSink({
  outputDir: './mve-data',
  filename: `session-${Date.now()}.jsonl`,
  bufferSize: 10,
  autoFlushIntervalMs: 5000, // Flush every 5 seconds
});

const agent = new FieldDiagnosticAgent(
  process.env.ANTHROPIC_API_KEY!,
  undefined, // registry
  undefined, // protocolPath
  observer   // observer
);

// Run diagnostic session...

// Cleanup when done
await observer.shutdown();
```

### 3. Run Diagnostic Sessions

Run 3-5 real diagnostic walks with founders. The observer will automatically log events to `./mve-data/`.

### 4. Analyze Results

```bash
# Analyze single session
npm run mve:analyze ./mve-data/session-12345.jsonl

# Analyze all sessions
npm run mve:analyze ./mve-data
```

## Event Schema

### Classification Event
```json
{
  "timestamp": "2025-12-02T10:30:00.000Z",
  "session_id": "abc123",
  "event_type": "classification",
  "classification_label": "walk",
  "confidence": 0.95
}
```

### Mode Decision Event
```json
{
  "timestamp": "2025-12-02T10:30:01.000Z",
  "session_id": "abc123",
  "event_type": "mode_decision",
  "mode": "WALK"
}
```

### Theme Answer Event
```json
{
  "timestamp": "2025-12-02T10:35:00.000Z",
  "session_id": "abc123",
  "event_type": "theme_answer",
  "theme_index": 1,
  "raw_text": "I always feel like I should be doing more...",
  "spotlight_flags": ["always", "should"]
}
```

## Spotlight Patterns

The system detects these field emergence indicators:
- `should` - Obligation language
- `always` - Absolute language
- `dont_know` - Uncertainty markers
- `rushing` - Pace indicators
- `exhausted` - Energy depletion

## Manual Annotation

To tag interesting moments, edit the JSONL file and add an `annotation` field:

```json
{
  "timestamp": "2025-12-02T10:35:00.000Z",
  "session_id": "abc123",
  "event_type": "theme_answer",
  "theme_index": 2,
  "raw_text": "...",
  "spotlight_flags": ["should", "rushing"],
  "annotation": {
    "tags": ["field_emergence", "breakthrough"],
    "note": "Clear urgency field emerging - founder aware of pattern for first time"
  }
}
```

## Week 1 Goal

After 3-5 sessions, answer:
1. **What memory structures are required?**
   - What should memory store about classification patterns?
   - What should memory store about field emergence?
   - When should memory be retrieved?

2. **What can be deferred?**
   - Which patterns are stable vs need more data?
   - Which hooks are essential vs nice-to-have?

## Cleanup

When the experiment is complete:

1. Find all MVE files:
```bash
find . -name "*mve*" -type f
```

2. Find all MVE code:
```bash
grep -r "MVE:" src/
```

3. Delete or archive as needed.

## Success Criteria

✅ 3-5 sessions collected without agent disruption
✅ Manual annotations reveal field emergence patterns
✅ Clear answer to: "What must memory store?"
✅ Clear answer to: "When should memory be retrieved?"

## Next Steps

See `~/.claude/plans/parsed-swimming-avalanche.md` for optional modules:
- Module 1: State Transition Deep Dive
- Module 2: Plan-Execution Delta Analysis
- Module 3: Field Archetype Clustering
- Module 4: Coherence Rhythm Modeling
- Module 7: Acontext Integration (if semantic search needed)
