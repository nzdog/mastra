# Comprehensive Codebase Analysis

## Field Diagnostic Agent - Lichen Protocol System

**Generated:** 2025-10-12 **Repository:** mastra-lichen-agent **Current Branch:**
ui-improvements-and-fixes

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Detailed Directory Structure](#2-detailed-directory-structure)
3. [File-by-File Breakdown](#3-file-by-file-breakdown)
4. [API Endpoints Analysis](#4-api-endpoints-analysis)
5. [Architecture Deep Dive](#5-architecture-deep-dive)
6. [Environment & Setup](#6-environment--setup)
7. [Technology Stack Breakdown](#7-technology-stack-breakdown)
8. [Visual Architecture Diagrams](#8-visual-architecture-diagrams)
9. [Key Insights & Recommendations](#9-key-insights--recommendations)

---

## 1. Project Overview

### Project Type

**Conversational AI Agent with REST API** - A TypeScript-based intelligent assistant that guides
users through the Field Diagnostic Protocol, a structured self-reflection framework from the Lichen
Protocol system.

### Tech Stack Summary

- **Runtime:** Node.js with TypeScript (ES2022, CommonJS)
- **AI/LLM:** Anthropic Claude API (@anthropic-ai/sdk)
- **Framework:** Mastra Core (@mastra/core v0.19.1)
- **API Server:** Express.js 5.1.0 with CORS
- **Protocol Parser:** gray-matter (YAML frontmatter + Markdown)
- **Development:** tsx for direct TypeScript execution

### Architecture Pattern

**Event-Driven Conversational Agent** with three distinct operating modes:

1. **ENTRY Mode** - Protocol orientation and introduction
2. **WALK Mode** - Guided theme-by-theme progression through 5 themes
3. **CLOSE Mode** - Field diagnosis and synthesis

The architecture follows a **Retrieval-Augmented Generation (RAG)** pattern with:

- Intent classification
- Protocol content retrieval
- AI-powered response composition
- State management and session tracking

### Primary Use Case

Helps users identify and understand the invisible "fields" (systemic pressures, norms, incentives)
shaping their behavior, decisions, and emotional experiences through structured guided conversation.

---

## 2. Detailed Directory Structure

```
mastra-lichen-agent/
├── .claude/                      # Claude Code configuration
│   ├── agents/                   # Custom agent definitions
│   │   └── git-workflow-manager.md
│   ├── commands/                 # Custom slash commands
│   │   └── analyze.md
│   └── settings.local.json       # Local settings
│
├── assets/                       # Static assets
│   └── lichen-logo.png          # Brand logo
│
├── dist/                         # Compiled JavaScript output
│   └── [compiled .js files]
│
├── protocols/                    # Protocol definition files
│   ├── README.md                # Protocol system documentation
│   ├── PROTOCOL_TEMPLATE.md    # Template for new protocols
│   ├── field_diagnostic.md     # Main Field Diagnostic Protocol
│   └── Field_Exit_Protocol_*.md # Field Exit Protocol variants (1-5)
│
├── src/                         # TypeScript source code
│   ├── composer/                # AI response generation
│   │   ├── client.ts           # Claude API client wrapper
│   │   ├── index.ts            # Composer orchestrator
│   │   └── prompts.ts          # System prompts for each mode
│   │
│   ├── protocol/                # Protocol parsing & loading
│   │   ├── loader.ts           # Multi-protocol discovery
│   │   ├── parser.ts           # Markdown → structured data
│   │   └── types.ts            # Protocol type definitions
│   │
│   ├── tools/                   # Retrieval & utilities
│   │   └── registry.ts         # Protocol chunk retrieval
│   │
│   ├── agent.ts                 # Main orchestration logic
│   ├── classifier.ts            # Intent classification
│   ├── index.ts                 # CLI entry point
│   ├── server.ts                # Express API server
│   ├── types.ts                 # Shared type definitions
│   └── validator.ts             # Response validation (currently disabled)
│
├── test/                        # Test suite
│   └── scenarios.ts            # End-to-end test scenarios
│
├── index.html                   # Production frontend (Netlify)
├── test-frontend.html          # Development test interface
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── Procfile                    # Railway deployment config
├── railway.json                # Railway service config
├── API.md                      # API documentation
├── INTEGRATION.md              # Frontend integration guide
├── DEPLOYMENT.md               # Deployment instructions
├── QUICKSTART.md               # Quick start guide
├── FRONTEND-SETUP.md           # Frontend setup guide
├── OPTIMIZATION-SUMMARY.md     # Performance optimization notes
└── README.md                   # Main project documentation
```

### Purpose of Each Major Directory

#### `/src` - Core Application

Contains all TypeScript source code organized by functional domain:

- **Composer:** AI response generation and prompt management
- **Protocol:** Protocol parsing, validation, and content retrieval
- **Tools:** Retrieval mechanisms and utilities
- Root-level files handle orchestration, state, and API serving

#### `/protocols` - Protocol Definitions

Markdown files with YAML frontmatter defining:

- Protocol metadata (id, title, version)
- Entry sections (purpose, use cases, outcomes)
- Theme structures (questions, prompts, completion criteria)
- Summary instructions for AI synthesis

#### `/test` - Test Suite

Automated test scenarios covering:

- Greeting handling
- ENTRY mode activation
- WALK mode progression
- Theme transitions
- Full protocol completion

#### `/.claude` - Development Tools

Claude Code CLI customizations:

- Custom agents for git workflows
- Slash commands for codebase analysis
- Local configuration settings

---

## 3. File-by-File Breakdown

### Core Application Files

#### `src/agent.ts` (581 lines)

**Purpose:** Main orchestrator coordinating all agent behaviors

**Key Responsibilities:**

- Session state management (mode, theme, conversation history)
- Message processing pipeline (classify → retrieve → compose → update)
- Theme answer tracking and progression logic
- Cost tracking (~$0.0082 per classifier call, ~$0.0080 per composer call)
- Mode transitions (ENTRY → WALK → CLOSE)
- Optimization: Skips AI calls for static content (ENTRY mode, theme questions)

**Critical Methods:**

- `processMessage()` - Main entry point for user input
- `determineMode()` - Decides current operational mode
- `getThemeIndexForResponse()` - Calculates which theme to show
- `getAwaitingConfirmationForResponse()` - Determines if showing questions or interpretation
- `buildStaticResponse()` - Constructs responses without AI calls (optimization)

**State Machine:**

```
null → ENTRY → WALK (Theme 1-5) → CLOSE
         ↑         ↓
         └─────────┘ (clarifications)
```

#### `src/server.ts` (524 lines)

**Purpose:** Express API server wrapping the agent for web access

**Key Features:**

- RESTful API with CORS enabled
- In-memory session storage (1-hour TTL, auto-cleanup every 10 min)
- Multi-protocol support via slug parameter
- Session lifecycle management
- Static file serving for frontend

**Endpoints:**

- `POST /api/walk/start` - Initialize new protocol session
- `POST /api/walk/continue` - Continue existing session
- `POST /api/walk/complete` - Finish protocol with summary
- `GET /api/protocols` - List available protocols
- `GET /api/session/:id` - Debug session state
- `GET /health` - Health check
- `GET /` - Serve production frontend
- `GET /test` - Serve test interface

**Helper Functions:**

- `extractSupports()` - Pulls relevant protocol excerpts for frontend display
- `formatResponse()` - Structures API responses consistently
- `createSession()` - Initializes new agent with protocol

#### `src/classifier.ts` (149 lines)

**Purpose:** AI-powered intent detection

**Classification Intents:**

- `discover` - User wants orientation/clarification
- `walk` - User wants to start/continue structured walk
- `memory` - User is continuing from context
- `none` - Greeting/off-topic

**User Intent Signals:**

- `advance_to_next_theme` - Ready to move forward
- `request_elaboration` - Needs more explanation
- `add_more_reflection` - Adding to current theme
- `navigate_to_theme` - Jumping to specific theme

**Fallback Rules:**

- Confidence < 0.55 → default to ENTRY mode
- Intent=walk but no active protocol → ENTRY mode
- Intent=memory but no prior state → ENTRY mode

**References:** src/classifier.ts:23-51

#### `src/types.ts` (58 lines)

**Purpose:** Shared TypeScript type definitions

**Core Types:**

- `Mode` - Operating mode ('ENTRY' | 'WALK' | 'CLOSE')
- `SessionState` - Complete session state structure
- `ClassificationResult` - Intent classification output
- `ProtocolChunk` - Retrieved protocol content
- `UserIntent` - Semantic user intentions
- `ConversationTurn` - Message history entry

**References:** src/types.ts:1-58

#### `src/composer/index.ts` (223 lines)

**Purpose:** Orchestrates AI response generation

**Key Features:**

- Mode-specific system prompts (ENTRY_PROMPT, WALK_PROMPT, CLOSE_PROMPT)
- Protocol metadata injection (total themes, protocol title)
- Message context building (history + protocol content)
- Response validation (currently disabled for flexibility)
- Retry logic with strengthened constraints

**Context Injection:**

- ENTRY: Protocol content
- WALK: Current theme + previous answers + state info
- CLOSE: All theme answers for synthesis

**Optimization:** Validation disabled to allow flexible templates

**References:** src/composer/index.ts:19-127

#### `src/composer/client.ts`

**Purpose:** Claude API client wrapper

**Key Methods:**

- `sendMessage()` - Send message to Claude with system prompt
- `getStructuredResponse<T>()` - Get typed JSON response from Claude

**Configuration:**

- Model: claude-3-5-sonnet-20241022
- Max tokens: Configurable (default varies by call)
- Temperature: 1.0 (creative responses)

#### `src/composer/prompts.ts`

**Purpose:** System prompts defining agent behavior for each mode

**Prompts:**

1. **ENTRY_PROMPT** - Introduces protocol with warmth and invitation
2. **WALK_PROMPT** - Guides through themes with structured reflection
3. **CLOSE_PROMPT** - Synthesizes field diagnosis from user answers
4. **CLASSIFIER_PROMPT** - Classifies user intent with structured JSON output

**Design Principles (Stone-aligned):**

- Clarity over cleverness
- Presence is productivity
- Integrity is the growth strategy

### Protocol System Files

#### `src/protocol/parser.ts` (287 lines)

**Purpose:** Parses markdown protocol files into structured data

**Key Methods:**

- `parse()` - Main parsing entry point
- `extractEntrySections()` - Extracts ENTRY mode sections
- `extractThemeChunks()` - Extracts WALK mode themes
- `extractSummaryInstructions()` - Extracts CLOSE mode instructions
- `parseThemeContent()` - Structures theme data

**Protocol Structure:**

```
YAML frontmatter (metadata)
---
## Entry Sections (Purpose, Why, Use When, Outcomes)
## Themes
### 1. Theme Title
  **Purpose:** ...
  **Guiding Questions:** ...
## Summary Instructions
```

**References:** src/protocol/parser.ts:16-276

#### `src/protocol/loader.ts`

**Purpose:** Multi-protocol discovery and loading

**Key Features:**

- Scans `protocols/` directory for .md files
- Extracts metadata from YAML frontmatter
- Returns list of available protocols
- Provides path resolution for protocol slugs

#### `src/protocol/types.ts`

**Purpose:** Protocol-specific type definitions

**Key Types:**

- `ProtocolMetadata` - Protocol identification and structure
- `ParsedProtocol` - Complete parsed protocol structure
- `EntrySection` - ENTRY mode content section
- `ThemeContent` - Structured theme data

#### `src/tools/registry.ts` (86 lines)

**Purpose:** Protocol content retrieval system

**Key Methods:**

- `retrieve(mode, themeIndex)` - Returns appropriate chunk for mode
- `getTotalThemes()` - Returns theme count
- `getThemeTitle(index)` - Returns theme name
- `getMetadata()` - Returns protocol metadata
- `getSummaryInstructions()` - Returns CLOSE mode prompt

**Critical Rule:** Never mix ENTRY and WALK chunks in one retrieval

**References:** src/tools/registry.ts:15-48

### Support Files

#### `src/validator.ts`

**Purpose:** Validates AI responses match protocol structure

**Status:** Currently disabled (VALIDATION_DISABLED = true)

**Validation Checks:**

- Theme title matches protocol
- Guiding questions match protocol
- Required sections present
- Format consistency

**Fallback:** Deterministic protocol content if validation fails twice

#### `src/index.ts`

**Purpose:** CLI interface for local testing

**Features:**

- Interactive readline-based chat
- Commands: exit, quit, reset, state, help
- Color-coded output
- State inspection for debugging

### Configuration Files

#### `package.json`

**Scripts:**

- `dev` - Run CLI with tsx
- `server` - Run API server
- `build` - Compile TypeScript
- `start` - Build and run production server
- `test` - Run test scenarios

**Dependencies:**

- **AI/LLM:** @anthropic-ai/sdk (^0.65.0), @mastra/core (^0.19.1)
- **Server:** express (^5.1.0), cors (^2.8.5)
- **Parsing:** gray-matter (^4.0.3), glob (^11.0.3)
- **Environment:** dotenv (^17.2.3)

**Dev Dependencies:**

- **TypeScript:** typescript (^5.9.3), @types/node (^24.6.2)
- **Runtime:** tsx (^4.20.6) for direct TS execution

#### `tsconfig.json`

**Configuration:**

- Target: ES2022
- Module: CommonJS
- Strict mode enabled
- Output: `./dist`
- Root: `./src`

### Test Files

#### `test/scenarios.ts` (127 lines)

**Test Scenarios:**

1. **Greeting Test** - Validates greeting handling without protocol activation
2. **ENTRY Test** - Tests protocol introduction
3. **WALK Transition** - Tests ENTRY → WALK transition
4. **Continuity Test** - Tests theme advancement
5. **Full Walk Test** - Complete protocol walkthrough (5 themes → CLOSE)

**Usage:**

```bash
npm run test
```

### Documentation Files

#### `README.md`

Main project documentation covering:

- Architecture overview (ENTRY/WALK/CLOSE modes)
- Installation and setup
- Usage instructions (CLI and API)
- Testing procedures
- Design principles (Stone alignment)
- State management

#### `API.md`

Complete API reference:

- Endpoint specifications
- Request/response schemas
- Example flow with JavaScript
- Error handling
- Session management details

#### `INTEGRATION.md`

Frontend integration guide:

- Quick start instructions
- API response parsing
- Session state management
- CORS configuration
- Production checklist

#### `DEPLOYMENT.md`

Deployment instructions:

- Split architecture (Netlify frontend + Railway backend)
- Environment variable setup
- Railway deployment steps
- Netlify deployment steps
- Testing procedures

---

## 4. API Endpoints Analysis

### Base URL

- **Development:** `http://localhost:3000`
- **Production:** Configured via `PORT` environment variable (Railway sets automatically)

### Endpoints Overview

| Method | Endpoint             | Purpose                        | Auth Required |
| ------ | -------------------- | ------------------------------ | ------------- |
| POST   | `/api/walk/start`    | Start new protocol session     | No (MVP)      |
| POST   | `/api/walk/continue` | Continue existing session      | No (MVP)      |
| POST   | `/api/walk/complete` | Complete protocol with summary | No (MVP)      |
| GET    | `/api/protocols`     | List available protocols       | No            |
| GET    | `/api/session/:id`   | Get session state (debug)      | No            |
| GET    | `/health`            | Health check                   | No            |
| GET    | `/`                  | Serve production frontend      | No            |
| GET    | `/test`              | Serve test interface           | No            |
| GET    | `/lichen-logo.png`   | Serve logo image               | No            |

### Detailed Endpoint Analysis

#### POST `/api/walk/start`

**Purpose:** Initialize a new protocol session

**Request Body:**

```json
{
  "user_input": "What field am I in?",
  "protocol_slug": "field_diagnostic" // optional, defaults to field_diagnostic
}
```

**Response:**

```json
{
  "session_id": "uuid-here",
  "protocol_name": "Field Diagnostic Protocol",
  "theme_number": 1,
  "total_themes": 5,
  "mode": "ENTRY",
  "composer_output": "**Field Diagnostic Protocol**\n\n...",
  "supports": [
    {
      "source": "Field Diagnostic Protocol",
      "theme": "Overview",
      "excerpt": "This protocol helps surface..."
    }
  ],
  "state": {
    "current_mode": "ENTRY",
    "current_theme": null,
    "last_response_type": "none",
    "turn_count": 1
  },
  "total_cost": 0.0082,
  "is_final_theme": false,
  "show_completion_options": false
}
```

**Server-side Flow:**

1. Validate request body
2. Create new session with protocol parser & registry
3. Initialize FieldDiagnosticAgent
4. Process initial message through agent
5. Extract supports from protocol
6. Format and return response

**References:** src/server.ts:323-354

#### POST `/api/walk/continue`

**Purpose:** Continue an existing protocol session

**Request Body:**

```json
{
  "session_id": "uuid-here",
  "user_response": "yes, walk me through it"
}
```

**Response:** Same structure as `/api/walk/start`

**Server-side Flow:**

1. Validate session_id and user_response
2. Retrieve session (returns 404 if expired)
3. Process message through agent
4. Update session cost tracking
5. Format and return response

**Mode Transitions:**

- ENTRY → WALK when user accepts invitation
- WALK (Theme N) → WALK (Theme N+1) when user completes theme
- WALK (Theme 5) → CLOSE when final theme completed

**References:** src/server.ts:357-396

#### POST `/api/walk/complete`

**Purpose:** Complete protocol and optionally generate field diagnosis summary

**Request Body:**

```json
{
  "session_id": "uuid-here",
  "generate_summary": true // optional, triggers CLOSE mode
}
```

**Response (with summary):**

```json
{
  "session_id": "uuid-here",
  "protocol_name": "Field Diagnostic Protocol",
  "theme_number": 5,
  "total_themes": 5,
  "mode": "COMPLETE",
  "composer_output": "Based on what you've surfaced...",
  "supports": [],
  "state": {
    "current_mode": "CLOSE",
    "current_theme": 5,
    "last_response_type": "interpretation_and_completion",
    "turn_count": 12
  },
  "total_cost": 0.0892,
  "completed": true
}
```

**Response (without summary):**

```json
{
  "completed": true
}
```

**Server-side Flow:**

1. Validate session_id
2. Retrieve session
3. If `generate_summary: true`:
   - Force mode to CLOSE
   - Process message to trigger field diagnosis
   - Update cost
   - Return full response
4. Delete session after completion

**References:** src/server.ts:399-479

#### GET `/api/protocols`

**Purpose:** List all available protocols

**Response:**

```json
{
  "protocols": [
    {
      "id": "field_diagnostic",
      "slug": "field_diagnostic",
      "title": "Field Diagnostic Protocol",
      "version": "1.0.0",
      "purpose": "To surface the invisible field...",
      "why": "Fields are powerful...",
      "use_when": "Feeling stuck, stalled...",
      "theme_count": 5
    }
  ]
}
```

**Server-side Flow:**

1. Initialize ProtocolLoader
2. Scan protocols directory
3. Extract metadata from each .md file
4. Return structured list

**References:** src/server.ts:296-320

#### GET `/api/session/:id`

**Purpose:** Debug endpoint to inspect session state

**Response:**

```json
{
  "session_id": "uuid-here",
  "created_at": "2025-10-12T09:00:00.000Z",
  "last_accessed": "2025-10-12T09:05:00.000Z",
  "state": {
    "active_protocol": "field_diagnostic",
    "mode": "WALK",
    "theme_index": 2,
    "last_response": "interpretation_and_completion",
    "turn_counter": 5
  }
}
```

**References:** src/server.ts:482-500

#### GET `/health`

**Purpose:** Health check for monitoring

**Response:**

```json
{
  "status": "ok",
  "active_sessions": 3,
  "timestamp": "2025-10-12T09:00:00.000Z"
}
```

**References:** src/server.ts:287-293

### Session Management

**Storage:** In-memory Map (ephemeral, clears on restart)

**TTL:** 1 hour of inactivity

**Cleanup:** Automatic every 10 minutes via setInterval

**Session Structure:**

```typescript
interface Session {
  id: string;
  agent: FieldDiagnosticAgent;
  registry: ProtocolRegistry;
  parser: ProtocolParser;
  created_at: string;
  last_accessed: string;
  total_cost: number;
}
```

**Production Considerations:**

- Current implementation is ephemeral (suitable for MVP)
- For production, consider Redis or database for persistence
- Add authentication (JWT or session cookies)
- Implement rate limiting
- Add request logging

**References:** src/server.ts:54-80

### Error Handling

**Standard Error Response:**

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**Common Status Codes:**

- `400` - Bad request (missing required fields)
- `404` - Session not found or expired
- `500` - Internal server error

**References:** src/server.ts:348-353

---

## 5. Architecture Deep Dive

### System Architecture

The Field Diagnostic Agent implements a **sophisticated conversational RAG (Retrieval-Augmented
Generation)** architecture with state management and multi-mode operation.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INPUT                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  API Server    │
                    │  (Express)     │
                    └────────┬───────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Agent          │ ◄───┐
                    │ Orchestrator   │     │
                    └────────┬───────┘     │
                             │             │
                ┌────────────┼────────────┐│
                ▼            ▼            ▼│
         ┌──────────┐ ┌──────────┐ ┌──────┴────┐
         │Intent    │ │Protocol  │ │Composer   │
         │Classifier│ │Registry  │ │(Claude AI)│
         └──────────┘ └──────────┘ └───────────┘
                │            │            │
                └────────────┼────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  RESPONSE      │
                    └────────────────┘
```

### Request Lifecycle

#### 1. User Message Receipt

```
User → API Server → Session Retrieval → Agent.processMessage()
```

#### 2. Intent Classification

```
ConversationHistory + State → IntentClassifier → ClassificationResult
                              (Claude API call)
```

**Classification Output:**

```typescript
{
  intent: 'discover' | 'walk' | 'memory' | 'none',
  continuity: boolean,
  user_wants_to: {
    advance_to_next_theme: boolean,
    request_elaboration: boolean,
    add_more_reflection: boolean,
    navigate_to_theme: number | null
  },
  confidence: number
}
```

**Cost:** ~$0.0082 per classification

**References:** src/agent.ts:69-77

#### 3. Mode Determination

```
ClassificationResult + CurrentState → determineMode() → Mode
```

**Mode Logic:**

- Already CLOSE → stay CLOSE
- Theme 5 complete + user confirms → CLOSE
- Intent=discover & no protocol → ENTRY
- Intent=discover & protocol active → WALK
- Intent=walk → WALK
- Intent=memory & protocol active → WALK
- Intent=none → ENTRY
- Default → ENTRY

**References:** src/agent.ts:343-395

#### 4. Protocol Content Retrieval

```
Mode + ThemeIndex → ProtocolRegistry.retrieve() → ProtocolChunk
```

**Retrieval Rules:**

- **ENTRY Mode:** Returns JSON-encoded entry sections
- **WALK Mode:** Returns specific theme markdown content
- **CLOSE Mode:** Returns null (no chunk needed)

**Critical:** Never mix ENTRY and WALK chunks

**References:** src/tools/registry.ts:15-48

#### 5. Response Composition

**Path A: Static Response (Optimization)**

```
ENTRY mode OR (WALK mode + showing questions)
→ buildStaticResponse()
→ Direct protocol content
→ No AI call
→ Saves ~$0.0080
```

**Path B: AI-Generated Response**

```
WALK mode (showing interpretation) OR CLOSE mode
→ Composer.compose()
→ Build messages with context
→ Claude API call
→ Cost: ~$0.0080
```

**Context Injection:**

- **ENTRY:** Protocol content
- **WALK:** Theme content + previous answers + state
- **CLOSE:** All theme answers for synthesis

**References:** src/agent.ts:149-184

#### 6. State Update

```
Mode + Classification + ThemeIndex → updateState()
→ Update mode, theme_index, turn_counter, timestamps
→ Store user answers (if answering questions)
→ Track conversation depth
→ Manage is_revisiting flag
```

**References:** src/agent.ts:400-466

#### 7. Response Return

```
AgentResponse → formatResponse() → API JSON Response → Client
```

### Data Flow Diagram

```
USER MESSAGE
     │
     ▼
┌─────────────────┐
│ Conversation    │
│ History         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Session State   │◄────►│ Intent          │
│                 │      │ Classifier      │
│ • mode          │      └─────────────────┘
│ • theme_index   │               │
│ • last_response │               ▼
│ • is_revisiting │      ┌─────────────────┐
│ • answers       │      │ Classification  │
└────────┬────────┘      │ Result          │
         │               └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│ Protocol        │      │ Mode            │
│ Registry        │      │ Determination   │
│                 │      └─────────────────┘
│ • ENTRY chunks  │               │
│ • WALK chunks   │               │
│ • Metadata      │◄──────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Protocol Chunk  │
│                 │
│ • ENTRY: JSON   │
│ • WALK: MD      │
│ • CLOSE: null   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Composer        │───────► Static Response (if optimized)
│                 │
│ Build messages  │
│ with context    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Claude API      │
│                 │
│ Generate        │
│ response        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RESPONSE        │
│                 │
│ • composer_out  │
│ • supports      │
│ • state         │
│ • metadata      │
└─────────────────┘
```

### State Machine

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     AGENT STATE MACHINE                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

       ┌──────────────────┐
       │  Initial State   │
       │  mode: null      │
       │  theme: null     │
       └────────┬─────────┘
                │
                │ User: "What field am I in?"
                │ Intent: discover
                │
                ▼
       ┌──────────────────┐
       │   ENTRY MODE     │
       │ Present protocol │
       │ orientation      │
       └────────┬─────────┘
                │
                │ User: "Walk me through it"
                │ Intent: walk
                │
                ▼
       ┌──────────────────┐
       │   WALK MODE      │
       │   Theme 1        │◄────┐
       │ Show questions   │     │
       └────────┬─────────┘     │
                │                │
                │ User answers   │
                │ Intent: memory │
                │                │
                ▼                │
       ┌──────────────────┐     │
       │   WALK MODE      │     │
       │   Theme 1        │     │
       │ Show interpret   │     │
       └────────┬─────────┘     │
                │                │
                │ User: "next"   │ User: "tell me more"
                │ advance=true   │ elaborate=true
                │                │
                ▼                │
       ┌──────────────────┐     │
       │   WALK MODE      │     │
       │   Theme 2        │     │
       │ Show questions   │─────┘
       └────────┬─────────┘
                │
                │ ... repeat for themes 2-4 ...
                │
                ▼
       ┌──────────────────┐
       │   WALK MODE      │
       │   Theme 5        │
       │ Show interpret   │
       └────────┬─────────┘
                │
                │ User confirms completion
                │ Intent: memory + theme=5
                │
                ▼
       ┌──────────────────┐
       │   CLOSE MODE     │
       │ Field diagnosis  │
       │ (final summary)  │
       └──────────────────┘
                │
                │ Protocol complete
                │
                ▼
       ┌──────────────────┐
       │   END STATE      │
       │ No further input │
       │ accepted         │
       └──────────────────┘
```

### Design Patterns

#### 1. Strategy Pattern

**Composer** uses different strategies based on mode:

- ENTRY_PROMPT strategy
- WALK_PROMPT strategy
- CLOSE_PROMPT strategy

Each prompt defines a distinct behavior strategy for the AI.

#### 2. State Pattern

**Agent** maintains session state and changes behavior based on:

- Current mode (ENTRY/WALK/CLOSE)
- Current theme index
- Last response type (questions/interpretation)

#### 3. Template Method Pattern

**Parser** defines protocol parsing template:

1. Parse YAML frontmatter
2. Extract entry sections
3. Extract theme chunks
4. Extract summary instructions

Subclasses could customize extraction methods.

#### 4. Registry Pattern

**ProtocolRegistry** acts as central registry for protocol content:

- Single point of access
- Encapsulates retrieval logic
- Manages protocol metadata

#### 5. Facade Pattern

**FieldDiagnosticAgent** provides simplified interface to complex subsystem:

- Hides complexity of classifier, registry, composer
- Provides single `processMessage()` method
- Manages internal coordination

### Performance Optimizations

#### Static Response Optimization

**Problem:** Every response required AI call (~$0.0080)

**Solution:** Skip AI calls for deterministic content

- ENTRY mode: Return JSON-structured protocol intro
- WALK mode (questions): Return formatted theme questions

**Impact:** ~50% cost reduction per session

**References:** src/agent.ts:150-156, src/agent.ts:471-534

#### Conversation History Pruning

**Implementation:** Keep only last 6 conversation turns

**Impact:** Reduces token usage in classifier/composer calls

**References:** src/classifier.ts:61, src/composer/index.ts:168

#### Session TTL and Cleanup

**Implementation:** 1-hour TTL with 10-minute cleanup cycle

**Impact:** Prevents memory leaks from abandoned sessions

**References:** src/server.ts:59-68

### Extensibility Points

#### Adding New Protocols

1. Create markdown file in `protocols/` directory
2. Follow template with YAML frontmatter
3. Define themes with questions/prompts
4. Add summary instructions
5. Protocol automatically discovered by ProtocolLoader

**No code changes required**

#### Adding New Modes

1. Define new mode in `types.ts`
2. Create system prompt in `prompts.ts`
3. Add mode handling in `agent.ts` `determineMode()`
4. Add retrieval logic in `registry.ts`
5. Add composition logic in `composer/index.ts`

#### Adding New Intents

1. Update Intent type in `types.ts`
2. Update CLASSIFIER_PROMPT with new intent
3. Add fallback rules in `classifier.ts`
4. Add mode determination logic in `agent.ts`

#### Adding Persistence

**Current:** In-memory session storage

**Extension Points:**

1. Create SessionStore interface
2. Implement Redis/Database adapter
3. Replace Map in `server.ts` with adapter
4. No changes to agent logic required

---

## 6. Environment & Setup

### Required Environment Variables

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-...  # Required

# Server Configuration
PORT=3000                            # Optional (Railway sets automatically)

# Frontend URL (for CORS in production)
FRONTEND_URL=https://your-app.netlify.app  # Optional
```

### Installation Process

```bash
# 1. Clone repository
git clone <repo-url>
cd mastra-lichen-agent

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Build TypeScript
npm run build

# 5. Run locally
npm run dev      # CLI interface
npm run server   # API server (port 3000)
```

### Development Workflow

#### Local Development

```bash
# Terminal 1: Run API server
npm run server

# Terminal 2: Test with curl or Postman
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "What field am I in?"}'

# Or open test interface
open http://localhost:3000/test
```

#### Testing

```bash
# Run test scenarios
npm run test

# Manual CLI testing
npm run dev
```

#### Building for Production

```bash
# Compile TypeScript
npm run build

# Run production build
npm start
```

### Production Deployment

#### Split Architecture

- **Frontend:** Netlify (static hosting)
- **Backend:** Railway (Node.js server)

#### Railway Setup

1. Connect GitHub repository
2. Railway auto-detects Node.js
3. Set environment variables:
   - `ANTHROPIC_API_KEY`
   - `FRONTEND_URL` (Netlify URL)
4. Railway uses `Procfile`: `web: node dist/server.js`
5. Deploy automatically on push

#### Netlify Setup

1. Connect GitHub repository
2. Build command: `echo 'No build needed'`
3. Publish directory: `.` (root)
4. Update `index.html` with Railway backend URL
5. Deploy automatically on push

**Full deployment guide:** DEPLOYMENT.md

### Configuration Files

#### `Procfile`

```
web: node dist/server.js
```

Railway start command

#### `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### `.gitignore`

```
node_modules/
dist/
.env
*.log
.DS_Store
.netlify/
```

---

## 7. Technology Stack Breakdown

### Runtime Environment

**Node.js with TypeScript**

- **Target:** ES2022
- **Module System:** CommonJS
- **TypeScript Version:** 5.9.3
- **Type Checking:** Strict mode enabled

**Why CommonJS?**

- Better compatibility with current Node.js ecosystem
- Easier debugging
- Some dependencies require CommonJS

### AI/LLM Stack

#### Anthropic Claude API

**SDK:** @anthropic-ai/sdk (^0.65.0)

- **Model:** claude-3-5-sonnet-20241022
- **Temperature:** 1.0 (creative responses)
- **Max Tokens:** Varies by call type
  - Classifier: 512 tokens
  - Composer: Higher for rich responses

**Usage Patterns:**

1. **Intent Classification:** Structured JSON output
2. **Response Generation:** Markdown-formatted text
3. **Field Diagnosis:** Personalized synthesis

**Cost Tracking:**

- Classifier: ~$0.0082 per call
- Composer: ~$0.0080 per call
- Average session: $0.05-0.10

**References:** src/composer/client.ts

#### Mastra Framework

**Package:** @mastra/core (^0.19.1)

**Purpose:** Framework for building conversational AI agents

**Features Used:**

- Agent orchestration patterns
- Structured conversation flow
- State management patterns

### Backend Stack

#### Express.js

**Version:** 5.1.0

**Why Express 5?**

- Modern async/await support
- Better error handling
- Performance improvements
- Updated TypeScript types

**Middleware:**

- `express.json()` - JSON body parsing
- `cors()` - Cross-origin resource sharing

**References:** src/server.ts

#### CORS Configuration

**Package:** cors (^2.8.5)

**Current Setup:**

```typescript
app.use(
  cors({
    origin: '*', // Allow all origins (development)
    credentials: true,
  })
);
```

**Production Recommendation:**

```typescript
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
```

### Protocol Parsing Stack

#### gray-matter

**Version:** ^4.0.3

**Purpose:** Parse YAML frontmatter from Markdown files

**Usage:**

```typescript
const { data: frontmatter, content } = matter(fileContent);
```

**Why gray-matter?**

- Industry standard for frontmatter parsing
- Clean API
- Supports multiple formats (YAML, TOML, JSON)

**References:** src/protocol/parser.ts:18

#### glob

**Version:** ^11.0.3

**Purpose:** File pattern matching for protocol discovery

**Usage:**

```typescript
const files = glob.sync('protocols/*.md');
```

### Development Tools

#### tsx

**Version:** ^4.20.6

**Purpose:** Direct TypeScript execution without compilation

**Why tsx over ts-node?**

- Faster execution
- Better ES module support
- Active maintenance
- Lighter weight

**Usage:**

```bash
tsx src/index.ts     # CLI
tsx src/server.ts    # Server
tsx test/scenarios.ts # Tests
```

#### TypeScript Compiler

**Version:** ^5.9.3

**Configuration Highlights:**

- Strict null checks
- No implicit any
- Force consistent casing
- ES module interop

### Type Definitions

#### @types/node

**Version:** ^24.6.2

**Purpose:** Node.js built-in types

#### @types/express

**Version:** ^5.0.3

**Purpose:** Express.js types

#### @types/cors

**Version:** ^2.8.19

**Purpose:** CORS middleware types

### Environment Management

#### dotenv

**Version:** ^17.2.3

**Purpose:** Load environment variables from .env file

**Usage:**

```typescript
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;
```

### Dependencies Summary

```
Production Dependencies:
├── @anthropic-ai/sdk (^0.65.0)    - Claude API client
├── @mastra/core (^0.19.1)         - Agent framework
├── cors (^2.8.5)                   - CORS middleware
├── dotenv (^17.2.3)                - Environment variables
├── express (^5.1.0)                - HTTP server
├── glob (^11.0.3)                  - File pattern matching
└── gray-matter (^4.0.3)            - Frontmatter parsing

Development Dependencies:
├── @types/node (^24.6.2)           - Node.js types
├── tsx (^4.20.6)                   - TypeScript executor
└── typescript (^5.9.3)             - TypeScript compiler
```

### Infrastructure Stack

#### Netlify (Frontend)

- Static file hosting
- CDN distribution
- Automatic deployments from GitHub
- HTTPS included

#### Railway (Backend)

- Node.js hosting
- Automatic deployments from GitHub
- Environment variable management
- Automatic HTTPS
- PostgreSQL available (if needed for persistence)

---

## 8. Visual Architecture Diagrams

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Netlify)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      index.html                               │  │
│  │  • User interface                                             │  │
│  │  • Protocol intro flow                                        │  │
│  │  • Theme progression                                          │  │
│  │  • Summary display                                            │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ HTTPS/JSON
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Railway)                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                   Express API Server                        │   │
│  │  • Session management                                       │   │
│  │  • Request routing                                          │   │
│  │  • Response formatting                                      │   │
│  │  • CORS handling                                            │   │
│  └─────────────────┬───────────────────────────┬──────────────┘   │
│                    │                           │                   │
│                    ▼                           ▼                   │
│  ┌──────────────────────────┐  ┌──────────────────────────┐      │
│  │  Session Store           │  │  Protocol Loader         │      │
│  │  • In-memory Map         │  │  • Scan protocols/       │      │
│  │  • 1-hour TTL            │  │  • Parse metadata        │      │
│  │  • Auto cleanup          │  │  • Return available      │      │
│  └──────────────────────────┘  └──────────────────────────┘      │
│                    │                                               │
│                    ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              FieldDiagnosticAgent                         │   │
│  │  • Main orchestration                                     │   │
│  │  • State management                                       │   │
│  │  • Cost tracking                                          │   │
│  └──────┬────────────┬────────────┬─────────────┬──────────┘   │
│         │            │            │             │               │
│         ▼            ▼            ▼             ▼               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Intent    │ │Protocol  │ │Composer  │ │Validator │         │
│  │Classifier│ │Registry  │ │          │ │(disabled)│         │
│  │          │ │          │ │          │ │          │         │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └──────────┘         │
│        │            │            │                             │
│        └────────────┴────────────┘                             │
│                     │                                           │
└─────────────────────┼───────────────────────────────────────────┘
                      │ API Calls
                      ▼
         ┌────────────────────────┐
         │   Anthropic Claude     │
         │   • Intent classify    │
         │   • Response compose   │
         │   • Field synthesis    │
         └────────────────────────┘
```

### Request Flow Sequence Diagram

```
User          Frontend       API Server      Agent         Classifier    Registry    Composer      Claude
 │               │               │             │               │            │           │            │
 │──"What field──│               │             │               │            │           │            │
 │  am I in?"   │               │             │               │            │           │            │
 │               │               │             │               │            │           │            │
 │               │──POST /start──│             │               │            │           │            │
 │               │   (user_input)│             │               │            │           │            │
 │               │               │             │               │            │           │            │
 │               │               │─create──────│               │            │           │            │
 │               │               │  session    │               │            │           │            │
 │               │               │             │               │            │           │            │
 │               │               │─process─────│               │            │           │            │
 │               │               │  message    │               │            │           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │──classify─────│            │           │            │
 │               │               │             │    intent     │            │           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │               │──API call──│           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │               │            │◄──────────│            │
 │               │               │             │               │  intent:   │           │            │
 │               │               │             │               │  discover  │           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │◄──────────────│            │           │            │
 │               │               │             │  classification            │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──determine────────────────►│           │            │
 │               │               │             │    mode: ENTRY             │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──retrieve──────────────────│           │            │
 │               │               │             │    ENTRY chunk             │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │◄───────────────────────────│           │            │
 │               │               │             │  protocol content (JSON)   │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──build static response─────│           │            │
 │               │               │             │  (no AI call needed)       │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──update state──────────────│           │            │
 │               │               │             │                            │           │            │
 │               │               │◄────────────│                            │           │            │
 │               │               │  response   │                            │           │            │
 │               │               │             │                            │           │            │
 │               │◄─────────────│             │                            │           │            │
 │               │  JSON response│             │                            │           │            │
 │               │  + session_id │             │                            │           │            │
 │               │               │             │                            │           │            │
 │◄──────────────│               │             │                            │           │            │
 │  Display      │               │             │                            │           │            │
 │  protocol     │               │             │                            │           │            │
 │  intro        │               │             │                            │           │            │
 │               │               │             │                            │           │            │
 │──"Yes, walk"──│               │             │                            │           │            │
 │               │               │             │                            │           │            │
 │               │──POST /cont───│             │                            │           │            │
 │               │   (session_id,│             │                            │           │            │
 │               │   user_resp)  │             │                            │           │            │
 │               │               │             │                            │           │            │
 │               │               │─get session─│                            │           │            │
 │               │               │             │                            │           │            │
 │               │               │─process─────│                            │           │            │
 │               │               │  message    │                            │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──classify─────│            │           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │               │──API call──│           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │               │            │◄──────────│            │
 │               │               │             │               │  intent:   │           │            │
 │               │               │             │               │  walk      │           │            │
 │               │               │             │               │            │           │            │
 │               │               │             │◄──────────────│            │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──mode: WALK, theme: 1──────│           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──retrieve theme 1──────────│           │            │
 │               │               │             │                            │           │            │
 │               │               │             │◄───────────────────────────│           │            │
 │               │               │             │  theme 1 content           │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──build static response─────│           │            │
 │               │               │             │  (theme questions)         │           │            │
 │               │               │             │  (no AI call)              │           │            │
 │               │               │             │                            │           │            │
 │               │               │◄────────────│                            │           │            │
 │               │               │             │                            │           │            │
 │               │◄─────────────│             │                            │           │            │
 │               │  JSON with    │             │                            │           │            │
 │               │  theme 1 Qs   │             │                            │           │            │
 │               │               │             │                            │           │            │
 │◄──────────────│               │             │                            │           │            │
 │  Display      │               │             │                            │           │            │
 │  questions    │               │             │                            │           │            │
 │               │               │             │                            │           │            │
 │──answer───────│               │             │                            │           │            │
 │  theme 1      │               │             │                            │           │            │
 │               │               │             │                            │           │            │
 │               │──POST /cont───│             │                            │           │            │
 │               │               │             │                            │           │            │
 │               │               │─process─────│                            │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──classify (memory)─────────│           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──mode: WALK, awaiting──────│           │            │
 │               │               │             │    confirmation: true      │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──compose───────────────────│           │            │
 │               │               │             │    interpretation          │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │                            │──API call─│            │
 │               │               │             │                            │           │            │
 │               │               │             │                            │           │◄───────────│
 │               │               │             │                            │           │  generated │
 │               │               │             │                            │           │  interpret │
 │               │               │             │                            │           │            │
 │               │               │             │◄───────────────────────────│           │            │
 │               │               │             │  interpretation text       │           │            │
 │               │               │             │                            │           │            │
 │               │               │             │──store answer──────────────│           │            │
 │               │               │             │                            │           │            │
 │               │               │◄────────────│                            │           │            │
 │               │               │             │                            │           │            │
 │               │◄─────────────│             │                            │           │            │
 │               │  JSON with    │             │                            │           │            │
 │               │  interpret    │             │                            │           │            │
 │               │               │             │                            │           │            │
 │◄──────────────│               │             │                            │           │            │
 │  Display      │               │             │                            │           │            │
 │  interpret    │               │             │                            │           │            │
 │  + advance    │               │             │                            │           │            │
 │               │               │             │                            │           │            │
```

### Mode Transition Diagram

```
                     START
                       │
                       ▼
            ┌──────────────────┐
            │   NULL STATE     │
            │  no protocol     │
            │  no theme        │
            └────────┬─────────┘
                     │
          User says: "What field am I in?" / "Hello"
          Intent: discover / none
                     │
                     ▼
            ┌──────────────────┐
            │   ENTRY MODE     │
            │  active_protocol │
            │  = field_diag    │
            │  theme = null    │
            └────────┬─────────┘
                     │
          User says: "Yes, walk me through"
          Intent: walk
                     │
                     ▼
     ┌───────────────────────────────────────┐
     │           WALK MODE                   │
     │                                       │
     │  Theme 1 → Theme 2 → ... → Theme 5   │
     │                                       │
     │  Each theme has 2 phases:             │
     │  1. Questions (static response)       │
     │  2. Interpretation (AI response)      │
     │                                       │
     │  User can:                            │
     │  • Answer questions                   │
     │  • Request elaboration                │
     │  • Navigate to other themes           │
     │  • Advance to next theme              │
     │                                       │
     └───────────────┬───────────────────────┘
                     │
          User completes Theme 5
          Says: "next" or "continue"
          Intent: memory + advance
                     │
                     ▼
            ┌──────────────────┐
            │   CLOSE MODE     │
            │  Generate field  │
            │  diagnosis from  │
            │  all answers     │
            └────────┬─────────┘
                     │
                     ▼
            ┌──────────────────┐
            │   END STATE      │
            │  Protocol        │
            │  complete        │
            └──────────────────┘
```

### Data Model Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      SessionState                            │
├─────────────────────────────────────────────────────────────┤
│ active_protocol: string | null                              │
│ mode: 'ENTRY' | 'WALK' | 'CLOSE'                           │
│ theme_index: number | null                                  │
│ last_response: 'theme_questions' | 'interpretation' | 'none'│
│ is_revisiting: boolean                                      │
│ conversation_depth: number                                  │
│ has_answered_theme: boolean                                 │
│ resume_hint: ResumeHint                                     │
│ last_answer_summary: string                                 │
│ last_chunk_refs: string[]                                   │
│ turn_counter: number                                        │
│ updated_at: string                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ 1
                        │ owns
                        ▼ *
┌─────────────────────────────────────────────────────────────┐
│                   ConversationTurn                           │
├─────────────────────────────────────────────────────────────┤
│ role: 'user' | 'assistant'                                  │
│ content: string                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ClassificationResult                        │
├─────────────────────────────────────────────────────────────┤
│ intent: 'discover' | 'walk' | 'memory' | 'none'            │
│ continuity: boolean                                         │
│ confidence: number                                          │
│ user_wants_to: UserIntent                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ 1
                        │ contains
                        ▼ 1
┌─────────────────────────────────────────────────────────────┐
│                      UserIntent                              │
├─────────────────────────────────────────────────────────────┤
│ advance_to_next_theme: boolean                              │
│ request_elaboration: boolean                                │
│ add_more_reflection: boolean                                │
│ navigate_to_theme: number | null                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ParsedProtocol                            │
├─────────────────────────────────────────────────────────────┤
│ metadata: ProtocolMetadata                                  │
│ entry_sections: EntrySection[]                              │
│ theme_chunks: Map<number, string>                           │
│ summary_instructions: string | undefined                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ 1
                        │ has
                        ▼ 1
┌─────────────────────────────────────────────────────────────┐
│                   ProtocolMetadata                           │
├─────────────────────────────────────────────────────────────┤
│ id: string                                                  │
│ title: string                                               │
│ version: string                                             │
│ entry_keys: string[]                                        │
│ entry_sections: EntrySectionConfig[] | undefined            │
│ themes: ThemeMetadata[]                                     │
│ stones: string[]                                            │
└───────────────────────┬─────────────────────────────────────┘
                        │ 1
                        │ has
                        ▼ *
┌─────────────────────────────────────────────────────────────┐
│                    ThemeMetadata                             │
├─────────────────────────────────────────────────────────────┤
│ index: number                                               │
│ title: string                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ProtocolChunk                             │
├─────────────────────────────────────────────────────────────┤
│ id: string                                                  │
│ type: 'ENTRY' | 'WALK'                                     │
│ content: string                                             │
│ theme_index?: number                                        │
└─────────────────────────────────────────────────────────────┘
```

### Protocol File Structure

```
┌────────────────────────────────────────────────────────────┐
│              field_diagnostic.md                            │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │ YAML FRONTMATTER                                  │     │
│  │ ---                                               │     │
│  │ id: field_diagnostic                              │     │
│  │ title: Field Diagnostic Protocol                  │     │
│  │ version: 1.0.0                                    │     │
│  │ themes:                                           │     │
│  │   - index: 1                                      │     │
│  │     title: Surface Behaviors                      │     │
│  │   - index: 2                                      │     │
│  │     title: Felt Experience                        │     │
│  │   ...                                             │     │
│  │ ---                                               │     │
│  └──────────────────────────────────────────────────┘     │
│                       │                                     │
│                       │ Parsed by gray-matter               │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ ENTRY SECTIONS (for ENTRY mode)                  │     │
│  │                                                   │     │
│  │ ## Purpose                                        │     │
│  │ To surface the invisible field...                │     │
│  │                                                   │     │
│  │ ## Why This Matters                              │     │
│  │ Fields are powerful...                           │     │
│  │                                                   │     │
│  │ ## Use This When                                 │     │
│  │ - Feeling stuck...                               │     │
│  │                                                   │     │
│  │ ## Outcomes                                       │     │
│  │ - Poor: Continue without awareness...            │     │
│  │ - Expected: Identify the field...                │     │
│  └──────────────────────────────────────────────────┘     │
│                       │                                     │
│                       │ Retrieved via ProtocolRegistry      │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ THEMES (for WALK mode)                           │     │
│  │                                                   │     │
│  │ ## Themes                                         │     │
│  │                                                   │     │
│  │ ### 1. Surface Behaviors *(Stone 4)*             │     │
│  │ **Purpose:** Name visible habits...              │     │
│  │ **Why this matters:** Behavior is first clue...  │     │
│  │ **Outcomes:**                                     │     │
│  │ - Poor: Deny behaviors...                        │     │
│  │ - Expected: Name behaviors...                    │     │
│  │ **Guiding Questions:**                           │     │
│  │ - What language am I using?                      │     │
│  │ - How do I act under pressure?                   │     │
│  │ **Completion Prompt:**                           │     │
│  │ I have named the visible patterns...             │     │
│  │                                                   │     │
│  │ ### 2. Felt Experience *(Stone 5)*               │     │
│  │ ...                                              │     │
│  └──────────────────────────────────────────────────┘     │
│                       │                                     │
│                       │ Retrieved per theme via Registry    │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ SUMMARY INSTRUCTIONS (for CLOSE mode)            │     │
│  │                                                   │     │
│  │ ## Summary Instructions                           │     │
│  │                                                   │     │
│  │ Name the active field clearly and describe its   │     │
│  │ defining pattern, energy, or behaviour.          │     │
│  │ Use present-tense language only.                 │     │
│  │ Avoid speculation about what comes next.         │     │
│  │ Do not recommend actions or solutions.           │     │
│  │ Focus on precision, neutrality, and grounded     │     │
│  │ observation.                                      │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 9. Key Insights & Recommendations

### Code Quality Assessment

#### Strengths

1. **Clear Separation of Concerns**
   - Agent orchestrates, doesn't implement details
   - Classifier, registry, composer have single responsibilities
   - Protocol parsing isolated from business logic

2. **Type Safety**
   - Comprehensive TypeScript types
   - Strict mode enabled
   - Clear interfaces for all data structures

3. **Extensive Logging**
   - Detailed console logs for debugging
   - Cost tracking per API call
   - State transitions logged

4. **Optimization Focus**
   - Static response optimization saves ~50% costs
   - Conversation history pruning
   - Session TTL and cleanup

5. **Protocol-Driven Design**
   - No protocol logic in code
   - Easy to add new protocols
   - Content separated from behavior

#### Areas for Improvement

1. **Error Handling**
   - Limited error recovery strategies
   - No retry logic for API failures
   - Generic error messages to users

2. **Testing**
   - Only basic scenario tests
   - No unit tests
   - No integration tests for API endpoints
   - No mocking of Claude API calls

3. **Validation**
   - Response validator disabled
   - No request validation beyond basic checks
   - No protocol schema validation

4. **Persistence**
   - In-memory sessions lost on restart
   - No conversation history persistence
   - No analytics tracking

5. **Security**
   - No authentication
   - No rate limiting
   - CORS allows all origins (development mode)
   - API keys in environment only

### Potential Improvements

#### 1. Add Comprehensive Testing

```typescript
// Unit tests
describe('IntentClassifier', () => {
  it('should classify walk intent', async () => {
    const classifier = new IntentClassifier(mockApiKey);
    const result = await classifier.classify('walk me through it', [], mockState);
    expect(result.intent).toBe('walk');
  });
});

// Integration tests
describe('API Endpoints', () => {
  it('should start new session', async () => {
    const response = await request(app)
      .post('/api/walk/start')
      .send({ user_input: 'What field am I in?' });

    expect(response.status).toBe(200);
    expect(response.body.session_id).toBeDefined();
  });
});
```

**Tools:** Jest, Supertest, MSW (for API mocking)

#### 2. Add Persistent Session Storage

```typescript
interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(sessionId: string, session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

class RedisSessionStore implements SessionStore {
  // Redis implementation
}

class DatabaseSessionStore implements SessionStore {
  // Postgres implementation
}
```

**Options:**

- Redis (fast, TTL support)
- PostgreSQL (persistent, queryable)
- DynamoDB (serverless, scalable)

#### 3. Add Authentication

```typescript
// JWT middleware
app.use('/api', authenticateJWT);

function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
}
```

**Recommendation:** Start with JWT, consider OAuth2 for production

#### 4. Add Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

**Recommendation:** Implement per-user rate limits based on auth

#### 5. Enable Response Validation

```typescript
// Update validator to work with flexible templates
class WalkResponseValidator {
  validateThemeResponse(
    response: string,
    themeIndex: number,
    awaitingConfirmation: boolean
  ): ValidationResult {
    // Flexible validation:
    // - Check presence of key sections
    // - Allow variations in wording
    // - Focus on structure, not exact text
  }
}
```

**Recommendation:** Use fuzzy matching, not exact string comparison

#### 6. Add Analytics and Monitoring

```typescript
// Track key metrics
interface SessionMetrics {
  session_id: string;
  protocol_slug: string;
  started_at: string;
  completed_at: string | null;
  total_turns: number;
  total_cost: number;
  themes_completed: number;
  completion_status: 'complete' | 'abandoned' | 'in_progress';
}

// Log to analytics service
function trackMetrics(metrics: SessionMetrics) {
  // Send to Mixpanel, Amplitude, or custom analytics
}
```

**Tools:** Mixpanel, Amplitude, PostHog, or custom PostgreSQL tracking

#### 7. Improve Error Handling

```typescript
class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public retryable: boolean
  ) {
    super(message);
  }
}

// In agent
try {
  const classification = await this.classifier.classify(...);
} catch (error) {
  if (error instanceof APIError && error.status === 429) {
    // Rate limited, retry with backoff
    await sleep(retryDelay);
    return this.retryClassify(...);
  }

  throw new AgentError(
    'Classification failed',
    'CLASSIFY_ERROR',
    500,
    true
  );
}
```

**Recommendation:** Implement exponential backoff for retries

#### 8. Add Protocol Validation

```typescript
// JSON Schema for protocol files
const protocolSchema = {
  type: 'object',
  required: ['id', 'title', 'version', 'themes'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['index', 'title'],
        properties: {
          index: { type: 'number' },
          title: { type: 'string' },
        },
      },
    },
  },
};

// Validate on load
function validateProtocol(metadata: any): void {
  const valid = ajv.validate(protocolSchema, metadata);
  if (!valid) {
    throw new Error(`Invalid protocol: ${ajv.errorsText()}`);
  }
}
```

**Tools:** Ajv (JSON Schema validation)

### Security Considerations

#### Current Security Posture

- **API Key Security:** ✅ Environment variables, not in code
- **CORS:** ⚠️ Allows all origins (development mode)
- **Authentication:** ❌ None implemented
- **Rate Limiting:** ❌ None implemented
- **Input Validation:** ⚠️ Basic checks only
- **Session Security:** ⚠️ No session encryption
- **HTTPS:** ✅ Handled by Railway/Netlify

#### Recommendations

1. **Add authentication** before production launch
2. **Implement rate limiting** per user/IP
3. **Validate all inputs** with schemas
4. **Configure CORS** for specific domains
5. **Encrypt sensitive session data** if storing user info
6. **Add request logging** for audit trails
7. **Implement CSRF protection** if using cookies

### Performance Optimization Opportunities

#### Current Performance

- Static response optimization: ~50% cost reduction
- Session TTL: Prevents memory leaks
- Conversation pruning: Limits token usage

#### Additional Optimizations

1. **Caching**

   ```typescript
   // Cache protocol content in memory
   const protocolCache = new Map<string, ParsedProtocol>();

   // Cache Claude responses for common queries
   const responseCache = new LRUCache<string, string>({
     max: 100,
     ttl: 1000 * 60 * 60, // 1 hour
   });
   ```

2. **Streaming Responses**

   ```typescript
   // Stream AI responses to frontend
   app.post('/api/walk/continue', async (req, res) => {
     res.setHeader('Content-Type', 'text/event-stream');

     const stream = await agent.processMessageStream(userMessage);
     for await (const chunk of stream) {
       res.write(`data: ${JSON.stringify(chunk)}\n\n`);
     }

     res.end();
   });
   ```

3. **Database Indexing** (if implementing persistence)

   ```sql
   CREATE INDEX idx_sessions_last_accessed ON sessions(last_accessed);
   CREATE INDEX idx_sessions_user_id ON sessions(user_id);
   ```

4. **CDN for Static Assets**
   - Already using Netlify CDN ✅
   - Consider CloudFront for additional regions

### Maintainability Suggestions

#### Documentation

1. **Add JSDoc comments** to all public methods
2. **Create architecture decision records (ADRs)** for major decisions
3. **Maintain changelog** for version tracking
4. **Document API changes** in versioned docs

#### Code Organization

1. **Extract magic numbers** to constants

   ```typescript
   const CLASSIFIER_COST = 0.0082;
   const COMPOSER_COST = 0.008;
   const SESSION_TTL_MS = 60 * 60 * 1000;
   const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
   ```

2. **Create configuration file**

   ```typescript
   // config.ts
   export const config = {
     claude: {
       model: 'claude-3-5-sonnet-20241022',
       temperature: 1.0,
       maxTokens: {
         classifier: 512,
         composer: 2048,
       },
     },
     session: {
       ttl: 60 * 60 * 1000,
       cleanupInterval: 10 * 60 * 1000,
     },
     costs: {
       classifier: 0.0082,
       composer: 0.008,
     },
   };
   ```

3. **Split large files**
   - `agent.ts` (581 lines) → Extract helper methods to separate modules
   - `server.ts` (524 lines) → Extract routes to separate files

#### Versioning

1. **Add API versioning**

   ```typescript
   app.use('/api/v1/walk', v1WalkRoutes);
   app.use('/api/v2/walk', v2WalkRoutes);
   ```

2. **Protocol versioning**
   - Already has version in frontmatter ✅
   - Implement version-specific parsers if needed

### Deployment Recommendations

#### Current Deployment

- Frontend: Netlify ✅
- Backend: Railway ✅
- Split architecture works well

#### Additional Considerations

1. **Health Checks**
   - Current `/health` endpoint ✅
   - Add deeper health checks (DB connection, API key validity)

2. **Monitoring**
   - Add Sentry for error tracking
   - Add DataDog/New Relic for APM
   - Add logging service (Logtail, Papertrail)

3. **CI/CD**
   - Add GitHub Actions for automated testing
   - Run tests before deployment
   - Automatic deployment on merge to main

4. **Environment Management**
   - Development
   - Staging
   - Production
   - Each with separate Railway projects

5. **Database Migrations** (if adding persistence)
   - Use migration tool (Prisma, TypeORM)
   - Run migrations before deployment
   - Rollback plan for failed migrations

### Scalability Considerations

#### Current Architecture

- Suitable for MVP and low-medium traffic
- In-memory sessions limit horizontal scaling

#### Scaling Path

1. **Phase 1: Current (0-1000 users)**
   - Single Railway instance
   - In-memory sessions
   - No changes needed

2. **Phase 2: Growing (1000-10,000 users)**
   - Add Redis for sessions
   - Multiple Railway instances
   - Load balancer (Railway handles this)
   - Database for conversation history

3. **Phase 3: Scale (10,000+ users)**
   - Microservices architecture
     - Session service
     - Protocol service
     - AI service
   - Message queue (RabbitMQ, SQS)
   - Distributed caching (Redis Cluster)
   - Read replicas for database

4. **Phase 4: Enterprise (100,000+ users)**
   - Kubernetes deployment
   - Auto-scaling
   - Multi-region deployment
   - CDN for API responses
   - Dedicated Claude API limits

---

## Conclusion

The Field Diagnostic Agent is a **well-architected conversational AI system** with clear separation
of concerns, strong type safety, and thoughtful optimizations. The codebase demonstrates:

**Key Strengths:**

- Clean, maintainable architecture
- Protocol-driven design enabling easy extension
- Cost-conscious optimizations
- Clear documentation
- Type safety throughout

**Primary Opportunities:**

- Add comprehensive testing
- Implement authentication and security
- Add persistent session storage
- Enable response validation
- Improve error handling

**Production Readiness:**

- **Current state:** MVP/Beta ready
- **For production:** Implement authentication, persistence, and monitoring
- **For scale:** Add Redis, improve error handling, implement analytics

The architecture provides a solid foundation for growth, with clear extension points and
well-documented patterns. The use of TypeScript, Mastra framework, and Anthropic Claude creates a
modern, maintainable AI application.

---

**End of Comprehensive Codebase Analysis**
