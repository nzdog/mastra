/**
 * EXPANSION DETECTOR
 * Detects clean upward coherence signals
 * As per SPEC.md Section 5.1
 * 
 * Expansion Signals:
 * - Physiological openness
 * - Grounded breath
 * - Stable rhythm + available capacity
 * - Clarity spike
 * - Calm excitement
 * - No urgency
 * - Embodied readiness
 */

import { FounderStateInput } from '../models/founder_state';
import { DiagnosticContext } from '../models/diagnostic_context';

export interface ExpansionSignals {
  physiological_openness: boolean;
  stable_rhythm: boolean;
  clarity_present: boolean;
  calm_state: boolean;
  no_urgency: boolean;
  embodied_readiness: boolean;
  available_capacity: boolean;
}

export interface ExpansionDetectionResult {
  expansion_detected: boolean;
  signals: ExpansionSignals;
  signal_count: number;
  signal_strength: number; // 0-1
}

/**
 * Detect expansion signals from founder state
 */
export function detectExpansion(
  founderState: FounderStateInput,
  diagnosticContext?: DiagnosticContext
): ExpansionDetectionResult {
  const signals: ExpansionSignals = {
    physiological_openness: founderState.physiological === 'open' || founderState.physiological === 'steady',
    stable_rhythm: founderState.rhythm === 'steady',
    clarity_present: founderState.cognitive === 'clear',
    calm_state: founderState.emotional === 'open',
    no_urgency: founderState.rhythm !== 'urgent' && founderState.conflict_indicator !== 'pressure',
    embodied_readiness: founderState.founder_ready_signal === true,
    available_capacity: checkAvailableCapacity(diagnosticContext)
  };

  // Count active signals
  const signalCount = Object.values(signals).filter(Boolean).length;
  const totalSignals = Object.keys(signals).length;
  const signalStrength = signalCount / totalSignals;

  // Expansion detected if most signals are present (threshold: 5/7 = 0.71)
  const expansion_detected = signalCount >= 5;

  return {
    expansion_detected,
    signals,
    signal_count: signalCount,
    signal_strength: signalStrength
  };
}

/**
 * Check if founder has available capacity
 */
function checkAvailableCapacity(context?: DiagnosticContext): boolean {
  if (!context) return true; // Assume capacity if no diagnostic context

  // Check coherence score
  if (context.coherence_score !== undefined && context.coherence_score < 0.6) {
    return false;
  }

  // Check capacity edge
  if (context.capacity_edge === 'breached' || context.capacity_edge === 'at_limit') {
    return false;
  }

  return true;
}

/**
 * Check if expansion is safe to amplify
 * All critical signals must be present
 */
export function isExpansionSafe(signals: ExpansionSignals): boolean {
  // Critical signals that MUST be present for safe amplification
  const criticalSignals = [
    signals.stable_rhythm,
    signals.no_urgency,
    signals.calm_state
  ];

  return criticalSignals.every(Boolean);
}

