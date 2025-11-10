/**
 * Configuration Module
 * Contains API configuration and constants
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

// Timing constants for animations
export const TIMING = {
  INTRO_QUOTE_DELAY: 600,
  INTRO_LINE_DELAY: 120,
  INTRO_ORIENTATION_DELAY: 200,
  INTRO_CONTINUE_DELAY: 300,
  FADE_DURATION: 800,
  QUICK_FADE_DURATION: 400,
};

// Detect platform for keyboard shortcuts
export const isMac = navigator.platform.toUpperCase().includes('MAC');
