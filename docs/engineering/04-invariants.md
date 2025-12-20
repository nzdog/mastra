# Encoding Invariants

> **Quick take**: Invariants are the non-negotiable boundaries that prevent the system from corrupting the field. They must be encoded, not documented.

## What is an Invariant?

An **invariant** is a condition that must **always** be true, regardless of:
- User input
- System load
- AI behavior
- External dependencies
- Developer convenience

**If an invariant can be violated, it was never an invariant—it was a guideline.**

## Three Types of Invariants

### 1. Mathematical Invariants

**Definition**: Properties that follow from logic, cryptography, or mathematics.

**Examples**:
- Session IDs are unique (UUID v4 collision probability < 10^-18)
- Timestamps are monotonically increasing
- Encryption is authenticated (AEAD)
- State transitions are atomic

**Encoding**:
```typescript
// GOOD: Enforced by type system + crypto
import { randomUUID } from 'crypto';

function createSessionId(): SessionId {
  return randomUUID() as SessionId; // Type-safe UUID
}

// BAD: Guideline, not invariant
function createSessionId(): string {
  return Date.now().toString(); // Can collide!
}
```

```typescript
// GOOD: Monotonic timestamp enforcement
class AuditLog {
  private lastTimestamp: number = 0;
  
  append(entry: LogEntry): void {
    const now = Date.now();
    if (now <= this.lastTimestamp) {
      // Wait until clock advances
      while (Date.now() <= this.lastTimestamp) {}
    }
    entry.timestamp = Date.now();
    this.lastTimestamp = entry.timestamp;
    this.writeToStorage(entry);
  }
}

// BAD: Assumes clock never goes backward
class AuditLog {
  append(entry: LogEntry): void {
    entry.timestamp = Date.now(); // Can violate monotonicity!
    this.writeToStorage(entry);
  }
}
```

### 2. Ethical Invariants

**Definition**: Properties that preserve human dignity, agency, and privacy.

**Examples**:
- No action without explicit consent
- No retention beyond stated purpose
- No surveillance through design
- No extraction through dark patterns

**Encoding**:
```typescript
// GOOD: Consent enforced at type level
type ConsentedAction<T> = {
  action: T;
  consent: ExplicitConsent;
  timestamp: number;
};

async function performAction<T>(
  action: ConsentedAction<T>
): Promise<Result<T>> {
  // Cannot be called without consent token
  await verifyConsent(action.consent);
  return executeAction(action.action);
}

// BAD: Consent as optional parameter
async function performAction(
  action: any,
  consent?: boolean
): Promise<Result> {
  if (consent) {
    await verifyConsent();
  }
  return executeAction(action); // Can execute without consent!
}
```

```typescript
// GOOD: Privacy by default
class SessionStore {
  async set(id: SessionId, session: Session): Promise<void> {
    const encrypted = await this.encrypt(session);
    await this.kv.set(id, encrypted, {
      ex: SESSION_TTL_SECONDS, // Auto-expire
    });
  }
  
  async get(id: SessionId): Promise<Session | null> {
    const encrypted = await this.kv.get(id);
    if (!encrypted) return null;
    return this.decrypt(encrypted);
  }
}

// BAD: Data persists indefinitely
class SessionStore {
  async set(id: SessionId, session: Session): Promise<void> {
    await this.kv.set(id, session); // Never expires!
  }
}
```

### 3. Operational Invariants

**Definition**: Promises the system makes about behavior under load, failure, or degradation.

**Examples**:
- p95 latency < 200ms
- 99.95% availability
- Zero data loss (for audit logs)
- Graceful degradation (never corrupt state)

**Encoding**:
```typescript
// GOOD: Timeout enforced with graceful degradation
async function getAIResponse(
  prompt: string,
  timeout: number = 5000
): Promise<Response> {
  try {
    return await Promise.race([
      this.ai.chat(prompt),
      sleep(timeout).then(() => {
        throw new TimeoutError('AI response timeout');
      }),
    ]);
  } catch (err) {
    if (err instanceof TimeoutError) {
      // Degrade to cached response
      return this.getCachedResponse(prompt);
    }
    throw err;
  }
}

// BAD: No timeout, blocks indefinitely
async function getAIResponse(prompt: string): Promise<Response> {
  return await this.ai.chat(prompt); // Can hang forever!
}
```

```typescript
// GOOD: Append-only audit log (zero data loss)
class AuditLog {
  async append(entry: LogEntry): Promise<void> {
    // Write to durable storage before returning
    await this.storage.append(entry);
    
    // Async replication (fire-and-forget)
    this.replicate(entry).catch(err => {
      console.error('Replication failed:', err);
      // Original write still succeeded
    });
  }
}

// BAD: In-memory buffer (data loss on crash)
class AuditLog {
  private buffer: LogEntry[] = [];
  
  append(entry: LogEntry): void {
    this.buffer.push(entry); // Lost on crash!
  }
  
  async flush(): Promise<void> {
    await this.storage.write(this.buffer);
    this.buffer = [];
  }
}
```

## Invariant Validation Patterns

### 1. Type-Level Enforcement

```typescript
// Prevent invalid states at compile time
type SessionState = 
  | { status: 'active'; protocol: Protocol }
  | { status: 'paused'; resumeToken: string }
  | { status: 'completed'; summary: string }
  | { status: 'expired' };

// This won't compile:
// const invalid: SessionState = { status: 'active' }; // Missing protocol!

// This will:
const valid: SessionState = {
  status: 'active',
  protocol: fieldDiagnostic,
};
```

### 2. Runtime Assertions

```typescript
class ProtocolStateMachine {
  async advance(input: string): Promise<Response> {
    // Pre-condition
    assert(this.currentStage !== null, 'Cannot advance without current stage');
    
    const next = await this.determineNextStage(input);
    
    // Post-condition
    assert(
      this.isValidTransition(this.currentStage, next),
      `Invalid transition: ${this.currentStage.id} → ${next.id}`
    );
    
    this.currentStage = next;
    return this.generateResponse();
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new InvariantViolation(message);
  }
}
```

### 3. Property-Based Testing

```typescript
import fc from 'fast-check';

describe('Session ID invariants', () => {
  it('always generates unique IDs', () => {
    fc.assert(
      fc.property(fc.nat(10000), (n) => {
        const ids = Array.from({ length: n }, () => createSessionId());
        const unique = new Set(ids);
        return ids.length === unique.size; // All unique
      })
    );
  });
});

describe('Audit log invariants', () => {
  it('maintains monotonic timestamps', () => {
    fc.assert(
      fc.property(fc.array(fc.anything()), (entries) => {
        const log = new AuditLog();
        entries.forEach(e => log.append(e));
        
        const timestamps = log.getAll().map(e => e.timestamp);
        return isSorted(timestamps); // Monotonically increasing
      })
    );
  });
});
```

## Common Invariant Violations

### ❌ Assuming User Input is Valid

```typescript
// BAD: No validation
app.post('/api/message', async (req, res) => {
  const { message } = req.body;
  const response = await ai.chat(message); // Injection risk!
  res.json(response);
});

// GOOD: Validated at boundary
app.post('/api/message', async (req, res) => {
  const messageSchema = z.string().min(1).max(10000);
  const message = messageSchema.parse(req.body.message);
  
  const response = await ai.chat(message);
  res.json(response);
});
```

### ❌ Fire-and-Forget for Critical Operations

```typescript
// BAD: Critical operation as fire-and-forget
async function createSession(): Promise<Session> {
  const session = { id: randomUUID(), ... };
  
  // If this fails, session is lost!
  this.storage.set(session.id, session).catch(err => {
    console.error('Storage failed:', err);
  });
  
  return session;
}

// GOOD: Await critical operations
async function createSession(): Promise<Session> {
  const session = { id: randomUUID(), ... };
  
  // Fail fast if storage fails
  await this.storage.set(session.id, session);
  
  return session;
}
```

### ❌ Mutable Shared State

```typescript
// BAD: Race condition
class SessionStore {
  private cache = new Map<SessionId, Session>();
  
  async get(id: SessionId): Promise<Session> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!; // Can be modified!
    }
    const session = await this.storage.get(id);
    this.cache.set(id, session);
    return session;
  }
}

// GOOD: Immutable return
class SessionStore {
  async get(id: SessionId): Promise<Readonly<Session>> {
    const session = await this.storage.get(id);
    return Object.freeze(session); // Cannot be modified
  }
}
```

## Checklist for New Code

Before merging, verify:

- [ ] **Mathematical invariants**: Type-safe? Cryptographically sound?
- [ ] **Ethical invariants**: Consent required? Privacy preserved? Agency maintained?
- [ ] **Operational invariants**: Timeouts enforced? Graceful degradation? Audit logged?
- [ ] **Validation**: User input validated at boundaries?
- [ ] **Testing**: Property-based tests for invariants?
- [ ] **Documentation**: Invariants documented in code comments?

**If you can't check all boxes, the code isn't ready.**

---

_Next: [AI Guardrails](./05-ai-guardrails.md) for constraining AI behavior._
