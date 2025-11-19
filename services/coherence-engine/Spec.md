THE LICHEN PROTOCOL — COHERENCE ENGINE SPECIFICATION

Version 1.0 — Architectural Specification (Stabilisation + Amplification Integrated)

Source of Truth Document

This document defines the complete architecture for the Lichen Coherence Engine — the stabilisation and amplification subsystem that keeps founders coherent, aligned, and moving without urgency.
This spec is implementation-ready and governs:
• engineering
• protocol routing
• founder-state classification
• momentum amplification
• drift detection
• memory integration
• orchestration rules
• scale behavior
• boundary protection

No interpretation.
No drift.
No hidden features.
This is the hard architecture.

⸻

0. PURPOSE (What This Engine Is)

The Coherence Engine is the real-time stability and momentum regulation layer of the Lichen Protocol.
It has two equal functions: 1. Downward Coherence (Stabilisation)
• detect drift
• classify integrity state
• route to protocol
• restore rhythm
• prevent collapse 2. Upward Coherence (Magnification + Amplification)
• detect upward signals
• magnify coherence
• release grounded momentum
• prevent positive urgency/hype
• anchor gains

It ensures founders remain coherent, regulated, and able to move cleanly — without distortion or pressure.

This engine sits between:
• Field Diagnostic (input context)
• Protocol Engine (intervention execution)
• Amplification Layer (upward movement)
• Memory Layer (historic fact store)
• Field Exit Engine (collapse handling)

⸻

1. INPUT LAYER

(What the Coherence Engine Accepts)

1.1 Founder State Inputs (Real-Time)
• physiological state: open / tight / numb / agitated / steady
• rhythm: steady / fragmented / urgent / oscillating
• emotional state: open / constricted / fog / collapse
• cognitive state: clear / looping / overwhelmed
• tension keyword: single-word description
• conflict indicator: none / avoidance / tension / pressure
• founder-led readiness signal (optional): embodied “yes”

1.2 Diagnostic Inputs (From Field Diagnostic Engine)
• current field
• origin field residue
• emerging field
• distortion map
• capacity edge
• coherence score
• field drift direction

1.3 Memory Layer Inputs (Strict Event-Only Facts)
• recorded drift events
• recorded distortion events
• recorded pre-collapse events
• stability-restoration durations
• collapse precursors (factual only)
• protocol usage history
• founder drift signature (exact-match map, not predictive)

Memory is read-only, event-based, and non-temporal.

⸻

2. OUTPUT LAYER

(What the Coherence Engine Produces)

2.1 Allowed Output Types (Downward Coherence) 1. State Reflection
Verbatim classification of founder’s present state. 2. Integrity Classification
• Stable
• Drift
• Distortion
• Pre-Collapse 3. Protocol Route or Exit Precursor
Output: protocol_route or exit_precursor_flag. 4. Stabilisation Cue (One Line)
e.g., “Pause.”

2.2 Allowed Output Types (Upward Coherence / Amplification) 1. Upward-state reflection 2. Magnification prompt (non-directive) 3. Micro-alignment reflection 4. Confirmation of embodied readiness 5. Momentum pathway (1–2 stabilising micro-steps)

2.3 Forbidden Outputs
• advice
• guidance
• suggestions
• meaning-making
• emotional validation
• interpretation
• motivation
• encouragement
• urgency
• future references (“next”, “after”, “now you can…”)
• strategy
• therapy
• reassurance (“it’s ok”, “you’re doing great”)

⸻

3. INTERNAL OPERATING MODES

(Downward + Upward State Machine)

3.1 Downward Coherence Modes 1. Stable Mode 2. Drift Mode 3. Distortion Mode 4. Pre-Collapse Mode

Each mode has:
• detection rules
• classification logic
• allowed outputs
• routing constraints

3.2 Upward Coherence Modes 1. Expansion Mode
(coherence magnification) 2. Momentum Mode
(coherence-driven acceleration)

Amplification can only start after:

integrity_state == STABLE
protocol_cycle == COMPLETE
founder_ready_signal == TRUE

⸻

4. STATE CLASSIFICATION LOGIC

(Downward Coherence)

4.1 Drift Detection Categories
• emotional drift
• rhythm drift
• cognitive drift
• field drift
• relational drift
• pressure drift

Each drift category has a deterministic classifier.

4.2 State Classifier

if numbness or shutdown: PRE-COLLAPSE
if acute fear or shame or overwhelm: DISTORTION
if urgency or wobble or avoidance: DRIFT
else: STABLE

No interpretation.
Only signal logic.

⸻

5. UPWARD COHERENCE DETECTION

(Amplification Addendum Integration)

5.1 Expansion Signals
• physiological openness
• grounded breath
• stable rhythm + available capacity
• clarity spike
• calm excitement
• no urgency
• embodied readiness

5.2 False-High Signals (Unsafe)
• hype
• pressured excitement
• oscillating rhythm
• racing thoughts
• disembodied uplift
• positive urgency

False-high → treat as Drift.

⸻

6. AMPLIFICATION SAFEGUARDS

6.1 Pace Lock

Amplification cannot increase founder speed beyond baseline rhythm.

6.2 Embodiment Gate

Amplification halts immediately if body closes.

6.3 Urgency Kill Switch

If any urgency appears:

stop_amplification()
route_to_coherence()

6.4 Founder-Led Microconsent Loop

Amplification continues only with implicit embodied yes.

⸻

7. MEMORY INTEGRATION RULES

7.1 Allowed Memory Behavior
• event-only
• exact-match recognition
• read-only context
• non-executable
• non-temporal
• non-statistical
• non-inferential

7.2 Prohibited Memory Behavior
• prediction
• trend calculation
• likelihood estimation
• meaning-making
• identity modeling
• cross-event inference
• temporal linking

Memory cannot influence classification.

⸻

8. ENGINE SEPARATION & ORCHESTRATION

8.1 Single-Responsibility Contracts
• Coherence Engine stabilises + amplifies
• Protocol Engine walks protocol
• Diagnostic Engine maps field
• Field Exit Engine handles collapse
• Memory Layer stores events
• Orchestrator connects them but none can call each other directly

8.2 Mutual Execution Locks

Only one engine may be active per founder per cycle.

8.3 Typed I/O Interfaces

Each engine only accepts/outputs a narrow message type.

⸻

9. DRIFT DETECTION & SELF-CORRECTION

9.1 Drift Signals
• future references
• motivation
• advice
• narrative interpretation
• emotional tone
• cross-domain output

9.2 Self-Correction Sequence

reject_output()
reset_engine_state()
enforce_role_contract()
reclassify_present_state()

Founder never sees drift outputs.

⸻

10. SUCCESS METRICS

The Coherence Engine works when:
• founders remain coherent ≥ 75% of time
• collapses are prevented
• rhythm normalises
• amplification occurs without urgency
• upward coherence becomes predictable
• founders experience clean, non-forced momentum
• the system scales without drift

⸻

11. DEPLOYMENT PHASES

Phase 1 — Manual

Signals entered by founders; routing semi-automatic.

Phase 2 — Semi-Automated

Forms + lightweight real-time classification.

Phase 3 — Fully Automated

Natural-language detection + agentic execution.

⸻

12. POSITIONING STATEMENT (External)

The Coherence Engine is the core stability + momentum layer of the Lichen System.
It keeps founders from drifting, collapsing, or distorting —
and enables forward movement without urgency.

It is the part of Lichen that YC and all accelerators cannot replicate.

⸻

THE SPEC IS COMPLETE


