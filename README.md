# Field Diagnostic Agent

A TypeScript-based conversational agent that walks users through the **Field Diagnostic Protocol**
from the Lichen Protocol system.

## Overview

The Field Diagnostic Protocol helps surface the invisible field currently shaping your behavior,
decisions, and emotional stance. This agent guides you through 6 themes to identify the systemic
pressures and patterns you're living inside—so you can see clearly what is holding you, rather than
mistaking it for personal failure or strength.

## Architecture

### Three Modes

1. **ENTRY Mode**: Provides orientation
   - Presents protocol purpose, why it matters, when to use it, and expected outcomes
   - Ends with an invitation to walk the protocol step by step
   - No theme-level content

2. **WALK Mode**: Steps through themes one at a time
   - Guides through 6 themes with one question per turn
   - Mirrors back user responses with Stone-aligned clarity
   - Tracks completion and advances themes

3. **CLOSE Mode**: Field diagnosis
   - Synthesizes answers across all themes
   - Generates pattern-level field name (e.g., "Velocity Over Depth")
   - Checks alignment with coherence or collapse
   - Offers summary of the walk

### Core Components

- **Intent Classifier** (`src/classifier.ts`): AI-powered intent detection that classifies user
  messages before retrieval
- **Protocol Parser** (`src/protocol/parser.ts`): Parses markdown protocol files with YAML
  frontmatter into structured chunks
- **Retrieval Registry** (`src/tools/registry.ts`): Retrieves appropriate chunks (ENTRY or WALK)
  based on mode
- **Composer** (`src/composer/`): Generates responses using Claude API with mode-specific system
  prompts
- **Agent Orchestrator** (`src/agent.ts`): Main state management and workflow coordination
- **CLI Interface** (`src/index.ts`): Interactive readline-based command-line interface

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Configuration

Create a `.env` file:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Usage

### Run the CLI

```bash
npm run dev
```

### Run the API Server

```bash
npm run server
# Server runs on http://localhost:3000
```

**For frontend integration, see [INTEGRATION.md](./INTEGRATION.md)**

### CLI Commands

- **exit** or **quit**: End the session
- **reset**: Start over from the beginning
- **state**: View current session state (for debugging)
- **help**: Show help information

### Example Conversation Flow

```
> What field am I in?

[Agent provides ENTRY orientation]
Would you like to walk that protocol step by step?

> Yes, walk me through it

[Agent enters WALK mode, Theme 1: Surface Behaviors]
What language am I using most often right now?

> I use language about shipping fast, hitting deadlines...

[Agent mirrors back, then advances]

> continue

[Agent moves to Theme 2: Felt Experience]
...
```

## Testing

Run the test scenarios:

```bash
npm run test
```

The test suite includes:

1. Greeting Test
2. ENTRY Mode Test
3. WALK Transition Test
4. Continuity Test
5. Full Walk Test (all 6 themes → CLOSE)

## Project Structure

```
field-diagnostic-agent/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── API.md                   # API documentation
├── INTEGRATION.md           # Frontend integration guide
├── test-frontend.html       # Simple test interface
├── src/
│   ├── index.ts            # CLI entry point
│   ├── server.ts           # Express API server ✨ NEW
│   ├── agent.ts            # Main orchestrator
│   ├── classifier.ts       # Intent detection
│   ├── validator.ts        # Response validation
│   ├── types.ts            # Shared types
│   ├── protocol/
│   │   ├── parser.ts       # Markdown → chunks
│   │   └── types.ts        # Protocol types
│   ├── tools/
│   │   └── registry.ts     # Retrieval tool
│   └── composer/
│       ├── prompts.ts      # System prompts
│       ├── client.ts       # Claude API integration
│       └── index.ts        # Composer orchestrator
├── protocols/
│   └── field_diagnostic.md # Protocol file
└── test/
    └── scenarios.ts        # Test suite
```

## The Six Themes

1. **Surface Behaviors** - Name visible habits and language patterns
2. **Felt Experience** - Attend to how the body and emotions register the field
3. **Rewards and Punishments** - Identify what the field rewards and punishes
4. **Source Stories** - Uncover narratives and myths the field is built on
5. **Pressure Points** - Examine how the field behaves under stress
6. **Naming the Field** - Gather evidence and explicitly name the field

## Design Principles

### Stone Alignment

The agent voice is shaped by three Lichen Stones:

- **Stone 4: Clarity Over Cleverness** - Simple, not shallow
- **Stone 5: Presence Is Productivity** - Stillness is part of the work
- **Stone 8: Integrity Is the Growth Strategy** - Grow through alignment

### Critical Requirements

1. **Never mix ENTRY and WALK chunks** in one retrieval
2. **One question per turn** in WALK mode
3. **Deterministic mode transitions** after classifier
4. **Pattern-level field naming** (not "The [X] Field" format)
5. **Stone-aligned voice** throughout
6. **In-memory state only** (no persistence)
7. **Fallback to ENTRY** on ambiguity

## State Management

Session state is tracked in-memory:

```typescript
interface SessionState {
  active_protocol: string | null;
  mode: 'ENTRY' | 'WALK' | 'CLOSE';
  theme_index: number | null;
  last_completion_confirmed: boolean;
  resume_hint: 'awaiting_theme_completion' | 'ready_to_advance' | 'none';
  last_answer_summary: string;
  last_chunk_refs: string[];
}

Invariant — Memory enriches but never controls.
  turn_counter: number;
  emotion_last?: string;
  field_diagnosed?: string;
  updated_at: string;
}
```

## Intent Classification

Before retrieval, user messages are classified into intents:

- **discover**: Wants orientation (e.g., "What field am I in?")
- **walk**: Begin/continue stepping through (e.g., "Walk me through it")
- **memory**: Continue from prior context (e.g., "continue", "next")
- **none**: Greeting/off-topic (e.g., "Hello")

Fallback rules ensure safe defaults when confidence is low.

## Field Diagnosis Examples

The CLOSE mode generates pattern-level field names by abstracting user language:

- "ship or die" → **Velocity Over Depth**
- "always on" → **Constant Availability**
- "prove daily" → **Continuous Proving**
- "care invisible" → **Invisible Labor**
- "everything urgent" → **Manufactured Urgency**

## License

ISC

## Contributing

This is an experimental protocol agent. Feedback and improvements welcome.
