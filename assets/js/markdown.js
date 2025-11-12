/**
 * Markdown Processing Module
 * Handles markdown parsing, conversion to HTML, and rendering
 */

import { composerOutput } from './dom.js';

/**
 * Convert markdown text to HTML
 */
export function convertMarkdownToHTML(markdown) {
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

/**
 * Parse markdown into structured sections
 */
export function parseMarkdown(markdown) {
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
  const questionMatch = markdown.match(/\*\*Guiding Question\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (questionMatch) sections.guiding_question = questionMatch[1].trim();

  // Common sections
  const whyMatch = markdown.match(/\*\*Why This Matters\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (whyMatch) sections.why_this_matters = whyMatch[1].trim();

  // CLOSE mode - field diagnosis content
  // Check if this is completion content by looking for common CLOSE mode patterns
  // Updated to handle both Field Diagnostic and Field Exit protocols
  console.log('🔍 Checking if CLOSE mode...', {
    hasFieldCall: markdown.includes("field I'd call"),
    hasCompleted: markdown.includes("You've completed"),
    hasFieldDiagnosis: markdown.includes('**FIELD DIAGNOSIS**'),
    hasPattern: markdown.includes('**Pattern Identified:**'),
    hasType: markdown.includes('**Type:**'),
    hasPurposeColon: markdown.includes('Purpose:'),
    hasGuidingQuestions: markdown.includes('Guiding Questions:'),
    length: markdown.length,
    preview: markdown.substring(0, 200),
  });

  if (
    markdown.includes("field I'd call") ||
    markdown.includes("You've completed") ||
    markdown.includes('**FIELD DIAGNOSIS**') ||
    markdown.includes('**Pattern Identified:**') ||
    markdown.includes('**Type:**') ||
    markdown.includes('## Field Diagnosis') ||
    markdown.includes('## Evidence') ||
    markdown.includes('## Coherence Assessment') ||
    markdown.includes('## Close Mode Summary')
  ) {
    // For CLOSE mode, treat the entire content as acknowledgment/diagnosis
    console.log('✅ CLOSE mode detected - treating as acknowledgment');
    sections.acknowledgment = markdown.trim();
    return sections;
  }

  console.log('📝 Not CLOSE mode - continuing to parse sections');

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
    if (readyMatch) sections.transition = `Ready to move into <strong>${readyMatch[1]}</strong>?`;

    // Check for "Shall we move into Theme X" pattern (older)
    const shallMatch = markdown.match(/Shall we move into \*\*(Theme \d+[^*]*)\*\*\??/i);
    if (shallMatch) sections.transition = `Shall we move into <strong>${shallMatch[1]}</strong>?`;
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
    guidingQuestionPreview: sections.guiding_question
      ? sections.guiding_question.substring(0, 100)
      : 'none',
  });

  return sections;
}

/**
 * Render composer output from markdown
 */
export function renderComposerOutput(markdown) {
  if (!composerOutput) {
    console.error('Composer output element not found');
    return;
  }

  composerOutput.innerHTML = '';

  console.log('📄 Composer output markdown:', markdown);

  // Parse markdown sections
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
