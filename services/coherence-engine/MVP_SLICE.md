# MVP SLICE — COHERENCE ENGINE (STABILISATION ONLY)

## Purpose

This document defines the minimal viable slice for Phase 1 implementation:
**Stabilisation-only** Coherence Engine with no amplification logic.

## Scope

### In Scope (Phase 1)

- Founder state input processing
- Diagnostic context integration (basic)
- Memory snapshot integration (read-only, non-predictive)
- Integrity state classification (STABLE, DRIFT, DISTORTION, PRE_COLLAPSE)
- Protocol routing based on classification
- One-line stabilisation cues
- Drift detection in outputs
- Basic self-correction for drift violations

### Out of Scope (Phase 1)

- Upward coherence detection
- Amplification logic
- Expansion mode
- Momentum mode
- Real-time websocket connections
- Natural language processing
- Advanced field diagnostics

## Core Components (MVP)

### 1. Data Models

- `FounderStateInput`
- `DiagnosticContext` (simplified)
- `MemorySnapshot` (event list only)
- `CoherencePacket` (without upward block)

### 2. Classification Engine

- Drift detector (6 categories)
- Integrity classifier (deterministic rules)

### 3. Protocol Router

- Simple mapping table
- Deterministic routing based on state + signals

### 4. Output Builder

- State reflection generator
- Stabilisation cue generator
- Drift guard (forbidden phrase checker)

### 5. API Endpoints (MVP)

- `POST /coherence/stabilise-only`
- `POST /coherence/debug/drift-check` (test helper)

## Classification Rules (MVP)

```
if (numb or shutdown): PRE-COLLAPSE
else if (acute fear or shame or overwhelm): DISTORTION
else if (urgency or wobble or avoidance): DRIFT
else: STABLE
```

## Protocol Routing Table (MVP)

| Integrity State | Primary Signal | Protocol Route      |
| --------------- | -------------- | ------------------- |
| DRIFT           | urgency        | holding_my_rhythm   |
| DRIFT           | avoidance      | what_am_i_avoiding  |
| DRIFT           | oscillating    | grounding_sequence  |
| DISTORTION      | shame          | shame_release       |
| DISTORTION      | fear           | fear_mapping        |
| DISTORTION      | overwhelm      | capacity_reset      |
| PRE_COLLAPSE    | numbness       | emergency_grounding |
| PRE_COLLAPSE    | shutdown       | exit_precursor      |
| STABLE          | none           | none                |

## API Contract (MVP)

### Request

```json
{
  "founder_state": {
    "physiological": "tight",
    "rhythm": "urgent",
    "emotional": "constricted",
    "cognitive": "looping",
    "tension_keyword": "deadline",
    "conflict_indicator": "pressure"
  },
  "diagnostic_context": {
    "current_field": "launch_pressure",
    "coherence_score": 0.4
  },
  "memory_snapshot": {
    "recent_drift_events": ["urgency_spike_2024-11-15"],
    "founder_drift_signature": ["urgency", "collapse"]
  }
}
```

### Response

```json
{
  "integrity_state": "DRIFT",
  "state_reflection": "Urgency detected. Rhythm fragmented.",
  "protocol_route": "holding_my_rhythm",
  "stabilisation_cue": "Pause.",
  "exit_precursor": false,
  "upward": null
}
```

## Implementation Order

1. Models → Classification → Routing → Outputs → API
2. Test each component independently
3. Integration test the full flow
4. Add drift guardrails
5. Document and finalize

## Success Criteria

- All MVP endpoints return valid CoherencePacket
- Classification is deterministic and testable
- No future references, advice, or motivation in outputs
- Tests pass for all routing scenarios
- Drift guard catches forbidden phrases
