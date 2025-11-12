/**
 * Completion Module
 * Handles protocol completion, summary rendering, and PDF generation
 */

import { API_BASE } from './config.js';
import { state } from './state.js';
import { composerOutput } from './dom.js';
import { getHeaders } from './utils.js';
import { renderComposerOutput } from './markdown.js';
import { ANIMATION_DELAYS, CONTENT_LIMITS } from './constants.js';

/**
 * Handle completion mode - render summary and provide download/completion options
 */
export function handleCompletion(data) {
  console.log('🔧 handleCompletion called');
  console.log('📋 Data in handleCompletion:', data);

  // Add wider container class for summary mode
  const fieldContainer = document.getElementById('main-content');
  if (fieldContainer) {
    fieldContainer.classList.add('summary-container');
  }

  // Render the completion content (field diagnosis and summary)
  console.log('🎨 Rendering composer output...');
  renderComposerOutput(data.composer_output);

  // Add summary-mode class for enhanced styling
  console.log('🔧 Before adding summary-mode, classes:', composerOutput?.className);
  if (composerOutput) {
    composerOutput.classList.add('summary-mode');
    console.log('🔧 After adding summary-mode, classes:', composerOutput.className);

    // Log the actual HTML structure
    console.log(
      `🔧 Composer output HTML (first ${CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH} chars):`,
      composerOutput.innerHTML.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH)
    );

    // Check if h2 tags exist
    const h2Tags = composerOutput.querySelectorAll('h2');
    console.log('🔧 Number of h2 tags found:', h2Tags.length);
    if (h2Tags.length > 0) {
      console.log('🔧 First h2 text:', h2Tags[0].textContent);
      console.log(
        '🔧 First h2 computed style font-size:',
        window.getComputedStyle(h2Tags[0]).fontSize
      );
      console.log('🔧 First h2 computed style color:', window.getComputedStyle(h2Tags[0]).color);
    }
  }

  console.log('✅ Composer output rendered with summary styling');

  // Hide the entire response area (input + continue button)
  const responseArea = document.querySelector('.response-area');
  console.log('🔍 Response area found:', !!responseArea);
  if (responseArea) {
    console.log('👁️ Hiding response area');
    responseArea.style.display = 'none';
    console.log('✅ Response area hidden');
  } else {
    console.log('⚠️ Response area not found!');
  }

  // Hide the existing continue button specifically
  const continueButton = document.getElementById('continue-button');
  console.log('🔍 Continue button found:', !!continueButton);
  if (continueButton) {
    console.log('👁️ Hiding continue button');
    continueButton.style.display = 'none';
    console.log('✅ Continue button hidden');
  } else {
    console.log('⚠️ Continue button not found!');
  }

  // Add completion button container after composer output
  console.log('🔨 Creating completion buttons...');
  const completionContainer = document.createElement('div');
  completionContainer.className = 'walk-control';
  completionContainer.style.marginTop = '3rem';
  completionContainer.style.display = 'flex';
  completionContainer.style.gap = '1rem';
  completionContainer.style.justifyContent = 'center';
  completionContainer.style.paddingTop = '2rem';
  completionContainer.style.borderTop = '1px solid #E7E5E4';
  completionContainer.innerHTML = `
    <button class="walk-button" id="download-button" style="padding: 0.875rem 1.75rem; font-size: 0.9375rem;">Download Summary</button>
    <button class="walk-button" id="completion-button" style="padding: 0.875rem 1.75rem; font-size: 0.9375rem;">Mark complete</button>
  `;

  // Insert completion button after composer output
  console.log('🔍 Composer output parent:', !!composerOutput?.parentNode);
  if (composerOutput?.parentNode) {
    composerOutput.parentNode.insertBefore(completionContainer, composerOutput.nextSibling);
    console.log('✅ Completion buttons added');
  }

  // Handle download button click
  const downloadButton = completionContainer.querySelector('#download-button');
  console.log('🔍 Download button found:', !!downloadButton);
  if (downloadButton) {
    downloadButton.onclick = async () => {
      console.log('🖱️ Download button clicked');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Load and add logo
      const logoImg = document.querySelector('img[src="/lichen-logo.png"]');
      if (logoImg) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = logoImg.width;
        canvas.height = logoImg.height;
        ctx.drawImage(logoImg, 0, 0);
        const logoData = canvas.toDataURL('image/png');

        // Add logo at top center (20mm wide, proportional height)
        const logoWidth = 20;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoData, 'PNG', logoX, yPosition, logoWidth, logoHeight);
        yPosition += logoHeight + 10;
      }

      // Helper function to add footer to each page
      const addFooter = () => {
        const currentDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(160, 160, 160); // Subtle gray
        doc.text(currentDate, margin, pageHeight - 10);
        doc.setTextColor(0, 0, 0); // Reset to black
      };

      // Add footer to first page
      addFooter();

      // Helper function to add text with word wrapping
      const addText = (text, fontSize, isBold = false, isItalic = false) => {
        if (yPosition > pageHeight - 25) {
          doc.addPage();
          addFooter(); // Add footer to new page
          yPosition = margin;
        }

        doc.setFontSize(fontSize);
        if (isBold && isItalic) {
          doc.setFont('helvetica', 'bolditalic');
        } else if (isBold) {
          doc.setFont('helvetica', 'bold');
        } else if (isItalic) {
          doc.setFont('helvetica', 'italic');
        } else {
          doc.setFont('helvetica', 'normal');
        }

        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line) => {
          if (yPosition > pageHeight - 25) {
            doc.addPage();
            addFooter(); // Add footer to new page
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += fontSize * 0.5;
        });
      };

      // Title
      addText(data.protocol_name.toUpperCase(), 18, true);
      yPosition += 5;
      addText('Summary Report', 14, false, true);
      yPosition += 10;

      // Draw a line
      doc.setDrawColor(200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Get the text content and parse it
      const summaryText = composerOutput.innerText || composerOutput.textContent;
      const lines = summaryText.split('\n');

      for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          yPosition += 3;
          continue;
        }

        // Check if it's a header (all caps or starts with specific patterns)
        if (
          trimmed.match(/^[A-Z\s]{5,}$/) ||
          trimmed.match(/^(FIELD DIAGNOSIS|SUMMARY|THE FIELD)/)
        ) {
          yPosition += 5;
          addText(trimmed, 14, true);
          yPosition += 5;
        } else if (trimmed.includes('**') || trimmed.match(/^[A-Z][A-Z\s]+:/)) {
          // Bold text or section headers
          const cleanText = trimmed.replace(/\*\*/g, '');
          addText(cleanText, 11, true);
          yPosition += 2;
        } else {
          // Regular paragraph text
          addText(trimmed, 10);
          yPosition += 2;
        }
      }

      // Save the PDF
      const protocolSlug = data.protocol_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const date = new Date().toISOString().split('T')[0];
      doc.save(`${protocolSlug}-${date}.pdf`);

      console.log('✅ Summary downloaded as PDF');
    };
  }

  // Handle completion button click
  const button = completionContainer.querySelector('#completion-button');
  console.log('🔍 Completion button found:', !!button);
  if (button) {
    button.onclick = async () => {
      console.log('🖱️ Completion button clicked');

      // Add clicked class to fade out border
      button.classList.add('clicked');

      const overlay = document.getElementById('completion-overlay');
      if (overlay) {
        overlay.classList.add('active');
      }

      setTimeout(async () => {
        if (overlay) {
          overlay.classList.remove('active');
        }

        // Call complete endpoint
        await fetch(`${API_BASE}/api/walk/complete`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            session_id: state.sessionId,
            generate_summary: false,
          }),
        });

        // Reset to entry
        location.reload();
      }, ANIMATION_DELAYS.COMPLETION_OVERLAY_DISPLAY);
    };
  }

  console.log('🎉 handleCompletion completed');
}
