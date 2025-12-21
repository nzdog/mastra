import { FounderStateInput } from './types';

export interface Scenario {
  name: string;
  state: FounderStateInput;
}

export const SCENARIOS: Scenario[] = [
  {
    name: '⚡ Urgency Spike',
    state: {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
    },
  },
  {
    name: '🔄 Avoidance',
    state: {
      physiological: 'tight',
      rhythm: 'steady',
      emotional: 'constricted',
      cognitive: 'clear',
      tension_keyword: 'busy',
      conflict_indicator: 'avoidance',
    },
  },
  {
    name: '😔 Shame Spike',
    state: {
      physiological: 'tight',
      rhythm: 'oscillating',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'failure',
      conflict_indicator: 'tension',
    },
  },
  {
    name: '🌊 Overwhelm',
    state: {
      physiological: 'agitated',
      rhythm: 'fragmented',
      emotional: 'constricted',
      cognitive: 'overwhelmed',
      tension_keyword: 'too_much',
      conflict_indicator: 'pressure',
    },
  },
  {
    name: '❄️ Numbness',
    state: {
      physiological: 'numb',
      rhythm: 'fragmented',
      emotional: 'fog',
      cognitive: 'overwhelmed',
      tension_keyword: 'nothing',
      conflict_indicator: 'avoidance',
    },
  },
  {
    name: '✨ Calm & Coherent',
    state: {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true,
    },
  },
  {
    name: '🚀 Ready for Amplification',
    state: {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'focused',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true,
    },
  },
  {
    name: '⚡ False-High (Hype)',
    state: {
      physiological: 'agitated',
      rhythm: 'oscillating',
      emotional: 'open',
      cognitive: 'looping',
      tension_keyword: 'amazing',
      conflict_indicator: 'none',
      founder_led_readiness_signal: true,
    },
  },
];
