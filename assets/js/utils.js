/**
 * Utility Functions
 * Helper functions for UI interactions, animations, and API calls
 */

import { API_KEY, API_BASE, TIMING } from './config.js';

// Helper function to build headers with API key
export function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

// Announce text for screen readers
export function announceForScreenReader(text, srAnnouncer) {
  if (srAnnouncer) {
    srAnnouncer.textContent = text;
    setTimeout(() => {
      srAnnouncer.textContent = '';
    }, 1000);
  }
}

// Fade in an element (opacity only)
export function fadeIn(element, duration = 1000) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '1';
    setTimeout(resolve, duration);
  });
}

// Fade in with forced text reset (for intro flow only)
export function fadeInClean(element, duration = 1000) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    // Force clean text content (strips any spans)
    const text = element.textContent;
    element.textContent = text;

    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '1';
    setTimeout(resolve, duration);
  });
}

// Fade out an element
export function fadeOut(element, duration = TIMING.fadeOutDuration) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '0';
    setTimeout(resolve, duration);
  });
}

// Animate text reveal (jigsaw effect)
export function animateTextReveal(element, duration = 400) {
  // Skip animation if text is empty
  if (!element || !element.textContent || !element.textContent.trim()) {
    return;
  }

  const text = element.textContent;
  element.textContent = '';

  // Split into words
  const words = text.split(/(\s+)/);
  const spans = [];

  words.forEach((word) => {
    if (word) {
      const span = document.createElement('span');
      span.textContent = word;
      span.style.opacity = '0';
      span.style.transition = 'opacity 0.2s ease-in';
      span.style.display = 'inline';
      element.appendChild(span);
      spans.push(span);
    }
  });

  // Create random order for revealing
  const indices = spans.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Reveal words/letters in random order
  const totalSteps = Math.ceil(spans.length * 1.5);
  const interval = duration / totalSteps;

  let revealed = 0;
  for (let step = 0; step < totalSteps && revealed < spans.length; step++) {
    setTimeout(() => {
      if (revealed < spans.length) {
        // Randomly decide: reveal full word (50%) or break into letters (50%)
        if (Math.random() > 0.5) {
          // Reveal full word
          spans[indices[revealed]].style.opacity = '1';
          revealed++;
        } else {
          // Break word into letters and reveal in random order
          const span = spans[indices[revealed]];
          const word = span.textContent;
          const letters = word.split('');

          span.textContent = '';
          const letterSpans = letters.map((letter) => {
            const letterSpan = document.createElement('span');
            letterSpan.textContent = letter;
            letterSpan.style.opacity = '0';
            letterSpan.style.transition = 'opacity 0.1s ease-in';
            letterSpan.style.display = 'inline';
            span.appendChild(letterSpan);
            return letterSpan;
          });

          span.style.opacity = '1';

          // Create random order for letters
          const letterIndices = letters.map((_, i) => i);
          for (let i = letterIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letterIndices[i], letterIndices[j]] = [letterIndices[j], letterIndices[i]];
          }

          // Reveal letters in random order
          letterIndices.forEach((letterIndex, i) => {
            setTimeout(() => {
              letterSpans[letterIndex].style.opacity = '1';
            }, i * 10);
          });

          revealed++;
        }
      }
    }, step * interval);
  }
}

// Update cost display
export function updateCostDisplay(increment = 0.01, costDisplay) {
  if (costDisplay) {
    const current = parseFloat(costDisplay.textContent.replace('$', '')) || 0;
    costDisplay.textContent = `$${(current + increment).toFixed(2)}`;
  }
}

// Show loading indicator
export function showLoadingIndicator(headerCenterLogo) {
  if (headerCenterLogo) {
    headerCenterLogo.classList.add('spinning');
  }
}

// Hide loading indicator
export function hideLoadingIndicator(headerCenterLogo) {
  if (headerCenterLogo) {
    headerCenterLogo.classList.remove('spinning');
  }
}

// Show error message
export function showError(message, errorStrip, errorMessage) {
  if (errorMessage) errorMessage.textContent = message;
  if (errorStrip) errorStrip.classList.add('active');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorStrip) errorStrip.classList.remove('active');
  }, 5000);
}

// Fetch and display current git branch
export async function fetchBranch(branchLabel) {
  try {
    const response = await fetch(`${API_BASE}/api/branch`);
    const data = await response.json();
    if (branchLabel && data.branch) {
      branchLabel.textContent = `branch: ${data.branch}`;
    } else {
      console.error('Branch data missing:', data);
      if (branchLabel) branchLabel.textContent = 'branch: unknown';
    }
  } catch (error) {
    console.error('Error fetching branch:', error);
    if (branchLabel) {
      branchLabel.textContent = 'branch: error';
    }
  }
}
