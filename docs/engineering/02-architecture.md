# System Architecture

> **Quick take**: Multi-layer architecture where empathy isn't a feature—it's an invariant enforced at every boundary.

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│ AI Layer (Anthropic Claude)                │
│ - Constrained by system prompts            │
│ - Validated by guardrails                  │
│ - Audited for compliance                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Protocol Layer (Typed Workflows)            │
│ - State machines for protocol walks        │
│ - Field detection logic                    │
│ - Transition validation                    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Application Layer (Express + Mastra)       │
│ - Session management                       │
│ - Empathy codec integration                │
│ - Consent enforcement                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Storage Layer (KV + Audit)                 │
│ - Encrypted session state                  │
│ - Immutable audit logs                     │
│ - Privacy-respecting retention             │
└─────────────────────────────────────────────┘
```

## Core Invariants

### Mathematical Invariants (Never Negotiable)
- Session IDs are cryptographically unique
- Timestamps are monotonically increasing
- State transitions are atomic
- Audit logs are append-only

### Ethical Invariants (Human Dignity)
- No action without explicit consent
- No retention beyond stated purpose
- No surveillance through design
- No extraction through dark patterns

### Operational Invariants (System Promises)
- p95 latency < 200ms (control must feel instant)
- p99 latency < 800ms (patience threshold)
- 99.95% availability (trust requires reliability)
- Zero data loss (field work is precious)

## Failure Modes

| Mode | Trigger | Behavior | User Experience |
|------|---------|----------|-----------------|
| **Full** | All systems nominal | AI + protocols + storage | Seamless experience |
| **Cached** | AI degraded | Use cached protocol templates | Slight delay, full functionality |
| **Readonly** | Storage write failure | Display only, no new sessions | Clear error, graceful state |
| **Export** | Critical failure | Export current state, shutdown | User retains all data |
| **Manual** | Complete outage | Fallback to PDF protocol templates | Continuity without system |

**Principle**: The system degrades toward human agency, never away from it.

## Key Design Decisions

### 1. Fire-and-Forget for Non-Critical Operations
**Why**: Email notifications must never block session creation. Human workflow > system notifications.

```typescript
// GOOD: Non-blocking
emailNotifier.notifySessionStart({...}).catch(err => log(err));

// BAD: Blocking
await emailNotifier.notifySessionStart({...});
```

### 2. Stateful Sessions with Immutable Audit
**Why**: Protocol walks require state; trust requires auditability; privacy requires deletion.

- Session state is mutable (workflow progress)
- Audit logs are immutable (compliance proof)
- Both respect retention policies (privacy law)

### 3. Empathy Codec in Request Pipeline
**Why**: Field detection must happen *before* response generation, not after.

```typescript
// Detect field state from message patterns
const fieldState = detectFieldState(userMessage);

// Adapt response accordingly
const prompt = applyEmpathyCodec(basePrompt, fieldState);
```

### 4. No User Accounts, Only Sessions
**Why**: Identity introduces surveillance risk. Sessions expire naturally.

- Sessions are ephemeral (30 days max)
- No cross-session tracking
- No behavioral profiling
- Clean deletion is default

## SLOs and Monitoring

### Response Time SLOs
- **p50 < 100ms**: Immediate feedback preserves flow state
- **p95 < 200ms**: Control feels instant
- **p99 < 800ms**: Patience threshold (urgency codec activates at p99 > 1s)

### Availability SLOs
- **99.95% uptime**: ~4 minutes downtime/month
- **RTO < 5 minutes**: Quick recovery preserves trust
- **RPO = 0**: Zero data loss (append-only logs)

### Empathy Metrics (Not Performance Metrics)
- **Stress detection accuracy**: % of stress signals caught
- **Urgency false positives**: Times we incorrectly assumed urgency
- **Rest preservation**: Sessions that completed without rushed prompts

**These are not KPIs to optimize—they're guardrails to maintain.**

## Security Model

### Data Classification
- **Public**: Protocol templates, documentation
- **Session**: Encrypted at rest, deleted after 30 days
- **Audit**: Immutable, retained per compliance requirements
- **Secrets**: Never logged, never transmitted

### Threat Model
- **XSS**: All user input escaped in HTML contexts
- **Injection**: Parameterized queries, no string concatenation
- **CSRF**: Session tokens, SameSite cookies
- **DoS**: Rate limiting, graceful degradation
- **Surveillance**: No analytics, no tracking, no profiling

**See**: [Encoding Invariants](./04-invariants.md) for implementation patterns.

## Technology Choices

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| **AI** | Anthropic Claude | Best-in-class reasoning, ethical training data |
| **Runtime** | Node.js + TypeScript | Type safety, async primitives, ecosystem |
| **Framework** | Express + Mastra | Minimal abstraction, explicit control |
| **Storage** | Vercel KV (Redis) | Low latency, simple semantics, managed |
| **Email** | Nodemailer | Standard protocol, self-hosted option |
| **Hosting** | Vercel | Zero-config deploys, edge network |

**Principle**: Choose boring technology for critical paths, experiment at edges.

## Development Workflow

```bash
# Local development
npm install
npm run dev          # Start with hot reload

# Type checking
npm run build        # Compile TypeScript

# Testing
npm test             # Unit + integration tests

# Deployment
git push origin main # Auto-deploy via Vercel
```

**See**: [Operational Rhythms](./06-rhythms.md) for daily practices.

---

_Next: [Protocols as Code](./03-protocols.md) for typed workflow implementation._
