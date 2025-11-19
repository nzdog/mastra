/**
 * AMPLIFICATION PLANNER
 * Plans safe amplification with safeguards
 * As per SPEC.md Section 6
 *
 * Safeguards:
 * - Pace Lock: Cannot increase founder speed
 * - Embodiment Gate: Halts if body closes
 * - Urgency Kill Switch: Stops if urgency appears
 * - Micro-consent Loop: Continues only with embodied yes
 */

import { FounderStateInput } from '../models/founder_state';
import { UpwardCoherence } from '../models/coherence_packet';
import { ExpansionDetectionResult, isExpansionSafe } from './expansion_detector';
import { FalseHighDetectionResult } from './false_high_detector';
import { IntegrityState } from '../models/coherence_packet';

export interface AmplificationSafeguards {
  pace_lock_active: boolean;
  embodiment_gate_open: boolean;
  urgency_kill_switch_triggered: boolean;
  micro_consent_present: boolean;
}

export interface AmplificationPlan {
  can_amplify: boolean;
  safeguards: AmplificationSafeguards;
  upward_block: UpwardCoherence | null;
  block_reason?: string;
}

/**
 * Plan amplification with all safeguards
 */
export function planAmplification(
  founderState: FounderStateInput,
  integrityState: IntegrityState,
  expansion: ExpansionDetectionResult,
  falseHigh: FalseHighDetectionResult,
  protocolCycleComplete: boolean = false
): AmplificationPlan {
  // Check pre-conditions for amplification
  const preConditionsMet = checkPreConditions(
    integrityState,
    protocolCycleComplete,
    founderState.founder_ready_signal
  );

  if (!preConditionsMet.met) {
    return {
      can_amplify: false,
      safeguards: buildSafeguards(founderState, expansion, falseHigh),
      upward_block: null,
      block_reason: preConditionsMet.reason,
    };
  }

  // Check for false-high (treat as drift)
  if (falseHigh.false_high_detected) {
    return {
      can_amplify: false,
      safeguards: buildSafeguards(founderState, expansion, falseHigh),
      upward_block: null,
      block_reason: `False-high detected: ${falseHigh.reason}`,
    };
  }

  // Check if expansion is safe
  if (!expansion.expansion_detected || !isExpansionSafe(expansion.signals)) {
    return {
      can_amplify: false,
      safeguards: buildSafeguards(founderState, expansion, falseHigh),
      upward_block: null,
      block_reason: 'Insufficient expansion signals for safe amplification',
    };
  }

  // Build safeguards
  const safeguards = buildSafeguards(founderState, expansion, falseHigh);

  // Check all safeguards
  const allSafeguardsPass =
    !safeguards.urgency_kill_switch_triggered &&
    safeguards.embodiment_gate_open &&
    safeguards.micro_consent_present;

  if (!allSafeguardsPass) {
    return {
      can_amplify: false,
      safeguards,
      upward_block: null,
      block_reason: getSafeguardBlockReason(safeguards),
    };
  }

  // All checks passed - safe to amplify
  const upward_block = buildUpwardBlock(founderState, expansion, safeguards);

  return {
    can_amplify: true,
    safeguards,
    upward_block,
  };
}

/**
 * Check pre-conditions for amplification
 */
function checkPreConditions(
  integrityState: IntegrityState,
  protocolCycleComplete: boolean,
  founderReadySignal?: boolean
): { met: boolean; reason?: string } {
  // Must be STABLE
  if (integrityState !== 'STABLE') {
    return { met: false, reason: `Integrity state is ${integrityState}, must be STABLE` };
  }

  // Protocol cycle must be complete (or no protocol was needed)
  if (!protocolCycleComplete) {
    return { met: false, reason: 'Protocol cycle not yet complete' };
  }

  // Founder ready signal must be explicitly true
  if (founderReadySignal !== true) {
    return { met: false, reason: 'Founder ready signal not present' };
  }

  return { met: true };
}

/**
 * Build amplification safeguards
 */
function buildSafeguards(
  founderState: FounderStateInput,
  expansion: ExpansionDetectionResult,
  falseHigh: FalseHighDetectionResult
): AmplificationSafeguards {
  return {
    // Pace Lock: Ensure rhythm is stable (not urgent)
    pace_lock_active: founderState.rhythm === 'steady',

    // Embodiment Gate: Body must be open or steady
    embodiment_gate_open:
      founderState.physiological === 'open' || founderState.physiological === 'steady',

    // Urgency Kill Switch: No urgency signals
    urgency_kill_switch_triggered:
      founderState.rhythm === 'urgent' ||
      founderState.conflict_indicator === 'pressure' ||
      falseHigh.signals.urgency_present,

    // Micro-consent: Founder ready signal present
    micro_consent_present: founderState.founder_ready_signal === true,
  };
}

/**
 * Build upward coherence block
 */
function buildUpwardBlock(
  founderState: FounderStateInput,
  expansion: ExpansionDetectionResult,
  safeguards: AmplificationSafeguards
): UpwardCoherence {
  return {
    expansion_detected: true,
    amplification_safe: true,
    magnification_note: buildMagnificationNote(founderState, expansion),
    micro_actions: buildMicroActions(founderState, expansion),
  };
}

/**
 * Build magnification note (non-directive)
 */
function buildMagnificationNote(
  founderState: FounderStateInput,
  expansion: ExpansionDetectionResult
): string {
  const notes: string[] = [];

  if (expansion.signals.clarity_present) {
    notes.push('Clarity present');
  }

  if (expansion.signals.physiological_openness) {
    notes.push('Open and grounded');
  }

  if (expansion.signals.available_capacity) {
    notes.push('Capacity available');
  }

  return notes.length > 0 ? notes.join('. ') + '.' : 'Coherence stable.';
}

/**
 * Build micro-actions (1-2 stabilizing micro-steps)
 */
function buildMicroActions(
  founderState: FounderStateInput,
  expansion: ExpansionDetectionResult
): string[] {
  const actions: string[] = [];

  // Maximum 2 micro-actions
  if (expansion.signals.clarity_present && expansion.signals.stable_rhythm) {
    actions.push('Notice the clarity');
  }

  if (expansion.signals.physiological_openness && actions.length < 2) {
    actions.push('Maintain openness');
  }

  return actions;
}

/**
 * Get reason for safeguard block
 */
function getSafeguardBlockReason(safeguards: AmplificationSafeguards): string {
  if (safeguards.urgency_kill_switch_triggered) {
    return 'Urgency kill switch triggered';
  }

  if (!safeguards.embodiment_gate_open) {
    return 'Embodiment gate closed';
  }

  if (!safeguards.micro_consent_present) {
    return 'Micro-consent not present';
  }

  return 'Safeguard check failed';
}
