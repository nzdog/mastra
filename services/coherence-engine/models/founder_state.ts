/**
 * FOUNDER STATE INPUT MODEL
 * Real-time state signals from the founder
 * As per SPEC.md Section 1.1
 */

import { MAX_TENSION_KEYWORD_LENGTH } from '../constants';

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
export function isValidFounderState(state: unknown): state is FounderStateInput {
  if (!state || typeof state !== 'object') return false;

  // Type assertion after object check
  const s = state as Record<string, unknown>;

  const validPhysiological = ['open', 'tight', 'numb', 'agitated', 'steady'];
  const validRhythm = ['steady', 'fragmented', 'urgent', 'oscillating'];
  const validEmotional = ['open', 'constricted', 'fog', 'collapse'];
  const validCognitive = ['clear', 'looping', 'overwhelmed'];
  const validConflict = ['none', 'avoidance', 'tension', 'pressure'];

  // Validate tension_keyword: must be string, trimmed, and within length limit
  if (typeof s.tension_keyword !== 'string') return false;
  const trimmedKeyword = s.tension_keyword.trim();
  if (trimmedKeyword.length === 0 || trimmedKeyword.length > MAX_TENSION_KEYWORD_LENGTH) {
    return false;
  }

  return (
    typeof s.physiological === 'string' &&
    validPhysiological.includes(s.physiological) &&
    typeof s.rhythm === 'string' &&
    validRhythm.includes(s.rhythm) &&
    typeof s.emotional === 'string' &&
    validEmotional.includes(s.emotional) &&
    typeof s.cognitive === 'string' &&
    validCognitive.includes(s.cognitive) &&
    typeof s.conflict_indicator === 'string' &&
    validConflict.includes(s.conflict_indicator) &&
    (s.founder_led_readiness_signal === undefined ||
      typeof s.founder_led_readiness_signal === 'boolean')
  );
}
