# ADR 0001: Memory Layer Specification Adoption

## Status
Proposed

## Context
We are adopting the Memory Layer Specification (Themes 1–10) with branch-based rollout:
Shadow → Canary → Graduated → Regional → Full.

## Decision
Implement the spec on a dedicated long-lived branch with strict CI gates, audit receipts, and synthetic test endpoints.

## Consequences
- Reversible migrations
- Consent-aware APIs
- Observability and fairness gates
- Cost transparency dashboards
