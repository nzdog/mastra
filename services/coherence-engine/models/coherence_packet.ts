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
export function isValidCoherencePacket(packet: any): packet is CoherencePacket {
  if (!packet || typeof packet !== 'object') return false;

  const validIntegrityStates = ['STABLE', 'DRIFT', 'DISTORTION', 'PRE_COLLAPSE'];

  return (
    validIntegrityStates.includes(packet.integrity_state) &&
    typeof packet.state_reflection === 'string' &&
    (packet.protocol_route === null || typeof packet.protocol_route === 'string') &&
    (packet.stabilisation_cue === null || typeof packet.stabilisation_cue === 'string') &&
    typeof packet.exit_precursor === 'boolean' &&
    (packet.upward === null || isValidUpwardCoherence(packet.upward))
  );
}

function isValidUpwardCoherence(upward: any): upward is UpwardCoherence {
  if (!upward || typeof upward !== 'object') return false;

  return (
    typeof upward.expansion_detected === 'boolean' &&
    typeof upward.amplification_safe === 'boolean' &&
    (upward.magnification_note === undefined || typeof upward.magnification_note === 'string') &&
    (upward.micro_actions === undefined || Array.isArray(upward.micro_actions))
  );
}
