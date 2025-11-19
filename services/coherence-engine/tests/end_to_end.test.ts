/**
 * END-TO-END SCENARIO TESTS
 * Full flow tests from input to output
 * As per TESTS.md Section 9
 */

import { describe, it, expect } from 'vitest';
import { FounderStateInput } from '../models/founder_state';
import { classifyIntegrityState } from '../classification/integrity_classifier';
import { routeToProtocol } from '../protocol_router';
import { buildCoherencePacket } from '../outputs/output_builder';
import { isCleanOutput } from '../outputs/drift_guard';

describe('End-to-End Scenarios', () => {
  it('should handle urgency spike → DRIFT → holding_my_rhythm → one-line cue', () => {
    // Input: Urgency spike
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
    };

    // Process
    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    // Assertions
    expect(classification.integrity_state).toBe('DRIFT');
    expect(route.protocol).toBe('holding_my_rhythm');
    expect(route.exit_precursor).toBe(false);
    expect(packet.stabilisation_cue).toBe('Pause.');
    expect(isCleanOutput(packet.state_reflection)).toBe(true);
    expect(isCleanOutput(packet.stabilisation_cue!)).toBe(true);
  });

  it('should handle numbness → PRE_COLLAPSE → emergency_grounding → exit flag', () => {
    // Input: Numbness/shutdown
    const state: FounderStateInput = {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'nothing',
      conflict_indicator: 'avoidance',
    };

    // Process
    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    // Assertions
    expect(classification.integrity_state).toBe('PRE_COLLAPSE');
    expect(route.protocol).toBe('emergency_grounding');
    expect(route.exit_precursor).toBe(true);
    expect(packet.exit_precursor).toBe(true);
    expect(packet.stabilisation_cue).toBe('Stop.');
    expect(isCleanOutput(packet.state_reflection)).toBe(true);
  });

  it('should handle shame → DISTORTION → shame_release → stabilisation cue', () => {
    // Input: Shame spike
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'oscillating',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'failure',
      conflict_indicator: 'tension',
    };

    // Process
    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    // Assertions
    expect(classification.integrity_state).toBe('DISTORTION');
    expect(route.protocol).toBe('shame_release');
    expect(route.exit_precursor).toBe(false);
    expect(packet.stabilisation_cue).toBe('Ground.');
    expect(isCleanOutput(packet.state_reflection)).toBe(true);
  });

  it('should handle calm founder → STABLE → no protocol → no cue', () => {
    // Input: Calm, coherent state
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
    };

    // Process
    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    // Assertions
    expect(classification.integrity_state).toBe('STABLE');
    expect(route.protocol).toBeNull();
    expect(route.exit_precursor).toBe(false);
    expect(packet.protocol_route).toBeNull();
    expect(packet.stabilisation_cue).toBeNull();
    expect(isCleanOutput(packet.state_reflection)).toBe(true);
  });

  it('should handle avoidance pattern → DRIFT → what_am_i_avoiding', () => {
    // Input: Avoidance pattern
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'steady',
      emotional: 'constricted',
      cognitive: 'clear',
      tension_keyword: 'busy',
      conflict_indicator: 'avoidance',
    };

    // Process
    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    // Assertions
    expect(classification.integrity_state).toBe('DRIFT');
    expect(route.protocol).toBe('what_am_i_avoiding');
    expect(packet.stabilisation_cue).toBe('Notice.');
    expect(isCleanOutput(packet.state_reflection)).toBe(true);
  });

  it('should handle overwhelm → DISTORTION → capacity_reset', () => {
    // Input: Overwhelm
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'fragmented',
      emotional: 'constricted',
      cognitive: 'overwhelmed',
      tension_keyword: 'too_much',
      conflict_indicator: 'pressure',
    };

    // Process
    const classification = classifyIntegrityState(state);
    const route = routeToProtocol(classification);
    const packet = buildCoherencePacket(state, classification, route);

    // Assertions
    expect(classification.integrity_state).toBe('DISTORTION');
    expect(route.protocol).toBe('capacity_reset');
    expect(packet.stabilisation_cue).toBe('Breathe.');
    expect(isCleanOutput(packet.state_reflection)).toBe(true);
  });
});

describe('Output Drift Verification', () => {
  it('should produce zero drift violations across all scenarios', () => {
    const scenarios: FounderStateInput[] = [
      {
        physiological: 'tight',
        rhythm: 'urgent',
        emotional: 'constricted',
        cognitive: 'looping',
        tension_keyword: 'deadline',
        conflict_indicator: 'pressure',
      },
      {
        physiological: 'numb',
        rhythm: 'fragmented',
        emotional: 'fog',
        cognitive: 'overwhelmed',
        tension_keyword: 'nothing',
        conflict_indicator: 'none',
      },
      {
        physiological: 'tight',
        rhythm: 'oscillating',
        emotional: 'constricted',
        cognitive: 'looping',
        tension_keyword: 'failure',
        conflict_indicator: 'tension',
      },
      {
        physiological: 'open',
        rhythm: 'steady',
        emotional: 'open',
        cognitive: 'clear',
        tension_keyword: 'calm',
        conflict_indicator: 'none',
      },
    ];

    scenarios.forEach((state) => {
      const classification = classifyIntegrityState(state);
      const route = routeToProtocol(classification);
      const packet = buildCoherencePacket(state, classification, route);

      // All outputs must be clean
      expect(isCleanOutput(packet.state_reflection)).toBe(true);

      if (packet.stabilisation_cue) {
        expect(isCleanOutput(packet.stabilisation_cue)).toBe(true);
      }
    });
  });
});
