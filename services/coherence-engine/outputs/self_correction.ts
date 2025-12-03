/**
 * SELF-CORRECTION SYSTEM
 * Handles drift detection and output regeneration
 * As per SPEC.md Section 9.2
 *
 * Self-correction sequence:
 * 1. reject_output()
 * 2. reset_engine_state()
 * 3. enforce_role_contract()
 * 4. reclassify_present_state()
 */

import { checkForDrift, DriftViolation } from './drift_guard';
import { CoherencePacket } from '../models/coherence_packet';

const MAX_CORRECTION_ATTEMPTS = 3;

export interface CorrectionResult {
  success: boolean;
  attempts: number;
  final_output: CoherencePacket | null;
  violations_history: DriftViolation[][];
}

/**
 * Self-correction state (reset between attempts)
 */
interface EngineState {
  attempt_count: number;
  role_contract_enforced: boolean;
}

/**
 * Role contract enforcement
 * Re-affirms what the engine is and is not allowed to do
 */
function enforceRoleContract(): void {
  // This is a conceptual reset - in a more complex system,
  // this would reset any internal LLM context or state
  // For now, it's a documentation of the contract

  const CONTRACT = {
    allowed: [
      'Present-state reflection only',
      'Integrity classification',
      'Protocol routing',
      'One-line stabilisation cues',
    ],
    forbidden: [
      'Future references',
      'Advice',
      'Motivation',
      'Emotional validation',
      'Strategy',
      'Therapy',
    ],
  };

  // In production, this would be logged or used to reset AI context
  // For deterministic system, this is implicit in the output builder
}

/**
 * Reset engine state between correction attempts
 */
function resetEngineState(state: EngineState): void {
  state.role_contract_enforced = false;
  // Additional state resets would go here
}

/**
 * Attempt self-correction on drift violations
 *
 * NOTE: In this deterministic implementation, the output builder
 * should never produce drift. This is a safety net for future
 * AI-powered implementations or bugs in the output generator.
 */
export async function attemptSelfCorrection(
  outputGenerator: () => CoherencePacket | Promise<CoherencePacket>
): Promise<CorrectionResult> {
  const state: EngineState = {
    attempt_count: 0,
    role_contract_enforced: false,
  };

  const violations_history: DriftViolation[][] = [];

  while (state.attempt_count < MAX_CORRECTION_ATTEMPTS) {
    state.attempt_count++;

    // Generate output
    const output = await outputGenerator();

    // Check for drift
    const stateReflectionDrift = checkForDrift(output.state_reflection);
    const cueDrift = output.stabilisation_cue ? checkForDrift(output.stabilisation_cue) : [];
    const allViolations = [...stateReflectionDrift, ...cueDrift];

    if (allViolations.length === 0) {
      // Clean output - return success
      return {
        success: true,
        attempts: state.attempt_count,
        final_output: output,
        violations_history,
      };
    }

    // Drift detected - record and attempt correction
    violations_history.push(allViolations);

    if (state.attempt_count < MAX_CORRECTION_ATTEMPTS) {
      // Reject output
      // Reset state
      resetEngineState(state);

      // Enforce role contract
      enforceRoleContract();
      state.role_contract_enforced = true;

      // Continue to next attempt (reclassify happens in next iteration)
      continue;
    }
  }

  // Failed to correct after max attempts
  return {
    success: false,
    attempts: state.attempt_count,
    final_output: null,
    violations_history,
  };
}

/**
 * Simple validation without regeneration
 * Returns violations if found
 */
export function validateOutput(output: CoherencePacket): DriftViolation[] {
  const stateReflectionDrift = checkForDrift(output.state_reflection);
  const cueDrift = output.stabilisation_cue ? checkForDrift(output.stabilisation_cue) : [];

  return [...stateReflectionDrift, ...cueDrift];
}
