# Changelog

All notable changes to the Coherence Engine will be documented in this file.

## [3.0.0] - 2024-11-18

### Phase 3: Drift Guardrails & Self-Correction - COMPLETE ✅

#### Added

**Self-Correction System**

- Complete self-correction loop (reject → reset → enforce contract → reclassify → regenerate)
- Automatic drift detection across 7 forbidden pattern categories
- Maximum 3 regeneration attempts before failure
- Founder protection guarantee: zero drift outputs reach founders

**Drift Detection**

- Future references detection
- Advisory language detection
- Motivational language detection
- Emotional validation detection
- Therapeutic language detection
- Strategy/planning detection
- Reassurance detection

**Monitoring & Observability**

- Drift monitoring statistics tracking
- Detections, corrections, and failures counted
- Drift categorized by type
- Timestamps for last detection
- New endpoint: `GET /coherence/debug/drift-monitoring`

**API Integration**

- Both `/coherence/stabilise-only` and `/coherence/evaluate` now use self-correction
- Upward block (Phase 2) validated for drift
- Magnification notes and micro-actions checked
- 500 error returned if self-correction fails (system bug detected)

**Testing**

- 21 comprehensive Phase 3 tests
- Drift detection validation tests
- Self-correction loop tests
- Founder protection tests
- Monitoring tests
- Contract enforcement tests
- Upward block drift validation tests
- **Total: 126 tests** (88 Phase 1 + 17 Phase 2 + 21 Phase 3)

**Documentation**

- PHASE3_NOTES.md with implementation details
- Updated README with Phase 3 features
- Updated CHANGELOG
- API documentation for drift monitoring
- Test utilities documented

**Test Utilities**

- `injectDriftForTesting()` function for testing self-correction
- Drift type injection (future, advice, motivation, emotional)
- Reset drift monitoring for clean test runs

#### Changed

- Server startup message reflects Phase 3
- All outputs now pass through self-correction before returning
- API handlers log critical errors for drift correction failures
- Amplification outputs (upward block) validated for drift

#### Constraints Enforced

- ✅ Present-state only classification
- ✅ No future references in outputs
- ✅ No advice, motivation, or therapy
- ✅ Memory is read-only and non-inferential
- ✅ Amplification only on STABLE state
- ✅ Founder-led consent required
- ✅ Urgency kill-switch active
- ✅ Output schema lock
- ✅ **NEW: Automatic drift rejection and regeneration**

#### Technical Notes

- Deterministic output builder shouldn't produce drift (first-attempt success expected)
- Self-correction is a safety net for future AI-powered output generation
- Monitoring tracks drift for system health and debugging
- Tests use drift injection to verify self-correction works
- Max 3 attempts prevents infinite loops

---

## [2.0.0] - 2024-11-19

### Phase 2: Amplification - COMPLETE ✅

#### Added

**Amplification Components**

- Expansion signal detector (7 expansion signals)
- False-high detector (unsafe positive urgency detection)
- Amplification planner with all 4 safeguards
- Upward coherence block generation
- Magnification notes (non-directive, present-only)
- Micro-actions generation (max 2, stabilizing)

**Amplification Safeguards**

- Pace Lock — Cannot increase founder speed
- Embodiment Gate — Halts if body closes
- Urgency Kill Switch — Stops if urgency appears
- Micro-Consent Loop — Requires embodied readiness

**API Enhancements**

- Enhanced `/coherence/evaluate` endpoint with upward detection
- Upward coherence included when integrity_state = STABLE
- Automatic false-high detection and blocking
- Pre-condition validation (STABLE + protocol_complete + founder_ready)

**Testing**

- 17 comprehensive Phase 2 tests
- Expansion detection tests
- False-high detection tests
- Amplification planning tests
- Safeguard validation tests
- Upward block content tests
- **Total: 105 tests** (88 Phase 1 + 17 Phase 2)

**Documentation**

- PHASE2_NOTES.md with implementation details
- Updated README with Phase 2 features
- Updated CHANGELOG
- API documentation for upward coherence

#### Changed

- Server startup message reflects Phase 2
- `/coherence/evaluate` now includes upward coherence detection
- All Phase 1 functionality preserved (no breaking changes)

#### Constraints Enforced

✅ Amplification cannot increase founder speed (pace lock)
✅ Amplification halts if body closes (embodiment gate)
✅ Amplification stops if urgency appears (kill switch)
✅ Amplification requires continuous micro-consent
✅ False-high treated as DRIFT
✅ Present-state only outputs (no future references)
✅ Zero drift in magnification notes
✅ Expansion requires ≥5/7 signals
✅ All safeguards must pass for amplification

---

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

---

**Status:** Phase 2 Complete and Ready for Deployment

All 105 tests passing. Stabilisation + Amplification fully implemented.
