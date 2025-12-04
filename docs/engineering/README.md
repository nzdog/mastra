# Engineering Documentation

Detailed guides for engineers working on the Lichen Protocol.

## Reading Order

1. [Field Model](./01-field-model.md) - Understanding fields as engineering concepts
2. [System Architecture](./02-architecture.md) - Layers, invariants, failure modes
3. [Protocols as Code](./03-protocols.md) - Typed workflows and state machines
4. [Encoding Invariants](./04-invariants.md) - Mathematical, ethical, operational
5. [AI Guardrails](./05-ai-guardrails.md) - Constraining and validating AI
6. [Operational Rhythms](./06-rhythms.md) - Daily/weekly/quarterly practices
7. [First 7 Days](./07-onboarding.md) - Practical onboarding plan

## Quick Reference

- **Invariants**: Mathematical (never negotiable) → Ethical (human dignity) → Operational (system promises)
- **SLOs**: p95 < 200ms (control), p99 < 800ms (patience), 99.95% availability
- **Degradation**: Full → Cached → Readonly → Export → Manual
- **Principle**: The System Walks With Us

Start with [Field Model](./01-field-model.md).
