/**
 * Application Constants
 * Shared constants for timing, animations, and configuration values
 */

/**
 * Animation and transition durations (in milliseconds)
 */
export const ANIMATION_DELAYS = {
  // Fade animations
  FADE_COMPLETE: 1200, // Time for fade-out animations to complete (app.js)

  // Section reveal animations
  SECTION_REVEAL_TRANSITION: 500, // Border fade and content insertion (entry.js)
  SECTION_EXPAND_FADE: 1000, // Fade in for expanded sections (entry.js)

  // Walk flow animations
  JIGSAW_ANIMATION_START: 100, // Delay before starting jigsaw text animation (walk.js)

  // Completion overlay
  COMPLETION_OVERLAY_DISPLAY: 4000, // How long to show completion overlay (completion.js)
};

/**
 * Content display limits
 */
export const CONTENT_LIMITS = {
  SUMMARY_PREVIEW_LENGTH: 500, // Max characters for summary preview (completion.js)
};

/**
 * Cost tracking
 */
export const COST_ESTIMATES = {
  THEME_AI_CALL: 0.02, // Estimated cost per theme AI call in dollars
};
