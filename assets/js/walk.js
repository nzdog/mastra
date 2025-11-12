/**
 * Walk Flow Module
 * Handles the walk mode logic, user interactions, and state rendering
 */

import { API_BASE } from './config.js';
import { state, setState } from './state.js';
import {
  entryView,
  walkView,
  headerState,
  themePosition,
  responseInput,
  continueButton,
  composerOutput,
} from './dom.js';
import {
  getHeaders,
  showLoadingIndicator,
  hideLoadingIndicator,
  showError,
  animateTextReveal,
  updateCostDisplay,
} from './utils.js';
import { renderComposerOutput } from './markdown.js';

/**
 * Render walk state based on mode and data
 */
export async function renderWalkState(data) {
  console.log('🚀 renderWalkState called, mode:', data.mode);
  console.log('📦 Full data received:', JSON.stringify(data, null, 2));
  console.log('📄 Composer output:', data.composer_output);
  console.log('📏 Composer output length:', data.composer_output?.length);

  // Scroll to top whenever rendering walk state
  window.scrollTo(0, 0);

  // In ENTRY mode, stay in entry view but show protocol introduction
  if (data.mode === 'ENTRY') {
    console.log('📝 ENTRY mode - showing protocol introduction');

    if (headerState) headerState.textContent = 'Protocol Introduction';

    // Import and call renderEntryResponse
    const { renderEntryResponse } = await import('./entry.js');
    renderEntryResponse(data);
    return;
  }

  console.log('🎬 Starting WALK mode transition');

  // Update page header
  if (headerState) headerState.textContent = data.mode;

  // Handle undefined theme values gracefully
  const themeNum = data.theme_number || 1;
  const totalThemes = data.total_themes || 5;
  if (themePosition) themePosition.textContent = `Theme ${themeNum} of ${totalThemes}`;

  // Parse and render composer output (but keep hidden)
  renderComposerOutput(data.composer_output);

  // Hide entry view and show walk view
  if (entryView) entryView.style.display = 'none';
  if (walkView) {
    walkView.style.opacity = '0';
    walkView.style.display = 'block';

    // Force reflow to ensure transition works
    walkView.offsetHeight;

    // Fade in everything
    walkView.style.opacity = '1';
  }

  // Add fade-in class to walk view children
  const walkChildren = walkView?.querySelectorAll('.output-container, .response-area');
  walkChildren?.forEach((child) => {
    child.classList.add('fade-in-section');
  });

  // Apply jigsaw animation after fade-in is complete (skip for COMPLETE mode)
  if (data.mode !== 'COMPLETE') {
    setTimeout(() => {
      const contentElements = composerOutput?.querySelectorAll('.theme-title, .section-content');
      contentElements?.forEach((el) => {
        if (el.textContent.trim()) {
          animateTextReveal(el);
        }
      });
    }, 100);
  }

  // Focus the response input after content is visible
  setTimeout(() => {
    responseInput?.focus({ preventScroll: true });
  }, 900);

  // Handle completion options (two buttons when final theme is complete)
  if (data.show_completion_options) {
    console.log('🎯 COMPLETION OPTIONS DETECTED - Showing two buttons');
    showCompletionOptions();
  }

  // Handle completion
  if (data.mode === 'COMPLETE') {
    console.log('🎯 COMPLETE MODE DETECTED - Starting completion handling');
    console.log('📋 Data received:', data);
    console.log('📄 Composer output length:', data.composer_output?.length);
    console.log('📄 Composer output preview:', data.composer_output?.substring(0, 200));

    if (headerState) headerState.textContent = `${data.protocol_name} Summary`;

    // Import and call handleCompletion
    const { handleCompletion } = await import('./completion.js');
    handleCompletion(data);
  }
}

/**
 * Handle continue button click (main walk flow)
 */
export async function handleContinue() {
  const userResponse = responseInput?.value.trim();
  if (!userResponse || !state.sessionId) return;

  // Add clicked class to fade out border
  if (continueButton) continueButton.classList.add('clicked');

  // Blur input to stop cursor blinking
  responseInput?.blur();

  if (continueButton) continueButton.disabled = true;

  // Show loading indicator
  showLoadingIndicator();

  try {
    const response = await fetch(`${API_BASE}/api/walk/continue`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        session_id: state.sessionId,
        user_response: userResponse,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for API overload (529)
      if (response.status === 529 || errorData.error?.type === 'overloaded_error') {
        showError(
          'The AI service is currently experiencing high demand. Please wait a moment and try again.'
        );
      } else {
        showError('The field lost connection. Please try again.');
      }

      if (continueButton) {
        continueButton.classList.remove('clicked');
        continueButton.disabled = false;
      }
      hideLoadingIndicator();
      return;
    }

    const data = await response.json();
    setState({ protocolData: data });

    // Update cost display (WALK responses typically cost ~$0.015-0.025)
    updateCostDisplay(0.02);

    if (responseInput) responseInput.value = '';
    renderWalkState(data);

    if (continueButton) {
      continueButton.classList.remove('clicked');
      continueButton.disabled = false;
    }

    // Hide loading indicator
    hideLoadingIndicator();

    // Focus will be set in renderWalkState after animation
  } catch (error) {
    showError('The field lost connection. Please try again.');
    if (continueButton) {
      continueButton.classList.remove('clicked');
      continueButton.disabled = false;
    }
    hideLoadingIndicator();
  }
}

/**
 * Show completion options (two buttons: Ask Another Question, Complete Walk)
 */
export function showCompletionOptions() {
  const walkControl = document.getElementById('walk-control');
  if (!walkControl) return;

  // Clear existing buttons
  walkControl.innerHTML = '';

  // Create two buttons
  const askAnotherBtn = document.createElement('button');
  askAnotherBtn.className = 'walk-button';
  askAnotherBtn.textContent = 'Ask Another Question';
  askAnotherBtn.id = 'ask-another-button';
  askAnotherBtn.style.marginRight = '1rem';

  const completeWalkBtn = document.createElement('button');
  completeWalkBtn.className = 'walk-button';
  completeWalkBtn.textContent = 'Complete Walk & View Summary';
  completeWalkBtn.id = 'complete-walk-button';

  walkControl.appendChild(askAnotherBtn);
  walkControl.appendChild(completeWalkBtn);

  // Handle ask another question
  askAnotherBtn.addEventListener('click', async () => {
    const userResponse = responseInput?.value.trim();
    if (!userResponse) return;

    askAnotherBtn.classList.add('clicked');
    askAnotherBtn.disabled = true;
    responseInput?.blur();

    // Show loading indicator
    showLoadingIndicator();

    try {
      const response = await fetch(`${API_BASE}/api/walk/continue`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          session_id: state.sessionId,
          user_response: userResponse,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check for API overload (529)
        if (response.status === 529 || errorData.error?.type === 'overloaded_error') {
          showError(
            'The AI service is currently experiencing high demand. Please wait a moment and try again.'
          );
        } else {
          showError('The field lost connection. Please try again.');
        }

        askAnotherBtn.classList.remove('clicked');
        askAnotherBtn.disabled = false;
        hideLoadingIndicator();
        return;
      }

      const data = await response.json();
      setState({ protocolData: data });
      updateCostDisplay(0.02);
      if (responseInput) responseInput.value = '';
      renderWalkState(data);

      // Hide loading indicator
      hideLoadingIndicator();
    } catch (error) {
      showError('The field lost connection. Please try again.');
      askAnotherBtn.classList.remove('clicked');
      askAnotherBtn.disabled = false;
      hideLoadingIndicator();
    }
  });

  // Handle complete walk
  completeWalkBtn.addEventListener('click', async () => {
    completeWalkBtn.classList.add('clicked');
    completeWalkBtn.disabled = true;

    // Show loading indicator
    showLoadingIndicator();

    try {
      const response = await fetch(`${API_BASE}/api/walk/complete`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          session_id: state.sessionId,
          generate_summary: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check for API overload (529)
        if (response.status === 529 || errorData.error?.type === 'overloaded_error') {
          showError(
            'The AI service is currently experiencing high demand. Please wait a moment and try again.'
          );
        } else {
          showError('The field lost connection. Please try again.');
        }

        completeWalkBtn.classList.remove('clicked');
        completeWalkBtn.disabled = false;
        hideLoadingIndicator();
        return;
      }

      const data = await response.json();
      setState({ protocolData: data });

      // Update cost display for completion
      updateCostDisplay(0.02);

      renderWalkState(data);

      // Hide loading indicator
      hideLoadingIndicator();
    } catch (error) {
      showError('The field lost connection. Please try again.');
      completeWalkBtn.classList.remove('clicked');
      completeWalkBtn.disabled = false;
      hideLoadingIndicator();
    }
  });
}

/**
 * Handle generate report button click (after Theme 5)
 */
export async function handleGenerateReport() {
  const button = document.getElementById('generate-report-button');
  if (!button) return;

  // Add clicked class to fade out border
  button.classList.add('clicked');
  button.disabled = true;

  // Show loading indicator
  showLoadingIndicator();

  try {
    // Trigger CLOSE mode by sending "yes" to continue
    const response = await fetch(`${API_BASE}/api/walk/continue`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        session_id: state.sessionId,
        user_response: 'generate field diagnosis',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for API overload (529)
      if (response.status === 529 || errorData.error?.type === 'overloaded_error') {
        showError(
          'The AI service is currently experiencing high demand. Please wait a moment and try again.'
        );
      } else {
        showError('The field lost connection. Please try again.');
      }

      button.classList.remove('clicked');
      button.disabled = false;
      hideLoadingIndicator();
      return;
    }

    const data = await response.json();
    setState({ protocolData: data });

    // Update cost display (CLOSE mode costs ~$0.015)
    updateCostDisplay(0.015);

    renderWalkState(data);

    // Hide loading indicator
    hideLoadingIndicator();
  } catch (error) {
    showError('The field lost connection. Please try again.');
    button.classList.remove('clicked');
    button.disabled = false;
    hideLoadingIndicator();
  }
}
