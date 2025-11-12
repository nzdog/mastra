/**
 * Protocols Module
 * Handles protocol loading, rendering, and selection
 */

import { API_BASE } from './config.js';
import { setState } from './state.js';
import { protocolGrid, protocolTitle, protocolSelectionView, entryView } from './dom.js';
import { showError } from './utils.js';

/**
 * Fetch and display available protocols
 */
export async function loadProtocols() {
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

    if (data.protocols.length > 0) {
      renderProtocolCards(data.protocols);
    } else {
      showError('No protocols available');
    }
  } catch (error) {
    console.error('Error loading protocols:', error);
    showError('Failed to load protocols. Please refresh the page.');
  }
}

/**
 * Render protocol cards in the protocol grid
 */
export function renderProtocolCards(protocols) {
  if (!protocolGrid) {
    console.error('Protocol grid element not found');
    return;
  }

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
    const truncatedPurpose = purpose.length > 200 ? purpose.substring(0, 200) + '...' : purpose;

    card.innerHTML = `
      <div class="protocol-card-header">
        <div class="protocol-card-title">${protocol.title}</div>
        <div class="protocol-card-badge">${protocol.theme_count} themes</div>
      </div>
      <div class="protocol-card-purpose">${truncatedPurpose}</div>
    `;

    card.addEventListener('click', () => selectProtocol(protocol));
    protocolGrid.appendChild(card);
  });
}

/**
 * Handle protocol selection and show entry view
 */
export function selectProtocol(protocol) {
  if (!protocol) {
    console.error('No protocol provided to selectProtocol');
    return;
  }

  // Update state
  setState({ selectedProtocol: protocol });

  // Scroll to top
  window.scrollTo(0, 0);

  // Update protocol title in entry view with stacked format
  // Split title at em dash (—) or long dash if present
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
  }

  // Hide protocol selection, show entry view
  if (protocolSelectionView) {
    protocolSelectionView.classList.add('hidden');
  }
  if (entryView) {
    entryView.classList.remove('hidden');
  }
}
