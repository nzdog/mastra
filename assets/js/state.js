/**
 * State Management Module
 * Manages global application state
 */

// Application state
export const state = {
  sessionId: null,
  currentMode: 'ENTRY',
  protocolData: null,
  selectedProtocol: null,
  skipIntroAnimations: false,
};

// Helper function to update state
export function setState(updates) {
  Object.assign(state, updates);
}

// Helper function to reset state
export function resetState() {
  state.sessionId = null;
  state.currentMode = 'ENTRY';
  state.protocolData = null;
  state.selectedProtocol = null;
}
