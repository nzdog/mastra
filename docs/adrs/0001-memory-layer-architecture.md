# ADR 0001: Memory Layer Architecture

**Status:** Accepted **Date:** 2025-10-16 **Deciders:** Core Team **Technical Story:** Memory Layer
Specification Implementation

## Context

The Lichen Protocol system requires a Memory Layer to enable intelligent agents to:

- Store contextual information across sessions
- Recall relevant context during interactions
- Distill patterns from accumulated experiences
- Forget information according to governance policies
- Export memory artifacts for audit and compliance

This ADR establishes the foundational architecture for implementing the Memory Layer specification
on a dedicated branch deployment.

## Decision

We will implement the Memory Layer with the following architectural decisions:

### 1. Deployment Model

- **Long-lived branch:** `feature/memory-layer-phase-3.2`
- **Isolated environment:** `spec-sandbox` deployment separate from production
- **Phased rollout:** Shadow → Canary → Graduated → Regional → Full
- **Rollback capability:** Dual-write migration with snapshot-based rollback

### 2. API Contract (v1)

Six core operations:

1. **Store** - Persist memory with consent metadata
2. **Recall** - Retrieve context with audit trail
3. **Distill** - Extract patterns from memories
4. **Forget** - Remove memory per governance rules
5. **Export** - Generate audit artifacts
6. **Health** - System status with compliance metrics

### 3. Governance & Audit

- **Merkle-chained ledger:** Tamper-evident audit log for all operations
- **Signed receipts:** Cryptographic proof of all Store/Recall/Distill/Forget/Export/Health
  operations
- **Consent families:** Personal / Cohort / Population consent scopes
- **Foundation Stones:** Constitutional governance layer with override protections

### 4. Privacy & Security

- **Pseudonymization:** Token-rotation with differential privacy (DP) + k-anonymity checks
- **Encryption:** AES-256 at-rest, TLS 1.3 in-transit
- **Key rotation:** ≤90-day rotation policy
- **Access control:** Matrix-based permissions with threat detection hooks

### 5. Observability

- **Metrics/Tracing/Logs:** Full observability stack
- **Bias/Fairness probes:** Continuous ethical monitoring
- **Synthetic tests:** SLO verification and policy gate validation
- **Cost tracking:** Per-operation quotas with predictive scaling

### 6. Error Handling

- **Error envelope:** Structured error responses with retry guidance
- **SLOs:** Service level objectives for each operation
- **Version headers:** API versioning with backwards compatibility

## Consequences

### Positive

- **Isolated experimentation:** Branch deployment allows spec validation without production risk
- **Governance-first:** Built-in audit and compliance from day one
- **Incremental rollout:** Phased deployment reduces blast radius
- **Privacy by design:** Encryption and pseudonymization are foundational, not bolted-on

### Negative

- **Complexity:** Governance and privacy layers add implementation overhead
- **Performance:** Audit trails and encryption may impact latency
- **Migration cost:** Dual-write strategy requires additional infrastructure
- **Monitoring burden:** Comprehensive observability requires tooling investment

### Neutral

- **Branch longevity:** Long-lived branch requires explicit merge strategy
- **Spec evolution:** Changes to spec require coordinated updates across layers
- **Cost model:** Per-operation quotas need tuning based on real usage patterns

## Compliance

This architecture satisfies:

- **Theme 6:** Privacy by default (pseudonymization, encryption, consent)
- **Theme 9:** Governance transparency (Merkle ledger, audit receipts)
- **Theme 10:** Ethical coherence (bias probes, Foundation Stones, public deviation reports)

## References

- Memory Layer Specification (docs/specs/memory-layer-spec.md)
- GitHub Issue #11: Implementation Plan
- Clarification Issues #12, #13, #14, #15
- Foundation Stones documentation

## Revision History

| Date       | Version | Changes                       |
| ---------- | ------- | ----------------------------- |
| 2025-10-16 | 1.0     | Initial architecture decision |
