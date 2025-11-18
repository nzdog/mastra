/**
 * SELF-CORRECTION SYSTEM (PHASE 3)
 * Handles drift detection and output regeneration
 * As per SPEC.md Section 9.2
 * 
 * Self-correction sequence:
 * 1. reject_output()
 * 2. reset_engine_state()
 * 3. enforce_role_contract()
 * 4. reclassify_present_state()
 * 
 * FOUNDER NEVER SEES DRIFT OUTPUTS
 */

import { checkForDrift, DriftViolation, validateOutputPacket } from './drift_guard';
import { CoherencePacket, UpwardCoherence } from '../models/coherence_packet';
import { FounderStateInput, DiagnosticContext } from '../models';
import { classifyIntegrityState } from '../classification';
import { routeToProtocol } from '../protocol_router';
import { buildCoherencePacket } from './output_builder';

const MAX_CORRECTION_ATTEMPTS = 3;

/**
 * Drift monitoring state
 */
export interface DriftMonitoring {
  total_drift_detections: number;
  total_corrections: number;
  total_correction_failures: number;
  drift_by_type: Record<string, number>;
  last_drift_timestamp?: Date;
}

const DRIFT_MONITOR: DriftMonitoring = {
  total_drift_detections: 0,
  total_corrections: 0,
  total_correction_failures: 0,
  drift_by_type: {}
};

export function getDriftMonitoring(): DriftMonitoring {
  return { ...DRIFT_MONITOR };
}

export function resetDriftMonitoring(): void {
  DRIFT_MONITOR.total_drift_detections = 0;
  DRIFT_MONITOR.total_corrections = 0;
  DRIFT_MONITOR.total_correction_failures = 0;
  DRIFT_MONITOR.drift_by_type = {};
  DRIFT_MONITOR.last_drift_timestamp = undefined;
}

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
      'One-line stabilisation cues'
    ],
    forbidden: [
      'Future references',
      'Advice',
      'Motivation',
      'Emotional validation',
      'Strategy',
      'Therapy'
    ]
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
    role_contract_enforced: false
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
        violations_history
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
    violations_history
  };
}

/**
 * Simple validation without regeneration
 * Returns violations if found
 */
export function validateOutput(output: CoherencePacket): DriftViolation[] {
  const result = validateOutputPacket(output);
  
  // Also check upward block if present
  if (output.upward) {
    const magnificationDrift = output.upward.magnification_note ? 
      checkForDrift(output.upward.magnification_note) : [];
    const microActionsDrift = output.upward.micro_actions ?
      output.upward.micro_actions.flatMap(action => checkForDrift(action)) : [];
    
    return [...result.violations, ...magnificationDrift, ...microActionsDrift];
  }
  
  return result.violations;
}

/**
 * Log drift detection for monitoring
 */
function logDriftDetection(violations: DriftViolation[]): void {
  DRIFT_MONITOR.total_drift_detections++;
  DRIFT_MONITOR.last_drift_timestamp = new Date();
  
  for (const violation of violations) {
    const type = violation.type;
    DRIFT_MONITOR.drift_by_type[type] = (DRIFT_MONITOR.drift_by_type[type] || 0) + 1;
  }
  
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[DRIFT DETECTED]', {
      count: violations.length,
      types: violations.map(v => v.type),
      samples: violations.slice(0, 3).map(v => v.detected_in)
    });
  }
}

/**
 * PHASE 3: Complete self-correction with regeneration
 * This function wraps the output generation and applies the full
 * self-correction sequence if drift is detected.
 * 
 * @param founderState Current founder state
 * @param diagnosticContext Optional diagnostic context
 * @param upwardBlock Optional upward coherence block (for Phase 2)
 * @returns CorrectionResult with clean output or failure
 */
export async function generateWithSelfCorrection(
  founderState: FounderStateInput,
  diagnosticContext?: DiagnosticContext,
  upwardBlock?: UpwardCoherence | null
): Promise<CorrectionResult> {
  const state: EngineState = {
    attempt_count: 0,
    role_contract_enforced: false
  };

  const violations_history: DriftViolation[][] = [];

  while (state.attempt_count < MAX_CORRECTION_ATTEMPTS) {
    state.attempt_count++;

    // 1. RECLASSIFY PRESENT STATE (fresh classification each attempt)
    const classification = classifyIntegrityState(founderState, diagnosticContext);
    const route = routeToProtocol(classification);
    
    // 2. BUILD OUTPUT
    let output = buildCoherencePacket(founderState, classification, route);
    
    // Add upward block if provided (Phase 2)
    if (upwardBlock) {
      output = { ...output, upward: upwardBlock };
    }

    // 3. CHECK FOR DRIFT
    const violations = validateOutput(output);

    if (violations.length === 0) {
      // CLEAN OUTPUT - SUCCESS
      if (state.attempt_count > 1) {
        DRIFT_MONITOR.total_corrections++;
      }
      
      return {
        success: true,
        attempts: state.attempt_count,
        final_output: output,
        violations_history
      };
    }

    // 4. DRIFT DETECTED - REJECT OUTPUT
    logDriftDetection(violations);
    violations_history.push(violations);

    if (state.attempt_count < MAX_CORRECTION_ATTEMPTS) {
      // 5. RESET ENGINE STATE
      resetEngineState(state);
      
      // 6. ENFORCE ROLE CONTRACT
      enforceRoleContract();
      state.role_contract_enforced = true;

      // 7. CONTINUE TO NEXT ATTEMPT (loop will reclassify)
      continue;
    }
  }

  // FAILED TO CORRECT AFTER MAX ATTEMPTS
  DRIFT_MONITOR.total_correction_failures++;
  
  console.error('[SELF-CORRECTION FAILURE]', {
    attempts: state.attempt_count,
    total_violations: violations_history.flat().length,
    violation_types: [...new Set(violations_history.flat().map(v => v.type))]
  });

  return {
    success: false,
    attempts: state.attempt_count,
    final_output: null,
    violations_history
  };
}

/**
 * TEST UTILITY: Inject drift into output for testing self-correction
 * This is ONLY used in tests to verify the self-correction loop works
 */
export function injectDriftForTesting(
  output: CoherencePacket,
  driftType: 'future' | 'advice' | 'motivation' | 'emotional'
): CoherencePacket {
  const driftExamples = {
    future: ' You will feel better soon.',
    advice: ' You should try taking a break.',
    motivation: ' You can do it, keep going.',
    emotional: " It's okay, don't worry."
  };

  return {
    ...output,
    state_reflection: output.state_reflection + driftExamples[driftType]
  };
}

