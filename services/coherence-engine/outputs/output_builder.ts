/**
 * OUTPUT BUILDER
 * Constructs CoherencePacket outputs from classification + routing
 * As per SPEC.md Section 2
 *
 * CRITICAL: All outputs must be:
 * - Present-state only
 * - No future references
 * - No advice, motivation, or emotional content
 */

import { CoherencePacket, IntegrityState } from '../models/coherence_packet';
import { FounderStateInput } from '../models/founder_state';
import { ClassificationResult } from '../classification/integrity_classifier';
import { ProtocolRoute } from '../protocol_router';

/**
 * Build complete CoherencePacket from classification and routing
 */
export function buildCoherencePacket(
  founderState: FounderStateInput,
  classification: ClassificationResult,
  route: ProtocolRoute
): CoherencePacket {
  return {
    integrity_state: classification.integrity_state,
    state_reflection: buildStateReflection(founderState, classification),
    protocol_route: route.protocol,
    stabilisation_cue: buildStabilisationCue(
      classification.integrity_state,
      classification.primary_signal
    ),
    exit_precursor: route.exit_precursor,
    upward: null, // Always null in Phase 1
  };
}

/**
 * Build state reflection (verbatim present-state description)
 * CRITICAL: No interpretation, no advice, no future reference
 */
function buildStateReflection(
  state: FounderStateInput,
  classification: ClassificationResult
): string {
  const { integrity_state, primary_signal } = classification;

  // Build reflection based on integrity state
  switch (integrity_state) {
    case 'PRE_COLLAPSE':
      return buildPreCollapseReflection(state, primary_signal);

    case 'DISTORTION':
      return buildDistortionReflection(state, primary_signal);

    case 'DRIFT':
      return buildDriftReflection(state, primary_signal);

    case 'STABLE':
      return buildStableReflection(state);
  }
}

/**
 * PRE_COLLAPSE state reflection
 */
function buildPreCollapseReflection(state: FounderStateInput, signal: string): string {
  const parts: string[] = [];

  if (signal === 'numbness' || state.physiological === 'numb') {
    parts.push('Numbness detected.');
  }

  if (signal === 'shutdown' || state.emotional === 'collapse') {
    parts.push('System shutdown imminent.');
  }

  if (signal === 'fog' || state.emotional === 'fog') {
    parts.push('Fog present.');
  }

  if (state.rhythm === 'fragmented') {
    parts.push('Rhythm fragmented.');
  }

  return parts.length > 0 ? parts.join(' ') : 'Pre-collapse state detected.';
}

/**
 * DISTORTION state reflection
 */
function buildDistortionReflection(state: FounderStateInput, signal: string): string {
  const parts: string[] = [];

  if (signal === 'shame') {
    parts.push('Shame detected.');
  } else if (signal === 'fear') {
    parts.push('Fear detected.');
  } else if (signal === 'overwhelm' || state.cognitive === 'overwhelmed') {
    parts.push('Overwhelm detected.');
  }

  if (state.physiological === 'tight' || state.physiological === 'agitated') {
    parts.push('Body constricted.');
  }

  if (state.rhythm === 'fragmented' || state.rhythm === 'oscillating') {
    parts.push('Rhythm disrupted.');
  }

  if (parts.length === 0) {
    parts.push('Field distorted.');
  }

  return parts.join(' ');
}

/**
 * DRIFT state reflection
 */
function buildDriftReflection(state: FounderStateInput, signal: string): string {
  const parts: string[] = [];

  if (signal === 'urgency' || state.rhythm === 'urgent') {
    parts.push('Urgency detected.');
  }

  if (signal === 'oscillating' || state.rhythm === 'oscillating') {
    parts.push('Rhythm oscillating.');
  }

  if (signal === 'avoidance' || state.conflict_indicator === 'avoidance') {
    parts.push('Avoidance detected.');
  }

  if (signal === 'pressure' || state.conflict_indicator === 'pressure') {
    parts.push('Pressure present.');
  }

  if (state.emotional === 'constricted') {
    parts.push('Constriction present.');
  }

  if (state.rhythm === 'fragmented') {
    parts.push('Rhythm fragmented.');
  }

  if (parts.length === 0) {
    parts.push('Drift detected.');
  }

  return parts.join(' ');
}

/**
 * STABLE state reflection
 */
function buildStableReflection(state: FounderStateInput): string {
  const parts: string[] = [];

  if (state.emotional === 'open') {
    parts.push('Coherent.');
  }

  if (state.rhythm === 'steady') {
    parts.push('Rhythm steady.');
  }

  if (state.cognitive === 'clear') {
    parts.push('Clear.');
  }

  return parts.length > 0 ? parts.join(' ') : 'Stable.';
}

/**
 * Build one-line stabilisation cue
 * CRITICAL: Must be extremely minimal, present-only, non-directive
 */
function buildStabilisationCue(
  integrityState: IntegrityState,
  primarySignal: string
): string | null {
  // No cue for STABLE state
  if (integrityState === 'STABLE') {
    return null;
  }

  // PRE_COLLAPSE: immediate stop
  if (integrityState === 'PRE_COLLAPSE') {
    return 'Stop.';
  }

  // DISTORTION: ground
  if (integrityState === 'DISTORTION') {
    if (primarySignal === 'overwhelm') {
      return 'Breathe.';
    }
    return 'Ground.';
  }

  // DRIFT: pause or notice
  if (integrityState === 'DRIFT') {
    if (primarySignal === 'urgency') {
      return 'Pause.';
    }
    if (primarySignal === 'avoidance') {
      return 'Notice.';
    }
    return 'Pause.';
  }

  return null;
}
