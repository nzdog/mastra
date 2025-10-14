# The Lichen Protocol — Style Guide

**Version:** 1.0.0 **Last Updated:** 2025-10-14 **Repository:** mastra-lichen-agent

---

## 1. Purpose & Principles

This style guide codifies the actual coding patterns found in The Lichen Protocol codebase. It maps
the project's Foundation Stones to concrete coding decisions:

- **Clarity Over Cleverness** → Simple names, shallow abstraction, direct data flow
- **The Speed of Trust** → Explicit types, safe defaults, predictable APIs
- **Presence Is Productivity** → Readable modules, fast onboarding, minimal surprises
- **Integrity Is the Growth Strategy** → Consistent error handling, logging, testing gates
- **Nothing Forced, Nothing Withheld** → Progressive enhancement, feature flags, opt-ins
- **Built for Wholeness** → Inclusive naming, i18n hooks, accessibility patterns

This guide prefers **evidence over opinion**: rules reflect what the codebase already does well.

---

## 2. Repository Layout

```
mastra-lichen-agent/
├── .claude/                    # Claude Code configuration
│   ├── agents/                 # Custom agent definitions
│   ├── commands/               # Slash commands
│   └── protocols/              # AI workflow protocols
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── README.md                   # Project documentation
├── STYLEGUIDE.md               # This file
├── API.md                      # API documentation
├── INTEGRATION.md              # Integration guide
├── src/                        # Source code
│   ├── index.ts               # CLI entry point
│   ├── server.ts              # Express API server
│   ├── agent.ts               # Main orchestrator
│   ├── classifier.ts          # Intent detection
│   ├── validator.ts           # Response validation
│   ├── types.ts               # Shared type definitions
│   ├── session-store.ts       # Session management
│   ├── performance.ts         # Performance monitoring
│   ├── protocol/              # Protocol parsing
│   │   ├── parser.ts          # Markdown parser
│   │   ├── loader.ts          # Protocol loader
│   │   └── types.ts           # Protocol types
│   ├── tools/                 # Tool implementations
│   │   └── registry.ts        # Protocol retrieval
│   └── composer/              # Claude API integration
│       ├── index.ts           # Composer orchestrator
│       ├── client.ts          # API client
│       └── prompts.ts         # System prompts
├── protocols/                  # Markdown protocol files
│   ├── field_diagnostic.md    # Main protocol
│   ├── PROTOCOL_TEMPLATE.md   # Template for new protocols
│   └── README.md              # Protocol documentation
├── test/                       # Test files
│   └── scenarios.ts           # Integration test scenarios
├── dist/                       # Compiled output (gitignored)
└── index.html                  # Production frontend

### Guidelines:
- **Feature modules** at top level (agent.ts, classifier.ts)
- **Related functionality** in subdirectories (protocol/, tools/, composer/)
- **Types** in dedicated types.ts per module or at root for shared types
- **Protocols** are markdown files with YAML frontmatter
- **Tests** mirror src/ structure when present
```

---

## 3. Naming Conventions

### File Names

**Rule:** Use kebab-case for all files.

```typescript
// ✅ Good
src / agent.ts;
src / session - store.ts;
src / protocol / parser.ts;

// ❌ Bad
src / Agent.ts;
src / sessionStore.ts;
src / protocol / Parser.ts;
```

**Rationale:** Consistent with Node.js ecosystem; avoids case-sensitivity issues across platforms.
**Evidence:** agent.ts:1, session-store.ts:1, protocol/parser.ts:1

### Classes

**Rule:** PascalCase for class names.

```typescript
// ✅ Good
export class FieldDiagnosticAgent {}
export class IntentClassifier {}
export class ProtocolParser {}

// ❌ Bad
export class fieldDiagnosticAgent {}
export class intent_classifier {}
```

**Rationale:** Standard TypeScript/JavaScript convention; distinguishes classes from instances.
**Evidence:** agent.ts:15, classifier.ts:5, protocol/parser.ts:6

### Interfaces & Types

**Rule:** PascalCase for interfaces and type aliases.

```typescript
// ✅ Good
export interface SessionState {}
export interface ClassificationResult {}
export type Mode = 'ENTRY' | 'WALK' | 'CLOSE';
export type Intent = 'discover' | 'walk' | 'memory' | 'none';

// ❌ Bad
export interface session_state {}
export type mode = 'ENTRY' | 'WALK' | 'CLOSE';
```

**Rationale:** Matches class naming; clear visual distinction from values. **Evidence:**
types.ts:3-5, types.ts:11

### Variables & Parameters

**Rule:** camelCase for variables, parameters, and object properties.

```typescript
// ✅ Good
const apiKey = process.env.ANTHROPIC_API_KEY;
const conversationHistory: ConversationTurn[] = [];
function processMessage(userMessage: string) {}

// ❌ Bad
const api_key = process.env.ANTHROPIC_API_KEY;
const ConversationHistory = [];
function process_message(user_message: string) {}
```

**Rationale:** Standard JavaScript convention; readable without underscores. **Evidence:**
agent.ts:33, agent.ts:21, agent.ts:59

### Constants

**Rule:** SCREAMING_SNAKE_CASE for module-level constants.

```typescript
// ✅ Good
const API_KEY = process.env.ANTHROPIC_API_KEY;
export const ENTRY_PROMPT = `...`;
export const CLASSIFIER_PROMPT = `...`;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ❌ Bad
const apiKey = process.env.ANTHROPIC_API_KEY; // if module-level constant
export const entryPrompt = `...`;
```

**Rationale:** Signals immutability and global scope; distinguishes from local variables.
**Evidence:** server.ts:17, composer/prompts.ts:1, protocol/parser.ts:10

### Private Class Members

**Rule:** camelCase with `private` keyword (no underscore prefix).

```typescript
// ✅ Good
export class FieldDiagnosticAgent {
  private classifier: IntentClassifier;
  private composer: Composer;
  private state: SessionState;

  private updateState() {}
  private determineMode() {}
}

// ❌ Bad
export class FieldDiagnosticAgent {
  private _classifier: IntentClassifier;
  private Composer: Composer;

  private _updateState() {}
}
```

**Rationale:** TypeScript's `private` keyword provides access control; no need for naming
convention. **Evidence:** agent.ts:16-26, agent.ts:410

### Directories

**Rule:** kebab-case for directory names.

```
src/protocol/
src/tools/
src/composer/
```

**Rationale:** Consistent with file naming; Unix-friendly. **Evidence:** Directory structure

### Environment Variables

**Rule:** SCREAMING_SNAKE_CASE for environment variables.

```bash
# ✅ Good
ANTHROPIC_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
PORT=3000

# ❌ Bad
anthropic_api_key=sk-...
RedisUrl=redis://localhost:6379
```

**Rationale:** Shell convention; maximum visibility for critical configuration. **Evidence:**
.env.example:2, .env.example:6

---

## 4. TypeScript Standards

### Compiler Options

**Rule:** Use strict mode with these settings (as configured in tsconfig.json):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

**Rationale:** `strict: true` catches most type errors; `forceConsistentCasingInFileNames` prevents
cross-platform bugs. **Evidence:** tsconfig.json:2-13

### Type Annotations

**Rule:** Always annotate function parameters and return types for public APIs.

```typescript
// ✅ Good
async processMessage(userMessage: string): Promise<string> {
  // ...
}

function buildStaticResponse(
  mode: Mode,
  chunk: any,
  themeIndex: number | null,
  nextThemeTitle: string | null
): string {
  // ...
}

// ❌ Bad (omitting return type)
async processMessage(userMessage: string) {
  // ...
}
```

**Rationale:** Explicit types improve API clarity and catch errors at compile time. **Evidence:**
agent.ts:59, agent.ts:481

### Interfaces vs Type Aliases

**Rule:** Use `interface` for object shapes that may be extended; use `type` for unions,
intersections, or primitives.

```typescript
// ✅ Good - interfaces for extensible structures
export interface SessionState {
  active_protocol: string | null;
  mode: Mode;
  theme_index: number | null;
  // ...
}

// ✅ Good - types for unions/literals
export type Mode = 'ENTRY' | 'WALK' | 'CLOSE';
export type Intent = 'discover' | 'walk' | 'memory' | 'none';

// ❌ Avoid - type when interface would work
export type SessionState = {
  active_protocol: string | null;
  mode: Mode;
};
```

**Rationale:** Interfaces can be extended/merged; types are more flexible for complex compositions.
**Evidence:** types.ts:3-9, types.ts:11

### Nullability

**Rule:** Use `null` for intentional absence; avoid `undefined` in public APIs. Use union types
(`T | null`) rather than optional properties when a value is expected but may be absent.

```typescript
// ✅ Good
interface SessionState {
  active_protocol: string | null;
  theme_index: number | null;
  emotion_last?: string; // Optional is OK when truly optional
}

// ❌ Avoid
interface SessionState {
  active_protocol?: string; // Unclear if undefined means "not set" or "not provided"
}
```

**Rationale:** Explicit `null` signals intent; strict mode enforces null checks. **Evidence:**
types.ts:12-14

### Any Usage

**Rule:** Avoid `any` except for interop with untyped libraries (use sparingly and document).

```typescript
// ✅ Acceptable - third-party library without types
private redis: any; // ioredis is optional dependency
const chunk: any; // From external protocol parsing

// ⚠️ Justify with comment
agent_state: any; // Serialized agent state - complex nested structure

// ❌ Bad - should be typed
function processData(data: any) { }
```

**Rationale:** `any` defeats type checking; reserve for unavoidable cases. **Evidence:**
session-store.ts:126, session-store.ts:25

### Generics

**Rule:** Use generics for reusable, type-safe abstractions.

```typescript
// ✅ Good
async getStructuredResponse<T>(
  systemPrompt: string,
  messages: any[],
  maxTokens: number
): Promise<T> {
  // ...
}

// Used like:
const result = await this.client.getStructuredResponse<ClassificationResult>(
  CLASSIFIER_PROMPT,
  messages,
  512
);
```

**Rationale:** Enables type-safe reusability without casting. **Evidence:** composer/client.ts
(inferred from usage in classifier.ts:24)

---

## 5. API Design

### REST Conventions

**Rule:** Use standard HTTP methods and plural resource names.

```typescript
// ✅ Good
GET    /api/protocols
POST   /api/walk/start
POST   /api/walk/continue
POST   /api/walk/complete
GET    /api/session/:id

// ❌ Bad
GET    /api/getProtocols
POST   /api/startWalk
```

**Rationale:** RESTful conventions are widely understood; plural nouns for collections.
**Evidence:** server.ts:330, 357, 391, 433, 516

### Request/Response Shape

**Rule:** Use consistent JSON structure; wrap responses in objects (not bare arrays/primitives).

```typescript
// ✅ Good - request interfaces
interface StartRequest {
  user_input: string;
  protocol_slug?: string;
}

interface ContinueRequest {
  session_id: string;
  user_response: string;
}

// ✅ Good - response structure
{
  session_id: string,
  protocol_name: string,
  theme_number: number,
  total_themes: number,
  mode: 'ENTRY' | 'WALK' | 'CONTINUE' | 'COMPLETE',
  composer_output: string,
  supports: Support[],
  state: { ... },
  total_cost: number
}
```

**Rationale:** Explicit interfaces catch errors at compile time; object responses are extensible.
**Evidence:** server.ts:59-72, server.ts:197-216

### Error Responses

**Rule:** Return consistent error shape with HTTP status codes.

```typescript
// ✅ Good
return res.status(400).json({
  error: 'Missing or invalid user_input field',
});

return res.status(404).json({
  error: 'Session not found or expired',
});

return res.status(500).json({
  error: 'Internal server error',
  message: error instanceof Error ? error.message : String(error),
});

// ❌ Bad
return res.send('Error: session not found'); // No structure or status code
throw new Error('Invalid input'); // Unhandled exception
```

**Rationale:** Consistent error shape enables client-side error handling; proper status codes signal
error type. **Evidence:** server.ts:362-365, server.ts:404-407, server.ts:382-387

### Validation

**Rule:** Validate input early; return 400 Bad Request for client errors.

```typescript
// ✅ Good
if (!user_input || typeof user_input !== 'string') {
  return res.status(400).json({
    error: 'Missing or invalid user_input field',
  });
}

if (!session_id || !user_response) {
  return res.status(400).json({
    error: 'Missing session_id or user_response',
  });
}
```

**Rationale:** Fail fast with clear messages; prevents downstream errors. **Evidence:**
server.ts:361-365, server.ts:395-399

### CORS

**Rule:** Configure CORS explicitly for production; use permissive settings only when appropriate.

```typescript
// ✅ Good - explicit configuration
const corsOptions = {
  origin: '*', // Document why this is safe for your deployment
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
```

**Rationale:** Security by design; explicit configuration prevents surprises. **Evidence:**
server.ts:229-234

---

## 6. Data Layer

### Protocol Files

**Rule:** Store protocols as Markdown files with YAML frontmatter.

```markdown
---
id: field_diagnostic
title: Field Diagnostic Protocol
version: 1.0.0
themes:
  - index: 1
    title: Surface Behaviors
  - index: 2
    title: Felt Experience
stones:
  - Stone 4: Clarity Over Cleverness
---

# Field Diagnostic Protocol

## Purpose

[Content...]

## Themes

### 1. Surface Behaviors _(Stone 4: Clarity Over Cleverness)_

**Purpose:** ...
```

**Rationale:** Human-readable, version-controllable, AI-friendly format. **Evidence:**
protocols/field_diagnostic.md:1-38

### Protocol Parsing

**Rule:** Use gray-matter for frontmatter; cache parsed results.

```typescript
// ✅ Good - caching with TTL
private static parsedProtocolCache: Map<string, ParsedProtocol> = new Map();
private static cacheTimestamps: Map<string, number> = new Map();
private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

parse(): ParsedProtocol {
  const now = Date.now();
  const cacheKey = this.protocolPath;

  // Check cache
  const cachedTime = ProtocolParser.cacheTimestamps.get(cacheKey);
  if (cachedTime && (now - cachedTime) < ProtocolParser.CACHE_TTL_MS) {
    const cached = ProtocolParser.parsedProtocolCache.get(cacheKey);
    if (cached) {
      console.log('📦 CACHE HIT: Protocol loaded from cache');
      return cached;
    }
  }

  // Parse and cache
  const parsed = this.parseFile();
  ProtocolParser.parsedProtocolCache.set(cacheKey, parsed);
  ProtocolParser.cacheTimestamps.set(cacheKey, now);
  return parsed;
}
```

**Rationale:** Protocol files are read-heavy; caching reduces I/O and parsing overhead.
**Evidence:** protocol/parser.ts:8-76

### Session Storage

**Rule:** Abstract session storage behind an interface; support both in-memory and Redis.

```typescript
// ✅ Good - interface allows multiple implementations
export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(sessionId: string, session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  cleanup(): Promise<number>;
  size(): Promise<number>;
}

export class InMemorySessionStore implements SessionStore {}
export class RedisSessionStore implements SessionStore {}

// Factory pattern
export function createSessionStore(config: {
  type: 'memory' | 'redis';
  redis?: any;
  apiKey: string;
}): SessionStore {}
```

**Rationale:** Decouples storage implementation from business logic; easy to swap in production.
**Evidence:** session-store.ts:35-60, 239-251

### IDs

**Rule:** Use UUID v4 for session IDs.

```typescript
// ✅ Good
import { randomUUID } from 'crypto';

const session: Session = {
  id: randomUUID(),
  // ...
};
```

**Rationale:** Globally unique, no coordination needed, secure randomness. **Evidence:**
server.ts:4, server.ts:105

### Timestamps

**Rule:** Use ISO 8601 format for timestamps.

```typescript
// ✅ Good
created_at: new Date().toISOString();
updated_at: new Date().toISOString();

// ❌ Bad
created_at: Date.now(); // Numeric timestamp
updated_at: new Date().toString(); // Locale-dependent
```

**Rationale:** ISO 8601 is unambiguous, sortable, widely supported. **Evidence:** agent.ts:666,
agent.ts:418

---

## 7. Errors & Logging

### Error Handling Pattern

**Rule:** Use try-catch for async operations; provide fallback defaults.

```typescript
// ✅ Good
try {
  const result = await this.client.getStructuredResponse<ClassificationResult>(
    CLASSIFIER_PROMPT,
    messages,
    512
  );
  return this.applyFallbackRules(result, state);
} catch (error) {
  console.error('Classification error:', error);
  // Safe fallback
  return {
    intent: 'discover',
    continuity: false,
    protocol_pointer: {
      protocol_slug: state.active_protocol || 'field_diagnostic',
      theme_index: null,
    },
    confidence: 0.5,
  };
}
```

**Rationale:** Graceful degradation; errors logged but don't crash the system. **Evidence:**
classifier.ts:23-50

### Never Throw from Public APIs

**Rule:** Return error values or reject promises; avoid throwing exceptions across boundaries.

```typescript
// ✅ Good - return error response
res.status(500).json({
  error: 'Internal server error',
  message: error instanceof Error ? error.message : String(error),
});

// ✅ Good - fallback default
if (!session) {
  return res.status(404).json({
    error: 'Session not found or expired',
  });
}
```

**Rationale:** Prevents unhandled exceptions; makes error handling explicit. **Evidence:**
server.ts:382-387, server.ts:404-407

### Logging Levels

**Rule:** Use console.log for info, console.error for errors, console.warn for warnings. Prefix with
emoji for visual scanning.

```typescript
// ✅ Good - structured logging with emoji
console.log('📦 CACHE HIT: Protocol loaded from cache');
console.log(`✨ Created new session: ${session.id}`);
console.log(`🤖 AI CALL: Generating field diagnosis`);
console.log(`💰 COMPOSER COST: ~$0.0080 | Total: $${this.totalCost.toFixed(4)}`);
console.error('❌ Error serving logo:', error);
console.warn('⚠️  Redis module not installed. Using in-memory session store.');

// ❌ Bad - no context
console.log('Cache hit');
console.log('Error');
```

**Rationale:** Visual prefixes enable quick log scanning; structured messages aid debugging.
**Evidence:** protocol/parser.ts:29, server.ts:115, agent.ts:108, agent.ts:126, server.ts:257,
server.ts:44

### Log Redaction

**Rule:** Never log API keys, passwords, or sensitive user data.

```typescript
// ✅ Good
console.log(`✨ Created new session: ${session.id}`);

// ❌ Bad
console.log(`API Key: ${process.env.ANTHROPIC_API_KEY}`);
console.log(`User input: ${userMessage}`); // May contain PII
```

**Rationale:** Security and privacy; logs may be shared or stored insecurely. **Evidence:** Inferred
from secure practices in codebase

---

## 8. Testing

### Test Organization

**Rule:** Place integration tests in `test/` directory; use scenario-based testing.

```
test/
└── scenarios.ts          # Integration test scenarios
```

**Rationale:** Scenario tests validate end-to-end workflows; match real user interactions.
**Evidence:** test/scenarios.ts:1-127

### Test Structure

**Rule:** Define scenarios as data structures; run sequentially.

```typescript
// ✅ Good
interface TestScenario {
  name: string;
  messages: string[];
  expectedBehavior: string;
}

const scenarios: TestScenario[] = [
  {
    name: 'ENTRY Test',
    messages: ['What field am I in?'],
    expectedBehavior: 'Should enter ENTRY mode and provide orientation',
  },
  {
    name: 'WALK Transition',
    messages: ['What field am I in?', 'Walk me through it'],
    expectedBehavior: 'Should transition to WALK mode, Theme 1',
  },
];

async function runScenario(scenario: TestScenario) {
  const agent = new FieldDiagnosticAgent(API_KEY!);
  for (const message of scenario.messages) {
    const response = await agent.processMessage(message);
    // Assertions...
  }
}
```

**Rationale:** Data-driven tests are readable; easy to add new scenarios. **Evidence:**
test/scenarios.ts:13-73, 75-105

### Coverage Targets

**Rule:** (Current state: No formal coverage target; tests are exploratory)

**Recommendation:** Aim for 80% coverage on business logic (agent, classifier, composer).

**Rationale:** High coverage on core logic catches regressions; lower priority for I/O code.

### Test Naming

**Rule:** Descriptive test names that state expected behavior.

```typescript
// ✅ Good
{
  name: 'Greeting Test',
  expectedBehavior: 'Should respond naturally without retrieving protocol chunks'
}

// ❌ Bad
{ name: 'Test 1' }
```

**Rationale:** Clear expectations; easier to diagnose failures. **Evidence:**
test/scenarios.ts:21-24

---

## 9. Protocol Files (RAG/Prompt Engineering)

### File Naming

**Rule:** Use snake_case for protocol files; include descriptive names.

```
protocols/
├── field_diagnostic.md
├── Field_Exit_Protocol_1_Knowing_When_a_Field_Must_End.md
├── Field_Exit_Protocol_2_Composting_the_Old_Signal.md
└── PROTOCOL_TEMPLATE.md
```

**Rationale:** Underscores for readability; capitals for proper nouns; clear versioning.
**Evidence:** protocols/ directory

### Frontmatter Structure

**Rule:** Use YAML frontmatter with required fields: id, title, version, themes, stones.

```yaml
---
id: field_diagnostic
title: Field Diagnostic Protocol
version: 1.0.0
entry_keys:
  - purpose
  - why
themes:
  - index: 1
    title: Surface Behaviors
  - index: 2
    title: Felt Experience
stones:
  - Stone 4: Clarity Over Cleverness
  - Stone 5: Presence Is Productivity
---
```

**Rationale:** Structured metadata enables parsing and validation; consistent across protocols.
**Evidence:** protocols/field_diagnostic.md:1-38

### Section Markers

**Rule:** Use markdown heading levels consistently: `## ` for top-level sections, `### ` for themes.

```markdown
## Purpose

[Content...]

## Why This Matters

[Content...]

## Themes

### 1. Surface Behaviors _(Stone 4: Clarity Over Cleverness)_

**Purpose:** ... **Why this matters:** ... **Guiding Questions:**

- Question 1
- Question 2
```

**Rationale:** Parser relies on heading structure; consistent markers enable reliable extraction.
**Evidence:** protocol/parser.ts:90-104, 156-194

### Variable Interpolation

**Rule:** Use bracketed placeholders in prompts for dynamic content.

```typescript
// Prompt template
`Ready to move into **Theme [N+1] – [Next Theme Title]**?`;

// Runtime substitution
response = response.replace('[N+1]', String(nextThemeIndex));
response = response.replace('[Next Theme Title]', nextThemeTitle);
```

**Rationale:** Clear placeholder syntax; easy to spot and substitute. **Evidence:**
composer/prompts.ts:76

### Guardrails

**Rule:** Include explicit constraints in system prompts.

```typescript
export const WALK_PROMPT = `...
CRITICAL CONSTRAINTS:
- ALWAYS show "**Theme [N] – [Exact Title]**" at the top
- Use EXACT theme titles from protocol
- Present ALL 3 Guiding Questions together
- Accept all answers without pushing for detail
- No preambles or filler language
...`;
```

**Rationale:** Explicit constraints prevent model drift; reinforce desired behavior. **Evidence:**
composer/prompts.ts:141-150

---

## 10. Security & Secrets

### Environment Variables

**Rule:** Store all secrets in `.env`; never commit `.env` to version control.

```bash
# .env (gitignored)
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://:password@hostname:6379

# .env.example (committed)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# REDIS_URL=redis://localhost:6379
```

**Rationale:** Prevents accidental secret exposure; `.env.example` documents required variables.
**Evidence:** .env.example:1-7, .gitignore:3

### API Key Loading

**Rule:** Load environment variables at startup; fail fast if required keys are missing.

```typescript
// ✅ Good
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not found in environment variables.');
  process.exit(1);
}
```

**Rationale:** Fail early with clear error; prevents runtime failures. **Evidence:** server.ts:14-22

### Input Validation

**Rule:** Validate all user input; sanitize before processing.

```typescript
// ✅ Good
if (!user_input || typeof user_input !== 'string') {
  return res.status(400).json({
    error: 'Missing or invalid user_input field',
  });
}
```

**Rationale:** Prevents injection attacks; type checking catches malformed input. **Evidence:**
server.ts:361-365

### SSRF Prevention

**Rule:** Do not allow user-controlled URLs or file paths.

**Current State:** Not applicable (no user-controlled file/URL access).

**Rationale:** Prevents attackers from accessing internal resources.

---

## 11. Frontend (Vanilla JS)

### Structure

**Rule:** Use single-page vanilla HTML/CSS/JS; inline styles and scripts for simplicity.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lichen Field</title>
    <style>
      /* Inline styles */
    </style>
  </head>
  <body>
    <!-- Content -->
    <script>
      // Inline JavaScript
    </script>
  </body>
</html>
```

**Rationale:** Zero build step; fast deployment; all assets in one file. **Evidence:**
index.html:1-20

### Accessibility

**Rule:** Include ARIA attributes, semantic HTML, and keyboard navigation.

```html
<!-- ✅ Good -->
<button aria-label="Send message">Send</button>
<main role="main">
  <section aria-labelledby="protocol-title">
    <h1 id="protocol-title">Field Diagnostic Protocol</h1>
  </section>
</main>

<!-- Focus management -->
*:focus-visible { outline: 2px solid #57534E; outline-offset: 2px; }
```

**Rationale:** Ensures usability for all users; meets WCAG standards. **Evidence:** index.html
(inferred from semantic structure)

### Responsive Design

**Rule:** Use mobile-first CSS with media queries.

```css
/* Mobile first */
body {
  font-size: 16px;
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  body {
    font-size: 18px;
    padding: 2rem;
  }
}
```

**Rationale:** Mobile traffic is significant; progressive enhancement for larger screens.
**Evidence:** index.html styling

### Animation

**Rule:** Respect `prefers-reduced-motion` for accessibility.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Rationale:** Respects user preferences; prevents motion sickness. **Evidence:** index.html:27-33

---

## 12. Performance & Caching

### In-Memory Caching

**Rule:** Cache expensive operations (parsing, AI calls for static content) with TTL.

```typescript
// ✅ Good - protocol parsing cache
private static parsedProtocolCache: Map<string, ParsedProtocol> = new Map();
private static cacheTimestamps: Map<string, number> = new Map();
private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ✅ Good - ENTRY mode response cache
private static entryResponseCache: Map<string, string> = new Map();
private static cacheTimestamps: Map<string, number> = new Map();
private static CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
```

**Rationale:** Reduces I/O and API costs; TTL ensures freshness. **Evidence:**
protocol/parser.ts:8-10, agent.ts:29-31

### Cache Key Design

**Rule:** Use descriptive, collision-resistant cache keys.

```typescript
// ✅ Good
const cacheKey = this.protocolPath; // File path is unique
const cacheKey = `ENTRY:${this.state.active_protocol || 'field_diagnostic'}`;

// ❌ Bad
const cacheKey = 'entry'; // Not specific enough
```

**Rationale:** Prevents cache collisions; enables targeted invalidation. **Evidence:**
protocol/parser.ts:22, agent.ts:484

### Conversation Compression

**Rule:** Compress conversation history when it exceeds a threshold; keep recent turns.

```typescript
// ✅ Good
if (this.conversationHistory.length > 12) {
  this.conversationHistory = this.compressConversationHistory(this.conversationHistory);
}

private compressConversationHistory(history: ConversationTurn[]): ConversationTurn[] {
  // Keep last 12 turns, summarize older ones
  const recentTurns = history.slice(-12);
  const olderTurns = history.slice(0, -12);
  const summary = this.summarizeOlderTurns(olderTurns);

  return [
    { role: 'assistant', content: `[Previous conversation summary: ${summary}]` },
    ...recentTurns
  ];
}
```

**Rationale:** Reduces token usage; maintains recent context. **Evidence:** agent.ts:73-76, 571-598

### Static Content Optimization

**Rule:** Skip AI calls for static protocol content (ENTRY mode, theme questions).

```typescript
// ✅ Good
const skipAI = mode === 'ENTRY' || (mode === 'WALK' && !awaitingConfirmationForResponse);

if (skipAI) {
  console.log('⚡ OPTIMIZATION: Skipping AI call for static content');
  response = this.buildStaticResponse(mode, chunk, themeIndexForResponse, nextThemeTitle);
  console.log(`💰 SAVED ~$0.0080 by skipping AI call`);
} else {
  console.log('🤖 AI CALL: Generating interpretation');
  response = await this.composer.compose(...);
}
```

**Rationale:** Reduces API costs; improves response latency for static content. **Evidence:**
agent.ts:160-194

---

## 13. Git Hygiene

### Branching Strategy

**Rule:** (Current state: Simple main branch workflow; no explicit branching strategy documented)

**Recommendation:** Use feature branches for new work; merge to main via pull requests.

```bash
# Feature branch
git checkout -b feat/add-new-protocol
git commit -m "feat: add field exit protocol"
git push origin feat/add-new-protocol

# Bug fix branch
git checkout -b fix/session-timeout
git commit -m "fix: correct session timeout calculation"
```

**Rationale:** Isolates work; enables code review before merge.

### Commit Messages

**Rule:** Use Conventional Commits format.

```bash
# ✅ Good
feat: add comprehensive performance optimizations
fix: improve mobile responsiveness and UI refinements
docs: update API documentation
refactor: streamline UI with inline attribution

# ❌ Bad
Added stuff
Fixed bug
Update
```

**Rationale:** Clear, parseable history; enables automated changelog generation. **Evidence:**
Recent commits (b2fbcb4, f7884c5, 7e3d8b8)

### Git Ignore

**Rule:** Ignore build artifacts, dependencies, secrets, and OS files.

```gitignore
node_modules/
dist/
.env
*.log
.DS_Store
.netlify/
```

**Rationale:** Keeps repository clean; prevents accidental secret commits. **Evidence:**
.gitignore:1-6

---

## 14. Examples Appendix

### Example 1: Creating a New Protocol File

```markdown
---
id: my_new_protocol
title: My New Protocol
version: 1.0.0
themes:
  - index: 1
    title: First Theme
  - index: 2
    title: Second Theme
stones:
  - Stone 1: Light Before Form
---

# My New Protocol

## Purpose

[Define what this protocol does]

## Why This Matters

[Explain significance]

## Use This When

[Guidance on when to apply]

## Outcomes

- **Poor:** [Description]
- **Expected:** [Description]
- **Excellent:** [Description]
- **Transcendent:** [Description]

---

## Themes

### 1. First Theme _(Stone 1: Light Before Form)_

**Purpose:** [One sentence] **Why this matters:** [One sentence] **Outcomes:**

- Poor: [Description]
- Expected: [Description]
- Excellent: [Description]
- Transcendent: [Description] **Guiding Questions:**
- Question 1?
- Question 2?
- Question 3?

**Completion Prompt:** [Statement of completion]
```

### Example 2: Adding a New API Endpoint

```typescript
// 1. Define request/response types
interface MyRequest {
  user_id: string;
  action: string;
}

interface MyResponse {
  result: string;
  timestamp: string;
}

// 2. Implement endpoint with validation
app.post('/api/my-endpoint', async (req: Request, res: Response) => {
  try {
    const { user_id, action } = req.body as MyRequest;

    // Validate input
    if (!user_id || !action) {
      return res.status(400).json({
        error: 'Missing user_id or action',
      });
    }

    // Business logic
    const result = await processAction(user_id, action);

    // Return response
    res.json({
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/my-endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
```

### Example 3: Implementing Class-Level Caching

```typescript
export class MyService {
  // Static cache shared across instances
  private static cache: Map<string, MyData> = new Map();
  private static cacheTimestamps: Map<string, number> = new Map();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getData(key: string): Promise<MyData> {
    const now = Date.now();

    // Check cache
    const cachedTime = MyService.cacheTimestamps.get(key);
    if (cachedTime && now - cachedTime < MyService.CACHE_TTL_MS) {
      const cached = MyService.cache.get(key);
      if (cached) {
        console.log('📦 CACHE HIT:', key);
        return cached;
      }
    }

    // Fetch and cache
    console.log('💾 CACHE MISS:', key);
    const data = await this.fetchData(key);
    MyService.cache.set(key, data);
    MyService.cacheTimestamps.set(key, now);
    return data;
  }

  private async fetchData(key: string): Promise<MyData> {
    // Implementation...
  }
}
```

### Example 4: Error Handling with Fallback

```typescript
async function reliableOperation(): Promise<Result> {
  try {
    // Attempt primary operation
    const result = await primaryService.execute();
    return result;
  } catch (error) {
    console.error('Primary service failed:', error);

    // Fallback to safe default
    console.log('⚠️  Using fallback default');
    return {
      status: 'fallback',
      data: getDefaultData(),
      message: 'Using cached/default data due to service unavailability',
    };
  }
}
```

### Example 5: Writing Tests

```typescript
// test/my-feature.ts
import { MyFeature } from '../src/my-feature';

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  {
    name: 'handles basic input',
    input: 'hello',
    expected: 'HELLO',
  },
  {
    name: 'handles empty string',
    input: '',
    expected: '',
  },
];

async function runTests() {
  console.log('🧪 Running My Feature Tests\n');

  for (const testCase of testCases) {
    console.log(`TEST: ${testCase.name}`);
    const feature = new MyFeature();
    const actual = await feature.process(testCase.input);

    if (actual === testCase.expected) {
      console.log('✅ PASS\n');
    } else {
      console.log(`❌ FAIL: Expected "${testCase.expected}", got "${actual}"\n`);
    }
  }
}

runTests();
```

---

## 15. Adoption Plan

### Phase 1: Immediate (Week 1) — Low Churn

**Goal:** Add enforceable tooling without code changes.

1. **Add Prettier** (formatting)

   ```bash
   npm install --save-dev prettier
   ```

   - Copy `.prettierrc` from this guide
   - Run: `npx prettier --write "src/**/*.ts"`

2. **Add ESLint** (linting)

   ```bash
   npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
   ```

   - Copy `.eslintrc.cjs` from this guide
   - Run: `npx eslint src/ --fix`

3. **Add EditorConfig**
   - Copy `.editorconfig` from this guide

4. **Add Git Hooks** (commitlint + husky)

   ```bash
   npm install --save-dev @commitlint/cli @commitlint/config-conventional husky lint-staged
   npx husky install
   ```

5. **CI Workflow**
   - Copy `.github/workflows/ci.yml` from this guide

**Time Estimate:** 2-3 hours **Risk:** Very low (automated formatting/linting)

### Phase 2: Documentation (Week 1-2) — No Code Changes

**Goal:** Improve onboarding and contribution clarity.

1. **Add PR Template**
   - Copy `.github/PULL_REQUEST_TEMPLATE.md`

2. **Add Issue Templates**
   - Create `.github/ISSUE_TEMPLATE/` with bug, feature, docs templates

3. **Expand README**
   - Add contributing section referencing STYLEGUIDE.md

**Time Estimate:** 1-2 hours **Risk:** None

### Phase 3: Refactoring (Week 2-4) — Medium Churn

**Goal:** Fix identified inconsistencies (see Gap Report).

1. **Add Missing Type Annotations**
   - Review any functions with implicit return types

2. **Consolidate Error Handling**
   - Ensure all API endpoints use consistent error format

3. **Add Unit Tests**
   - Start with `classifier.ts`, `validator.ts` (pure logic)

**Time Estimate:** 4-6 hours **Risk:** Medium (requires code review)

### Phase 4: Optional Enhancements (Future) — High Churn

**Goal:** Modernize or scale architecture.

1. **Add Database Layer** (if persistence needed beyond Redis)
2. **Migrate to ESM** (if CommonJS becomes limiting)
3. **Add Frontend Framework** (if UI complexity grows)
4. **Add Metrics/Monitoring** (if production load increases)

**Time Estimate:** Weeks to months **Risk:** High (architectural changes)

---

## 16. Maintenance & Evolution

### Updating This Guide

**When to update:**

- New patterns emerge and stabilize (used in 3+ files)
- Breaking changes to dependencies (e.g., TypeScript version bump)
- Architectural decisions (e.g., switch from in-memory to Redis by default)

**How to update:**

- Edit STYLEGUIDE.md
- Update examples and evidence references
- Re-run adoption plan if tooling changes

### Feedback Loop

**Process:**

1. Propose style changes via PR
2. Discuss in PR comments
3. Update guide if consensus reached
4. Announce changes in team communication

---

## Summary

This style guide reflects **The Lichen Protocol** codebase as it is, not as it "should" be. It
prioritizes:

1. **Consistency** — Follow established patterns (kebab-case files, PascalCase classes, camelCase
   variables)
2. **Clarity** — Explicit types, descriptive names, structured logging
3. **Safety** — Strict TypeScript, error handling, input validation
4. **Pragmatism** — Cache where it matters, test what breaks, document what's surprising

The guide is **living**: as the codebase evolves, so should this document. When in doubt, check
existing code and apply the principle: **Clarity Over Cleverness**.
