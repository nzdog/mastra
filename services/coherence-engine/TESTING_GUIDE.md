# Testing Guide — Coherence Engine

## Quick Start

The server is running on **http://localhost:3000**

## 🎯 4 Ways to Test

### 1. Run Example Script (Recommended)

```bash
npm run example
```

Shows 4 complete scenarios with output.

### 2. Run Test Suite

```bash
npm test              # Run all 88 tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### 3. Use cURL Commands

Copy and paste these into your terminal.

### 4. Use API Client

Import into Postman, Insomnia, or use HTTPie.

---

## 📋 Test Scenarios (cURL)

### Scenario 1: Urgency Spike → DRIFT

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
  }' | jq
```

**Expected:**

- `integrity_state`: "DRIFT"
- `protocol_route`: "holding_my_rhythm"
- `stabilisation_cue`: "Pause."
- `exit_precursor`: false

---

### Scenario 2: Avoidance → DRIFT

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "tight",
      "rhythm": "steady",
      "emotional": "constricted",
      "cognitive": "clear",
      "tension_keyword": "busy",
      "conflict_indicator": "avoidance"
    }
  }' | jq
```

**Expected:**

- `integrity_state`: "DRIFT"
- `protocol_route`: "what_am_i_avoiding"
- `stabilisation_cue`: "Notice."

---

### Scenario 3: Shame → DISTORTION

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "tight",
      "rhythm": "oscillating",
      "emotional": "constricted",
      "cognitive": "looping",
      "tension_keyword": "failure",
      "conflict_indicator": "tension"
    }
  }' | jq
```

**Expected:**

- `integrity_state`: "DISTORTION"
- `protocol_route`: "shame_release"
- `stabilisation_cue`: "Ground."

---

### Scenario 4: Overwhelm → DISTORTION

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "agitated",
      "rhythm": "fragmented",
      "emotional": "constricted",
      "cognitive": "overwhelmed",
      "tension_keyword": "too_much",
      "conflict_indicator": "pressure"
    }
  }' | jq
```

**Expected:**

- `integrity_state`: "DISTORTION"
- `protocol_route`: "capacity_reset"
- `stabilisation_cue`: "Breathe."

---

### Scenario 5: Numbness → PRE_COLLAPSE

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "numb",
      "rhythm": "fragmented",
      "emotional": "fog",
      "cognitive": "overwhelmed",
      "tension_keyword": "nothing",
      "conflict_indicator": "avoidance"
    }
  }' | jq
```

**Expected:**

- `integrity_state`: "PRE_COLLAPSE"
- `protocol_route`: "emergency_grounding"
- `stabilisation_cue`: "Stop."
- `exit_precursor`: **true** ⚠️

---

### Scenario 6: Calm Founder → STABLE

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "open",
      "rhythm": "steady",
      "emotional": "open",
      "cognitive": "clear",
      "tension_keyword": "calm",
      "conflict_indicator": "none"
    }
  }' | jq
```

**Expected:**

- `integrity_state`: "STABLE"
- `protocol_route`: null
- `stabilisation_cue`: null
- `exit_precursor`: false

---

## 🔍 Test Drift Detection

### Test Dirty Text (Should Fail)

```bash
curl -X POST http://localhost:3000/coherence/debug/drift-check \
  -H "Content-Type: application/json" \
  -d '{"text": "You should try to relax. Soon you will feel better."}' | jq
```

**Expected:** 4+ violations (future refs, advisory language)

### Test Clean Text (Should Pass)

```bash
curl -X POST http://localhost:3000/coherence/debug/drift-check \
  -H "Content-Type: application/json" \
  -d '{"text": "Urgency detected. Rhythm fragmented. Pause."}' | jq
```

**Expected:** `"clean": true`, `"violations": []`

---

## 🏥 Health Check

```bash
curl http://localhost:3000/health | jq
```

**Expected:**

```json
{
  "status": "healthy",
  "service": "coherence-engine",
  "version": "1.0.0",
  "timestamp": "2024-11-17T..."
}
```

---

## 🧪 Edge Cases to Test

### Invalid Input (Should Return 400)

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{
    "founder_state": {
      "physiological": "INVALID",
      "rhythm": "urgent",
      "emotional": "constricted",
      "cognitive": "looping",
      "tension_keyword": "deadline",
      "conflict_indicator": "pressure"
    }
  }' | jq
```

### Missing Required Field (Should Return 400)

```bash
curl -X POST http://localhost:3000/coherence/stabilise-only \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

---

## 📊 What to Verify

For every response, check:

✅ **Structure**

- Has `integrity_state`, `state_reflection`, `protocol_route`, `stabilisation_cue`, `exit_precursor`, `upward`
- `upward` is always `null` in Phase 1

✅ **Classification**

- Correct integrity state for input signals
- Logical primary signal detection

✅ **Routing**

- Correct protocol route for state + signal
- Exit precursor flag set for PRE_COLLAPSE

✅ **Drift Guard**

- No "you should", "you will", "try to", "soon", etc.
- No advice or motivation
- Only present-state reflection

✅ **Cues**

- One word + period only ("Pause.", "Stop.", "Ground.", "Notice.", "Breathe.")
- Or null for STABLE

---

## 🚨 Red Flags

If you see ANY of these, it's a bug:

❌ Future references ("you will", "next", "soon")
❌ Advice ("you should", "try to")
❌ Motivation ("you can do it", "keep going")
❌ Multi-sentence cues
❌ Therapy language ("how does that make you feel")
❌ Missing fields in response
❌ 500 errors

---

## 💡 Pro Tips

1. **Use `jq`** for pretty JSON output (install with `brew install jq`)
2. **Save requests** as `.json` files for reuse
3. **Check logs** in the terminal where `npm run dev` is running
4. **Run tests first** to validate core logic before API testing
5. **Test edge cases** like empty fields, extreme values

---

## 📚 More Resources

- **API_EXAMPLES.json** — Pre-built test fixtures
- **TESTS.md** — Full test specification
- **README.md** — Complete API documentation
- **example.ts** — Programmatic examples

---

**Happy Testing!** 🎉
