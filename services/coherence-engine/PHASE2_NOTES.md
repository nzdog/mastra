# Phase 2 Implementation Notes — Amplification & Upward Coherence

## What Was Added in Phase 2

### New Components

1. **Expansion Detector** (`amplification/expansion_detector.ts`)
   - Detects 7 expansion signals
   - Calculates signal strength (0-1)
   - Safety checker for amplification

2. **False-High Detector** (`amplification/false_high_detector.ts`)
   - Detects unsafe "positive urgency"
   - Identifies hype, pressured excitement, oscillating rhythm
   - Treats false-high as DRIFT

3. **Amplification Planner** (`amplification/amplification_planner.ts`)
   - Implements all 4 safeguards
   - Builds upward coherence block
   - Generates magnification notes and micro-actions

### Amplification Safeguards (All Implemented)

1. ✅ **Pace Lock**
   - Cannot increase founder speed
   - Requires steady rhythm
   - Blocks if urgency present

2. ✅ **Embodiment Gate**
   - Halts if body closes
   - Requires open or steady physiological state
   - Continuous monitoring

3. ✅ **Urgency Kill Switch**
   - Stops immediately if urgency appears
   - Monitors rhythm and conflict indicators
   - Zero tolerance for pressure

4. ✅ **Micro-Consent Loop**
   - Requires explicit founder_ready_signal = true
   - Embodied "yes" only
   - Re-checks on each evaluation

### Pre-Conditions for Amplification

All must be true:
1. ✅ integrity_state == STABLE
2. ✅ protocol_cycle_complete == true
3. ✅ founder_ready_signal == true
4. ✅ No false-high signals detected
5. ✅ Expansion signals present (≥5/7)
6. ✅ All safeguards pass

### Upward Coherence Block Structure

```typescript
{
  expansion_detected: boolean,
  amplification_safe: boolean,
  magnification_note: string,      // Non-directive, present-only
  micro_actions: string[]           // Max 2, stabilizing steps
}
```

### API Changes

#### `/coherence/evaluate` (Enhanced)

Now includes upward coherence detection when state is STABLE.

**Example Response with Amplification:**
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
    "magnification_note": "Clarity present. Open and grounded. Capacity available.",
    "micro_actions": [
      "Notice the clarity",
      "Maintain openness"
    ]
  }
}
```

#### `/coherence/stabilise-only` (Unchanged)

Still returns `upward: null` - Phase 1 behavior preserved.

### Expansion Signals

All 7 signals:
1. Physiological openness (open or steady)
2. Stable rhythm
3. Clarity present (cognitive: clear)
4. Calm state (emotional: open)
5. No urgency
6. Embodied readiness (founder_ready_signal: true)
7. Available capacity (coherence_score ≥ 0.6)

**Threshold:** ≥5 signals must be present for expansion detection.

### False-High Signals (Any = Block)

1. Oscillating rhythm
2. Racing thoughts (looping + not steady)
3. Pressured excitement
4. Disembodied state
5. Urgency present
6. Hype keywords (amazing, incredible, crushing, etc.)

**Even ONE false-high signal blocks amplification.**

### Test Coverage

17 new tests covering:
- Expansion detection (3 tests)
- False-high detection (4 tests)
- Amplification planning (5 tests)
- Safeguards (3 tests)
- Upward block content (2 tests)

**Total: 105 tests passing** ✅

### Drift Protection

All outputs from amplification are validated:
- Magnification notes: Present-state only
- Micro-actions: Stabilizing, not accelerating
- Zero future references
- Zero motivational language
- Zero advice

### Example Scenarios

#### Safe Amplification
```typescript
{
  founder_state: {
    physiological: 'open',
    rhythm: 'steady',
    emotional: 'open',
    cognitive: 'clear',
    tension_keyword: 'calm',
    conflict_indicator: 'none',
    founder_ready_signal: true
  }
}
// Result: Amplification approved ✅
```

#### Blocked: False-High
```typescript
{
  founder_state: {
    physiological: 'open',
    rhythm: 'oscillating',  // ❌ False-high
    emotional: 'open',
    cognitive: 'clear',
    tension_keyword: 'amazing',  // ❌ Hype keyword
    conflict_indicator: 'none',
    founder_ready_signal: true
  }
}
// Result: Blocked - False-high detected
```

#### Blocked: Urgency Kill Switch
```typescript
{
  founder_state: {
    physiological: 'open',
    rhythm: 'urgent',  // ❌ Urgency
    emotional: 'open',
    cognitive: 'clear',
    tension_keyword: 'deadline',
    conflict_indicator: 'pressure',  // ❌ Pressure
    founder_ready_signal: true
  }
}
// Result: Blocked - Urgency kill switch triggered
```

### Phase 2 Constraints Enforced

✅ Amplification cannot increase founder speed
✅ Amplification halts if body closes
✅ Amplification stops if urgency appears
✅ Amplification requires continuous micro-consent
✅ False-high treated as DRIFT
✅ Present-state only outputs
✅ Zero drift in magnification notes

### Performance

- Expansion detection: O(1) - 7 boolean checks
- False-high detection: O(1) - 6 boolean checks + keyword scan
- Amplification planning: O(1) - deterministic logic
- No ML, no prediction, fully deterministic

### Integration with Phase 1

Phase 2 is additive:
- Phase 1 stabilisation: Still works identically
- `/coherence/stabilise-only`: Unchanged
- `/coherence/evaluate`: Enhanced with upward detection
- All Phase 1 tests: Still passing
- No breaking changes

---

## Next Steps (Future Phases)

### Phase 3 Candidates
- Real-time streaming support
- Natural language input processing
- Protocol cycle completion tracking
- Advanced field diagnostic integration
- Memory-based founder drift signatures

### Not Planned
- ML-based prediction (violates present-state constraint)
- Automatic goal setting (violates non-directive constraint)
- Emotional intervention (violates role boundary)

---

**Phase 2 Status:** Complete ✅

All amplification safeguards implemented and tested.
Ready for production deployment.

