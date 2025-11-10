/**
 * Intro Flow Module
 * Handles the application intro sequence and animations
 */

import { API_BASE, TIMING, isMac } from './config.js';
import { state, setState } from './state.js';
import {
  introFlowView,
  introLogo,
  introQuoteDesktop,
  introQuoteMobile,
  introEmbodimentLines,
  introOrientation,
  introContinueContainer,
  introContinueBtn,
  introContent,
  introProtocolListPage,
  introSequenceContainer,
  introProtocolDeck,
  introProtocolGuidance,
  introBeginContainer,
  introBeginBtn,
  pageHeader,
} from './dom.js';
import {
  fadeIn,
  fadeInClean,
  fadeOut,
  announceForScreenReader,
  getHeaders,
} from './utils.js';

// Timing constants for intro sequence
const INTRO_TIMING = {
  initialWait: 2000, // 2s wait before first line
  jigsawDuration: 400, // 0.4s jigsaw animation
  lineDuration: 3000, // 3s line stays visible
  fadeOutDuration: 1000, // 1s fade out
  beforeOrientation: 1200, // 1.2s pause before orientation
  beforeSequence: 1700, // 1.7s pause before sequence
};

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Organically reveal all intro text with quick, staggered transitions
export async function revealAllIntroText() {
  setState({ skipIntroAnimations: true });

  // Reset text content for both desktop and mobile quotes (with inline attribution)
  introQuoteDesktop.textContent =
    '"The field is the sole governing agency of the particle." — Albert Einstein';
  introQuoteMobile.textContent =
    '"The field is the sole governing agency of the particle." — Albert Einstein';

  // Show quotes with quick fade
  introQuoteDesktop.style.transition = 'opacity 300ms ease';
  introQuoteDesktop.style.opacity = '1';
  introQuoteDesktop.style.color = '';

  introQuoteMobile.style.transition = 'opacity 300ms ease';
  introQuoteMobile.style.opacity = '1';
  introQuoteMobile.style.color = '';

  // Wait a moment before showing embodiment lines
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Create and show all embodiment lines with staggered quick fades
  const embodimentLines = [
    'You are the particle.',
    "Every decision, every signal, every relationship is shaped by the field you're in.",
    'The Lichen System listens to that field.',
    'It helps you see where you are.',
    'It helps you transform the field when the time is right.',
  ];

  // Clear any existing lines
  introEmbodimentLines.innerHTML = '';

  // Add all lines with quick staggered reveals
  for (let i = 0; i < embodimentLines.length; i++) {
    const line = document.createElement('div');
    line.className = 'intro-text-line';
    line.textContent = embodimentLines[i];
    line.style.top = `calc(33% - 70px + ${60 + i * 40}px)`;
    line.style.transition = 'opacity 250ms ease';
    line.style.opacity = '0';
    line.style.color = '';
    introEmbodimentLines.appendChild(line);

    // Quick stagger (100ms between each line)
    await new Promise((resolve) => setTimeout(resolve, 100));
    line.style.opacity = '1';
  }

  // Show continue button with final quick fade
  await new Promise((resolve) => setTimeout(resolve, 100));
  introContinueContainer.style.transition = 'opacity 300ms ease';
  introContinueContainer.style.opacity = '1';
}

// Run the intro flow sequence
export async function runIntroFlow() {
  console.log('Starting intro flow...');

  // Reset all text to plain text for both desktop and mobile versions
  if (introQuoteDesktop) {
    introQuoteDesktop.textContent =
      '"The field is the sole governing agency of the particle." — Albert Einstein';
  }
  if (introQuoteMobile) {
    introQuoteMobile.textContent =
      '"The field is the sole governing agency of the particle." — Albert Einstein';
  }

  // Check if animations should be skipped
  if (state.skipIntroAnimations) {
    return; // Exit early, text already revealed
  }

  // 1. Wait 2 seconds with logo visible and spinning
  await new Promise((resolve) => setTimeout(resolve, INTRO_TIMING.initialWait));

  // Check if animations were skipped during the wait
  if (state.skipIntroAnimations) {
    return; // Exit early if user clicked logo
  }

  // 2. Show quote with simple fade (0.86s) - both desktop and mobile versions
  if (introQuoteDesktop && introQuoteMobile) {
    // Fade in both versions (CSS controls which one is visible)
    await Promise.all([fadeInClean(introQuoteDesktop, 860), fadeInClean(introQuoteMobile, 860)]);

    // Announce for screen readers
    announceForScreenReader(
      '"The field is the sole governing agency of the particle." — Albert Einstein'
    );

    // Wait 3 seconds total before greying out
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (state.skipIntroAnimations) {
      return;
    }

    // Grey out both versions
    introQuoteDesktop.style.transition = 'opacity 500ms ease, color 500ms ease';
    introQuoteDesktop.style.opacity = '0.6';
    introQuoteDesktop.style.color = '#78716C';

    introQuoteMobile.style.transition = 'opacity 500ms ease, color 500ms ease';
    introQuoteMobile.style.opacity = '0.6';
    introQuoteMobile.style.color = '#78716C';

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 3. Show each embodiment line with jigsaw fade, one at a time
  const embodimentLines = [
    'You are the particle.',
    "Every decision, every signal, every relationship is shaped by the field you're in.",
    'The Lichen System listens to that field.',
    'It helps you see where you are.',
    'It helps you transform the field when the time is right.',
  ];

  let previousLine = null;
  for (let i = 0; i < embodimentLines.length; i++) {
    const lineText = embodimentLines[i];
    const line = document.createElement('div');
    line.className = 'intro-text-line';
    line.textContent = lineText;

    // Move first two lines: up 3px on desktop, up 20px on mobile
    const isMobile = window.innerWidth <= 768;
    const offset = i < 2 ? (isMobile ? -20 : -3) : 0;
    line.style.top = `calc(33% - 70px + ${60 + i * 40 + offset}px)`;
    introEmbodimentLines.appendChild(line);

    // Grey out the previous line BEFORE showing the next one
    if (previousLine) {
      previousLine.style.transition = 'opacity 500ms ease, color 500ms ease';
      previousLine.style.opacity = '0.6';
      previousLine.style.color = '#78716C';
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await fadeInClean(line, 860);
    announceForScreenReader(lineText);
    await new Promise((resolve) => setTimeout(resolve, INTRO_TIMING.lineDuration));

    if (state.skipIntroAnimations) {
      return;
    }

    previousLine = line;
  }

  // 4. Grey out the last embodiment line
  if (previousLine) {
    previousLine.style.transition = 'opacity 500ms ease, color 500ms ease';
    previousLine.style.opacity = '0.6';
    previousLine.style.color = '#78716C';
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await new Promise((resolve) => setTimeout(resolve, INTRO_TIMING.beforeOrientation));

  // 5. Show continue button
  await fadeIn(introContinueContainer, 800);
  console.log('Continue button visible, waiting for user action...');
}

// Handle Continue button click - show protocol list page
export async function showProtocolListPage() {
  console.log('Showing protocol list page...');

  // Scroll to top
  window.scrollTo(0, 0);

  // Fade out both the intro logo and content together (same duration)
  const introLogoContainer = document.querySelector('.intro-logo-container');
  await Promise.all([
    fadeOut(introContent, 800),
    introLogoContainer ? fadeOut(introLogoContainer, 800) : Promise.resolve(),
  ]);

  // Hide intro content
  introContent.style.display = 'none';

  // Hide the big intro logo
  if (introLogoContainer) {
    introLogoContainer.style.display = 'none';
  }

  // Show protocol list page
  introProtocolListPage.classList.add('visible');

  // Show header logo on protocol list page
  pageHeader.classList.add('protocol-list-active');

  // Fade in guidance text
  if (introProtocolGuidance) {
    // Force browser to render initial state before transition
    await new Promise((resolve) =>
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      })
    );

    introProtocolGuidance.classList.add('visible');
  }

  // Load and render protocol cards (happens during guidance fade)
  await loadAndRenderProtocolCards();
}

// Load protocols from API and render cards with progressive disclosure
async function loadAndRenderProtocolCards() {
  try {
    const response = await fetch(`${API_BASE}/api/protocols`);
    const data = await response.json();

    if (data.protocols && data.protocols.length > 0) {
      // Sort: Field Diagnostic first, then the 5 Field Exit protocols in order
      const sortedProtocols = data.protocols
        .sort((a, b) => {
          if (a.slug === 'field_diagnostic') return -1;
          if (b.slug === 'field_diagnostic') return 1;
          // Extract number from field_exit_protocol_N_...
          const aNum = parseInt(a.slug.match(/field_exit_protocol_(\d+)/)?.[1] || '999');
          const bNum = parseInt(b.slug.match(/field_exit_protocol_(\d+)/)?.[1] || '999');
          return aNum - bNum;
        })
        .slice(0, 6); // Take only the first 6

      // Render each protocol card
      for (const protocol of sortedProtocols) {
        renderProtocolCard(protocol);
      }

      // Force browser to render initial state before transition
      await new Promise((resolve) =>
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        })
      );

      // Fade in the protocol deck
      introProtocolDeck.classList.add('visible');
      announceForScreenReader(
        'Protocol cards revealed. Use tab to navigate and explore each protocol.'
      );
    }
  } catch (error) {
    console.error('Error loading protocols for intro:', error);
  }
}

// Render a single protocol card with progressive disclosure
function renderProtocolCard(protocol) {
  const card = document.createElement('div');
  card.className = 'intro-protocol-card';

  // Title
  const title = document.createElement('div');
  title.className = 'intro-protocol-title';
  title.textContent = protocol.title;
  card.appendChild(title);

  // Use When section (initially hidden)
  const useWhenSection = document.createElement('div');
  useWhenSection.className = 'intro-disclosure-section';

  // Format use_when as a list if it's an array, otherwise as plain text
  let useWhenContent = '';
  if (Array.isArray(protocol.use_when)) {
    useWhenContent =
      '<ul>' + protocol.use_when.map((item) => `<li>${item}</li>`).join('') + '</ul>';
  } else {
    useWhenContent = protocol.use_when || 'No use cases available';
  }

  useWhenSection.innerHTML = `
    <div class="intro-disclosure-label">Use This When</div>
    <div class="intro-disclosure-content">${useWhenContent}</div>
  `;
  card.appendChild(useWhenSection);

  // Use When button (initially visible)
  const useWhenBtn = document.createElement('button');
  useWhenBtn.className = 'intro-disclosure-btn';
  useWhenBtn.textContent = 'Use This When';
  useWhenBtn.setAttribute('aria-expanded', 'false');
  useWhenBtn.setAttribute('aria-controls', `usewhen-${protocol.id}`);
  useWhenSection.id = `usewhen-${protocol.id}`;
  card.appendChild(useWhenBtn);

  // Walk this Protocol button (initially hidden, shown after Use This When is clicked)
  const walkBtn = document.createElement('button');
  walkBtn.className = 'intro-walk-btn';
  walkBtn.textContent = 'Walk this Protocol';
  card.appendChild(walkBtn);

  // Handle Use This When button click
  useWhenBtn.addEventListener('click', () => {
    useWhenSection.classList.add('visible');
    walkBtn.classList.add('visible');
    useWhenBtn.style.display = 'none';
    useWhenBtn.setAttribute('aria-expanded', 'true');
    announceForScreenReader(`Use cases revealed for ${protocol.title}`);
  });

  // Handle Walk this Protocol button click
  walkBtn.addEventListener('click', async () => {
    setState({ selectedProtocol: protocol });
    console.log('Selected protocol:', protocol);

    // Hide intro flow completely
    introFlowView.style.display = 'none';

    // Begin the protocol walk
    await beginProtocolWalk(protocol);
  });

  introProtocolDeck.appendChild(card);
}

// Begin protocol walk (placeholder - will be handled by walk.js)
async function beginProtocolWalk(protocol) {
  console.log('Beginning protocol walk for:', protocol.title);
  // This will be implemented in walk.js
  // For now, just dispatch a custom event
  window.dispatchEvent(new CustomEvent('beginProtocolWalk', { detail: { protocol } }));
}

// Initialize intro flow event listeners
export function initIntroFlow() {
  // Continue button click handler
  introContinueBtn.addEventListener('click', () => {
    showProtocolListPage();
  });

  // Keyboard shortcut: Cmd/Ctrl + Enter to continue
  document.addEventListener('keydown', (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    const isShortcut = modifier && e.key === 'Enter';

    if (isShortcut) {
      // Only trigger if continue button is visible and intro content is still showing
      if (
        introContinueContainer &&
        parseFloat(window.getComputedStyle(introContinueContainer).opacity) > 0.5 &&
        window.getComputedStyle(introContent).display !== 'none'
      ) {
        e.preventDefault();
        showProtocolListPage();
      }
    }
  });

  // Logo click handler - reveal all text instantly
  if (introLogo) {
    introLogo.addEventListener('click', () => {
      // Only trigger if intro content is showing and animations haven't been skipped
      if (!state.skipIntroAnimations && window.getComputedStyle(introContent).display !== 'none') {
        revealAllIntroText();
      }
    });
  }

  // Set platform-specific keyboard shortcut hints
  const introContinueHint = document.querySelector('.intro-continue-hint');
  if (introContinueHint) {
    introContinueHint.textContent = isMac ? 'Press ⌘ + Enter' : 'Press Ctrl + Enter';
  }
}
