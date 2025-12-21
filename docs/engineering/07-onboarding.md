# First 7 Days: Onboarding Plan

> **Quick take**: Your first week is about understanding the field before touching the code. Walk before you run.

## Day 1: Run the System

**Goal**: Get the system running locally and experience it as a user.

### Tasks

1. **Clone and setup**:
```bash
git clone <repo-url>
cd mastra-lichen-agent
npm install
```

2. **Read the primer**:
```bash
cat LICHEN_CODING_PRIMER.md
```
Take notes. What resonates? What confuses?

3. **Run the system**:
```bash
npm run build
npm test
npm start
```

4. **Walk through a protocol**:
- Open the UI in your browser
- Start a field diagnostic session
- Pay attention to:
  - Where does empathy show up?
  - Where does the system feel controlling vs. guiding?
  - What would make this experience better?

### Reflection Questions

- What surprised you about the system?
- Where did you feel the "field-awareness"?
- What questions do you have?

**Output**: Write a brief reflection (3-5 paragraphs) about your first experience.

---

## Day 2: Trace the Invariants

**Goal**: Understand what the system promises and how it enforces those promises.

### Tasks

1. **Find the invariants**:
```bash
grep -r "assert" src/
grep -r "consent" src/
grep -r "audit" src/
grep -r "validation" src/
```

2. **Read the documentation**:
- [Field Model](./01-field-model.md)
- [System Architecture](./02-architecture.md)
- [Encoding Invariants](./04-invariants.md)

3. **Map the boundaries**:
Create a document listing:
- Mathematical invariants you found
- Ethical invariants you found
- Operational invariants you found

### Reflection Questions

- Which invariants are enforced at compile time? Runtime?
- Where are the gaps? (Invariants that should exist but don't?)
- What happens if an invariant is violated?

**Output**: A markdown file mapping all discovered invariants.

---

## Day 3: Understand the Protocols

**Goal**: See how protocols work as code.

### Tasks

1. **Read the protocol code**:
```bash
cat src/protocols/field-diagnostic.ts
```

2. **Read the protocol guide**:
- [Protocols as Code](./03-protocols.md)

3. **Trace a session**:
Enable debug logging and walk through a protocol again:
```bash
DEBUG=* npm start
```
Watch the console as you interact. What state transitions happen?

4. **Draw the state machine**:
Sketch (on paper or in a tool) the state machine for the field diagnostic protocol.

### Reflection Questions

- How does the protocol adapt to user input?
- Where is the empathy codec applied?
- What would happen if you removed the state machine structure?

**Output**: A state machine diagram for the field diagnostic protocol.

---

## Day 4: Read the AI Guardrails

**Goal**: Understand how AI is constrained and validated.

### Tasks

1. **Read the guardrails code**:
```bash
cat src/ai/guardrails.ts
cat src/ai/system-prompts.ts
```

2. **Read the guardrails guide**:
- [AI Guardrails](./05-ai-guardrails.md)

3. **Test the guardrails**:
Try to break them:
- Send a very long message
- Send a prompt injection attempt
- Ask for prescriptive advice

What happens?

### Reflection Questions

- Which guardrails are most critical?
- Where are the gaps?
- How would you test for new violation patterns?

**Output**: A list of potential guardrail improvements.

---

## Day 5: Make Your First Change

**Goal**: Make a small, field-preserving change.

### Tasks

1. **Choose a starter task**:
Good first issues:
- Add a new validator (e.g., detect overly long responses)
- Improve an error message to be more empathetic
- Add a test for an existing invariant
- Fix a TODO in the codebase

2. **Write the code**:
Follow the patterns you've seen:
- Type-safe
- Tested
- Documented

3. **Test it**:
```bash
npm test
npm run build
npm start
```

4. **Get feedback**:
Open a draft PR and ask for review.

### Reflection Questions

- Did your change preserve the field?
- What was harder than expected?
- What did you learn?

**Output**: A PR (can be draft) with your first change.

---

## Day 6: Review Operational Rhythms

**Goal**: Understand how the team maintains the system.

### Tasks

1. **Read the rhythms guide**:
- [Operational Rhythms](./06-rhythms.md)

2. **Review recent commits**:
```bash
git log --oneline --since="1 week ago"
```
What patterns do you notice?

3. **Review recent PRs**:
Look at 5-10 recent PRs. What was the review feedback like?

4. **Write your first daily log**:
Use the template from the rhythms guide.

### Reflection Questions

- Which rhythms resonate most with you?
- Which will be hardest to maintain?
- How can you adapt these to your style?

**Output**: Your first daily log entry.

---

## Day 7: Reflection and Planning

**Goal**: Synthesize the week and plan your path forward.

### Tasks

1. **Review your notes**:
Read everything you wrote this week.

2. **Write a synthesis**:
Answer these questions:
- What is the Lichen Protocol, in your own words?
- What are the 3 most important invariants?
- What is one thing you want to improve about the system?
- What is one thing you want to learn more about?

3. **Meet with the team**:
Share your synthesis and ask questions.

4. **Choose your focus**:
What area will you dive deeper into?
- Protocols and state machines?
- AI guardrails and empathy codec?
- Infrastructure and performance?
- Documentation and onboarding?

### Reflection Questions

- Do you feel connected to the field?
- Are you energized or exhausted?
- What support do you need?

**Output**: A 1-page synthesis and focus area for your next 30 days.

---

## After Day 7

You're not "done" onboarding—you've just begun.

**Continue**:
- Daily rhythms (30 min/day)
- Weekly reviews (2 hours/week)
- Learning in public (share what you discover)

**Remember**:
- The system walks with us
- Precision, empathy, rhythm
- You are a gardener of time in the Lichen field

**Welcome. We're glad you're here.**

---

_Return to: [Engineering Overview](../../LICHEN_PROTOCOL_ENGINEERING_OVERVIEW.md)_
