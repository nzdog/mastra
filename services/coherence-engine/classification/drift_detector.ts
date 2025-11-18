/**
 * DRIFT DETECTOR
 * Detects 6 categories of drift from founder state
 * As per SPEC.md Section 4.1
 * 
 * CRITICAL: This is present-state only detection, no prediction
 */

import { FounderStateInput } from '../models/founder_state';
import { DiagnosticContext } from '../models/diagnostic_context';

export type DriftCategory = 
  | 'emotional_drift'
  | 'rhythm_drift'
  | 'cognitive_drift'
  | 'field_drift'
  | 'relational_drift'
  | 'pressure_drift';

export interface DriftSignal {
  category: DriftCategory;
  detected: boolean;
  signal: string;
}

/**
 * Detect all drift categories from founder state
 */
export function detectDrift(
  founderState: FounderStateInput,
  diagnosticContext?: DiagnosticContext
): DriftSignal[] {
  const signals: DriftSignal[] = [];

  // Emotional Drift
  signals.push(detectEmotionalDrift(founderState));

  // Rhythm Drift
  signals.push(detectRhythmDrift(founderState));

  // Cognitive Drift
  signals.push(detectCognitiveDrift(founderState));

  // Field Drift
  signals.push(detectFieldDrift(founderState, diagnosticContext));

  // Relational Drift
  signals.push(detectRelationalDrift(founderState));

  // Pressure Drift
  signals.push(detectPressureDrift(founderState));

  return signals;
}

/**
 * Emotional Drift Detection
 */
function detectEmotionalDrift(state: FounderStateInput): DriftSignal {
  const driftStates = ['constricted', 'fog', 'collapse'];
  const detected = driftStates.includes(state.emotional);

  return {
    category: 'emotional_drift',
    detected,
    signal: detected ? `emotional_state: ${state.emotional}` : ''
  };
}

/**
 * Rhythm Drift Detection
 */
function detectRhythmDrift(state: FounderStateInput): DriftSignal {
  const driftRhythms = ['fragmented', 'urgent', 'oscillating'];
  const detected = driftRhythms.includes(state.rhythm);

  return {
    category: 'rhythm_drift',
    detected,
    signal: detected ? `rhythm: ${state.rhythm}` : ''
  };
}

/**
 * Cognitive Drift Detection
 */
function detectCognitiveDrift(state: FounderStateInput): DriftSignal {
  const driftStates = ['looping', 'overwhelmed'];
  const detected = driftStates.includes(state.cognitive);

  return {
    category: 'cognitive_drift',
    detected,
    signal: detected ? `cognitive_state: ${state.cognitive}` : ''
  };
}

/**
 * Field Drift Detection
 */
function detectFieldDrift(
  state: FounderStateInput,
  context?: DiagnosticContext
): DriftSignal {
  let detected = false;
  let signal = '';

  // Check diagnostic context for field drift
  if (context?.field_drift_direction && context.field_drift_direction !== 'stable') {
    detected = true;
    signal = `field_drift: ${context.field_drift_direction}`;
  }

  // Check coherence score
  if (context?.coherence_score !== undefined && context.coherence_score < 0.5) {
    detected = true;
    signal = signal ? `${signal}, low_coherence: ${context.coherence_score}` : `low_coherence: ${context.coherence_score}`;
  }

  return {
    category: 'field_drift',
    detected,
    signal
  };
}

/**
 * Relational Drift Detection
 */
function detectRelationalDrift(state: FounderStateInput): DriftSignal {
  const driftIndicators = ['avoidance', 'tension', 'pressure'];
  const detected = driftIndicators.includes(state.conflict_indicator);

  return {
    category: 'relational_drift',
    detected,
    signal: detected ? `conflict: ${state.conflict_indicator}` : ''
  };
}

/**
 * Pressure Drift Detection
 */
function detectPressureDrift(state: FounderStateInput): DriftSignal {
  const pressureKeywords = [
    'deadline', 'urgent', 'rushed', 'pressure', 'stressed',
    'overwhelmed', 'too_much', 'behind', 'late', 'hurry'
  ];

  const detected = 
    state.conflict_indicator === 'pressure' ||
    pressureKeywords.some(keyword => 
      state.tension_keyword.toLowerCase().includes(keyword)
    );

  return {
    category: 'pressure_drift',
    detected,
    signal: detected ? `pressure: ${state.tension_keyword}` : ''
  };
}

/**
 * Check if any drift is detected
 */
export function hasDrift(signals: DriftSignal[]): boolean {
  return signals.some(signal => signal.detected);
}

/**
 * Get all active drift signals
 */
export function getActiveDriftSignals(signals: DriftSignal[]): DriftSignal[] {
  return signals.filter(signal => signal.detected);
}

