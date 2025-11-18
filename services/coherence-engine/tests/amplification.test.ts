/**
 * AMPLIFICATION TESTS (Phase 2)
 * Tests for upward coherence detection and amplification logic
 */

import { describe, it, expect } from 'vitest';
import { FounderStateInput } from '../models/founder_state';
import { DiagnosticContext } from '../models/diagnostic_context';
import { detectExpansion, isExpansionSafe } from '../amplification/expansion_detector';
import { detectFalseHigh } from '../amplification/false_high_detector';
import { planAmplification } from '../amplification/amplification_planner';

describe('Expansion Detection', () => {
  it('should detect clean expansion with all signals present', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const context: DiagnosticContext = {
      coherence_score: 0.85
    };

    const result = detectExpansion(state, context);

    expect(result.expansion_detected).toBe(true);
    expect(result.signal_count).toBeGreaterThanOrEqual(5);
    expect(result.signals.physiological_openness).toBe(true);
    expect(result.signals.stable_rhythm).toBe(true);
    expect(result.signals.clarity_present).toBe(true);
    expect(result.signals.calm_state).toBe(true);
    expect(result.signals.no_urgency).toBe(true);
  });

  it('should not detect expansion without enough signals', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'fragmented',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'stressed',
      conflict_indicator: 'pressure'
    };

    const result = detectExpansion(state);

    expect(result.expansion_detected).toBe(false);
    expect(result.signal_count).toBeLessThan(5);
  });

  it('should check expansion safety correctly', () => {
    const safeSignals = {
      physiological_openness: true,
      stable_rhythm: true,
      clarity_present: true,
      calm_state: true,
      no_urgency: true,
      embodied_readiness: true,
      available_capacity: true
    };

    expect(isExpansionSafe(safeSignals)).toBe(true);

    const unsafeSignals = {
      ...safeSignals,
      no_urgency: false // Critical signal missing
    };

    expect(isExpansionSafe(unsafeSignals)).toBe(false);
  });
});

describe('False-High Detection', () => {
  it('should detect oscillating rhythm as false-high', () => {
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'oscillating',
      emotional: 'open',
      cognitive: 'looping',
      tension_keyword: 'excited',
      conflict_indicator: 'none'
    };

    const result = detectFalseHigh(state);

    expect(result.false_high_detected).toBe(true);
    expect(result.signals.oscillating_rhythm).toBe(true);
  });

  it('should detect pressured excitement as false-high', () => {
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'urgent',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'motivated',
      conflict_indicator: 'pressure'
    };

    const result = detectFalseHigh(state);

    expect(result.false_high_detected).toBe(true);
    expect(result.signals.pressured_excitement).toBe(true);
    expect(result.signals.urgency_present).toBe(true);
  });

  it('should detect hype keywords as false-high', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'amazing',
      conflict_indicator: 'none'
    };

    const result = detectFalseHigh(state);

    expect(result.false_high_detected).toBe(true);
    expect(result.signals.hype_keywords).toBe(true);
  });

  it('should not detect false-high in clean expansion', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const result = detectFalseHigh(state);

    expect(result.false_high_detected).toBe(false);
    expect(result.signal_count).toBe(0);
  });
});

describe('Amplification Planning', () => {
  it('should allow amplification for clean stable expansion', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const context: DiagnosticContext = {
      coherence_score: 0.85
    };

    const expansion = detectExpansion(state, context);
    const falseHigh = detectFalseHigh(state, context);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.can_amplify).toBe(true);
    expect(plan.upward_block).not.toBeNull();
    expect(plan.upward_block?.expansion_detected).toBe(true);
    expect(plan.upward_block?.amplification_safe).toBe(true);
  });

  it('should block amplification if integrity state is not STABLE', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'DRIFT', // Not STABLE
      expansion,
      falseHigh,
      true
    );

    expect(plan.can_amplify).toBe(false);
    expect(plan.upward_block).toBeNull();
    expect(plan.block_reason).toContain('DRIFT');
  });

  it('should block amplification if founder ready signal not present', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: false // Not ready
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.can_amplify).toBe(false);
    expect(plan.upward_block).toBeNull();
    expect(plan.block_reason).toContain('ready signal');
  });

  it('should block amplification if false-high detected', () => {
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'oscillating', // False-high signal
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'excited',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.can_amplify).toBe(false);
    expect(plan.upward_block).toBeNull();
    expect(plan.block_reason).toContain('False-high');
  });

  it('should block amplification if protocol cycle not complete', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      false // Protocol cycle NOT complete
    );

    expect(plan.can_amplify).toBe(false);
    expect(plan.upward_block).toBeNull();
    expect(plan.block_reason).toContain('Protocol cycle');
  });
});

describe('Amplification Safeguards', () => {
  it('should trigger urgency kill switch', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'urgent', // Urgency present
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
      founder_led_readiness_signal: true
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.safeguards.urgency_kill_switch_triggered).toBe(true);
    expect(plan.can_amplify).toBe(false);
  });

  it('should close embodiment gate when body not open', () => {
    const state: FounderStateInput = {
      physiological: 'tight', // Body closed
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.safeguards.embodiment_gate_open).toBe(false);
    expect(plan.can_amplify).toBe(false);
  });

  it('should enforce pace lock with stable rhythm', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const expansion = detectExpansion(state);
    const falseHigh = detectFalseHigh(state);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.safeguards.pace_lock_active).toBe(true);
  });
});

describe('Upward Block Content', () => {
  it('should generate clean magnification note', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'focused',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const context: DiagnosticContext = {
      coherence_score: 0.9
    };

    const expansion = detectExpansion(state, context);
    const falseHigh = detectFalseHigh(state, context);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.upward_block).not.toBeNull();
    expect(plan.upward_block?.magnification_note).toBeTruthy();
    // Should not contain forbidden language
    expect(plan.upward_block?.magnification_note).not.toMatch(/you should|will|try to/i);
  });

  it('should generate micro-actions (max 2)', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'centered',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true
    };

    const context: DiagnosticContext = {
      coherence_score: 0.95
    };

    const expansion = detectExpansion(state, context);
    const falseHigh = detectFalseHigh(state, context);

    const plan = planAmplification(
      state,
      'STABLE',
      expansion,
      falseHigh,
      true
    );

    expect(plan.upward_block).not.toBeNull();
    expect(plan.upward_block?.micro_actions).toBeDefined();
    expect(plan.upward_block?.micro_actions?.length).toBeLessThanOrEqual(2);
  });
});

