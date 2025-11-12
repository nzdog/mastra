/**
 * Configuration Module
 * Contains API configuration and constants
 */

// API Integration - automatically detects environment
export const API_BASE =
  window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port || 3000}`
    : ''; // Use relative URLs for production (same origin)

// API Key for authentication - reads from environment or meta tag
// Server should inject this via <meta name="api-key" content="..."> or window.APP_CONFIG
// Never commit actual API keys to source control
export const API_KEY = (() => {
  // Priority 1: Check for server-injected config
  if (window.APP_CONFIG && window.APP_CONFIG.apiKey) {
    return window.APP_CONFIG.apiKey;
  }

  // Priority 2: Check meta tag (server can inject at runtime)
  const metaTag = document.querySelector('meta[name="api-key"]');
  if (metaTag) {
    return metaTag.getAttribute('content');
  }

  // Priority 3: Local development (no auth required)
  if (window.location.hostname === 'localhost') {
    return null;
  }

  // Fallback: No key available (API requests will need to handle auth differently)
  console.warn(
    'No API key configured. Set window.APP_CONFIG.apiKey or add <meta name="api-key"> tag.'
  );
  return null;
})();

// Timing constants for animations (all durations in milliseconds)
export const TIMING = {
  // Intro sequence timing
  initialWait: 2000, // 2s wait before first animation
  jigsawDuration: 860, // 0.86s jigsaw fade animation
  lineDuration: 3000, // 3s line stays visible
  fadeOutDuration: 1000, // 1s fade out
  beforeOrientation: 1200, // 1.2s pause before orientation
  beforeSequence: 1700, // 1.7s pause before sequence
  greyOutDuration: 500, // 0.5s grey out transition
  continueFadeDuration: 800, // 0.8s continue button fade
  contentFadeDuration: 800, // 0.8s content fade out
  quickRevealWait: 150, // 0.15s wait before quick reveal
  quickRevealStagger: 100, // 0.1s stagger between quick reveals
  quickRevealTransition: 300, // 0.3s quick reveal transition

  // Legacy constants (kept for compatibility)
  INTRO_QUOTE_DELAY: 600,
  INTRO_LINE_DELAY: 120,
  INTRO_ORIENTATION_DELAY: 200,
  INTRO_CONTINUE_DELAY: 300,
  FADE_DURATION: 800,
  QUICK_FADE_DURATION: 400,
};

// Detect platform for keyboard shortcuts (using modern API with fallback)
export const isMac = (navigator.userAgentData?.platform || navigator.platform)
  .toUpperCase()
  .includes('MAC');
