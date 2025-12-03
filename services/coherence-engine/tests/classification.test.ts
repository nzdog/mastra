/**
 * CLASSIFICATION TESTS
 * Tests for integrity state classification
 * As per TESTS.md Section 1
 */

import { describe, it, expect } from 'vitest';
import { classifyIntegrityState } from '../classification/integrity_classifier';
import { FounderStateInput } from '../models/founder_state';
import { DiagnosticContext } from '../models/diagnostic_context';

describe('Classification - PRE_COLLAPSE Detection', () => {
  it('should detect PRE_COLLAPSE from numbness', () => {
    const state: FounderStateInput = {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'nothing',
      conflict_indicator: 'none',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('PRE_COLLAPSE');
    expect(result.primary_signal).toBe('numbness');
  });

  it('should detect PRE_COLLAPSE from shutdown', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'fragmented',
      emotional: 'collapse',
      cognitive: 'overwhelmed',
      tension_keyword: 'shutdown',
      conflict_indicator: 'none',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('PRE_COLLAPSE');
  });

  it('should detect PRE_COLLAPSE from fog + shutdown keywords', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'empty',
      conflict_indicator: 'avoidance',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('PRE_COLLAPSE');
  });
});

describe('Classification - DISTORTION Detection', () => {
  it('should detect DISTORTION from acute shame', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'oscillating',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'failure',
      conflict_indicator: 'tension',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DISTORTION');
    expect(result.primary_signal).toBe('shame');
  });

  it('should detect DISTORTION from acute fear', () => {
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'fear',
      conflict_indicator: 'tension',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DISTORTION');
    expect(result.primary_signal).toBe('fear');
  });

  it('should detect DISTORTION from overwhelm', () => {
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'fragmented',
      emotional: 'constricted',
      cognitive: 'overwhelmed',
      tension_keyword: 'too_much',
      conflict_indicator: 'pressure',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DISTORTION');
    expect(result.primary_signal).toBe('overwhelm');
  });

  it('should detect DISTORTION from breached capacity', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'fragmented',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'pressure',
      conflict_indicator: 'pressure',
    };

    const context: DiagnosticContext = {
      capacity_edge: 'breached',
    };

    const result = classifyIntegrityState(state, context);
    expect(result.integrity_state).toBe('DISTORTION');
  });
});

describe('Classification - DRIFT Detection', () => {
  it('should detect DRIFT from urgency', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DRIFT');
    expect(result.primary_signal).toBe('urgency');
  });

  it('should detect DRIFT from oscillating rhythm', () => {
    const state: FounderStateInput = {
      physiological: 'agitated',
      rhythm: 'oscillating',
      emotional: 'constricted',
      cognitive: 'clear',
      tension_keyword: 'scattered',
      conflict_indicator: 'tension',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DRIFT');
    expect(result.primary_signal).toBe('oscillating');
  });

  it('should detect DRIFT from avoidance', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'steady',
      emotional: 'constricted',
      cognitive: 'clear',
      tension_keyword: 'busy',
      conflict_indicator: 'avoidance',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DRIFT');
    expect(result.primary_signal).toBe('avoidance');
  });

  it('should detect DRIFT from fragmented rhythm', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'fragmented',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'scattered',
      conflict_indicator: 'none',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DRIFT');
  });
});

describe('Classification - STABLE Detection', () => {
  it('should detect STABLE from open and steady state', () => {
    const state: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('STABLE');
    expect(result.primary_signal).toBe('none');
  });

  it('should detect STABLE when no drift signals present', () => {
    const state: FounderStateInput = {
      physiological: 'steady',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'focused',
      conflict_indicator: 'none',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('STABLE');
  });
});

describe('Classification Priority Rules', () => {
  it('should prioritize PRE_COLLAPSE over DISTORTION', () => {
    const state: FounderStateInput = {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed', // Would be DISTORTION on its own
      tension_keyword: 'nothing',
      conflict_indicator: 'none',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('PRE_COLLAPSE');
  });

  it('should prioritize DISTORTION over DRIFT', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent', // Would be DRIFT on its own
      emotional: 'constricted',
      cognitive: 'overwhelmed', // DISTORTION
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
    };

    const result = classifyIntegrityState(state);
    expect(result.integrity_state).toBe('DISTORTION');
  });
});
