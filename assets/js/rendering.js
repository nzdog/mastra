// ========================================
// RENDERING FUNCTIONS
// ========================================

// Announce text for screen readers
function announceForScreenReader(text) {
  const srAnnouncer = document.getElementById('sr-announcer');
  if (srAnnouncer) {
    srAnnouncer.textContent = text;
    setTimeout(() => {
      srAnnouncer.textContent = '';
    }, 1000);
  }
}

// Fade in an element (opacity only)
function fadeIn(element, duration = 1000) {
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
function fadeInClean(element, duration = 1000) {
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
function fadeOut(element, duration = 1000) {
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
function animateTextReveal(element, duration = 400) {
  if (!element) return;

  const text = element.textContent;
  const chars = text.split('');
  
  // Create spans for each character
  element.innerHTML = '';
  const spans = chars.map(char => {
    const span = document.createElement('span');
    span.textContent = char;
    span.style.opacity = '0';
    span.style.transition = `opacity ${duration}ms ease`;
    element.appendChild(span);
    return span;
  });

  // Trigger animation
  setTimeout(() => {
    spans.forEach((span, i) => {
      setTimeout(() => {
        span.style.opacity = '1';
      }, i * 10); // Stagger the appearance
    });
  }, 10);
}

// Convert markdown to HTML with improved parsing
function convertMarkdownToHTML(markdown) {
  if (!markdown) return '';

  console.log('🔧 MARKDOWN INPUT (first 500 chars):', markdown.substring(0, 500));

  let html = markdown;

  // Filter out horizontal rules (---) - they're structural markers, not content
  html = html.replace(/^---+\s*$/gm, '');

  // First, convert headers (before any other processing)
  // Support both ## and # formats
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Convert **bold text:** or **bold** to <strong>
  // Use a more robust pattern that handles multi-line and inline bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert bullet points
  html = html.replace(/^\• (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => {
    return '<ul>' + match + '</ul>';
  });

  // Split into paragraphs based on double newlines first
  const paragraphs = html.split(/\n\n+/);
  const processed = [];

  for (let para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Check if it's already an HTML element
    if (
      trimmed.startsWith('<h2>') ||
      trimmed.startsWith('<h3>') ||
      trimmed.startsWith('<ul>') ||
      trimmed.startsWith('<ol>') ||
      trimmed.startsWith('<li>')
    ) {
      processed.push(trimmed);
    } else {
      // Wrap plain text in paragraph tags
      // Replace single newlines with spaces within paragraphs
      const cleanText = trimmed.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      processed.push('<p>' + cleanText + '</p>');
    }
  }

  const result = processed.join('\n\n');
  console.log('🔧 FINAL HTML (first 500 chars):', result.substring(0, 500));
  console.log('🔧 Total processed elements:', processed.length);

  return result;
}

// Parse markdown into sections
function parseMarkdown(markdown) {
  const sections = {};

  // Extract theme name from markdown (e.g., **Theme 1 – Surface Behaviors**)
  const themeMatch = markdown.match(/\*\*(Theme\s+\d+\s*[–—:-]\s*[^*]+)\*\*/i);
  if (themeMatch) sections.theme_name = themeMatch[1].trim();

  // ENTRY mode sections
  const purposeMatch = markdown.match(/\*\*Purpose\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (purposeMatch) sections.orientation = purposeMatch[1].trim();

  const outcomesMatch = markdown.match(
    /\*\*Protocol-Level Outcomes\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i
  );
  if (outcomesMatch) sections.guiding_question = outcomesMatch[1].trim();

  // WALK mode sections - Purpose/Frame is the orientation
  const purposeWalkMatch = markdown.match(/\*\*Purpose:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
  if (purposeWalkMatch) sections.orientation = purposeWalkMatch[1].trim();

  const frameMatch = markdown.match(/\*\*Frame:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
  if (frameMatch) sections.orientation = frameMatch[1].trim();

  const orientationMatch = markdown.match(/\*\*Orientation\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (orientationMatch) sections.orientation = orientationMatch[1].trim();

  // Guiding Questions (plural) - extract the bullet points
  const questionsMatch = markdown.match(
    /\*\*Guiding Questions:\*\*\s*\n([\s\S]*?)(?=\n\n[^•\n]|\n\*\*|$)/i
  );
  if (questionsMatch) {
    sections.guiding_question = questionsMatch[1].trim();
  }

  // Guiding Question (singular)
  const questionMatch = markdown.match(
    /\*\*Guiding Question\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i
  );
  if (questionMatch) sections.guiding_question = questionMatch[1].trim();

  // Common sections
  const whyMatch = markdown.match(/\*\*Why This Matters\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (whyMatch) sections.why_this_matters = whyMatch[1].trim();

  // Interpretation section (with invisible marker like <!-- INTERPRETATION -->)
  const interpretationMatch = markdown.match(
    /<!--\s*INTERPRETATION\s*-->\s*\n([\s\S]*?)(?=\n(?:<!--|\*\*)|$)/i
  );
  if (interpretationMatch) {
    sections.acknowledgment = interpretationMatch[1].trim();
  }

  // Acknowledgment/Interpretation - fallback to capture from "I hear you" or "I see you" until completion prompt or transition
  if (!sections.acknowledgment) {
    const ackMatch = markdown.match(
      /^(I (?:hear|see) you[\s\S]*?)(?=\n\*\*Completion Prompt\*\*|Ready to move|Shall we move|\n\*\*Theme)/im
    );
    if (ackMatch) sections.acknowledgment = ackMatch[1].trim();
  }

  const promptMatch = markdown.match(/\*\*Completion Prompt\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (promptMatch) sections.completion_prompt = promptMatch[1].trim();

  // Check for protocol completion (any protocol, any number of themes)
  const completionMatch = markdown.match(/You've completed all \d+ themes of the .+/i);
  if (completionMatch) {
    sections.transition = 'PROTOCOL_COMPLETE';
    sections.completionText = completionMatch[0]; // Store the actual completion text
  } else {
    // Check for "Ready to move into Theme X" pattern
    const readyMatch = markdown.match(/Ready to move into \*\*(Theme \d+[^*]*)\*\*\??/i);
    if (readyMatch)
      sections.transition = `Ready to move into <strong>${readyMatch[1]}</strong>?`;

    // Check for "Shall we move into Theme X" pattern (older)
    const shallMatch = markdown.match(/Shall we move into \*\*(Theme \d+[^*]*)\*\*\??/i);
    if (shallMatch)
      sections.transition = `Shall we move into <strong>${shallMatch[1]}</strong>?`;
  }

  // Also check for "Would you like me to" pattern (ENTRY mode)
  const wouldYouMatch = markdown.match(/(Would you like me to.*?\*\*Theme \d+[^*]*\*\*\??)/i);
  if (wouldYouMatch) sections.transition = wouldYouMatch[1];

  // Extract final instruction like "Take a moment..."
  const instructionMatch = markdown.match(/\n\n([A-Z][^*\n]+(?:moment|ready)[^*\n]+\.)/);
  if (instructionMatch) sections.instruction = instructionMatch[1].trim();

  console.log('📋 Parsed sections:', {
    hasOrientation: !!sections.orientation,
    hasGuidingQuestion: !!sections.guiding_question,
    hasWhyThisMatters: !!sections.why_this_matters,
    hasAcknowledgment: !!sections.acknowledgment,
    hasTransition: !!sections.transition,
    guidingQuestionPreview: sections.guiding_question ? sections.guiding_question.substring(0, 100) : 'none'
  });

  return sections;
}

// Render composer output
function renderComposerOutput(markdown, isCloseMode = false) {
  const composerOutput = document.getElementById('composer-output');
  if (!composerOutput) return;
  
  composerOutput.innerHTML = '';

  console.log('📄 Composer output markdown:', markdown);
  console.log('🔍 isCloseMode:', isCloseMode);

  // Safety check for undefined markdown
  if (!markdown) {
    console.error('❌ renderComposerOutput called with undefined markdown');
    return;
  }

  // If this is CLOSE mode, treat entire content as acknowledgment
  if (isCloseMode) {
    console.log('✅ CLOSE mode - treating entire content as summary');
    const sections = { acknowledgment: markdown.trim() };
    const htmlContent = convertMarkdownToHTML(sections.acknowledgment);
    composerOutput.innerHTML = `
      <div class="output-section">
        <div class="section-content">${htmlContent}</div>
      </div>
    `;
    return;
  }

  // Parse markdown sections for WALK/ENTRY modes
  const sections = parseMarkdown(markdown);
  console.log('📋 Parsed sections:', sections);

  // Check if we should hide response area (protocol complete)
  const shouldHideResponseArea = sections.transition === 'PROTOCOL_COMPLETE';
  if (shouldHideResponseArea) {
    const responseArea = document.querySelector('.response-area');
    if (responseArea) responseArea.style.display = 'none';
    console.log('🎯 Hiding response area - protocol complete');
  } else {
    const responseArea = document.querySelector('.response-area');
    if (responseArea) responseArea.style.display = 'block';
  }

  // Render theme title if available
  if (sections.theme_name) {
    composerOutput.innerHTML += `
      <div class="theme-title">${sections.theme_name}</div>
    `;
  }

  // Render based on available sections
  if (sections.orientation) {
    composerOutput.innerHTML += `
      <div class="output-section">
        <div class="section-label">Purpose</div>
        <div class="section-content">${sections.orientation}</div>
      </div>
    `;
  }

  if (sections.why_this_matters) {
    composerOutput.innerHTML += `
      <div class="output-section">
        <div class="section-label">Why This Theme Matters</div>
        <div class="section-content">${sections.why_this_matters}</div>
      </div>
    `;
  }

  if (sections.guiding_question) {
    const label = sections.guiding_question.includes('•')
      ? 'Guiding Questions'
      : 'Guiding Question';
    const helperText =
      'Reflect on these questions as they relate to your current situation. Share what comes up for you—there are no right or wrong answers.';
    composerOutput.innerHTML += `
      <div class="output-section">
        <div class="section-label">${label}</div>
        <div class="section-content" style="font-size: 0.875rem; color: #78716C; margin-bottom: 0.75rem; font-style: italic;">${helperText}</div>
        <div class="section-content" style="white-space: pre-line;">${sections.guiding_question}</div>
      </div>
    `;
  }

  if (sections.instruction) {
    composerOutput.innerHTML += `
      <div class="output-section">
        <div class="section-content" style="color: #78716C; font-style: italic; margin-top: 1.5rem;">${sections.instruction}</div>
      </div>
    `;
  }

  if (sections.acknowledgment) {
    // Convert markdown to HTML for better formatting
    const htmlContent = convertMarkdownToHTML(sections.acknowledgment);
    console.log('📝 SETTING innerHTML with htmlContent');
    console.log('📝 htmlContent length:', htmlContent.length);
    composerOutput.innerHTML += `
      <div class="output-section">
        <div class="section-content">${htmlContent}</div>
      </div>
    `;
    console.log('📝 composerOutput.innerHTML length after:', composerOutput.innerHTML.length);
    console.log('📝 composerOutput classes:', composerOutput.className);
  }

  if (sections.completion_prompt) {
    const helperText = "When this statement feels true for you, you're ready to continue:";
    composerOutput.innerHTML += `
      <div class="output-section">
        <div class="section-label">Theme Completion</div>
        <div class="section-content" style="font-size: 0.875rem; color: #78716C; margin-bottom: 0.5rem;">${helperText}</div>
        <div class="section-content" style="font-style: italic; font-weight: 500; color: #57534E;">${sections.completion_prompt}</div>
      </div>
    `;
  }

  if (sections.transition) {
    if (sections.transition === 'PROTOCOL_COMPLETE') {
      // Special case: Show "Generate Report" button after completing all themes
      const completionText =
        sections.completionText || 'You have completed all themes of this protocol.';
      composerOutput.innerHTML += `
        <div class="output-section">
          <div class="section-content" style="color: #78716C; font-size: 1rem;">${completionText}</div>
        </div>
        <div class="output-section" style="margin-top: 2rem;">
          <button id="generate-report-button" class="walk-button">Field Diagnosis Complete, generate report</button>
        </div>
      `;
    } else {
      composerOutput.innerHTML += `
        <div class="output-section">
          <div class="section-content" style="color: #78716C; font-size: 1rem;">${sections.transition}</div>
        </div>
      `;
    }
  }
}

// Render protocol card for intro view
function renderProtocolCard(protocol) {
  const introProtocolDeck = window.introProtocolDeck;
  if (!introProtocolDeck) return;

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
    useWhenContent = '<ul>' + protocol.use_when.map(item => `<li>${item}</li>`).join('') + '</ul>';
  } else {
    useWhenContent = `<p>${protocol.use_when || 'Information not available'}</p>`;
  }

  useWhenSection.innerHTML = `
    <div class="intro-disclosure-label">Use this when…</div>
    <div class="intro-disclosure-content">${useWhenContent}</div>
  `;
  card.appendChild(useWhenSection);

  // Use When button
  const useWhenBtn = document.createElement('button');
  useWhenBtn.className = 'intro-disclosure-btn';
  useWhenBtn.textContent = 'Use this when…';
  card.appendChild(useWhenBtn);

  // Walk button (initially hidden)
  const walkBtn = document.createElement('button');
  walkBtn.className = 'intro-walk-btn';
  walkBtn.textContent = 'Begin Protocol';
  card.appendChild(walkBtn);

  // Use When button click handler
  useWhenBtn.addEventListener('click', () => {
    useWhenBtn.style.display = 'none';
    useWhenSection.classList.add('visible');
    
    setTimeout(() => {
      walkBtn.style.display = 'block';
    }, 1500);
  });

  // Walk button click handler  
  walkBtn.addEventListener('click', () => {
    window.selectProtocol(protocol);
  });

  introProtocolDeck.appendChild(card);
}

// Render protocol cards for main selection view
function renderProtocolCards(protocols) {
  // Clear any previous errors on successful render
  clearError();

  const protocolGrid = document.getElementById('protocol-grid');
  if (!protocolGrid) return;

  protocolGrid.innerHTML = '';

  // Sort protocols: Field Diagnostic first, then alphabetically by title
  const sortedProtocols = [...protocols].sort((a, b) => {
    if (a.slug === 'field_diagnostic') return -1;
    if (b.slug === 'field_diagnostic') return 1;
    return a.title.localeCompare(b.title);
  });

  sortedProtocols.forEach((protocol) => {
    const card = document.createElement('div');
    card.className = 'protocol-card';

    // Truncate purpose if too long
    const purpose = protocol.purpose || 'No description available';
    const truncatedPurpose =
      purpose.length > 200 ? purpose.substring(0, 200) + '...' : purpose;

    card.innerHTML = `
      <div class="protocol-card-header">
        <div class="protocol-card-title">${protocol.title}</div>
        <div class="protocol-card-badge">${protocol.theme_count} themes</div>
      </div>
      <div class="protocol-card-purpose">${truncatedPurpose}</div>
    `;

    card.addEventListener('click', () => window.selectProtocol(protocol));
    protocolGrid.appendChild(card);
  });
}

// Render entry response with sections
function renderEntryResponse(data) {
  const entryView = document.getElementById('entry-view');
  if (!entryView) return;

  console.log('🔧 renderEntryResponse called with data:', data);
  console.log('🔧 composer_output:', data.composer_output);
  console.log('🔧 composer_output length:', data.composer_output?.length);

  // Remove entry area if exists
  const existingEntryArea = document.getElementById('entry-response-area');
  if (existingEntryArea) {
    existingEntryArea.remove();
  }

  // Create response area
  const entryResponseArea = document.createElement('div');
  entryResponseArea.id = 'entry-response-area';
  entryResponseArea.style.cssText = 'margin-top: 3rem;';

  // Parse sections from composer output
  const markdown = data.composer_output || '';
  const sections = parseMarkdown(markdown);

  // Build section data array (all possible sections in order)
  const sectionData = [];

  if (sections.orientation) {
    sectionData.push({
      title: 'Purpose',
      content: sections.orientation
    });
  }

  if (sections.guiding_question) {
    sectionData.push({
      title: sections.guiding_question.includes('•') ? 'Guiding Questions' : 'Guiding Question',
      content: sections.guiding_question
    });
  }

  // Show first section immediately
  let currentIndex = 0;
  if (sectionData.length > 0) {
    const firstSection = sectionData[currentIndex];
    const firstSectionDiv = document.createElement('div');
    firstSectionDiv.style.cssText = 'opacity: 0; transition: opacity 1s ease-in-out;';

    // Create title
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText =
      'font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #78716C; margin-bottom: 0.75rem;';
    titleDiv.textContent = firstSection.title;
    firstSectionDiv.appendChild(titleDiv);

    // Create content
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = firstSection.content;
    firstSectionDiv.appendChild(contentDiv);

    entryResponseArea.appendChild(firstSectionDiv);

    // Trigger fade-in animation
    setTimeout(() => {
      firstSectionDiv.style.opacity = '1';
      
      // Apply jigsaw animation to text after fade-in starts
      setTimeout(() => {
        const textElements = firstSectionDiv.querySelectorAll('div');
        textElements.forEach((el) => {
          if (el.textContent.trim() && !el.querySelector('div')) {
            animateTextReveal(el);
          }
        });
      }, 300);
    }, 50);

    currentIndex++;
  }

  // Helper to add reveal button
  function addRevealButton(nextTitle) {
    const revealBtn = document.createElement('button');
    revealBtn.className = 'section-reveal-btn';
    revealBtn.textContent = nextTitle;
    entryResponseArea.appendChild(revealBtn);

    revealBtn.addEventListener('click', function() {
      // Reveal next section
      if (currentIndex < sectionData.length) {
        const section = sectionData[currentIndex];
        const sectionDiv = document.createElement('div');
        sectionDiv.style.cssText = 'margin-top: 2rem; opacity: 0; transition: opacity 1s ease-in-out;';

        // Create title
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText =
          'font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #78716C; margin-bottom: 0.75rem;';
        titleDiv.textContent = section.title;
        sectionDiv.appendChild(titleDiv);

        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = section.content;
        sectionDiv.appendChild(contentDiv);

        // Insert before button
        entryResponseArea.insertBefore(sectionDiv, revealBtn);

        // Trigger fade-in animation
        setTimeout(() => {
          sectionDiv.style.opacity = '1';
          
          // Apply jigsaw animation
          setTimeout(() => {
            const textElements = sectionDiv.querySelectorAll('div');
            textElements.forEach((el) => {
              if (el.textContent.trim() && !el.querySelector('div')) {
                animateTextReveal(el);
              }
            });
          }, 300);
        }, 50);

        currentIndex++;

        // Update button or add continue button
        if (currentIndex < sectionData.length) {
          revealBtn.textContent = sectionData[currentIndex].title;
        } else {
          revealBtn.remove();
          addContinueButton();
        }
      }
    });
  }

  // Helper to add continue button
  function addContinueButton() {
    const continueBtn = document.createElement('button');
    continueBtn.className = 'walk-button';
    continueBtn.textContent = 'Begin Walk';
    continueBtn.style.cssText = 'margin-top: 2rem; opacity: 0; transition: opacity 1s ease-in-out;';
    entryResponseArea.appendChild(continueBtn);

    setTimeout(() => {
      continueBtn.style.opacity = '1';
    }, 50);

    continueBtn.addEventListener('click', () => {
      window.handleWalkStart();
    });
  }

  // Add to entry view
  entryView.appendChild(entryResponseArea);

  // Add first reveal button or continue button after initial section
  if (sectionData.length > 1) {
    addRevealButton(sectionData[1].title);
  } else {
    addContinueButton();
  }
}

// Show error message
function showError(message) {
  const errorMessage = document.getElementById('error-message');
  const errorStrip = document.getElementById('error-strip');
  const errorMessageEntry = document.getElementById('error-message-entry');
  const errorStripEntry = document.getElementById('error-strip-entry');

  console.log('🔔 showError called with message:', message);

  // Show error in walk view
  if (errorMessage && errorStrip) {
    errorMessage.textContent = message;
    errorStrip.classList.add('active');
  }

  // Show error in entry view
  if (errorMessageEntry && errorStripEntry) {
    errorMessageEntry.textContent = message;
    errorStripEntry.classList.add('active');
  }
}

function clearError() {
  const errorMessage = document.getElementById('error-message');
  const errorStrip = document.getElementById('error-strip');
  const errorMessageEntry = document.getElementById('error-message-entry');
  const errorStripEntry = document.getElementById('error-strip-entry');

  // Clear error in walk view
  if (errorMessage && errorStrip) {
    errorMessage.textContent = '';
    errorStrip.classList.remove('active');
  }

  // Clear error in entry view
  if (errorMessageEntry && errorStripEntry) {
    errorMessageEntry.textContent = '';
    errorStripEntry.classList.remove('active');
  }
}

// Export to window for cross-module access
window.announceForScreenReader = announceForScreenReader;
window.fadeIn = fadeIn;
window.fadeInClean = fadeInClean;
window.fadeOut = fadeOut;
window.animateTextReveal = animateTextReveal;
window.convertMarkdownToHTML = convertMarkdownToHTML;
window.parseMarkdown = parseMarkdown;
window.renderComposerOutput = renderComposerOutput;
window.renderProtocolCard = renderProtocolCard;
window.renderProtocolCards = renderProtocolCards;
window.renderEntryResponse = renderEntryResponse;
window.showError = showError;
window.clearError = clearError;
