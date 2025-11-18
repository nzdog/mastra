# Lichen Protocol — Coherence Engine

**Phase 2: Stabilisation + Amplification**

The Coherence Engine is the real-time stability and momentum regulation layer of the Lichen Protocol. It detects drift, classifies founder integrity state, routes to protocols, prevents collapse, and safely amplifies upward coherence.

---

## Architecture Overview

This is a **deterministic, rules-based system** that implements:

**Phase 1 (Stabilisation):**
- ✅ **Integrity Classification** (STABLE, DRIFT, DISTORTION, PRE_COLLAPSE)
- ✅ **Protocol Routing** (deterministic mapping)
- ✅ **Drift Detection** (6 categories)
- ✅ **Output Validation** (forbidden language detection)
- ✅ **Present-State Only Logic** (no prediction, no memory influence)

**Phase 2 (Amplification):**
- ✅ **Expansion Detection** (7 expansion signals)
- ✅ **False-High Detection** (unsafe positive urgency)
- ✅ **Amplification Safeguards** (pace lock, embodiment gate, urgency kill-switch, micro-consent)
- ✅ **Upward Coherence** (safe momentum release)
- ✅ **Magnification Notes** (non-directive, present-only)

### What's NOT Implemented (Future Phases)
- ❌ Natural language processing
- ❌ Real-time streaming
- ❌ Protocol cycle tracking integration

---

## Quick Start

### Prerequisites

- Node.js 20+ or compatible runtime
- npm or yarn

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Server starts on `http://localhost:3000` (or PORT env var)

### Run Production Build

```bash
npm run build
npm start
```

---

## API Endpoints

### `POST /coherence/stabilise-only`

Stabilisation-only endpoint (Phase 1 behavior, no upward detection).

**Request:**
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
    "recent_drift_events": ["urgency_2024-11-15"]
  }
}
```

**Response:**
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

### `POST /coherence/evaluate`

Full evaluation endpoint with upward coherence detection (Phase 2).

**Request:** Same as stabilise-only, with optional `founder_ready_signal`:
```json
{
  "founder_state": {
    "physiological": "open",
    "rhythm": "steady",
    "emotional": "open",
    "cognitive": "clear",
    "tension_keyword": "calm",
    "conflict_indicator": "none",
    "founder_ready_signal": true
  },
  "diagnostic_context": {
    "coherence_score": 0.85
  }
}
```

**Response (with amplification):**
```json
{
  "integrity_state": "STABLE",
  "state_reflection": "Coherent. Rhythm steady. Clear.",
  "protocol_route": null,
  "stabilisation_cue": null,
  "exit_precursor": false,
  "upward": {
    "expansion_detected": true,
    "amplification_safe": true,
    "magnification_note": "Clarity present. Open and grounded.",
    "micro_actions": ["Notice the clarity", "Maintain openness"]
  }
}
```

### `POST /coherence/debug/drift-check`

Test drift detection on arbitrary text.

**Request:**
```json
{
  "text": "You should try to relax. Soon you will feel better."
}
```

**Response:**
```json
{
  "clean": false,
  "violations": [
    {
      "type": "advisory",
      "pattern": "\\byou should\\b",
      "detected_in": "You should"
    },
    {
      "type": "future_reference",
      "pattern": "\\bsoon\\b",
      "detected_in": "Soon"
    }
  ],
  "text": "You should try to relax. Soon you will feel better."
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "coherence-engine",
  "version": "1.0.0",
  "timestamp": "2024-11-17T12:00:00.000Z"
}
```

---

## Testing

### Run All Tests

```bash
npm test  # 105 tests
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Test Categories

**Phase 1 (88 tests):**
- **Classification Tests** (`tests/classification.test.ts`) — Integrity state classification logic
- **Routing Tests** (`tests/routing.test.ts`) — Protocol routing table
- **Drift Guard Tests** (`tests/drift_guard.test.ts`) — Forbidden language detection
- **Output Builder Tests** (`tests/output_builder.test.ts`) — CoherencePacket generation
- **Memory Non-Interference Tests** (`tests/memory_noninterference.test.ts`) — Memory cannot influence classification
- **API Tests** (`tests/api.test.ts`) — HTTP endpoint integration
- **End-to-End Tests** (`tests/end_to_end.test.ts`) — Full scenarios

**Phase 2 (17 tests):**
- **Amplification Tests** (`tests/amplification.test.ts`) — Expansion detection, false-high detection, safeguards, upward coherence

---

## Project Structure

```
coherence-engine/
├── models/                    # Data models
│   ├── founder_state.ts       # Founder state input types
│   ├── diagnostic_context.ts  # Diagnostic context types
│   ├── memory_snapshot.ts     # Memory snapshot types
│   └── coherence_packet.ts    # Output packet types
├── classification/            # Classification logic
│   ├── drift_detector.ts      # 6 drift categories
│   └── integrity_classifier.ts # State classification (STABLE/DRIFT/DISTORTION/PRE_COLLAPSE)
├── outputs/                   # Output generation
│   ├── output_builder.ts      # CoherencePacket builder
│   ├── drift_guard.ts         # Forbidden language detection
│   └── self_correction.ts     # Self-correction loop
├── api/                       # HTTP API
│   ├── handlers.ts            # Request handlers
│   └── server.ts              # Express server
├── tests/                     # Test suite
├── protocol_router.ts         # Protocol routing table
├── index.ts                   # Entry point
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── SPEC.md                    # Full specification
├── MVP_SLICE.md               # Phase 1 scope
├── API_EXAMPLES.json          # Example requests/responses
└── TESTS.md                   # Test specification
```

---

## Design Principles

### 1. Present-State Only Classification

Classification is based **entirely** on the current `founder_state` input. No prediction, no forecasting, no trends.

### 2. Memory is Descriptive, Not Predictive

Memory is an event log for context only. It **cannot** influence classification.

### 3. Output Schema Lock

Allowed outputs:
- State reflection (present only)
- Integrity classification
- Protocol route
- One-line stabilisation cue

Forbidden outputs:
- Advice
- Motivation
- Future references
- Emotional validation
- Strategy

### 4. Drift Detection & Self-Correction

All outputs are validated against forbidden language patterns. If drift is detected, output is rejected and regenerated.

### 5. Deterministic Routing

Protocol routing is a simple lookup table. No ML, no heuristics.

---

## Classification Rules

```
if (numbness or shutdown):      PRE-COLLAPSE
else if (shame or fear or overwhelm): DISTORTION
else if (urgency or wobble or avoidance): DRIFT
else:                             STABLE
```

## Protocol Routing Table

| Integrity State | Primary Signal | Protocol Route |
|-----------------|----------------|----------------|
| DRIFT | urgency | holding_my_rhythm |
| DRIFT | avoidance | what_am_i_avoiding |
| DRIFT | oscillating | grounding_sequence |
| DISTORTION | shame | shame_release |
| DISTORTION | fear | fear_mapping |
| DISTORTION | overwhelm | capacity_reset |
| PRE_COLLAPSE | numbness | emergency_grounding |
| PRE_COLLAPSE | shutdown | exit_precursor flag |
| STABLE | none | none |

---

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Build

```bash
npm run build
```

Output goes to `dist/`

---

## Environment Variables

- `PORT` — Server port (default: 3000)

---

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "tight",
      "rhythm": "urgent",
      "emotional": "constricted",
      "cognitive": "looping",
      "tension_keyword": "deadline",
      "conflict_indicator": "pressure"
    }
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:3000/coherence/stabilise-only', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    founder_state: {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure'
    }
  })
});

const packet = await response.json();
console.log(packet.integrity_state); // "DRIFT"
console.log(packet.protocol_route);  // "holding_my_rhythm"
```

---

## Phase 2 Complete ✅

All amplification features implemented:
- ✅ Upward coherence detection
- ✅ Expansion signal detection (7 signals)
- ✅ False-high detection
- ✅ Amplification safeguards (all 4)
- ✅ Pace lock
- ✅ Embodiment gate
- ✅ Urgency kill switch
- ✅ Micro-consent loop

See `PHASE2_NOTES.md` for implementation details.

---

## Documentation

- **SPEC.md** — Complete architectural specification
- **MVP_SLICE.md** — Phase 1 scope definition
- **TESTS.md** — Test specification
- **API_EXAMPLES.json** — Example API requests and responses

---

## License

PROPRIETARY — Lichen Protocol

---

## Support

For questions or issues, contact the Lichen Protocol team.

---

**Status:** Phase 2 Complete ✅

All 105 tests passing. Stabilisation + Amplification fully implemented. Ready for production deployment.

