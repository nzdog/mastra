/**
 * Application Entry Point
 * Integrates all modules and sets up event handlers
 */

import { API_BASE, isMac } from './config.js';
import { state, setState } from './state.js';
import {
  beginButton,
  responseInput,
  continueButton,
  responseHint,
  entryInput,
  entryView,
  walkView,
  protocolSelectionView,
} from './dom.js';
import {
  fetchBranch,
  getHeaders,
  showLoadingIndicator,
  hideLoadingIndicator,
  showError,
} from './utils.js';
import { initIntroFlow, runIntroFlow } from './intro.js';
import { loadProtocols } from './protocols.js';
import { renderProtocolEntry } from './entry.js';
import { handleContinue, handleGenerateReport } from './walk.js';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing Field Diagnostic Agent...');

  // Fetch and display git branch
  await fetchBranch();

  // Initialize intro flow event listeners
  initIntroFlow();

  // Start the intro animation sequence
  await runIntroFlow();

  // Load protocols (for the protocol selection view, not used in intro flow)
  loadProtocols();

  // Set helper text based on platform
  if (responseHint) {
    responseHint.textContent = isMac
      ? 'Press ⌘ + Enter to continue'
      : 'Press Ctrl + Enter to continue';
  }

  // Update button aria-label for accessibility
  if (continueButton) {
    continueButton.setAttribute(
      'aria-label',
      isMac ? 'Continue (Cmd + Enter)' : 'Continue (Ctrl + Enter)'
    );
  }

  // Enable continue button when response has content
  if (responseInput) {
    responseInput.addEventListener('input', () => {
      if (continueButton) {
        continueButton.disabled = !responseInput.value.trim();
      }
    });
  }

  // Handle keyboard shortcuts for continue action
  if (responseInput) {
    responseInput.addEventListener('keydown', (e) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + Enter: trigger Continue or Ask Another Question
      if (modifier && e.key === 'Enter') {
        e.preventDefault();
        if (responseInput.value.trim()) {
          // Check if we're in completion options mode
          const askAnotherBtn = document.getElementById('ask-another-button');
          if (askAnotherBtn && !askAnotherBtn.disabled) {
            askAnotherBtn.click();
          } else if (continueButton && !continueButton.disabled) {
            handleContinue();
          }
        }
      }
      // Shift + Enter: allow new line (default behavior)
      // Enter alone: allow new line (default behavior)
    });
  }

  // Escape key: Exit walk and return to protocol selection
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Check if we're in a walk (walk-view is visible or entry-view is visible)
      const isInWalk =
        (walkView && walkView.style.display !== 'none') ||
        (entryView && !entryView.classList.contains('hidden'));

      if (isInWalk && confirm('Exit this protocol and return to protocol selection?')) {
        // Reset views
        if (walkView) walkView.style.display = 'none';
        if (entryView) entryView.classList.add('hidden');

        // Show protocol selection
        if (protocolSelectionView) protocolSelectionView.classList.remove('hidden');

        // Reset inputs
        if (responseInput) responseInput.value = '';
        if (continueButton) continueButton.disabled = true;

        // Scroll to top
        window.scrollTo(0, 0);
      }
    }
  });

  // Begin walk
  if (beginButton) {
    beginButton.addEventListener('click', async () => {
      console.log('🎬 BEGIN WALK BUTTON CLICKED');
      console.log('📋 Selected protocol:', state.selectedProtocol);

      // Add clicked class to fade out border
      beginButton.classList.add('clicked');

      // Show loading indicator
      showLoadingIndicator();

      // Fade out main entry logo and title
      const title = entryView?.querySelectorAll('div')[0];
      const logo = document.getElementById('lichen-logo');

      beginButton.disabled = true;

      // Fade out main logo and title
      if (logo) logo.classList.add('fade-out');
      if (title) title.classList.add('fade-out');

      // Wait for fade animations to complete
      await new Promise((resolve) => setTimeout(resolve, 1200));

      try {
        // Use non-AI endpoint to get protocol entry content
        const response = await fetch(
          `${API_BASE}/api/protocols/${state.selectedProtocol?.slug}/entry`,
          {
            method: 'GET',
            headers: getHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // No session created yet - will create when user starts walk
        setState({ sessionId: null, protocolData: data });

        // No AI cost for loading entry content
        // updateCostDisplay not called - stays at $0.00

        // Render protocol entry content (no AI, just markdown content)
        renderProtocolEntry(data);

        // Hide loading indicator
        hideLoadingIndicator();
      } catch (error) {
        showError('The field lost connection. Please try again.');
        beginButton.textContent = 'Begin walk';
        beginButton.disabled = false;
        hideLoadingIndicator();
      }
    });
  }

  // Continue walk
  if (continueButton) {
    continueButton.addEventListener('click', handleContinue);
  }

  // Handle generate report button (dynamically created after Theme 5)
  // Use event delegation since button is created dynamically
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'generate-report-button') {
      handleGenerateReport();
    }
  });

  console.log('Application initialized.');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
