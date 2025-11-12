# AI Developer Onboarding Guide

## Project Overview

**Field Diagnostic Agent** is a TypeScript-based conversational AI system built on the **Lichen Protocol**. It guides users through structured diagnostic conversations to help them understand the invisible systemic fields shaping their behavior and decisions.

The project combines:
- **Conversational AI Agent**: Multi-mode dialogue system powered by Anthropic's Claude
- **Memory Layer**: Cryptographically audited memory system with privacy guarantees
- **Web Frontend**: Polished SPA interface with intro flows and conversation UI
- **Production-Ready API**: Express server with security, rate limiting, and observability

---

## Core Concept: The Field Diagnostic Protocol

The agent walks users through **6 themes** to surface the "field" they're operating within:

1. **Surface Behaviors** - Language patterns and visible habits
2. **Felt Experience** - Somatic and emotional registration
3. **Rewards and Punishments** - What the field incentivizes
4. **Source Stories** - Underlying narratives and myths
5. **Pressure Points** - Behavior under stress
6. **Naming the Field** - Pattern synthesis (e.g., "Velocity Over Depth")

The agent operates in **3 modes**:
- **ENTRY**: Orientation and context-setting
- **WALK**: Step-by-step theme exploration (one question per turn)
- **CLOSE**: Field synthesis and diagnosis

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (SPA)                          │
│  index.html + assets/js/* + assets/css/*                    │
│  - Intro flow with animated logo                            │
│  - Conversational UI with cost tracking                     │
│  - Session management and state display                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/JSON
┌────────────────────▼────────────────────────────────────────┐
│                   Express API Server                         │
│  src/server.ts + src/server/routes/*                        │
│  - Security (Helmet, CORS, rate limiting)                   │
│  - Session lifecycle management                             │
│  - Protocol conversation endpoints                          │
│  - Memory Layer API router                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
┌───────▼─────────┐      ┌─────────▼──────────┐
│  Agent Core     │      │   Memory Layer     │
│  src/agent.ts   │      │ src/memory-layer/* │
│                 │      │                    │
│ - Classifier    │      │ - Storage API      │
│ - Composer      │      │ - Audit System     │
│ - Registry      │      │ - Consent Engine   │
│ - Validator     │      │ - Crypto Signing   │
└─────────────────┘      └────────────────────┘
```

---

## Key Components

### 1. Agent Core (`src/agent.ts`)

**Purpose**: Main orchestrator for the conversational flow

**Key Responsibilities**:
- Maintain session state (mode, theme_index, conversation history)
- Process user messages through classification → retrieval → composition
- Track theme progression and completion
- Manage conversation history compression (keep context under limits)
- Cache ENTRY mode responses for performance
- Cost tracking across API calls

**Key Methods**:
- `processMessage(userMessage: string)`: Main entry point
- `determineModeTransition()`: State machine for mode transitions
- `compressConversationHistory()`: Prune old turns to manage token count

### 2. Intent Classifier (`src/classifier.ts`)

**Purpose**: AI-powered intent detection before retrieval

**Classification Intents**:
- `discover`: User wants orientation ("What field am I in?")
- `walk`: User wants to begin/continue stepping through protocol
- `memory`: User is continuing from prior context ("continue", "next")
- `none`: Greetings or off-topic

**How it Works**:
- Uses Claude API with structured prompt
- Falls back safely on low confidence
- Influences mode transitions and chunk retrieval

### 3. Protocol Parser (`src/protocol/parser.ts`)

**Purpose**: Parse markdown protocol files into structured chunks

**Input**: `protocols/field_diagnostic.md` with YAML frontmatter
**Output**: Array of `ProtocolChunk` objects with metadata:
- `chunkId`: Unique identifier
- `section`: Theme number or "ENTRY"
- `tags`: ["ENTRY"] or ["WALK", "Theme 1"], etc.
- `content`: Actual text content

### 4. Registry (`src/tools/registry.ts`)

**Purpose**: Retrieval system for protocol content

**Key Methods**:
- `getEntryChunks()`: All ENTRY-tagged chunks
- `getWalkChunksForTheme(themeNumber)`: Theme-specific WALK chunks
- `getAllChunks()`: Everything for CLOSE mode

**Critical Rule**: Never mix ENTRY and WALK chunks in one retrieval

### 5. Composer (`src/composer/index.ts`)

**Purpose**: Generate AI responses using Claude API

**Flow**:
1. Build system prompt based on mode (ENTRY/WALK/CLOSE)
2. Include retrieved protocol chunks as context
3. Add conversation history for continuity
4. Send to Claude API
5. Validate response (in WALK mode)
6. Return response + cost

**Validation** (`src/validator.ts`):
- Ensures WALK responses end with exactly one question
- Checks for theme advancement signals
- Validates mirroring of user's answer

### 6. Memory Layer (`src/memory-layer/`)

**Purpose**: Privacy-preserving, cryptographically audited memory system

**Architecture**:
```
API Layer (operations.ts, memory-router.ts)
    │
    ├─ Middleware (consent, schema validation, error handling)
    │
    ├─ Storage (in-memory, PostgreSQL, dual-store)
    │
    └─ Governance (crypto signatures, Merkle tree, audit ledger)
```

**Core Operations**:
- `POST /api/memory/store`: Store memory with consent
- `POST /api/memory/recall`: Retrieve memories
- `POST /api/memory/distill`: Aggregate across users (k-anonymity enforced)
- `DELETE /api/memory/forget`: Hard delete with audit trail
- `POST /api/memory/export`: Export user data

**Key Features**:
- Ed25519 cryptographic signatures for all operations
- Merkle tree ledger for tamper-evident audit trail
- JWKS endpoint for public key distribution
- Consent resolver middleware (fail-closed)
- K-anonymity enforcement (k ≥ 5 for aggregations)
- Differential privacy infrastructure (Phase 3)

**Invariant**: "Memory enriches but never controls"

---

## Technology Stack

**Runtime**:
- Node.js ≥ 20.0.0
- TypeScript 5.9.3
- CommonJS module system

**Core Dependencies**:
- `@anthropic-ai/sdk`: Claude API client
- `@mastra/core`: Mastra framework integration
- `express`: HTTP server
- `pg`: PostgreSQL client
- `argon2`: Password hashing
- `jose`: JWT/JWK cryptography
- `ajv`: JSON schema validation

**Security & Observability**:
- `helmet`: Security headers
- `cors`: CORS configuration
- `express-rate-limit`: Rate limiting
- `prom-client`: Prometheus metrics

**Development**:
- `tsx`: TypeScript execution
- `vitest`: Testing framework
- `eslint`: Linting
- `prettier`: Code formatting
- `husky`: Git hooks

---

## Project Structure

```
field-diagnostic-agent/
├── src/
│   ├── agent.ts                    # Main agent orchestrator
│   ├── classifier.ts               # Intent classification
│   ├── composer/                   # Response generation
│   │   ├── index.ts               # Composer orchestrator
│   │   ├── client.ts              # Claude API client
│   │   └── prompts.ts             # System prompts per mode
│   ├── protocol/                   # Protocol parsing
│   │   ├── parser.ts              # Markdown → chunks
│   │   └── types.ts               # Protocol types
│   ├── tools/
│   │   └── registry.ts            # Retrieval registry
│   ├── validator.ts               # Response validation
│   ├── types.ts                   # Shared types
│   ├── server.ts                  # Express API server
│   ├── server/                    # Server components
│   │   ├── routes/                # API endpoints
│   │   ├── middleware/            # Express middleware
│   │   ├── config.ts              # Configuration loader
│   │   └── lifecycle.ts           # Server lifecycle
│   ├── memory-layer/              # Memory system
│   │   ├── api/                   # Memory API endpoints
│   │   ├── storage/               # Storage adapters
│   │   ├── governance/            # Audit & crypto
│   │   ├── middleware/            # Consent, validation
│   │   ├── models/                # Data models
│   │   └── security/              # Encryption service
│   └── index.ts                   # CLI entry point
├── protocols/
│   └── field_diagnostic.md        # Field Diagnostic Protocol
├── assets/
│   ├── js/                        # Frontend JavaScript
│   │   ├── main.js               # Application entry
│   │   ├── state.js              # State management
│   │   ├── intro.js              # Intro flow
│   │   ├── dom.js                # DOM utilities
│   │   └── config.js             # Frontend config
│   └── css/                       # Stylesheets
│       ├── base.css              # Base styles
│       ├── animations.css        # Animations
│       ├── layout.css            # Layout system
│       ├── components.css        # UI components
│       ├── views.css             # View-specific styles
│       └── responsive.css        # Responsive design
├── test/                          # Test suites
├── docs/
│   ├── specs/                     # Specifications
│   ├── adrs/                      # Architecture decisions
│   └── runbooks/                  # Operational procedures
└── index.html                     # SPA entry point
```

---

## Key Patterns & Principles

### 1. Stone Alignment

The agent's voice follows **Lichen Stones**:
- **Stone 4**: Clarity Over Cleverness
- **Stone 5**: Presence Is Productivity
- **Stone 8**: Integrity Is the Growth Strategy

This means: simple language, no rushing, pattern-level insights (not surface-level).

### 2. State Machine

Mode transitions are deterministic:
```
ENTRY → WALK (intent: walk)
WALK → WALK (theme progression)
WALK → CLOSE (all 6 themes completed)
CLOSE → ENTRY (reset)
```

### 3. One Question Per Turn (WALK Mode)

Critical constraint: WALK mode responses MUST end with exactly one question. The validator enforces this.

### 4. Conversation History Compression

To stay under Claude's context limits:
- Keep first 2 turns (grounding)
- Keep last 8 turns (recent context)
- Prune middle turns
- Summarize lost context in a meta-turn

### 5. Cost Tracking

Every API call tracks cost (input + output tokens × pricing). Displayed to user in real-time.

### 6. Memory Layer Invariant

**"Memory enriches but never controls."**

Memory provides context but NEVER overrides current conversation flow. The agent can recall patterns but must stay present.

### 7. Consent-Driven Privacy

All memory operations require explicit consent:
- `personal`: User's own data
- `cohort`: Aggregated group data (k ≥ 5)
- `population`: Public aggregations

Consent resolver middleware fails closed (deny by default).

### 8. Cryptographic Audit Trail

Every memory operation:
1. Generates a canonical JSON payload
2. Signs with Ed25519 private key
3. Appends to Merkle tree
4. Returns cryptographic receipt
5. Publishes public key via JWKS

This creates a tamper-evident audit log.

---

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
```

### Running Locally

```bash
# CLI mode (interactive terminal)
npm run dev

# API server (production-like)
npm run server
# → http://localhost:3000

# Build and start (production mode)
npm run build
npm start
```

### Testing

```bash
# Full test suite
npm test

# Specific test suites
npm run test:memory-middleware
npm run test:memory-storage
npm run test:scenarios

# Smoke tests (no API key needed)
npm run test:smoke
```

### Code Quality

Git hooks (via Husky):
- Pre-commit: Linting and formatting (lint-staged)
- Commit-msg: Conventional commits (commitlint)

### Deployment

See `PRODUCTION_DEPLOYMENT.md` for:
- Railway deployment configuration
- Environment variable setup
- Health check endpoints
- Monitoring and observability

---

## Important Files to Read First

1. **README.md** - Project overview and quick start
2. **src/types.ts** - Core type definitions (SessionState, Mode, etc.)
3. **src/agent.ts** - Main orchestration logic
4. **protocols/field_diagnostic.md** - The actual protocol content
5. **docs/specs/README.md** - Memory Layer specification index
6. **docs/specs/phase-2-api.md** - Memory API documentation
7. **API.md** - HTTP API contracts

---

## Common Tasks

### Adding a New Protocol

1. Create `protocols/your_protocol.md` with YAML frontmatter
2. Tag chunks with `ENTRY`, `WALK`, theme numbers
3. Load in agent: `loadProtocol('./protocols/your_protocol.md')`
4. Create custom registry and pass to agent

### Modifying System Prompts

Edit `src/composer/prompts.ts`:
- `getSystemPromptForMode()`: Mode-specific instructions
- Include Stone alignment principles
- Add retrieval context formatting

### Adding a Memory Operation

1. Define schema in `src/memory-layer/models/`
2. Add route in `src/memory-layer/api/operations.ts`
3. Wire up in `src/memory-layer/api/memory-router.ts`
4. Add middleware (consent, validation)
5. Emit audit event
6. Add tests

### Debugging Session State

In API:
```bash
curl http://localhost:3000/api/protocol/session/<session-id>/state
```

In CLI:
```
> state
```

### Viewing Metrics

```bash
curl http://localhost:3000/metrics
```

Prometheus-compatible metrics for audit events, crypto operations, lock contention, etc.

---

## Roadmap & Phases

The project is implementing the **Lichen Protocol Memory Layer** in phases:

- ✅ **Phase 0**: Foundations (TypeScript, Express, Agent Core)
- ✅ **Phase 1.0**: Cryptographic audit (Ed25519, Merkle, JWKS)
- 🔄 **Phase 1.1**: Governance hardening (CI gates, key rotation, metrics)
- 📋 **Phase 2**: Differential privacy & consent management
- 📋 **Phase 3**: Federated learning integration
- 📋 **Phase 4**: Constitutional governance
- 📋 **Phase 5**: Public auditing & transparency reports

See `docs/specs/README.md` for detailed phase breakdown.

---

## Critical Invariants & Rules

1. **Never mix ENTRY and WALK chunks** in retrieval
2. **One question per turn** in WALK mode (enforced by validator)
3. **Deterministic mode transitions** after classification
4. **Pattern-level field naming** (not "The [X] Field" format)
5. **Stone-aligned voice** (clarity, presence, integrity)
6. **In-memory state only** for sessions (no persistence by default)
7. **Fallback to ENTRY** on ambiguity or low confidence
8. **Memory enriches but never controls** (invariant)
9. **Fail-closed consent** (deny by default)
10. **Cryptographic audit** for all memory operations

---

## Security Considerations

### Current Protections

- Helmet.js security headers
- CORS with configurable origins
- Rate limiting (per-IP, per-session)
- Input validation (AJV schemas)
- Argon2 password hashing
- Ed25519 cryptographic signatures
- Merkle tree tamper detection

### Upcoming (Phase 3)

- Differential privacy (ε-DP guarantees)
- Token-rotation pseudonymization
- AES-256 encryption at rest
- TLS 1.3 in transit
- Key rotation ≤90 days
- Threat detection hooks

---

## Performance Optimization

### Current Optimizations

- ENTRY response caching (10-minute TTL)
- Conversation history compression
- Response streaming (where supported)
- Static asset caching
- Session cleanup intervals
- Memory record TTL enforcement

### Monitoring

- Prometheus metrics at `/metrics`
- Cost tracking per session
- Token usage tracking
- Audit operation timing
- Lock contention monitoring
- Verification failure tracking

See `PERFORMANCE-OPTIMIZATIONS.md` for detailed analysis.

---

## Troubleshooting

### Agent keeps repeating questions

Check:
1. Validator is passing (WALK mode)
2. Theme completion confirmation logic
3. `resume_hint` state field

### Session state not advancing

Check:
1. Classification result (intent detection)
2. Mode transition logic in `determineModeTransition()`
3. Theme completion criteria

### Memory operations failing

Check:
1. Consent headers in request
2. Schema validation errors (check response body)
3. Audit ledger corruption (verify Merkle root)
4. Storage adapter configuration

### High API costs

Check:
1. Conversation history size (enable compression)
2. ENTRY caching (should reduce repeated calls)
3. Classification frequency (should be once per turn)

---

## Getting Help

### Documentation

- `/docs/specs/` - Specifications
- `/docs/adrs/` - Architecture decisions
- `/docs/runbooks/` - Operational procedures
- `API.md` - HTTP API reference
- `INTEGRATION.md` - Frontend integration guide

### Key Files for Context

- `src/types.ts` - All TypeScript interfaces
- `src/agent.ts` - Main orchestration logic
- `src/composer/prompts.ts` - Agent voice and instructions
- `protocols/field_diagnostic.md` - Protocol content

### Code Analysis

```bash
npm run analyze
npm run analyze:latest
```

Generates comprehensive code analysis reports.

---

## Contributing

1. Follow conventional commits (enforced by commitlint)
2. Run `npm run format` before committing
3. Ensure `npm test` passes
4. Update relevant documentation
5. Add tests for new features
6. Follow Stone alignment principles in agent voice

See `CONTRIBUTING.md` for detailed guidelines.

---

## Next Steps for Onboarding

1. **Read the README** to understand project purpose
2. **Run the CLI** (`npm run dev`) and have a conversation
3. **Run the server** (`npm run server`) and open http://localhost:3000
4. **Read `src/types.ts`** to understand core data structures
5. **Step through `src/agent.ts`** to see orchestration flow
6. **Explore `protocols/field_diagnostic.md`** to see protocol content
7. **Review `docs/specs/phase-2-api.md`** to understand Memory Layer
8. **Run tests** (`npm test`) to see expected behaviors
9. **Make a small change** and observe the full dev workflow

---

## Key Contacts & Resources

- **GitHub Issues**: Track roadmap and bug reports
- **Lichen Protocol Docs**: Background on protocol philosophy
- **Anthropic Claude Docs**: API reference for Claude integration

---

**Welcome to the Field Diagnostic Agent! 🌿**

This codebase blends conversational AI, privacy-preserving memory systems, and protocol-driven dialogue to create something unique. Take your time exploring, and remember: **clarity over cleverness**.
