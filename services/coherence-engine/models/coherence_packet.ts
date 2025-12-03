/**
 * COHERENCE PACKET MODEL
 * Complete output from the Coherence Engine
 * As per SPEC.md Section 2
 */

export type IntegrityState = 'STABLE' | 'DRIFT' | 'DISTORTION' | 'PRE_COLLAPSE';

/**
 * Upward Coherence Block (Phase 2 - not implemented in MVP)
 */
export interface UpwardCoherence {
  expansion_detected: boolean;
  amplification_safe: boolean;
  magnification_note?: string;
  micro_actions?: string[];
}

/**
 * Complete output packet from Coherence Engine
 */
export interface CoherencePacket {
  integrity_state: IntegrityState;
  state_reflection: string;
  protocol_route: string | null;
  stabilisation_cue: string | null;
  exit_precursor: boolean;
  upward: UpwardCoherence | null; // Always null in Phase 1 (stabilisation-only)
}

/**
 * Validation helper
 */
export function isValidCoherencePacket(packet: unknown): packet is CoherencePacket {
  if (!packet || typeof packet !== 'object') return false;

  // Type assertion after object check
  const p = packet as Record<string, any>;

  const validIntegrityStates = ['STABLE', 'DRIFT', 'DISTORTION', 'PRE_COLLAPSE'];

  return (
    validIntegrityStates.includes(p.integrity_state) &&
    typeof p.state_reflection === 'string' &&
    (p.protocol_route === null || typeof p.protocol_route === 'string') &&
    (p.stabilisation_cue === null || typeof p.stabilisation_cue === 'string') &&
    typeof p.exit_precursor === 'boolean' &&
    (p.upward === null || isValidUpwardCoherence(p.upward))
  );
}

function isValidUpwardCoherence(upward: unknown): upward is UpwardCoherence {
  if (!upward || typeof upward !== 'object') return false;

  // Type assertion after object check
  const u = upward as Record<string, any>;

  return (
    typeof u.expansion_detected === 'boolean' &&
    typeof u.amplification_safe === 'boolean' &&
    (u.magnification_note === undefined || typeof u.magnification_note === 'string') &&
    (u.micro_actions === undefined || Array.isArray(u.micro_actions))
  );
}
