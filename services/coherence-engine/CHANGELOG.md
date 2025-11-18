# Changelog

All notable changes to the Coherence Engine will be documented in this file.

## [1.0.0] - 2024-11-17

### Phase 1: Stabilisation Only - COMPLETE ✅

#### Added

**Core Architecture**
- Deterministic integrity state classification (STABLE, DRIFT, DISTORTION, PRE_COLLAPSE)
- Protocol routing table with 9 protocol routes
- Drift detection across 6 categories (emotional, rhythm, cognitive, field, relational, pressure)
- Present-state only classification (zero prediction)
- Memory integration (non-predictive, event-only)

**Data Models**
- `FounderStateInput` — Real-time founder state signals
- `DiagnosticContext` — Field diagnostic inputs
- `MemorySnapshot` — Event-only memory context
- `CoherencePacket` — Complete output structure
- Full TypeScript type safety with validation helpers

**Classification Engine**
- Drift detector with 6 category detection
- Integrity classifier with deterministic rules
- Priority-based classification (PRE_COLLAPSE > DISTORTION > DRIFT > STABLE)

**Protocol Router**
- Deterministic routing table
- Exit precursor flag handling
- Fallback routing logic

**Output System**
- State reflection builder (present-state only)
- Stabilisation cue generator (one-line, non-directive)
- Drift guard with forbidden language detection
- Self-correction loop (reject → reset → re-enforce → reclassify)

**API Endpoints**
- `POST /coherence/stabilise-only` — Main stabilisation endpoint
- `POST /coherence/evaluate` — Full evaluation (identical to stabilise-only in Phase 1)
- `POST /coherence/debug/drift-check` — Drift detection test endpoint
- `GET /health` — Health check

**Testing**
- 50+ unit tests across all components
- Classification tests (PRE_COLLAPSE, DISTORTION, DRIFT, STABLE)
- Routing tests (all protocol routes)
- Drift guard tests (all forbidden patterns)
- Output builder tests (schema integrity)
- Memory non-interference tests
- API integration tests
- End-to-end scenario tests

**Documentation**
- Complete README.md with quick start
- SPEC.md (architectural specification)
- MVP_SLICE.md (Phase 1 scope)
- TESTS.md (test specification)
- API_EXAMPLES.json (example requests/responses)
- CHANGELOG.md (this file)
- Example usage script

**Development Tools**
- TypeScript configuration
- Vitest test runner
- Express HTTP server
- Development watch mode
- Type checking
- Code coverage reporting

#### Constraints Enforced

✅ Present-state only classification (no prediction)
✅ Memory cannot influence classification
✅ No future references in outputs
✅ No advice, motivation, or therapy in outputs
✅ Deterministic routing (no ML)
✅ Drift detection catches forbidden language
✅ Self-correction for drift violations

#### Not Implemented (Phase 2+)

❌ Upward coherence detection
❌ Amplification logic
❌ Expansion mode
❌ False-high detection
❌ Pace lock
❌ Embodiment gate
❌ Urgency kill switch
❌ Natural language processing
❌ Real-time streaming

## Next Release: Phase 2 (Amplification)

### Planned Features
- Upward coherence detection
- Safe amplification logic
- False-high detection (positive urgency)
- Pace lock (prevent speed increase)
- Embodiment gate (halt on body closing)
- Urgency kill switch
- Founder-led micro-consent loop
- Upward block in CoherencePacket

### Timeline
Phase 2 begins after Phase 1 is deployed and validated in production.

---

**Status:** Phase 1 Complete and Ready for Deployment

