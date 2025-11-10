/**
 * Main Application Entry Point
 * Initializes the Field Diagnostic Agent application
 */

import { fetchBranch } from './utils.js';
import { initIntroFlow, runIntroFlow } from './intro.js';

// Initialize the application
async function init() {
  console.log('Initializing Field Diagnostic Agent...');

  // Fetch and display git branch
  await fetchBranch();

  // Initialize intro flow event listeners
  initIntroFlow();

  // Start the intro animation sequence
  await runIntroFlow();

  console.log('Application initialized.');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
