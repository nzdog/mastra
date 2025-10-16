# Memory Layer Specification Index

**Branch:** `feature/memory-layer-spec` **Environment:** `spec-sandbox` **Status:** Phase 0 -
Foundations **Version:** 0.1.0

## Overview

This directory contains the Memory Layer specification and implementation artifacts for the Lichen
Protocol system.

## Specification Documents

| Document                                       | Status  | Description                           |
| ---------------------------------------------- | ------- | ------------------------------------- |
| [memory-layer-spec.md](./memory-layer-spec.md) | Draft   | Core Memory Layer specification       |
| [api-contracts.md](./api-contracts.md)         | Pending | API endpoint contracts and schemas    |
| [governance-model.md](./governance-model.md)   | Pending | Consent, audit, and ethics governance |
| [privacy-security.md](./privacy-security.md)   | Pending | Privacy and security architecture     |
| [observability.md](./observability.md)         | Pending | Metrics, logging, and monitoring      |

## Architecture Decision Records

| ADR                                                   | Title                     | Status   | Date       |
| ----------------------------------------------------- | ------------------------- | -------- | ---------- |
| [ADR-0001](../adrs/0001-memory-layer-architecture.md) | Memory Layer Architecture | Accepted | 2025-10-16 |

## Implementation Phases

### Phase 0 — Foundations ✅

- [x] Create long-lived branch and protect it
- [x] Add ADR 0001 and spec index
- [ ] Seed `/v1/health` contract and audit-emitter stub
- [ ] Add CI policy gates (lint/tests/audit stub)
- [ ] Configure `spec-sandbox` environment & secrets

### Phase 1 — Governance & Audit

- [ ] Merkle-chained governance ledger sink (dev)
- [ ] Signed audit receipts for Store/Recall/Distill/Forget/Export/Health

### Phase 2 — APIs & Consent Families

- [ ] Implement six core operations
- [ ] Personal / Cohort / Population API families
- [ ] Error envelope + SLOs + version headers

### Phase 3 — Privacy, Security, Governance

- [ ] Token-rotation pseudonymization; DP + k-anon checks
- [ ] AES-256 at-rest / TLS1.3 in-transit; key rotation ≤90d
- [ ] Access-control matrix; threat detection hooks

### Phase 4 — Observability & Evaluation

- [ ] Metrics/tracing/logs; bias/fairness probes
- [ ] Synthetic test endpoints for SLO & policy gates

### Phase 5 — Rollout, Migration & Cost

- [ ] Shadow → Canary → Graduated → Regional → Full
- [ ] Dual-write migration pipeline + rollback snapshots
- [ ] Cost quotas + predictive scaling hooks

## Governance Extensions

Linked clarification issues addressing edge cases:

1. **Issue #12:** Ambiguous / Contested Consent
2. **Issue #13:** Governance Disagreement (Policy Engine vs Ethics Committee)
3. **Issue #14:** Cultural / Jurisdictional Privacy & Consent
4. **Issue #15:** Override Logic Roll-Up (Matrix + Telemetry + Docs)

## Invariant

**Memory enriches but never controls.**

## References

- [GitHub Issue #11](https://github.com/nzdog/mastra/issues/11) - Implementation Plan
- [Foundation Stones](../../protocols/README.md) - Lichen Protocol principles
- ADR directory: `docs/adrs/`

## Maintenance

This index is updated as the specification evolves. All changes require:

- ADR documentation for architectural decisions
- Phase checklist updates
- Linked GitHub issue updates
- Version bump in this document

---

**Last Updated:** 2025-10-16 **Maintainers:** Core Team
