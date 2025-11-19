/**
 * FOUNDER STATE INPUT MODEL
 * Real-time state signals from the founder
 * As per SPEC.md Section 1.1
 */

export type PhysiologicalState = 'open' | 'tight' | 'numb' | 'agitated' | 'steady';
export type Rhythm = 'steady' | 'fragmented' | 'urgent' | 'oscillating';
export type EmotionalState = 'open' | 'constricted' | 'fog' | 'collapse';
export type CognitiveState = 'clear' | 'looping' | 'overwhelmed';
export type ConflictIndicator = 'none' | 'avoidance' | 'tension' | 'pressure';

export interface FounderStateInput {
  physiological: PhysiologicalState;
  rhythm: Rhythm;
  emotional: EmotionalState;
  cognitive: CognitiveState;
  tension_keyword: string;
  conflict_indicator: ConflictIndicator;
  founder_led_readiness_signal?: boolean; // Optional embodied "yes" for amplification
}

/**
 * Validation helper
 */
export function isValidFounderState(state: any): state is FounderStateInput {
  if (!state || typeof state !== 'object') return false;

  const validPhysiological = ['open', 'tight', 'numb', 'agitated', 'steady'];
  const validRhythm = ['steady', 'fragmented', 'urgent', 'oscillating'];
  const validEmotional = ['open', 'constricted', 'fog', 'collapse'];
  const validCognitive = ['clear', 'looping', 'overwhelmed'];
  const validConflict = ['none', 'avoidance', 'tension', 'pressure'];

  return (
    validPhysiological.includes(state.physiological) &&
    validRhythm.includes(state.rhythm) &&
    validEmotional.includes(state.emotional) &&
    validCognitive.includes(state.cognitive) &&
    typeof state.tension_keyword === 'string' &&
    validConflict.includes(state.conflict_indicator) &&
    (state.founder_led_readiness_signal === undefined ||
      typeof state.founder_led_readiness_signal === 'boolean')
  );
}
