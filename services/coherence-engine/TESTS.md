# COHERENCE ENGINE — TEST SPECIFICATION

## Test Categories

### 1. Classification Tests

#### 1.1 PRE_COLLAPSE Detection

- **Test**: Numbness → PRE_COLLAPSE
- **Test**: Shutdown → PRE_COLLAPSE
- **Test**: Fog + Numb → PRE_COLLAPSE

#### 1.2 DISTORTION Detection

- **Test**: Acute shame → DISTORTION
- **Test**: Acute fear → DISTORTION
- **Test**: Overwhelm + breached capacity → DISTORTION

#### 1.3 DRIFT Detection

- **Test**: Urgency → DRIFT
- **Test**: Oscillating rhythm → DRIFT
- **Test**: Avoidance → DRIFT
- **Test**: Wobble + tension → DRIFT

#### 1.4 STABLE Detection

- **Test**: Open + steady + clear → STABLE
- **Test**: No drift signals → STABLE

### 2. Routing Tests

#### 2.1 Protocol Mapping

- **Test**: DRIFT + urgency → holding_my_rhythm
- **Test**: DRIFT + avoidance → what_am_i_avoiding
- **Test**: DRIFT + oscillating → grounding_sequence
- **Test**: DISTORTION + shame → shame_release
- **Test**: DISTORTION + fear → fear_mapping
- **Test**: DISTORTION + overwhelm → capacity_reset
- **Test**: PRE_COLLAPSE + numbness → emergency_grounding
- **Test**: PRE_COLLAPSE + shutdown → exit_precursor flag
- **Test**: STABLE → no protocol route

### 3. Output Schema Tests

#### 3.1 Structure Validation

- **Test**: All responses contain integrity_state
- **Test**: All responses contain state_reflection
- **Test**: All responses contain exit_precursor (boolean)
- **Test**: Upward is null in stabilisation-only mode
- **Test**: No undocumented fields in response

#### 3.2 Field Types

- **Test**: integrity_state is enum
- **Test**: protocol_route is string or null
- **Test**: stabilisation_cue is string or null
- **Test**: exit_precursor is boolean

### 4. Drift Guardrail Tests

#### 4.1 Future Reference Detection

- **Test**: Reject "you will"
- **Test**: Reject "next you"
- **Test**: Reject "after this"
- **Test**: Reject "soon"
- **Test**: Reject "later"
- **Test**: Reject "when you're ready"

#### 4.2 Advisory Language Detection

- **Test**: Reject "you should"
- **Test**: Reject "you need to"
- **Test**: Reject "try to"
- **Test**: Reject "consider"
- **Test**: Reject "I recommend"

#### 4.3 Motivational Language Detection

- **Test**: Reject "you can do it"
- **Test**: Reject "you've got this"
- **Test**: Reject "keep going"
- **Test**: Reject "stay strong"
- **Test**: Reject "believe in yourself"

#### 4.4 Emotional Validation Detection

- **Test**: Reject "it's okay"
- **Test**: Reject "you're doing great"
- **Test**: Reject "that's normal"
- **Test**: Reject "don't worry"

#### 4.5 Therapeutic Language Detection

- **Test**: Reject "how does that make you feel"
- **Test**: Reject "let's explore"
- **Test**: Reject "what comes up for you"

### 5. Memory Non-Interference Tests

#### 5.1 Classification Independence

- **Test**: Same founder_state + different memory → same integrity_state
- **Test**: Memory cannot change DRIFT to STABLE
- **Test**: Memory cannot change STABLE to DRIFT
- **Test**: Memory is descriptive context only

### 6. API Integration Tests

#### 6.1 /coherence/stabilise-only

- **Test**: Valid request → 200 + valid CoherencePacket
- **Test**: Missing founder_state → 400 error
- **Test**: Invalid physiological value → 400 error
- **Test**: Response matches expected structure

#### 6.2 /coherence/debug/drift-check

- **Test**: Clean text → passes
- **Test**: Text with "you should" → fails with violations
- **Test**: Returns list of detected violations

### 7. Self-Correction Tests

#### 7.1 Drift Rejection Flow

- **Test**: Generate drift output → reject → regenerate clean
- **Test**: Self-correction does not loop infinitely
- **Test**: Founder never sees rejected output

#### 7.2 State Reset

- **Test**: After rejection, engine state resets
- **Test**: Role contract re-enforced after rejection
- **Test**: Re-classification uses only present state

### 8. Edge Case Tests

#### 8.1 Boundary Conditions

- **Test**: Empty tension_keyword → handled
- **Test**: Null diagnostic_context → handled with defaults
- **Test**: Empty memory_snapshot → handled
- **Test**: Multiple simultaneous drift signals → classification priority correct

#### 8.2 Mixed Signals

- **Test**: Open physiological + urgent rhythm → classify as DRIFT
- **Test**: Steady rhythm + shame → classify as DISTORTION
- **Test**: Clear cognitive + numb physiological → classify as PRE_COLLAPSE

### 9. End-to-End Scenarios

#### 9.1 Full Flow Tests

- **Test**: Urgency spike → DRIFT → holding_my_rhythm → one-line cue
- **Test**: Numbness → PRE_COLLAPSE → emergency_grounding → exit flag
- **Test**: Shame → DISTORTION → shame_release → stabilisation cue
- **Test**: Calm founder → STABLE → no protocol → no cue

## Test Implementation Notes

- Use test fixtures from API_EXAMPLES.json
- Each test should be isolated and repeatable
- Mock external dependencies (no real memory layer required for Phase 1)
- Use property-based testing for drift detection where applicable
- Ensure 100% coverage of classification logic
- All tests must pass before moving to Phase 2

## Acceptance Criteria

- All classification tests pass
- All routing tests pass
- All drift guardrail tests pass
- All memory non-interference tests pass
- API integration tests pass
- No drift violations in any output
- Self-correction loop works correctly
