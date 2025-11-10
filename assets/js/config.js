/**
 * Configuration and Constants
 * API configuration, timing constants, and global state
 */

// API Integration - automatically detects environment
export const API_BASE =
  window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port || 3000}`
    : ''; // Use relative URLs for production (same origin)

// API Key for authentication (set to null for local dev if X_API_KEY not required)
export const API_KEY =
  window.location.hostname === 'localhost'
    ? null // Set to your local key if needed, or null to skip validation
    : 'lichen-field-2025-secret'; // Replace with your Railway X_API_KEY

// Global state
export let sessionId = null;
export let currentMode = 'ENTRY';
export let protocolData = null;
export let selectedProtocol = null; // Store selected protocol

// State setters
export function setSessionId(id) {
  sessionId = id;
}

export function setCurrentMode(mode) {
  currentMode = mode;
}

export function setProtocolData(data) {
  protocolData = data;
}

export function setSelectedProtocol(protocol) {
  selectedProtocol = protocol;
}

// Timing constants (tunable)
export const TIMING = {
  initialWait: 2000, // 2s wait before first line
  jigsawDuration: 400, // 0.4s jigsaw animation
  lineDuration: 3000, // 3s line stays visible
  fadeOutDuration: 1000, // 1s fade out
  beforeOrientation: 1200, // 1.2s pause before orientation
  beforeSequence: 1700, // 1.7s pause before sequence
};

// Check for reduced motion preference
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Detect platform for keyboard shortcuts
export const isMac = navigator.platform.toUpperCase().includes('MAC');

// Intro animation control
export let skipIntroAnimations = false;

export function setSkipIntroAnimations(value) {
  skipIntroAnimations = value;
}
