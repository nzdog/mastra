---
theme id: memory-layer
version: 0001-phase0
last_review: 2025-10-15
---

# ADR 0001 — Memory Layer Specification

Status: Proposed

## Context

This repository is introducing a Memory Layer specification that defines storage, recall,
governance, and privacy rules for short- and long-lived memory in the Mastra system.

## Decision

Create a feature branch `feature/memory-layer-spec` and scaffold a spec index, ADR, health contract,
and an audit-emitter stub. The implementation will follow phased rollout described in the project
plan.

## Consequences

- Adds spec artifacts and CI policy gates.
- Introduces a `/v1/health` contract and `src/audit-emitter.ts` stub.
