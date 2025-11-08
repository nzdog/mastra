// ========================================
// EVENT HANDLERS
// ========================================

// Continue walk handler - persistent state for duplicate prevention
let isHandlingContinue = false;
let lastUserMessage = '';
let lastMessageTime = 0;

async function handleContinue() {
  const responseInput = document.getElementById('response-input');
  const continueButton = document.getElementById('continue-button');

  const userResponse = responseInput.value.trim();
  if (!userResponse || !window.sessionId) return;

  // Prevent double-calling while request is in-flight
  if (isHandlingContinue) {
    console.log('⚠️ handleContinue already in progress, skipping');
    return;
  }

  // Check for duplicate non-navigation messages within 3 seconds
  const isNavigationRequest = /go (back )?to theme \d+|revisit theme|back to|return to theme/i.test(userResponse);

  if (!isNavigationRequest &&
      userResponse === lastUserMessage &&
      Date.now() - lastMessageTime < 3000) {
    console.log('⚠️ Duplicate message detected within 3s, skipping');
    return;
  }

  // Set flags and tracking
  isHandlingContinue = true;
  lastUserMessage = userResponse;
  lastMessageTime = Date.now();

  // Add clicked class to fade out border
  continueButton.classList.add('clicked');

  // Blur input to stop cursor blinking
  responseInput.blur();

  continueButton.disabled = true;

  // Show loading indicator
  window.showLoadingIndicator();

  try {
    const data = await window.continueProtocolWalk(window.sessionId, userResponse);

    if (!data) {
      continueButton.classList.remove('clicked');
      continueButton.disabled = false;
      window.hideLoadingIndicator();
      return;
    }

    window.protocolData = data;

    // Update cost display (WALK responses typically cost ~$0.015-0.025)
    window.updateCostDisplay(0.02);

    responseInput.value = '';
    window.renderWalkState(data);

    continueButton.classList.remove('clicked');
    continueButton.disabled = false;

    // Hide loading indicator
    window.hideLoadingIndicator();

    // Focus will be set in renderWalkState after animation
  } catch (error) {
    window.showError('The field lost connection. Please try again.');
    continueButton.classList.remove('clicked');
    continueButton.disabled = false;
    window.hideLoadingIndicator();
  } finally {
    // Always reset the flag, regardless of success/error/early return
    isHandlingContinue = false;
  }
}

// Handle walk start (from entry view)
async function handleWalkStart() {
  const entryInput = document.getElementById('entry-input');
  const beginButton = document.getElementById('begin-button');

  const themeText = entryInput.value.trim();
  if (!themeText || !window.selectedProtocol) return;

  beginButton.disabled = true;
  window.showLoadingIndicator();

  try {
    const data = await window.startProtocolWalk(window.selectedProtocol.slug, themeText);

    if (!data) {
      beginButton.disabled = false;
      window.hideLoadingIndicator();
      return;
    }

    window.sessionId = data.session_id;
    window.currentMode = data.mode;
    window.protocolData = data;

    // Update cost display (ENTRY responses typically cost ~$0.01-0.02)
    window.updateCostDisplay(0.015);

    beginButton.disabled = false;
    window.hideLoadingIndicator();

    // Render the walk state
    window.renderWalkState(data);
  } catch (error) {
    window.showError('Failed to start protocol. Please try again.');
    beginButton.disabled = false;
    window.hideLoadingIndicator();
  }
}

// Handle completion
function handleCompletion(data) {
  console.log('🔧 handleCompletion called');
  console.log('📋 Data:', data);
  console.log('📄 Composer output:', data.composer_output);
  console.log('📏 Composer output length:', data.composer_output?.length);

  const composerOutput = document.getElementById('composer-output');
  const walkView = document.getElementById('walk-view');

  // Hide response area
  const responseArea = document.querySelector('.response-area');
  if (responseArea) {
    responseArea.style.display = 'none';
    console.log('✅ Response area hidden');
  } else {
    console.error('❌ Response area not found');
  }

  // Add summary-mode class to composer output
  composerOutput.classList.add('summary-mode');
  console.log('✅ summary-mode class added');
  console.log('📝 composerOutput classes:', composerOutput.className);

  // Add summary-container class to field-container
  const fieldContainer = document.getElementById('main-content');
  if (fieldContainer) {
    fieldContainer.classList.add('summary-container');
    console.log('✅ summary-container class added to field-container');
  }

  // Render the completion summary (treat as CLOSE mode)
  console.log('📝 Calling renderComposerOutput with isCloseMode=true');
  window.renderComposerOutput(data.composer_output, true);
  console.log('✅ renderComposerOutput completed');
  console.log('📝 composerOutput.innerHTML length:', composerOutput.innerHTML.length);
  console.log('📝 composerOutput first 500 chars:', composerOutput.innerHTML.substring(0, 500));

  // Add action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'margin-top: 3rem; display: flex; gap: 1rem; justify-content: center;';

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'walk-button';
  downloadBtn.textContent = 'Download as PDF';
  downloadBtn.onclick = () => window.downloadSummaryAsPDF(data);

  const newProtocolBtn = document.createElement('button');
  newProtocolBtn.className = 'walk-button';
  newProtocolBtn.textContent = 'Start New Protocol';
  newProtocolBtn.onclick = () => {
    window.location.reload();
  };

  actionsDiv.appendChild(downloadBtn);
  actionsDiv.appendChild(newProtocolBtn);

  composerOutput.appendChild(actionsDiv);

  // Scroll to top
  window.scrollTo(0, 0);
  console.log('✅ handleCompletion complete');
}

// Show completion options (two buttons for final theme)
function showCompletionOptions() {
  console.log('🎯 showCompletionOptions called');

  const walkControl = document.getElementById('walk-control');
  if (!walkControl) {
    console.error('❌ walk-control element not found');
    return;
  }

  // Clear existing buttons
  walkControl.innerHTML = '';

  // Create container for buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 1rem; width: 100%;';

  // Ask Another Question button
  const askButton = document.createElement('button');
  askButton.className = 'walk-button';
  askButton.id = 'ask-another-button';
  askButton.textContent = 'Ask Another Question';
  askButton.disabled = true; // Initially disabled until user types

  // Complete Protocol button
  const completeButton = document.createElement('button');
  completeButton.className = 'walk-button';
  completeButton.id = 'complete-protocol-button';
  completeButton.textContent = 'Complete Protocol';

  // Add click handlers
  askButton.addEventListener('click', () => {
    console.log('✅ Ask Another Question clicked');
    window.handleContinue();
  });

  completeButton.addEventListener('click', async () => {
    console.log('✅ Complete Protocol clicked');

    completeButton.disabled = true;
    window.showLoadingIndicator();

    try {
      const data = await window.completeProtocol(window.sessionId);

      if (!data) {
        completeButton.disabled = false;
        window.hideLoadingIndicator();
        return;
      }

      window.protocolData = data;

      // Update cost display (COMPLETE responses typically cost ~$0.03-0.05)
      window.updateCostDisplay(0.04);

      window.renderWalkState(data);
      window.hideLoadingIndicator();
    } catch (error) {
      window.showError('Failed to complete protocol. Please try again.');
      completeButton.disabled = false;
      window.hideLoadingIndicator();
    }
  });

  // Update ask button state based on response input
  const responseInput = document.getElementById('response-input');
  responseInput.addEventListener('input', () => {
    askButton.disabled = !responseInput.value.trim();
  });

  buttonContainer.appendChild(askButton);
  buttonContainer.appendChild(completeButton);
  walkControl.appendChild(buttonContainer);

  console.log('✅ Completion options rendered');
}

// Handle protocol selection (from intro view)
function selectProtocol(protocol) {
  window.selectedProtocol = protocol;

  const protocolTitle = document.getElementById('protocol-title');
  const protocolSelectionView = document.getElementById('protocol-selection-view');
  const entryView = document.getElementById('entry-view');
  const introFlowView = document.getElementById('intro-flow-view');
  const contentArea = document.querySelector('.content-area');
  const pageHeader = document.getElementById('page-header');

  // Scroll to top
  window.scrollTo(0, 0);

  // Hide intro flow view
  if (introFlowView) {
    introFlowView.classList.add('hidden');
  }

  // Show content area
  if (contentArea) {
    contentArea.classList.add('visible');
  }

  // Remove intro-mode class from header
  if (pageHeader) {
    pageHeader.classList.remove('intro-mode');
    pageHeader.classList.remove('protocol-list-active');
  }

  // Update protocol title in entry view with stacked format
  // Split title at em dash (—) or long dash if present
  const title = protocol.title;
  if (title.includes('—')) {
    const parts = title.split('—');
    protocolTitle.innerHTML = parts[0].trim() + '<br>' + parts[1].trim();
  } else if (title.includes(' — ')) {
    const parts = title.split(' — ');
    protocolTitle.innerHTML = parts[0].trim() + '<br>' + parts[1].trim();
  } else {
    protocolTitle.textContent = title;
  }

  // Update header title
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.textContent = protocol.title;
  }

  // Show entry view
  if (protocolSelectionView) protocolSelectionView.classList.add('hidden');
  if (entryView) entryView.classList.remove('hidden');

  // Focus the entry input after a brief delay
  const entryInput = document.getElementById('entry-input');
  if (entryInput) {
    setTimeout(() => {
      entryInput.focus();
    }, 300);
  }
}

// Download summary as PDF
function downloadSummaryAsPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  const titleLines = doc.splitTextToSize(data.protocol_name + ' - Summary', maxLineWidth);
  doc.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 10 + 10;

  // Content
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');

  // Split composer output into paragraphs and render
  const content = data.composer_output || '';
  const paragraphs = content.split('\n\n');

  paragraphs.forEach((para) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    // Check if we need a new page
    if (yPosition > pageHeight - margin - 20) {
      doc.addPage();
      yPosition = margin;
    }

    const lines = doc.splitTextToSize(trimmed, maxLineWidth);
    doc.text(lines, margin, yPosition);
    yPosition += lines.length * 7 + 5;
  });

  // Save the PDF
  const filename = data.protocol_name.replace(/\s+/g, '_') + '_Summary.pdf';
  doc.save(filename);
}

// Reveal all intro text instantly (when logo is clicked)
async function revealAllIntroText() {
  window.skipIntroAnimations = true;

  const introQuoteDesktop = document.getElementById('intro-quote-desktop');
  const introQuoteMobile = document.getElementById('intro-quote-mobile');
  const introEmbodimentLines = document.getElementById('intro-embodiment-lines');
  const introContinueContainer = document.getElementById('intro-continue-container');

  // Reset text content for both desktop and mobile quotes (with inline attribution)
  if (introQuoteDesktop) {
    introQuoteDesktop.textContent =
      '"The field is the sole governing agency of the particle." — Albert Einstein';
  }
  if (introQuoteMobile) {
    introQuoteMobile.textContent =
      '"The field is the sole governing agency of the particle." — Albert Einstein';
  }

  // Show quotes with quick fade
  if (introQuoteDesktop) {
    introQuoteDesktop.style.transition = 'opacity 300ms ease';
    introQuoteDesktop.style.opacity = '1';
    introQuoteDesktop.style.color = '';
  }

  if (introQuoteMobile) {
    introQuoteMobile.style.transition = 'opacity 300ms ease';
    introQuoteMobile.style.opacity = '1';
    introQuoteMobile.style.color = '';
  }

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
  if (introEmbodimentLines) {
    introEmbodimentLines.innerHTML = '';

    // Add all lines with quick staggered reveals
    for (let i = 0; i < embodimentLines.length; i++) {
      const line = document.createElement('div');
      line.className = 'intro-text-line';
      line.textContent = embodimentLines[i];
      line.style.top = 'calc(33% - 70px + ' + (60 + i * 40) + 'px)';
      line.style.transition = 'opacity 250ms ease';
      line.style.opacity = '0';
      line.style.color = '';
      introEmbodimentLines.appendChild(line);

      // Quick stagger (100ms between each line)
      await new Promise((resolve) => setTimeout(resolve, 100));
      line.style.opacity = '1';
    }
  }

  // Show continue button with final quick fade
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (introContinueContainer) {
    introContinueContainer.style.transition = 'opacity 300ms ease';
    introContinueContainer.style.opacity = '1';
  }
}

// Show protocol list page (after continue button)
async function showProtocolListPage() {
  console.log('Showing protocol list page...');

  const introContent = document.getElementById('intro-content');
  const introProtocolListPage = document.getElementById('intro-protocol-list-page');
  const introProtocolGuidance = document.getElementById('intro-protocol-guidance');
  const pageHeader = document.getElementById('page-header');

  // Scroll to top
  window.scrollTo(0, 0);

  // Fade out the intro content (quote, embodiment lines, orientation, continue button)
  await window.fadeOut(introContent, 800);

  // Hide intro content
  if (introContent) introContent.style.display = 'none';

  // Hide the big intro logo
  const introLogoContainer = document.querySelector('.intro-logo-container');
  if (introLogoContainer) {
    introLogoContainer.style.display = 'none';
  }

  // Show protocol list page
  if (introProtocolListPage) introProtocolListPage.classList.add('visible');

  // Show header logo on protocol list page
  if (pageHeader) pageHeader.classList.add('protocol-list-active');

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
  await window.loadAndRenderProtocolCards();
}

// Render walk state
async function renderWalkState(data) {
  // Clear any previous errors on successful render
  window.clearError();

  console.log('🚀 renderWalkState called, mode:', data.mode);
  console.log('📦 Full data received:', JSON.stringify(data, null, 2));
  console.log('📄 Composer output:', data.composer_output);
  console.log('📏 Composer output length:', data.composer_output?.length);

  const headerState = document.getElementById('header-state');
  const themePosition = document.getElementById('theme-position');
  const entryView = document.getElementById('entry-view');
  const walkView = document.getElementById('walk-view');
  const composerOutput = document.getElementById('composer-output');
  const responseInput = document.getElementById('response-input');

  // Scroll to top whenever rendering walk state
  window.scrollTo(0, 0);

  // In ENTRY mode, stay in entry view but show protocol introduction
  if (data.mode === 'ENTRY') {
    console.log('📝 ENTRY mode - showing protocol introduction');

    if (headerState) headerState.textContent = 'Protocol Introduction';
    window.renderEntryResponse(data);
    return;
  }

  console.log('🎬 Starting WALK mode transition');

  // Update page header
  if (headerState) headerState.textContent = data.mode;

  // Handle undefined theme values gracefully
  const themeNum = data.theme_number || 1;
  const totalThemes = data.total_themes || 5;
  if (themePosition) themePosition.textContent = 'Theme ' + themeNum + ' of ' + totalThemes;

  // Parse and render composer output (but keep hidden)
  window.renderComposerOutput(data.composer_output);

  // Hide entry view and show walk view
  if (entryView) entryView.style.display = 'none';
  if (walkView) {
    walkView.style.opacity = '0';
    walkView.style.display = 'block';

    // Force reflow to ensure transition works
    walkView.offsetHeight;

    // Fade in everything
    walkView.style.opacity = '1';

    // Add fade-in class to walk view children
    const walkChildren = walkView.querySelectorAll('.output-container, .response-area');
    walkChildren.forEach((child) => {
      child.classList.add('fade-in-section');
    });

    // Apply jigsaw animation after fade-in is complete (skip for COMPLETE mode)
    if (data.mode !== 'COMPLETE') {
      setTimeout(() => {
        const contentElements = composerOutput.querySelectorAll(
          '.theme-title, .section-content'
        );
        contentElements.forEach((el) => {
          if (el.textContent.trim()) {
            window.animateTextReveal(el);
          }
        });
      }, 100);
    }

    // Focus the response input after content is visible
    if (responseInput) {
      setTimeout(() => {
        responseInput.focus();
      }, 900);
    }
  }

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

    if (headerState) headerState.textContent = data.protocol_name + ' Summary';
    handleCompletion(data);
  }
}

// Export to window for cross-module access
window.handleContinue = handleContinue;
window.handleWalkStart = handleWalkStart;
window.handleCompletion = handleCompletion;
window.showCompletionOptions = showCompletionOptions;
window.selectProtocol = selectProtocol;
window.downloadSummaryAsPDF = downloadSummaryAsPDF;
window.revealAllIntroText = revealAllIntroText;
window.showProtocolListPage = showProtocolListPage;
window.renderWalkState = renderWalkState;
