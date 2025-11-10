/**
 * Intro Flow Logic
 * Handles the intro sequence animation and protocol list page
 */

import {
  TIMING,
  prefersReducedMotion,
  skipIntroAnimations,
  setSkipIntroAnimations,
} from './config.js';
import { fadeIn, fadeInClean, fadeOut, announceForScreenReader } from './utils.js';
import { loadAndRenderProtocolCards } from './protocol-selection.js';

// Organically reveal all intro text with quick, staggered transitions
export async function revealAllIntroText(elements) {
  const { introQuoteDesktop, introQuoteMobile, introEmbodimentLines, introContinueContainer } =
    elements;

  setSkipIntroAnimations(true);

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
export async function runIntroFlow(elements, srAnnouncer) {
  const { introQuoteDesktop, introQuoteMobile, introEmbodimentLines, introContinueContainer } =
    elements;

  console.log('Starting intro flow...');
  console.log('introQuoteDesktop element:', introQuoteDesktop);
  console.log('introQuoteMobile element:', introQuoteMobile);
  console.log('introEmbodimentLines element:', introEmbodimentLines);

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
  if (skipIntroAnimations) {
    return; // Exit early, text already revealed
  }

  // 1. Wait 2 seconds with logo visible and spinning
  await new Promise((resolve) => setTimeout(resolve, TIMING.initialWait));
  console.log('Initial wait complete, showing quote...');

  // Check if animations were skipped during the wait
  if (skipIntroAnimations) {
    return; // Exit early if user clicked logo
  }

  // 2. Show quote with simple fade (0.86s) - both desktop and mobile versions
  // The CSS will handle showing only the appropriate version
  if (introQuoteDesktop && introQuoteMobile) {
    // Fade in both versions (CSS controls which one is visible)
    await Promise.all([fadeInClean(introQuoteDesktop, 860), fadeInClean(introQuoteMobile, 860)]);

    // Announce for screen readers (use desktop version text)
    announceForScreenReader(
      '"The field is the sole governing agency of the particle." — Albert Einstein',
      srAnnouncer
    );

    // Wait 3 seconds total before greying out
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check if animations were skipped during the wait
    if (skipIntroAnimations) {
      return; // Exit early if user clicked logo
    }

    // Grey out both versions
    introQuoteDesktop.style.transition = 'opacity 500ms ease, color 500ms ease';
    introQuoteDesktop.style.opacity = '0.6';
    introQuoteDesktop.style.color = '#78716C';

    introQuoteMobile.style.transition = 'opacity 500ms ease, color 500ms ease';
    introQuoteMobile.style.opacity = '0.6';
    introQuoteMobile.style.color = '#78716C';

    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for grey transition

    console.log('Quote complete');
  } else {
    console.error('Quote elements not found!');
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
    line.style.top = `calc(33% - 70px + ${60 + i * 40 + offset}px)`; // Start 60px below Einstein quote, moved up 70px for header
    introEmbodimentLines.appendChild(line);

    // Grey out the previous line BEFORE showing the next one
    if (previousLine) {
      previousLine.style.transition = 'opacity 500ms ease, color 500ms ease';
      previousLine.style.opacity = '0.6';
      previousLine.style.color = '#78716C';
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for grey transition
    }

    await fadeInClean(line, 860);
    announceForScreenReader(lineText, srAnnouncer);
    await new Promise((resolve) => setTimeout(resolve, TIMING.lineDuration));

    // Check if animations were skipped during the wait
    if (skipIntroAnimations) {
      return; // Exit early if user clicked logo
    }

    previousLine = line;
  }

  // 4. Grey out the last embodiment line
  if (previousLine) {
    previousLine.style.transition = 'opacity 500ms ease, color 500ms ease';
    previousLine.style.opacity = '0.6';
    previousLine.style.color = '#78716C';
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for grey transition
  }
  await new Promise((resolve) => setTimeout(resolve, TIMING.beforeOrientation));

  // 5. Show continue button
  await fadeIn(introContinueContainer, 800);
  console.log('Continue button visible, waiting for user action...');

  // Wait for user to click continue
  // The rest will be handled by the continue button click handler
}

// Handle Continue button click - show protocol list page
export async function showProtocolListPage(elements) {
  const {
    introContent,
    introProtocolListPage,
    introSequenceContainer,
    introProtocolGuidance,
    introBeginContainer,
  } = elements;

  console.log('Showing protocol list page...');

  // Scroll to top
  window.scrollTo(0, 0);

  // Fade out the intro content (quote, embodiment lines, orientation, continue button)
  await fadeOut(introContent, 800);

  // Hide intro content
  introContent.style.display = 'none';

  // Hide the big intro logo
  const introLogoContainer = document.querySelector('.intro-logo-container');
  if (introLogoContainer) {
    introLogoContainer.style.display = 'none';
  }

  // Show protocol list page
  introProtocolListPage.style.display = 'block';

  // Show protocol sequence container with fade-in
  if (introSequenceContainer) {
    introSequenceContainer.style.display = 'block';
    await fadeIn(introSequenceContainer, 800);
  }

  // Fade in guidance text and protocol cards together
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

  // After all is done, show begin button with fade
  if (introBeginContainer) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await fadeIn(introBeginContainer, 600);
  }
}
