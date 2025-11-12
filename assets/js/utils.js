/**
 * Utility Functions Module
 * Common utility functions used throughout the application
 */

import { API_BASE, API_KEY, TIMING } from './config.js';
import { state, setState } from './state.js';
import { srAnnouncer, costDisplay, errorStrip, errorMessage } from './dom.js';

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

// Fetch and display current git branch
export async function fetchBranch() {
  try {
    const response = await fetch(`${API_BASE}/api/branch`);

    // Check HTTP status
    if (!response.ok) {
      throw new Error(`Failed to fetch branch: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data.branch !== 'string') {
      throw new Error('Invalid branch data structure');
    }

    const branchLabel = document.getElementById('branch-label');
    if (branchLabel) {
      branchLabel.textContent = `branch: ${data.branch}`;
    }
  } catch (error) {
    console.error('Error fetching branch:', error);
    const branchLabel = document.getElementById('branch-label');
    if (branchLabel) {
      branchLabel.textContent = 'branch: error';
    }
    // Note: Not using showError() here as branch display is non-critical
    // and shouldn't interrupt the user experience with a modal
  }
}

// Announce text for screen readers
export function announceForScreenReader(text) {
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
export function fadeOut(element, duration = TIMING.FADE_DURATION) {
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

// Animate text reveal with jigsaw effect
export function animateTextReveal(element, duration = 400) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.classList.add('jigsaw');
    setTimeout(() => {
      element.classList.remove('jigsaw');
      resolve();
    }, duration);
  });
}

// Update cost display
export function updateCostDisplay(increment = 0.01) {
  if (costDisplay) {
    costDisplay.textContent = `~$${increment.toFixed(2)}`;
  }
}

// Show loading indicator
export function showLoadingIndicator() {
  const headerLogo = document.getElementById('header-center-logo');
  if (headerLogo) {
    headerLogo.classList.add('spinning');
  }
}

// Hide loading indicator
export function hideLoadingIndicator() {
  const headerLogo = document.getElementById('header-center-logo');
  if (headerLogo) {
    headerLogo.classList.remove('spinning');
  }
}

// Show error message
export function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  if (errorStrip) {
    errorStrip.classList.add('visible');
    setTimeout(() => {
      errorStrip.classList.remove('visible');
    }, 5000);
  }
}

// Format section content for display
export function formatSectionContent(content) {
  // Split by double newlines to get paragraphs, then process each
  const paragraphs = content.split(/\n\s*\n/);
  let html = '';

  for (let paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // Check if this is a list item block
    const lines = trimmed.split('\n');
    const isListBlock = lines.every((line) => {
      const l = line.trim();
      return l.startsWith('- ') || l.startsWith('• ') || !l;
    });

    if (isListBlock) {
      // Render list items individually
      for (let line of lines) {
        const l = line.trim();
        if (l && (l.startsWith('- ') || l.startsWith('• '))) {
          html += `<div style="margin-left: 1.5rem; margin-bottom: 0.5rem; color: #292524;">${l}</div>`;
        }
      }
    } else {
      // Join lines into a single paragraph (removes mid-sentence line breaks)
      const joinedText = lines
        .map((l) => l.trim())
        .filter((l) => l)
        .join(' ');
      html += `<div style="margin-bottom: 1rem; color: #292524; font-size: 1.0625rem;">${joinedText}</div>`;
    }
  }
  return html;
}
