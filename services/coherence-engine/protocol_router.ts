/**
 * PROTOCOL ROUTER
 * Maps integrity state + primary signal to protocol routes
 * As per MVP_SLICE.md routing table
 *
 * CRITICAL: This is deterministic routing based on present state only
 */

import { IntegrityState } from './models/coherence_packet';
import { ClassificationResult } from './classification/integrity_classifier';

export interface ProtocolRoute {
  protocol: string | null;
  exit_precursor: boolean;
}

/**
 * Protocol routing table (deterministic mapping)
 */
const ROUTING_TABLE: Record<string, string> = {
  // DRIFT routes
  'DRIFT:urgency': 'holding_my_rhythm',
  'DRIFT:avoidance': 'what_am_i_avoiding',
  'DRIFT:oscillating': 'grounding_sequence',
  'DRIFT:rhythm_drift': 'holding_my_rhythm',
  'DRIFT:pressure': 'holding_my_rhythm',
  'DRIFT:emotional_drift': 'grounding_sequence',
  'DRIFT:drift': 'grounding_sequence', // Generic drift

  // DISTORTION routes
  'DISTORTION:shame': 'shame_release',
  'DISTORTION:fear': 'fear_mapping',
  'DISTORTION:overwhelm': 'capacity_reset',
  'DISTORTION:distortion': 'capacity_reset', // Generic distortion

  // PRE_COLLAPSE routes
  'PRE_COLLAPSE:numbness': 'emergency_grounding',
  'PRE_COLLAPSE:shutdown': 'exit_precursor', // Special: triggers exit flag
  'PRE_COLLAPSE:fog': 'emergency_grounding',

  // STABLE has no protocol route
  'STABLE:none': 'none',
};

/**
 * Route to appropriate protocol based on classification
 */
export function routeToProtocol(classification: ClassificationResult): ProtocolRoute {
  const { integrity_state, primary_signal } = classification;

  // STABLE state: no protocol needed
  if (integrity_state === 'STABLE') {
    return {
      protocol: null,
      exit_precursor: false,
    };
  }

  // Build lookup key
  const lookupKey = `${integrity_state}:${primary_signal}`;

  // Check routing table
  const route = ROUTING_TABLE[lookupKey];

  if (!route) {
    // Fallback to generic route for integrity state
    return getFallbackRoute(integrity_state);
  }

  // Check for exit precursor flag
  if (route === 'exit_precursor') {
    return {
      protocol: 'emergency_grounding',
      exit_precursor: true,
    };
  }

  // Check if route is 'none' (shouldn't happen for non-STABLE states, but safety)
  if (route === 'none') {
    return {
      protocol: null,
      exit_precursor: false,
    };
  }

  return {
    protocol: route,
    exit_precursor: integrity_state === 'PRE_COLLAPSE',
  };
}

/**
 * Fallback routing for unmapped signals
 */
function getFallbackRoute(integrityState: IntegrityState): ProtocolRoute {
  switch (integrityState) {
    case 'DRIFT':
      return {
        protocol: 'grounding_sequence',
        exit_precursor: false,
      };
    case 'DISTORTION':
      return {
        protocol: 'capacity_reset',
        exit_precursor: false,
      };
    case 'PRE_COLLAPSE':
      return {
        protocol: 'emergency_grounding',
        exit_precursor: true,
      };
    case 'STABLE':
      return {
        protocol: null,
        exit_precursor: false,
      };
  }
}

/**
 * Get protocol description (for debugging/logging)
 */
export function getProtocolDescription(protocolSlug: string | null): string {
  const descriptions: Record<string, string> = {
    holding_my_rhythm: 'Restore founder rhythm and reduce urgency',
    what_am_i_avoiding: 'Surface and address avoidance patterns',
    grounding_sequence: 'Ground and stabilise present-state awareness',
    shame_release: 'Release shame without bypassing',
    fear_mapping: 'Map and contain fear without collapsing',
    capacity_reset: 'Reset to sustainable capacity baseline',
    emergency_grounding: 'Emergency stabilisation for collapse prevention',
  };

  return protocolSlug ? descriptions[protocolSlug] || 'Unknown protocol' : 'No protocol required';
}
