# Phase 3: Drift Guardrails & Self-Correction

## Overview

Phase 3 implements the complete self-correction loop as specified in SPEC.md Section 9.2. This ensures that **founders never see drift outputs** by automatically detecting and regenerating any outputs that violate the Coherence Engine's strict role contract.

## Implementation Date

November 18, 2024

## Core Components

### 1. Enhanced Self-Correction System (`outputs/self_correction.ts`)

#### Key Features

- **Automatic Drift Detection**: Validates all outputs for forbidden patterns before they reach founders
- **Regeneration Loop**: If drift is detected, the system:
  1. Rejects the output
  2. Resets engine state
  3. Enforces role contract
  4. Reclassifies present state
  5. Regenerates output (up to 3 attempts)
- **Drift Monitoring**: Tracks drift detections, corrections, and failures

#### Main Function

```typescript
generateWithSelfCorrection(
  founderState: FounderStateInput,
  diagnosticContext?: DiagnosticContext,
  upwardBlock?: UpwardCoherenceBlock | null
): Promise<CorrectionResult>
```

This function wraps the entire output generation pipeline and ensures clean output.

#### Drift Categories Detected

1. **Future References**: "you will", "soon", "next", "later", etc.
2. **Advisory Language**: "you should", "you must", "try to", "consider", etc.
3. **Motivational**: "you can do it", "keep going", "stay strong", etc.
4. **Emotional Validation**: "it's okay", "don't worry", "that's normal", etc.
5. **Therapeutic**: "how does that make you feel", "let's explore", etc.
6. **Strategy/Planning**: "plan for", "goal", "steps to", etc.
7. **Reassurance**: "you're doing well", "good job", etc.

### 2. Drift Monitoring

The system tracks:

- Total drift detections
- Total successful corrections
- Total correction failures
- Drift count by type
- Last drift timestamp

Access via: `GET /coherence/debug/drift-monitoring`

### 3. API Integration

Both endpoints now use self-correction:

**POST /coherence/stabilise-only**

- Generates output with `generateWithSelfCorrection()`
- Returns clean output or 500 error if correction fails

**POST /coherence/evaluate**

- Determines amplification requirements
- Generates output with self-correction
- Includes upward block validation

### 4. Test Coverage

21 new tests in `tests/self_correction.test.ts`:

#### Drift Detection Tests

- Detects future references
- Detects advisory language
- Detects motivational language
- Detects emotional validation
- No false positives on clean outputs

#### Self-Correction Loop Tests

- Generates clean output on first attempt (deterministic system)
- Handles all integrity states without drift
- Validates all founder states produce clean outputs

#### Monitoring Tests

- Tracks drift detections
- Resets monitoring state
- Tracks successful corrections

#### Contract Enforcement Tests

- Enforces no future references
- Enforces no advice
- Enforces no motivation

#### Founder Protection Tests

- Founders never see drift outputs
- All outputs pass validation across multiple states

#### Phase 2 Integration Tests

- Validates upward block for drift
- Detects drift in magnification notes
- Detects drift in micro-actions

## Architectural Decisions

### Why Self-Correction in a Deterministic System?

Our output builder (`output_builder.ts`) is **deterministic** and shouldn't produce drift. However, Phase 3 self-correction is essential because:

1. **Future AI Integration**: When we add AI-powered output generation (natural language), drift will be possible
2. **Safety Net**: Catches any bugs in the output builder
3. **Verification**: Proves the system can detect and correct drift
4. **Compliance**: Meets the SPEC.md requirement for self-correction

### Self-Correction Sequence

As per SPEC.md Section 9.2:

```
1. reject_output()
   - Detects drift violations
   - Logs violations for monitoring

2. reset_engine_state()
   - Clears attempt-specific state
   - Prepares for fresh attempt

3. enforce_role_contract()
   - Re-affirms allowed/forbidden behaviors
   - Would reset LLM context in AI-powered version

4. reclassify_present_state()
   - Fresh classification from present-state inputs
   - No contamination from previous attempt
```

### Test Utilities

**Drift Injection**: For testing the self-correction loop:

```typescript
injectDriftForTesting(
  output: CoherencePacket,
  driftType: 'future' | 'advice' | 'motivation' | 'emotional'
): CoherencePacket
```

This function adds known drift patterns to clean outputs for testing purposes **only**.

## Phase 3 Success Criteria

✅ **All Achieved**

1. ✅ Drift detection works across all categories
2. ✅ Self-correction loop regenerates on drift
3. ✅ Founders never see drift outputs
4. ✅ Monitoring tracks drift statistics
5. ✅ API endpoints integrate self-correction
6. ✅ All 126 tests pass (including 21 new Phase 3 tests)
7. ✅ No false positives on clean outputs
8. ✅ Works with Phase 2 amplification (upward block validation)

## Performance

- **Zero overhead for clean outputs**: First-attempt success in deterministic system
- **Max 3 attempts**: Prevents infinite loops
- **Fail-safe**: Returns 500 error if correction fails (system bug detected)

## Monitoring in Production

Access drift statistics:

```bash
curl http://localhost:3000/coherence/debug/drift-monitoring
```

Response:

```json
{
  "monitoring": {
    "total_drift_detections": 0,
    "total_corrections": 0,
    "total_correction_failures": 0,
    "drift_by_type": {},
    "last_drift_timestamp": null
  },
  "message": "Phase 3 drift monitoring active"
}
```

## Next Steps

### Phase 4 (Future)

- Natural language AI-powered output generation
- LLM context management for role contract enforcement
- Adaptive drift pattern learning
- Real-time founder feedback integration

## Constraints Maintained

Phase 3 maintains all Phase 1 & 2 constraints:

- ✅ Present-state only classification
- ✅ No future references in outputs
- ✅ No advice, motivation, or therapy
- ✅ Memory is read-only and non-inferential
- ✅ Amplification only on STABLE state
- ✅ Founder-led consent required
- ✅ Urgency kill-switch active
- ✅ Output schema lock

## Critical Safety Feature

**The self-correction loop is the final guardrail** that ensures the Coherence Engine never drifts into advisory, motivational, or therapeutic territory. This is what makes Lichen fundamentally different from other founder support systems.

### Founder Protection Guarantee

> "Founder never sees drift outputs." — SPEC.md Section 9.2

Phase 3 enforces this guarantee at the API level. Any output that violates the role contract is **rejected and regenerated** before it reaches the founder.

## Testing Phase 3

Run all tests:

```bash
npm test
```

Run only self-correction tests:

```bash
npm test -- self_correction
```

Test drift monitoring:

```bash
npm run dev
# In another terminal:
curl http://localhost:3000/coherence/debug/drift-monitoring
```

## Summary

Phase 3 completes the Coherence Engine's core safety system by ensuring **zero drift outputs** reach founders. Combined with Phase 1 (stabilisation) and Phase 2 (amplification), the engine now:

1. **Stabilises**: Detects and routes integrity states
2. **Amplifies**: Safely magnifies upward coherence
3. **Self-Corrects**: Prevents any drift from reaching founders

The system is now production-ready for deterministic classification and prepared for future AI-powered enhancements.
