/**
 * OUTPUT BUILDER TESTS
 * Tests for CoherencePacket generation
 * As per TESTS.md Section 3
 */

import { describe, it, expect } from 'vitest';
import { buildCoherencePacket } from '../outputs/output_builder';
import { FounderStateInput } from '../models/founder_state';
import { classifyIntegrityState } from '../classification/integrity_classifier';
import { routeToProtocol } from '../protocol_router';
import { isCleanOutput } from '../outputs/drift_guard';

describe('Output Schema Integrity', () => {
  it('should produce valid CoherencePacket structure', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(packet).toHaveProperty('integrity_state');
    expect(packet).toHaveProperty('state_reflection');
    expect(packet).toHaveProperty('protocol_route');
    expect(packet).toHaveProperty('stabilisation_cue');
    expect(packet).toHaveProperty('exit_precursor');
    expect(packet).toHaveProperty('upward');
  });

  it('should have upward as null in Phase 1', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(packet.upward).toBeNull();
  });

  it('should have exit_precursor as boolean', () => {
    const state: FounderStateInput = {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'nothing',
      conflict_indicator: 'none'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(typeof packet.exit_precursor).toBe('boolean');
  });
});

describe('State Reflection Output', () => {
  it('should produce clean reflection for DRIFT', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(isCleanOutput(packet.state_reflection)).toBe(true);
    expect(packet.state_reflection).toContain('Urgency');
  });

  it('should produce clean reflection for DISTORTION', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'oscillating',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'failure',
      conflict_indicator: 'tension'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(isCleanOutput(packet.state_reflection)).toBe(true);
    expect(packet.state_reflection).toContain('Shame');
  });

  it('should produce clean reflection for PRE_COLLAPSE', () => {
    const state: FounderStateInput = {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'nothing',
      conflict_indicator: 'none'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(isCleanOutput(packet.state_reflection)).toBe(true);
    expect(packet.state_reflection).toContain('Numbness');
  });

  it('should produce clean reflection for STABLE', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(isCleanOutput(packet.state_reflection)).toBe(true);
  });
});

describe('Stabilisation Cue Output', () => {
  it('should produce "Pause." for urgency', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(packet.stabilisation_cue).toBe('Pause.');
  });

  it('should produce "Stop." for PRE_COLLAPSE', () => {
    const state: FounderStateInput = {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'nothing',
      conflict_indicator: 'none'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(packet.stabilisation_cue).toBe('Stop.');
  });

  it('should produce null cue for STABLE', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none'
    };

    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    expect(packet.stabilisation_cue).toBeNull();
  });

  it('should ensure all cues are clean (no drift)', () => {
    const testStates: FounderStateInput[] = [
      {
        physiological: 'tight',
        rhythm: 'urgent',
        emotional: 'constricted',
        cognitive: 'looping',
        tension_keyword: 'deadline',
        conflict_indicator: 'pressure'
      },
      {
        physiological: 'numb',
        rhythm: 'fragmented',
        emotional: 'fog',
        cognitive: 'overwhelmed',
        tension_keyword: 'nothing',
        conflict_indicator: 'none'
      },
      {
        physiological: 'tight',
        rhythm: 'oscillating',
        emotional: 'constricted',
        cognitive: 'looping',
        tension_keyword: 'failure',
        conflict_indicator: 'tension'
      }
    ];

    testStates.forEach(state => {
      const classification = classifyIntegrityState(state);
      const route = routeToProtocol(classification);
      const packet = buildCoherencePacket(state, classification, route);

      if (packet.stabilisation_cue) {
        expect(isCleanOutput(packet.stabilisation_cue)).toBe(true);
      }
    });
  });
});

