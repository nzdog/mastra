# Memory Layer Specification Index

**Branch:** `feature/memory-layer-phase-2` **Environment:** `spec-sandbox` **Status:** Phase 2 - Complete **Version:** 2.0.0

## Overview

This directory contains the Memory Layer specification and implementation artifacts for the Lichen
Protocol system.

## Specification Documents

| Document                                       | Status      | Description                           |
| ---------------------------------------------- | ----------- | ------------------------------------- |
| [memory-layer-spec.md](./memory-layer-spec.md) | Draft       | Core Memory Layer specification       |
| [phase-2-api.md](./phase-2-api.md)             | Complete    | Phase 2 API documentation and examples|
| [api-contracts.md](./api-contracts.md)         | Implemented | API endpoint contracts and schemas    |
| [governance-model.md](./governance-model.md)   | Partial     | Consent, audit, and ethics governance |
| [privacy-security.md](./privacy-security.md)   | Pending     | Privacy and security architecture     |
| [observability.md](./observability.md)         | Implemented | Metrics, logging, and monitoring      |

## Architecture Decision Records

| ADR                                                   | Title                     | Status   | Date       |
| ----------------------------------------------------- | ------------------------- | -------- | ---------- |
| [ADR-0001](../adrs/0001-memory-layer-architecture.md) | Memory Layer Architecture | Accepted | 2025-10-16 |

## Implementation Phases

### Phase 0 — Foundations ✅

- [x] Create long-lived branch and protect it
- [x] Add ADR 0001 and spec index
- [ ] Seed `/readyz` contract and audit-emitter stub
- [ ] Add CI policy gates (lint/tests/audit stub)
- [ ] Configure `spec-sandbox` environment & secrets

### Phase 1 — Governance & Audit ✅

- [x] Merkle-chained governance ledger sink (dev)
- [x] Signed audit receipts for Store/Recall/Distill/Forget/Export/Health
- [x] Ed25519 signatures and JWKS distribution
- [x] Metrics instrumentation and observability
- [x] CORS hardening and security headers

### Phase 2 — APIs & Consent Families ✅

- [x] Implement five core operations (Store, Recall, Distill, Forget, Export)
- [x] Personal / Cohort / Population API families
- [x] Error envelope + SLOs + version headers
- [x] Consent resolver middleware with fail-closed authorization
- [x] K-anonymity enforcement for aggregations
- [x] OpenAPI 3.0 specification
- [x] Complete API documentation and runbooks

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
