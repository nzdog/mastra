# Field Model → Engineering Model

> **Quick take**: A field is an invisible runtime environment for human decisions—like a Kubernetes cluster's resource quotas for agency.

## What is a Field?

A **field** is:
- The implicit constraint system shaping what actions feel possible/impossible
- The emotional-cognitive operating regime determining decision patterns
- The invisible architecture that makes urgency feel mandatory or rest feel forbidden

**Engineering analogy**: Fields are to human agency what cluster configurations are to workload behavior.

## Field States

| Field State | Characteristics | Engineering Parallel |
|-------------|----------------|----------------------|
| **COHERENT** | Decisions from alignment; rest integrated; agency preserved | Well-tuned autoscaler with health checks |
| **EXTRACTION** | Short-term optimization; rest impossible; urgency default | CPU limits at 100%, no graceful shutdown |
| **BURNOUT** | Capacity exhausted; reactive only; collapse imminent | Cluster at 95% with no horizontal scaling |

## Field Change vs. Feature Change

| Operation | Field Change | Feature Change |
|-----------|-------------|----------------|
| **Scope** | Entire constraint architecture | Single code path |
| **Example** | Lean manufacturing transformation | Add retry logic |
| **Risk** | System collapse during transition | Bug in feature |
| **Timeline** | Weeks to months | Hours to days |

## In Code Terms

A field-aware system must:

1. **Detect field state** from unstructured signals
2. **Adapt behavior** based on detected field (timeout extensions under stress)
3. **Guide transitions** safely (protocol walks)
4. **Never corrupt** the field through design (no urgency-inducing endpoints)

**See**: [System Architecture](./02-architecture.md) for how this is implemented.
