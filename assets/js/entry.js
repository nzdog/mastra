/**
 * Entry View Module
 * Handles protocol entry rendering and user interactions in entry mode
 */

import { API_BASE } from './config.js';
import { state, setState } from './state.js';
import {
  beginButton,
  headerCenterLogo,
  entryView,
  headerState,
  protocolSelectionView,
} from './dom.js';
import {
  getHeaders,
  showLoadingIndicator,
  hideLoadingIndicator,
  showError,
  formatSectionContent,
  animateTextReveal,
  updateCostDisplay,
} from './utils.js';

/**
 * Shared helper: Initialize entry view UI elements
 */
function initializeEntryViewUI() {
  // Hide begin button
  if (beginButton) beginButton.style.display = 'none';

  // Fade in header logo
  if (headerCenterLogo) headerCenterLogo.classList.add('visible');

  // Hide the large logo, keep only header logo
  const logo = entryView?.querySelector('img');
  const protocolTitleEl = document.getElementById('protocol-title');
  if (logo) {
    logo.style.display = 'none';
  }
  if (protocolTitleEl) {
    protocolTitleEl.classList.remove('fade-out');
    protocolTitleEl.classList.add('fade-in-only');

    // Add hover effect listeners
    protocolTitleEl.addEventListener('mouseenter', () => {
      protocolTitleEl.style.color = '#57534E';
    });
    protocolTitleEl.addEventListener('mouseleave', () => {
      protocolTitleEl.style.color = '#78716C';
    });
  }

  return protocolTitleEl;
}

/**
 * Shared helper: Create or get entry response area
 */
function getEntryResponseArea() {
  let entryResponseArea = document.getElementById('entry-response-area');
  if (!entryResponseArea) {
    entryResponseArea = document.createElement('div');
    entryResponseArea.id = 'entry-response-area';
    entryResponseArea.style.cssText = 'margin-top: 1rem; line-height: 1.7;';
  }
  return entryResponseArea;
}

/**
 * Shared helper: Render first section with animation
 */
function renderFirstSection(sectionData, entryResponseArea) {
  if (sectionData.length > 0) {
    const firstSection = document.createElement('div');
    firstSection.className = 'fade-in-only';

    // Create title
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText =
      'font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #78716C; margin-bottom: 0.75rem;';
    titleDiv.textContent = sectionData[0].title;
    firstSection.appendChild(titleDiv);

    // Create content container
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = formatSectionContent(sectionData[0].content);

    // Hide all text content initially
    const textElements = contentDiv.querySelectorAll('div');
    textElements.forEach((el) => {
      el.style.opacity = '0';
    });

    firstSection.appendChild(contentDiv);
    entryResponseArea.appendChild(firstSection);

    // Apply jigsaw animation to all text in content immediately
    textElements.forEach((el) => {
      if (el.textContent.trim()) {
        el.style.opacity = '1';
        animateTextReveal(el);
      }
    });
  }
}

/**
 * Shared helper: Create progressive reveal functionality for sections
 */
function createSectionRevealHandlers(
  sectionData,
  entryResponseArea,
  firstThemeTitle,
  options = {}
) {
  let currentIndex = 1;

  function showNextSection(event) {
    if (currentIndex < sectionData.length) {
      const section = sectionData[currentIndex];

      // Fade out the box by adding class to the clicked button
      const button = event.target;
      if (button) {
        button.classList.add('revealed');

        // After transition, add content and next button
        setTimeout(() => {
          // Create content container
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = formatSectionContent(section.content);

          // Hide all text content initially
          const textElements = contentDiv.querySelectorAll('div');
          textElements.forEach((el) => {
            el.style.opacity = '0';
          });

          // Insert content after button
          button.after(contentDiv);

          // Apply jigsaw animation to all text in content immediately
          textElements.forEach((el) => {
            if (el.textContent.trim()) {
              el.style.opacity = '1';
              animateTextReveal(el);
            }
          });

          currentIndex++;

          // Add next button or continue button
          if (currentIndex < sectionData.length) {
            addRevealButton(sectionData[currentIndex].title);
          } else {
            addContinueButton();
          }
        }, 500);
      }
    }
  }

  function addRevealButton(nextTitle) {
    const btn = document.createElement('button');
    btn.className = 'section-reveal-btn fade-in-only section-reveal-button';
    btn.textContent = nextTitle;
    btn.onclick = showNextSection;

    entryResponseArea.appendChild(btn);
  }

  function addContinueButton() {
    const continueControl = document.createElement('div');
    continueControl.className = 'walk-control';
    continueControl.style.marginTop = '2rem';

    const continueBtn = document.createElement('button');
    continueBtn.className = 'walk-button fade-in-only';
    continueBtn.textContent = `Continue to Theme 1 – ${firstThemeTitle}`;
    continueBtn.onclick = options.onContinue;

    continueControl.appendChild(continueBtn);
    entryResponseArea.appendChild(continueControl);

    // Add back button if callback provided
    if (options.addBackButton) {
      options.addBackButton();
    }
  }

  function expandAllSections(protocolTitleEl) {
    // Only expand if there are hidden sections
    if (currentIndex < sectionData.length) {
      // Remove any existing reveal buttons
      const revealButtons = entryResponseArea.querySelectorAll('.section-reveal-btn');
      revealButtons.forEach((btn) => btn.remove());

      // Create a container for all sections to fade in together
      const allSectionsContainer = document.createElement('div');
      allSectionsContainer.style.cssText = 'opacity: 0; transition: opacity 1s ease-in-out;';

      // Add all remaining sections
      for (let i = currentIndex; i < sectionData.length; i++) {
        const section = sectionData[i];

        const sectionDiv = document.createElement('div');
        sectionDiv.style.marginTop = '2rem';

        // Create title
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText =
          'font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #78716C; margin-bottom: 0.75rem;';
        titleDiv.textContent = section.title;
        sectionDiv.appendChild(titleDiv);

        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = formatSectionContent(section.content);
        sectionDiv.appendChild(contentDiv);

        allSectionsContainer.appendChild(sectionDiv);
      }

      entryResponseArea.appendChild(allSectionsContainer);

      // Trigger fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          allSectionsContainer.style.opacity = '1';
        });
      });

      // Update index and add continue button after animation
      setTimeout(() => {
        currentIndex = sectionData.length;
        addContinueButton();

        // Scroll to continue button
        const continueControl = entryResponseArea.querySelector('.walk-control');
        if (continueControl) {
          continueControl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 1000);
    }
  }

  // Initialize with first reveal button or continue button
  if (sectionData.length > 1) {
    addRevealButton(sectionData[1].title);
  } else {
    addContinueButton();
  }

  return { expandAllSections };
}

/**
 * Render protocol entry content (non-AI, static entry content)
 */
export function renderProtocolEntry(data) {
  console.log('🔍 renderProtocolEntry called with data:', data);
  console.log('🔍 data.entry_sections:', data.entry_sections);
  console.log('🔍 data.theme_1:', data.theme_1);

  const protocolTitleEl = initializeEntryViewUI();
  const entryResponseArea = getEntryResponseArea();

  const sectionData = data.entry_sections;
  const firstThemeTitle = data.theme_1?.title;

  if (!sectionData || sectionData.length === 0) {
    console.error('❌ No section data found!');
    return;
  }

  renderFirstSection(sectionData, entryResponseArea);

  // Continue button handler for non-AI path
  const onContinue = async () => {
    const continueBtn = event.target;
    continueBtn.classList.add('clicked');
    continueBtn.disabled = true;

    showLoadingIndicator();

    try {
      // NOW create session and start WALK mode (first AI call)
      const response = await fetch(`${API_BASE}/api/walk/start`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          user_input: 'begin walk',
          protocol_slug: state.selectedProtocol?.slug,
          mode: 'WALK', // Skip ENTRY mode, go straight to WALK
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const walkData = await response.json();
      setState({ sessionId: walkData.session_id, protocolData: walkData });

      // Update cost display (Theme 1 AI call typically costs ~$0.02)
      updateCostDisplay(0.02);

      // Import and call renderWalkState from walk.js
      const { renderWalkState } = await import('./walk.js');
      renderWalkState(walkData);

      hideLoadingIndicator();
    } catch (error) {
      showError('The field lost connection. Please try again.');
      continueBtn.classList.remove('clicked');
      continueBtn.disabled = false;
      hideLoadingIndicator();
    }
  };

  const { expandAllSections } = createSectionRevealHandlers(
    sectionData,
    entryResponseArea,
    firstThemeTitle,
    {
      onContinue,
    }
  );

  // Add click handler to protocol title to expand all sections at once
  if (protocolTitleEl) {
    protocolTitleEl.onclick = () => expandAllSections(protocolTitleEl);
  }

  // Append response area to entry view
  if (entryView) {
    entryView.appendChild(entryResponseArea);
    console.log('✅ entryResponseArea appended to entryView');
  } else {
    console.error('❌ entryView not found! Cannot append content.');
  }

  // Update header state
  if (headerState) {
    headerState.textContent = 'Protocol Introduction';
  }

  console.log('✅ renderProtocolEntry completed');
}

/**
 * Render ENTRY mode response (protocol introduction from AI)
 */
export function renderEntryResponse(data) {
  const protocolTitleEl = initializeEntryViewUI();
  const entryResponseArea = getEntryResponseArea();

  // Parse JSON response from agent
  let entryData;
  try {
    entryData = JSON.parse(data.composer_output);
  } catch (e) {
    console.error('Failed to parse ENTRY response JSON:', e);
    showError('Failed to load protocol content');
    return;
  }

  const sectionData = entryData.sections;
  const firstThemeTitle = entryData.firstThemeTitle;

  renderFirstSection(sectionData, entryResponseArea);

  // Continue button handler for AI path
  const onContinue = async () => {
    const continueBtn = event.target;
    continueBtn.classList.add('clicked');
    continueBtn.disabled = true;

    showLoadingIndicator();

    try {
      const response = await fetch(`${API_BASE}/api/walk/continue`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          session_id: state.sessionId,
          user_response: 'yes',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const walkData = await response.json();
      setState({ protocolData: walkData });

      // Update cost display (initial walk start typically costs ~$0.02)
      updateCostDisplay(0.02);

      // Import and call renderWalkState from walk.js
      const { renderWalkState } = await import('./walk.js');
      renderWalkState(walkData);

      hideLoadingIndicator();
    } catch (error) {
      showError('The field lost connection. Please try again.');
      continueBtn.classList.remove('clicked');
      continueBtn.disabled = false;
      hideLoadingIndicator();
    }
  };

  // Back button helper
  const addBackButton = () => {
    const backBtn = document.createElement('button');
    backBtn.className = 'fade-in-only';
    backBtn.style.cssText =
      'position: absolute; top: 1.5rem; right: 1.5rem; background: transparent; border: 1px solid #D6D3D1; color: #78716C; padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 9999px; cursor: pointer; transition: all 0.2s ease; font-family: inherit;';
    backBtn.textContent = 'Return to Protocol Selection';
    backBtn.onmouseenter = () => {
      backBtn.style.background = '#F5F5F4';
    };
    backBtn.onmouseleave = () => {
      backBtn.style.background = 'transparent';
    };
    backBtn.onclick = () => {
      // Hide entry view
      if (entryView) entryView.classList.add('hidden');
      // Show protocol selection
      if (protocolSelectionView) protocolSelectionView.classList.remove('hidden');
      // Scroll to top
      window.scrollTo(0, 0);
      // Remove the button
      backBtn.remove();
    };

    // Append button to entry view (top right)
    if (entryView) {
      entryView.appendChild(backBtn);
    }
  };

  const { expandAllSections } = createSectionRevealHandlers(
    sectionData,
    entryResponseArea,
    firstThemeTitle,
    {
      onContinue,
      addBackButton,
    }
  );

  // Add click handler to protocol title to expand all sections at once
  if (protocolTitleEl) {
    protocolTitleEl.onclick = () => expandAllSections(protocolTitleEl);
  }

  // Add to entry view
  if (entryView) {
    entryView.appendChild(entryResponseArea);
  }
}
