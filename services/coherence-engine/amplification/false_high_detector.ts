/**
 * FALSE-HIGH DETECTOR
 * Detects unsafe "positive urgency" and hype
 * As per SPEC.md Section 5.2
 *
 * False-High Signals (Unsafe):
 * - Hype
 * - Pressured excitement
 * - Oscillating rhythm
 * - Racing thoughts
 * - Disembodied uplift
 * - Positive urgency
 *
 * CRITICAL: False-high → treat as DRIFT
 */

import { FounderStateInput } from '../models/founder_state';
import { DiagnosticContext } from '../models/diagnostic_context';
import { FALSE_HIGH_SIGNAL_THRESHOLD, HYPE_KEYWORDS, EXCITED_KEYWORDS } from '../constants';

export interface FalseHighSignals {
  oscillating_rhythm: boolean;
  racing_thoughts: boolean;
  pressured_excitement: boolean;
  disembodied: boolean;
  urgency_present: boolean;
  hype_keywords: boolean;
}

export interface FalseHighDetectionResult {
  false_high_detected: boolean;
  signals: FalseHighSignals;
  signal_count: number;
  reason: string;
}

/**
 * Detect false-high signals (unsafe positive urgency)
 */
export function detectFalseHigh(
  founderState: FounderStateInput,
  diagnosticContext?: DiagnosticContext
): FalseHighDetectionResult {
  const signals: FalseHighSignals = {
    oscillating_rhythm: founderState.rhythm === 'oscillating',
    racing_thoughts: founderState.cognitive === 'looping' && founderState.rhythm !== 'steady',
    pressured_excitement:
      founderState.conflict_indicator === 'pressure' && founderState.emotional !== 'fog',
    disembodied:
      founderState.founder_ready_signal === false ||
      (founderState.physiological !== 'open' &&
        founderState.physiological !== 'steady' &&
        founderState.emotional === 'open'),
    urgency_present:
      founderState.rhythm === 'urgent' || founderState.conflict_indicator === 'pressure',
    hype_keywords: checkHypeKeywords(founderState.tension_keyword),
  };

  const signalCount = Object.values(signals).filter(Boolean).length;

  // Even ONE false-high signal means unsafe for amplification
  const false_high_detected = signalCount > FALSE_HIGH_SIGNAL_THRESHOLD;

  const reason = false_high_detected
    ? `False-high detected: ${getActiveSignals(signals).join(', ')}`
    : 'No false-high signals';

  return {
    false_high_detected,
    signals,
    signal_count: signalCount,
    reason,
  };
}

/**
 * Check for hype-related keywords
 */
function checkHypeKeywords(keyword: string): boolean {
  return HYPE_KEYWORDS.some((kw) => keyword.toLowerCase().includes(kw));
}

/**
 * Get list of active false-high signals
 */
function getActiveSignals(signals: FalseHighSignals): string[] {
  const active: string[] = [];

  if (signals.oscillating_rhythm) active.push('oscillating_rhythm');
  if (signals.racing_thoughts) active.push('racing_thoughts');
  if (signals.pressured_excitement) active.push('pressured_excitement');
  if (signals.disembodied) active.push('disembodied');
  if (signals.urgency_present) active.push('urgency_present');
  if (signals.hype_keywords) active.push('hype_keywords');

  return active;
}

/**
 * Check if state appears positive but is actually unsafe
 */
export function isUnsafePositive(
  founderState: FounderStateInput,
  falseHigh: FalseHighDetectionResult
): boolean {
  // Appears positive (open emotions, excited keywords)
  const appearsPositive =
    founderState.emotional === 'open' ||
    EXCITED_KEYWORDS.some((kw) => founderState.tension_keyword.toLowerCase().includes(kw));

  // But has false-high signals
  return appearsPositive && falseHigh.false_high_detected;
}
