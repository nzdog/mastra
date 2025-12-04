# Lichen Protocol: Engineering Overview

> **For world-class engineers who already think in invariants, empathy, and rhythm**
> **Prerequisites**: Read [LICHEN_CODING_PRIMER.md](./LICHEN_CODING_PRIMER.md) first

---

## What This Is

The Lichen Protocol is a **field-level diagnostic and alignment engine** for founders and organizations. It's a stateful AI-assisted system that detects invisible constraint patterns ("fields"), guides structured transformation ("protocol walks"), and ensures coherence between stated intent and operational reality.

This is not productivity software. It's **infrastructure for human coherence under uncertainty**—a migration engine for invisible architectures that determine whether founders make decisions from exhaustion, extraction, or genuine alignment.

Unlike conventional tooling that treats symptoms through task management or analytics, Lichen operates at the **architectural level**: identifying when an entire operating regime has become misaligned and providing executable scaffolds for field change.

## Why You Matter

You are here to **encode field boundaries into infrastructure**. Every endpoint you design either preserves the field (enables coherence, respects energy, maintains agency) or corrupts it (incentivizes extraction, ignores stress, removes choice).

Your role isn't to "build features"—it's to encode the boundaries that prevent the system from becoming another source of field corruption. Every log entry either honors or betrays privacy. Every timeout either respects or dismisses human stress. Every error message either preserves or violates dignity.

The codebase you maintain is **alive**. It must evolve with the field, not drift away from it.

**The System Walks With Us.**

---

## Documentation Structure

This overview is split into focused guides:

### Core Concepts
- **[Field Model](./docs/engineering/01-field-model.md)** - What fields are, how they map to engineering concepts
- **[System Architecture](./docs/engineering/02-architecture.md)** - Layers, invariants, failure modes
- **[Protocols as Code](./docs/engineering/03-protocols.md)** - Typed workflows, state machines

### Practice
- **[Encoding Invariants](./docs/engineering/04-invariants.md)** - Mathematical, ethical, operational boundaries
- **[AI Guardrails](./docs/engineering/05-ai-guardrails.md)** - How AI is constrained and validated
- **[Operational Rhythms](./docs/engineering/06-rhythms.md)** - Daily/weekly/quarterly/annual practices

### Onboarding
- **[First 7 Days](./docs/engineering/07-onboarding.md)** - Practical plan for new engineers

---

## Quick Start (if you must)

```bash
# Day 1: Run the system
npm install
npm run build
npm test
npm start

# Walk through a protocol as a user
# Notice: Where does empathy show up? Where doesn't it?

# Day 2: Trace the invariants
grep -r "assert" src/
grep -r "consent" src/
grep -r "audit" src/

# Day 3: Make a field-preserving change
# See docs/engineering/07-onboarding.md
```

---

## Core Principle

From LICHEN_CODING_PRIMER.md:

> Every line of code serves both today's necessity and tomorrow's possibility.
> World-class development means sustainable stewardship of human trust and systemic integrity.

In Lichen terms:
- **Precision**: Type safety, validated invariants, tested boundaries
- **Empathy**: Human energy conservation, dignity preservation, stress adaptation
- **Rhythm**: Daily reviews, weekly learning, quarterly renewal, annual evolution

**You are a gardener of time in the Lichen field.**

---

_Continue reading in the [Field Model](./docs/engineering/01-field-model.md) to understand what you're building._
