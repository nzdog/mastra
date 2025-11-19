/**
 * INTEGRITY CLASSIFIER
 * Deterministic classification of founder state into integrity levels
 * As per SPEC.md Section 4.2
 *
 * CRITICAL RULE:
 * if numbness or shutdown: PRE-COLLAPSE
 * if acute fear or shame or overwhelm: DISTORTION
 * if urgency or wobble or avoidance: DRIFT
 * else: STABLE
 *
 * Classification is PRESENT-STATE ONLY
 * Memory CANNOT influence classification
 */

import { FounderStateInput } from '../models/founder_state';
import { DiagnosticContext } from '../models/diagnostic_context';
import { IntegrityState } from '../models/coherence_packet';
import { detectDrift, hasDrift } from './drift_detector';

export interface ClassificationResult {
  integrity_state: IntegrityState;
  primary_signal: string;
  classification_reason: string;
}

/**
 * Classify founder's current integrity state
 * This is the core deterministic classifier
 */
export function classifyIntegrityState(
  founderState: FounderStateInput,
  diagnosticContext?: DiagnosticContext
): ClassificationResult {
  // RULE 1: PRE-COLLAPSE detection (highest priority)
  if (isPreCollapse(founderState, diagnosticContext)) {
    return {
      integrity_state: 'PRE_COLLAPSE',
      primary_signal: getPrimaryPreCollapseSignal(founderState),
      classification_reason: 'Numbness or shutdown detected',
    };
  }

  // RULE 2: DISTORTION detection
  if (isDistortion(founderState, diagnosticContext)) {
    return {
      integrity_state: 'DISTORTION',
      primary_signal: getPrimaryDistortionSignal(founderState, diagnosticContext),
      classification_reason: 'Acute fear, shame, or overwhelm detected',
    };
  }

  // RULE 3: DRIFT detection
  const driftSignals = detectDrift(founderState, diagnosticContext);
  if (hasDrift(driftSignals) || isDrift(founderState)) {
    return {
      integrity_state: 'DRIFT',
      primary_signal: getPrimaryDriftSignal(founderState, driftSignals),
      classification_reason: 'Urgency, wobble, or avoidance detected',
    };
  }

  // RULE 4: STABLE (default)
  return {
    integrity_state: 'STABLE',
    primary_signal: 'none',
    classification_reason: 'No drift signals detected',
  };
}

/**
 * PRE-COLLAPSE Detection
 * Numbness or shutdown
 */
function isPreCollapse(state: FounderStateInput, context?: DiagnosticContext): boolean {
  // Check physiological numbness
  if (state.physiological === 'numb') return true;

  // Check emotional collapse/fog (shutdown indicators)
  if (state.emotional === 'collapse' || state.emotional === 'fog') {
    // If also numb or have shutdown keywords, it's pre-collapse
    const shutdownKeywords = ['nothing', 'numb', 'empty', 'blank', 'shutdown', 'gone'];
    if (shutdownKeywords.some((kw) => state.tension_keyword.toLowerCase().includes(kw))) {
      return true;
    }
  }

  // Check diagnostic context for collapse indicators
  if (context?.current_field === 'collapse_edge') return true;
  if (context?.capacity_edge === 'shutdown') return true;

  return false;
}

/**
 * DISTORTION Detection
 * Acute fear, shame, or overwhelm
 */
function isDistortion(state: FounderStateInput, context?: DiagnosticContext): boolean {
  // Check cognitive overwhelm
  if (state.cognitive === 'overwhelmed') return true;

  // Check for shame keywords
  const shameKeywords = ['shame', 'failure', 'inadequate', 'worthless', 'bad', 'wrong'];
  if (shameKeywords.some((kw) => state.tension_keyword.toLowerCase().includes(kw))) {
    return true;
  }

  // Check for fear keywords
  const fearKeywords = ['fear', 'terror', 'panic', 'dread', 'scared'];
  if (fearKeywords.some((kw) => state.tension_keyword.toLowerCase().includes(kw))) {
    return true;
  }

  // Check distortion in diagnostic context
  if (context?.distortion_map && context.distortion_map.length > 0) {
    const distortionTypes = ['shame_spike', 'fear_spike', 'overwhelm'];
    if (distortionTypes.some((type) => context.distortion_map!.includes(type))) {
      return true;
    }
  }

  // Check capacity breach
  if (context?.capacity_edge === 'breached') return true;

  return false;
}

/**
 * DRIFT Detection
 * Urgency, wobble (oscillating), or avoidance
 */
function isDrift(state: FounderStateInput): boolean {
  // Check for urgency
  if (state.rhythm === 'urgent') return true;

  // Check for wobble (oscillating)
  if (state.rhythm === 'oscillating') return true;

  // Check for avoidance
  if (state.conflict_indicator === 'avoidance') return true;

  return false;
}

/**
 * Get primary signal for PRE_COLLAPSE state
 */
function getPrimaryPreCollapseSignal(state: FounderStateInput): string {
  if (state.physiological === 'numb') return 'numbness';
  if (state.emotional === 'collapse') return 'shutdown';
  if (state.emotional === 'fog') return 'fog';
  return 'shutdown';
}

/**
 * Get primary signal for DISTORTION state
 */
function getPrimaryDistortionSignal(state: FounderStateInput, context?: DiagnosticContext): string {
  if (state.cognitive === 'overwhelmed') return 'overwhelm';

  const shameKeywords = ['shame', 'failure', 'inadequate', 'worthless'];
  if (shameKeywords.some((kw) => state.tension_keyword.toLowerCase().includes(kw))) {
    return 'shame';
  }

  const fearKeywords = ['fear', 'terror', 'panic', 'dread'];
  if (fearKeywords.some((kw) => state.tension_keyword.toLowerCase().includes(kw))) {
    return 'fear';
  }

  if (context?.capacity_edge === 'breached') return 'overwhelm';

  return 'distortion';
}

/**
 * Get primary signal for DRIFT state
 */
function getPrimaryDriftSignal(state: FounderStateInput, driftSignals: any[]): string {
  if (state.rhythm === 'urgent') return 'urgency';
  if (state.rhythm === 'oscillating') return 'oscillating';
  if (state.conflict_indicator === 'avoidance') return 'avoidance';

  // Check drift signals for primary category
  const activeDrift = driftSignals.find((s) => s.detected);
  if (activeDrift) {
    if (activeDrift.category === 'rhythm_drift') return 'rhythm_drift';
    if (activeDrift.category === 'pressure_drift') return 'pressure';
    if (activeDrift.category === 'emotional_drift') return 'emotional_drift';
  }

  return 'drift';
}
