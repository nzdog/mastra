/**
 * Intro Flow Module
 * Handles the application intro sequence and animations
 */

import { API_BASE, TIMING, isMac } from './config.js';
import { state, setState, cancelAnimations } from './state.js';
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
  showError,
} from './utils.js';

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Organically reveal all intro text with quick, staggered transitions
export async function revealAllIntroText() {
  cancelAnimations(); // Use cancellation token to stop running animations

  // Reset text content for both desktop and mobile quotes (with inline attribution)
  introQuoteDesktop.textContent =
    '"The field is the sole governing agency of the particle." — Albert Einstein';
  introQuoteMobile.textContent =
    '"The field is the sole governing agency of the particle." — Albert Einstein';

  // Show quotes with quick fade
  introQuoteDesktop.style.transition = `opacity ${TIMING.quickRevealTransition}ms ease`;
  introQuoteDesktop.style.opacity = '1';
  introQuoteDesktop.style.color = '';

  introQuoteMobile.style.transition = `opacity ${TIMING.quickRevealTransition}ms ease`;
  introQuoteMobile.style.opacity = '1';
  introQuoteMobile.style.color = '';

  // Wait a moment before showing embodiment lines
  await new Promise((resolve) => setTimeout(resolve, TIMING.quickRevealWait));

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

    // Quick stagger between each line
    await new Promise((resolve) => setTimeout(resolve, TIMING.quickRevealStagger));
    line.style.opacity = '1';
  }

  // Show continue button with final quick fade
  await new Promise((resolve) => setTimeout(resolve, TIMING.quickRevealStagger));
  introContinueContainer.style.transition = `opacity ${TIMING.quickRevealTransition}ms ease`;
  introContinueContainer.style.opacity = '1';
}

// Run the intro flow sequence
export async function runIntroFlow() {
  console.log('🎬 Starting intro flow...');

  // Reset cancellation flag at start
  state.animationCancelled = false;

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
  await new Promise((resolve) => setTimeout(resolve, TIMING.initialWait));

  // Check if animations were cancelled during the wait
  if (state.animationCancelled) {
    return; // Exit early if user clicked logo
  }

  // 2. Show quote with jigsaw fade - both desktop and mobile versions
  if (introQuoteDesktop && introQuoteMobile) {
    // Fade in both versions (CSS controls which one is visible)
    await Promise.all([
      fadeInClean(introQuoteDesktop, TIMING.jigsawDuration),
      fadeInClean(introQuoteMobile, TIMING.jigsawDuration),
    ]);

    if (state.animationCancelled) {
      return;
    }

    // Announce for screen readers
    announceForScreenReader(
      '"The field is the sole governing agency of the particle." — Albert Einstein'
    );

    // Wait before greying out
    await new Promise((resolve) => setTimeout(resolve, TIMING.lineDuration));

    if (state.animationCancelled) {
      return;
    }

    // Grey out both versions
    introQuoteDesktop.style.transition = `opacity ${TIMING.greyOutDuration}ms ease, color ${TIMING.greyOutDuration}ms ease`;
    introQuoteDesktop.style.opacity = '0.6';
    introQuoteDesktop.style.color = '#78716C';

    introQuoteMobile.style.transition = `opacity ${TIMING.greyOutDuration}ms ease, color ${TIMING.greyOutDuration}ms ease`;
    introQuoteMobile.style.opacity = '0.6';
    introQuoteMobile.style.color = '#78716C';

    await new Promise((resolve) => setTimeout(resolve, TIMING.greyOutDuration));

    if (state.animationCancelled) {
      return;
    }
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
      previousLine.style.transition = `opacity ${TIMING.greyOutDuration}ms ease, color ${TIMING.greyOutDuration}ms ease`;
      previousLine.style.opacity = '0.6';
      previousLine.style.color = '#78716C';
      await new Promise((resolve) => setTimeout(resolve, TIMING.greyOutDuration));
    }

    await fadeInClean(line, TIMING.jigsawDuration);

    if (state.animationCancelled) {
      return;
    }

    announceForScreenReader(lineText);
    await new Promise((resolve) => setTimeout(resolve, TIMING.lineDuration));

    if (state.animationCancelled) {
      return;
    }

    previousLine = line;
  }

  // 4. Grey out the last embodiment line
  if (previousLine) {
    previousLine.style.transition = `opacity ${TIMING.greyOutDuration}ms ease, color ${TIMING.greyOutDuration}ms ease`;
    previousLine.style.opacity = '0.6';
    previousLine.style.color = '#78716C';
    await new Promise((resolve) => setTimeout(resolve, TIMING.greyOutDuration));

    if (state.animationCancelled) {
      return;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, TIMING.beforeOrientation));

  if (state.animationCancelled) {
    return;
  }

  // 5. Show continue button
  await fadeIn(introContinueContainer, TIMING.continueFadeDuration);
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
    fadeOut(introContent, TIMING.contentFadeDuration),
    introLogoContainer
      ? fadeOut(introLogoContainer, TIMING.contentFadeDuration)
      : Promise.resolve(),
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

    // Check HTTP status
    if (!response.ok) {
      throw new Error(`Failed to load protocols: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.protocols || !Array.isArray(data.protocols)) {
      throw new Error('Invalid protocol data structure');
    }

    if (data.protocols.length === 0) {
      // Show empty state message
      introProtocolDeck.innerHTML =
        '<div class="intro-protocol-empty">No protocols available at this time.</div>';
      introProtocolDeck.classList.add('visible');
      return;
    }

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
  } catch (error) {
    console.error('Error loading protocols for intro:', error);

    // Show user-facing error message
    const errorMessage =
      error.message || 'Unable to load protocols. Please refresh the page to try again.';
    showError(errorMessage);

    // Show fallback UI in the protocol deck
    introProtocolDeck.innerHTML = `
      <div class="intro-protocol-error">
        <p>Unable to load protocols at this time.</p>
        <p class="intro-protocol-error-hint">Please check your connection and try refreshing the page.</p>
      </div>
    `;
    introProtocolDeck.classList.add('visible');
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
    console.log('🖱️ Walk this Protocol clicked for:', protocol.title);
    setState({ selectedProtocol: protocol });

    // Begin the protocol walk (this will handle hiding intro flow)
    await beginProtocolWalk(protocol);
  });

  introProtocolDeck.appendChild(card);
}

// Begin protocol walk - load and show entry view
async function beginProtocolWalk(protocol) {
  console.log('🚀 Beginning protocol walk for:', protocol.title);
  console.log('📋 Protocol data:', protocol);

  try {
    // Import necessary modules
    const { API_BASE } = await import('./config.js');
    const { getHeaders, showLoadingIndicator, hideLoadingIndicator, showError } = await import('./utils.js');
    const { entryView, protocolSelectionView, protocolTitle } = await import('./dom.js');
    const { renderProtocolEntry } = await import('./entry.js');

    console.log('✅ Modules imported successfully');

    // Scroll to top
    window.scrollTo(0, 0);
    console.log('⬆️ Scrolled to top');

    // Show loading indicator
    showLoadingIndicator();
    console.log('⏳ Loading indicator shown');

    // Hide intro flow
    if (introFlowView) {
      introFlowView.classList.add('hidden');
      console.log('👋 Intro flow hidden');
    }

    // Show content area (contains entry view, walk view, etc.)
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.classList.add('visible');
      console.log('✅ Content area visible');
    }

    // Remove intro-mode from header to show normal header
    const pageHeader = document.getElementById('page-header');
    if (pageHeader) {
      pageHeader.classList.remove('intro-mode');
      console.log('✅ Header intro-mode removed');
    }

    // Update protocol title in entry view
    if (protocolTitle) {
      const title = protocol.title;
      if (title.includes('—')) {
        const parts = title.split('—');
        protocolTitle.innerHTML = `${parts[0].trim()}<br>${parts[1].trim()}`;
      } else if (title.includes(' — ')) {
        const parts = title.split(' — ');
        protocolTitle.innerHTML = `${parts[0].trim()}<br>${parts[1].trim()}`;
      } else {
        protocolTitle.textContent = title;
      }
      console.log('📝 Protocol title updated:', title);
    } else {
      console.warn('⚠️ Protocol title element not found!');
    }

    // Show entry view
    if (protocolSelectionView) {
      protocolSelectionView.classList.add('hidden');
      console.log('👋 Protocol selection hidden');
    }
    if (entryView) {
      entryView.classList.remove('hidden');
      console.log('👁️ Entry view shown');
      console.log('📊 Entry view display:', window.getComputedStyle(entryView).display);
      console.log('📊 Entry view visibility:', window.getComputedStyle(entryView).visibility);
    } else {
      console.error('❌ Entry view element not found!');
    }

    // Reset entry view elements to visible state
    const logo = document.getElementById('lichen-logo');
    const beginButton = document.getElementById('begin-button');

    if (logo) {
      logo.classList.remove('fade-out');
      logo.style.opacity = '1';
      logo.style.display = 'block';
      console.log('👁️ Logo made visible');
    }

    if (protocolTitle) {
      protocolTitle.classList.remove('fade-out');
      protocolTitle.style.opacity = '1';
      console.log('👁️ Protocol title made visible');
    }

    if (beginButton) {
      beginButton.classList.remove('clicked');
      beginButton.style.display = 'block';
      beginButton.disabled = false;
      beginButton.textContent = 'Begin walk';
      console.log('👁️ Begin button made visible and enabled');
    }

    // Show the entry view with big logo and "Begin walk" button
    // The Begin walk button handler in app.js will fetch the entry data
    console.log('✅ Entry view ready - showing Begin walk button');
    console.log('✅ User can now click Begin walk to start protocol');

    // Hide loading indicator
    hideLoadingIndicator();
  } catch (error) {
    console.error('❌ Error in beginProtocolWalk:', error);
    console.error('❌ Error stack:', error.stack);

    const { showError, hideLoadingIndicator } = await import('./utils.js');
    showError('Failed to load protocol. Please try again.');
    hideLoadingIndicator();

    // Show intro flow again
    if (introFlowView) {
      introFlowView.style.display = 'block';
      console.log('🔄 Returned to intro flow due to error');
    }
  }
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
