# Complete CSS Styles

This document contains all CSS files from the project.

---

## animations.css

```css
/**
 * Animations
 * Keyframes, transitions, and animation classes
 */

/* Fade Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.fade-in-section {
  opacity: 0;
  animation: fadeInUp 0.8s ease-out forwards;
}

.fade-in-only {
  opacity: 0;
  animation: fadeIn 0.8s ease-out forwards;
}

.fade-out {
  animation: fadeOut 1.2s ease-out forwards;
}

/* Spin Animations */
@keyframes spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes spinSlow {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes spinSlowSimple {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.logo-spin {
  animation: spin 20s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .logo-spin-intro {
    animation: spinSlowSimple 40s linear infinite !important;
  }
}

/* Slide Animations */
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 2000px;
  }
}

/* Jigsaw Animation (for embodiment lines) */
@keyframes jigsaw {
  0%,
  100% {
    transform: translateY(0);
  }
  10% {
    transform: translateY(-2px);
  }
  20% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(2px);
  }
  40% {
    transform: translateY(0);
  }
}

/* Pulse Animation */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Shimmer/Loading Animation */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
```

---

## base.css

```css
/**
 * Base Styles
 * Resets, typography, and foundational styles
 */

/* CSS Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  overflow-y: scroll;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #fafaf9;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Accessibility */
*:focus-visible {
  outline: 2px solid #57534e;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## components.css

```css
/**
 * Component Styles
 * Buttons, cards, inputs, error strips, and UI components
 */

/* Response Input */
.response-input {
  width: 100%;
  font-size: 1.125rem;
  line-height: 1.7;
  padding: 1.25rem 0;
  border: none;
  border-bottom: 1px solid #e7e5e4;
  background: transparent;
  color: #1c1917;
  transition: border-color 0.3s ease;
  font-family: inherit;
  resize: none;
  min-height: 80px;
}

.response-input:focus {
  outline: none;
  border-bottom-color: #78716c;
}

.response-input::placeholder {
  color: #a8a29e;
}

.response-hint {
  font-size: 0.8125rem;
  color: #a8a29e;
  margin-top: 0.5rem;
  text-align: left;
}

/* Walk Controls */
.walk-control {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.walk-button {
  background: transparent;
  border: 1px solid #d6d3d1;
  color: #57534e;
  padding: 0.75rem 1.5rem;
  font-size: 0.9375rem;
  font-weight: 400;
  cursor: pointer;
  transition:
    border-color 1.2s ease-out,
    background 1.2s ease-out;
  font-family: inherit;
  position: relative; /* Always relative to prevent layout shift */
  display: inline-block;
  white-space: nowrap;
}

/* Note: No hover effect on walk button - border stays visible until clicked */

.walk-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.walk-button.loading {
  opacity: 0.6;
}

.walk-button.clicked {
  border-color: transparent;
  background: transparent;
  color: #57534e; /* Keep text color unchanged */
}

.walk-button.clicked:disabled {
  border-color: transparent;
  background: transparent;
  color: #57534e; /* Keep text color unchanged */
}

/* Error Strip */
.error-strip {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-left: 3px solid #dc2626;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  display: none;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.1);
}

.error-strip.active {
  display: block;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-message {
  font-size: 0.875rem;
  line-height: 1.6;
  color: #78716c;
}

/* Completion Overlay */
.completion-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(250, 249, 249, 0.95);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.completion-overlay.active {
  display: flex;
}

.completion-message {
  text-align: center;
}

.completion-title {
  font-size: 1.25rem;
  font-weight: 500;
  color: #1c1917;
  margin-bottom: 0.75rem;
}

.completion-subtitle {
  font-size: 0.9375rem;
  color: #78716c;
  font-style: italic;
}

/* Supports Strip - DISABLED (not currently in use) */
.supports-strip {
  display: none !important;
}

.supports-container {
  display: flex;
  gap: 0.75rem;
  max-width: 1400px;
  margin: 0 auto;
}

.supports-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #a8a29e;
  padding: 0.625rem 0;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.support-card {
  border: 1px solid #f5f5f4;
  background: #fefefe;
  transition: all 0.2s ease;
  min-width: 200px;
  max-width: 280px;
  cursor: pointer;
}

.support-card:hover {
  border-color: #e7e5e4;
}

.support-header {
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.support-source {
  font-size: 0.625rem;
  font-weight: 600;
  color: #78716c;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.support-theme {
  font-size: 0.6875rem;
  color: #a8a29e;
  line-height: 1.4;
}

.support-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.support-body.expanded {
  max-height: 400px;
  overflow-y: auto;
}

.support-content {
  padding: 0 0.625rem 0.625rem 0.625rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #57534e;
  font-family: ui-monospace, monospace;
  white-space: pre-wrap;
  border-top: 1px solid #f5f5f4;
  padding-top: 0.625rem;
}

/* Intro Flow Styles */
.intro-flow-view {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  max-width: 100%;
  margin: 0 auto;
}

.intro-flow-view.hidden {
  display: none;
}

.intro-logo-container {
  position: absolute;
  top: calc(33vh - 70px);
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
}

.logo-spin-intro {
  width: 96px;
  height: 96px;
  opacity: 0.85;
  animation: spinSlowSimple 20s linear infinite;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.logo-spin-intro:hover {
  opacity: 1;
}

.intro-content {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 4rem;
  position: relative;
}

#intro-embodiment-lines {
  position: relative;
  width: 100%;
}

.intro-text-line {
  position: absolute;
  top: calc(33% - 70px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.125rem;
  line-height: 1.7;
  color: #57534e;
  font-style: italic;
  text-align: center;
  opacity: 0;
  z-index: 200;
  white-space: nowrap;
  display: inline-block;
  width: auto;
}

.intro-quote {
  position: absolute;
  top: calc(33% - 70px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.125rem;
  line-height: 1.7;
  color: #57534e;
  font-style: italic;
  text-align: center;
  opacity: 0;
  z-index: 200;
  white-space: nowrap;
  display: inline-block;
  width: auto;
}

.intro-quote-attribution {
  position: absolute;
  top: calc(33% + 45px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.9375rem;
  color: #78716c;
  text-align: center;
  opacity: 0;
  z-index: 200;
  display: inline-block;
}

/* Desktop/Mobile visibility classes */
.desktop-only {
  display: block;
}

.mobile-only {
  display: none;
}

.intro-orientation {
  position: absolute;
  top: calc(33% - 70px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.125rem;
  line-height: 1.7;
  color: #57534e;
  font-style: italic;
  text-align: center;
  opacity: 0;
  z-index: 200;
  white-space: nowrap;
  display: inline-block;
  width: auto;
}

.intro-sequence-container {
  opacity: 0;
  width: 100%;
  display: none; /* Hide sequence list */
}

.intro-sequence-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.intro-sequence-item {
  font-size: 1rem;
  line-height: 1.6;
  color: #57534e;
  padding-left: 2rem;
  position: relative;
}

.intro-sequence-item::before {
  content: attr(data-number);
  position: absolute;
  left: 0;
  color: #a8a29e;
  font-size: 0.875rem;
}

.intro-sequence-item.prelude {
  font-style: italic;
  color: #78716c;
}

.intro-sequence-item.prelude::before {
  content: '◆';
  font-style: normal;
}

.intro-sequence-subtext {
  font-size: 0.875rem;
  color: #a8a29e;
  text-align: center;
  margin-top: 1.5rem;
  font-style: italic;
}

.intro-protocol-guidance {
  font-size: 0.9375rem;
  color: #78716c;
  line-height: 1.7;
  text-align: left;
  margin-bottom: 3rem;
  max-width: 700px;
  padding: 0 1rem;
  opacity: 0;
  transform: translateY(50px);
  transition:
    opacity 960ms ease-out,
    transform 960ms ease-out;
  will-change: opacity, transform;
}

.intro-protocol-guidance.visible {
  opacity: 1;
  transform: translateY(0);
}

.intro-protocol-guidance p {
  margin-bottom: 1rem;
}

.intro-protocol-guidance p:last-child {
  margin-bottom: 0;
}

.intro-protocol-deck {
  opacity: 0;
  transform: translateY(50px);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 700px;
  padding: 0 1rem;
  transition:
    opacity 960ms ease-out,
    transform 960ms ease-out;
  will-change: opacity, transform;
}

.intro-protocol-deck.visible {
  opacity: 1;
  transform: translateY(0);
}

.intro-protocol-card {
  border: 1px solid #e7e5e4;
  background: #ffffff;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
  width: 100%;
}

.intro-protocol-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: #1c1917;
  line-height: 1.4;
}

.intro-disclosure-section {
  max-height: 0;
  margin-top: 0.5rem;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 3s ease,
    opacity 3s ease;
}

.intro-disclosure-section.visible {
  max-height: 1000px;
  opacity: 1;
}

.intro-disclosure-label {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #78716c;
  margin-bottom: 0.5rem;
}

.intro-disclosure-content {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: #57534e;
}

.intro-disclosure-content ul {
  list-style: none;
  padding-left: 1rem;
  margin: 0.5rem 0;
}

.intro-disclosure-content li {
  position: relative;
  padding-left: 0.5rem;
  margin-bottom: 0.5rem;
}

.intro-disclosure-content li::before {
  content: '−';
  position: absolute;
  left: -0.75rem;
  color: #a8a29e;
}

.intro-disclosure-btn {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #57534e;
  background: #fafaf9;
  border: 1px solid #d6d3d1;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  margin-top: 0.75rem;
  text-align: center;
  text-transform: uppercase;
  width: 100%;
}

.intro-disclosure-btn:hover {
  border-color: #78716c;
  background: #f5f5f4;
  transform: translateY(-1px);
}

.intro-disclosure-btn:focus-visible {
  outline: 2px solid #57534e;
  outline-offset: 2px;
}

.intro-walk-btn {
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: #78716c;
  background: transparent;
  border: 1px solid #e7e5e4;
  padding: 0.625rem 1rem;
  cursor: pointer;
  transition:
    border-color 1.5s ease,
    color 0.3s ease,
    background 0.3s ease;
  font-family: inherit;
  text-align: center;
  display: none;
  margin-top: 0.5rem;
}

.intro-walk-btn.visible {
  display: block;
}

.intro-walk-btn:hover {
  border-color: #78716c;
  background: #fafaf9;
}

.intro-walk-btn:focus-visible {
  outline: 2px solid #57534e;
  outline-offset: 2px;
}

.intro-walk-btn.dissolving {
  border-color: transparent;
}

/* Section Reveal Buttons (Protocol Introduction) */
.section-reveal-btn {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #78716c;
  background: transparent;
  border: none;
  box-shadow: inset 0 0 0 1px #d6d3d1;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition:
    box-shadow 0.2s ease,
    background 0.2s ease;
  font-family: inherit;
}

.section-reveal-btn:hover:not(.revealed) {
  box-shadow: inset 0 0 0 1px #78716c;
  background: #fafaf9;
}

.section-reveal-btn:focus-visible {
  outline: 2px solid #57534e;
  outline-offset: 2px;
}

.section-reveal-btn.revealed {
  box-shadow: inset 0 0 0 1px transparent;
  background: transparent;
  opacity: 0;
  pointer-events: none;
}

.intro-continue-container {
  position: absolute;
  top: calc(33% + 198px);
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  text-align: center;
  z-index: 200;
}

.intro-continue-btn {
  background: transparent;
  border: 1px solid #d6d3d1;
  color: #57534e;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.intro-continue-btn:hover {
  border-color: #78716c;
  background: #fafaf9;
}
```

---

## layout.css

```css
/**
 * Layout Styles
 * Page structure, headers, containers, and grid layouts
 */

.page-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  border-bottom: 1px solid #e7e5e4;
  padding: 1.25rem 2rem;
  background: #fcfcfb;
  display: flex; /* Visible during intro flow */
  gap: 2rem;
  align-items: baseline;
  transition: opacity 0.8s ease-out;
}

.page-header.intro-mode .header-state,
.page-header.intro-mode .theme-position,
.page-header.intro-mode .cost-display,
.page-header.intro-mode .header-center-logo {
  display: none;
}

/* Show header logo when protocol list is active */
.page-header.intro-mode.protocol-list-active .header-center-logo {
  display: block !important;
  opacity: 0.85;
}

/* Spinning animation for header logo */
.header-center-logo.spinning {
  animation: spinSlow 20s linear infinite;
}

.header-center-logo {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  height: 48px;
  width: auto;
  opacity: 0;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  animation: spin 20s linear infinite;
  animation-play-state: paused;
  transition: opacity 1.2s ease-out;
}
/* Dev badge next to header logo */
.header-logo-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(40px, -10px);
  font-size: 0.85rem;
  color: #374151;
  background: rgba(255, 255, 255, 0.9);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  pointer-events: none;
  z-index: 200;
}

.header-center-logo.visible {
  opacity: 0.85;
}

.header-center-logo.spinning {
  animation-play-state: running;
}

.cost-display {
  display: none; /* Hidden as requested */
  margin-left: auto;
  font-size: 0.75rem;
  color: #a8a29e;
  font-variant-numeric: tabular-nums;
}

.branch-label {
  position: absolute;
  top: 1.25rem;
  right: 2rem;
  font-size: 0.75rem;
  color: #78716c;
  background: #f5f5f4;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-family:
    'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  letter-spacing: 0.02em;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.branch-label:hover {
  opacity: 1;
}

.header-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #1c1917;
  cursor: default;
}

.header-state {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #78716c;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.theme-position {
  font-size: 0.8125rem;
  color: #78716c;
  margin-left: auto;
}

/* State Header (legacy - keeping for walk mode) */
.state-header {
  border-bottom: 1px solid #e7e5e4;
  padding: 1.25rem 2rem;
  background: #fcfcfb;
  display: none;
  gap: 2rem;
  align-items: baseline;
}

.state-header.active {
  display: flex;
}

.mode-indicator {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #57534e;
}

.protocol-name {
  font-size: 0.8125rem;
  color: #78716c;
  font-weight: 500;
  cursor: default;
}

/* Content Area */
.content-area {
  flex: 1;
  overflow-y: auto;
  display: none; /* Hidden initially during intro flow */
  justify-content: center;
  margin-top: 70px; /* Account for fixed header height */
}

.content-area.visible {
  display: flex;
}

.field-container {
  max-width: 680px;
  width: 100%;
  padding: 2rem 2rem 4rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

/* Wider container for summary mode */
.field-container.summary-container {
  max-width: 900px;
}

/* Protocol Selection */
.protocol-selection-view {
  display: flex;
  flex-direction: column;
  padding-top: 4rem;
}

.protocol-selection-view.hidden {
  display: none;
}

.protocol-selection-header {
  text-align: center;
  margin-bottom: 3rem;
}

.protocol-selection-title {
  font-size: 1.5rem;
  font-weight: 500;
  color: #1c1917;
  margin-bottom: 0.75rem;
}

.protocol-selection-subtitle {
  font-size: 1rem;
  color: #78716c;
  line-height: 1.6;
}

.protocol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.protocol-card {
  border: 1px solid #e7e5e4;
  background: #ffffff;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.protocol-card:hover {
  border-color: #78716c;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.protocol-card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.protocol-card-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: #1c1917;
  line-height: 1.4;
  flex: 1;
}

.protocol-card-badge {
  font-size: 0.6875rem;
  color: #78716c;
  background: #f5f5f4;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  white-space: nowrap;
  font-weight: 500;
}

.protocol-card-purpose {
  font-size: 0.9375rem;
  color: #57534e;
  line-height: 1.6;
}

.protocol-card-meta {
  font-size: 0.8125rem;
  color: #a8a29e;
  display: flex;
  gap: 1rem;
}

/* Entry State */
.entry-view {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.entry-view.hidden {
  display: none;
}

.field-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #78716c;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.entry-input {
  width: 100%;
  font-size: 1.5rem;
  line-height: 1.7;
  padding: 1.5rem 0;
  border: none;
  border-bottom: 1px solid #e7e5e4;
  background: transparent;
  color: #1c1917;
  transition: border-color 0.3s ease;
}

.entry-input:focus {
  outline: none;
  border-bottom-color: #78716c;
}

.entry-input::placeholder {
  color: #a8a29e;
}

.entry-hint {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #a8a29e;
}

/* Composer Output */
.composer-output {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Enhanced styling for completion summary */
.composer-output.summary-mode {
  background: #ffffff;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  padding: 3rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  max-width: 800px;
  margin: 0 auto;
}

.composer-output.summary-mode .theme-title {
  font-size: 2.25rem;
  color: #1c1917;
  border-bottom: 3px solid #d6d3d1;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* Target h2 tags anywhere in summary mode */
.composer-output.summary-mode h2,
.composer-output.summary-mode .section-content h2 {
  display: block !important;
  font-size: 1.5rem;
  color: #1c1917;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  padding-top: 1rem;
  border-top: 2px solid #f5f5f4;
}

/* First h2 shouldn't have top margin or border */
.composer-output.summary-mode h2:first-child,
.composer-output.summary-mode .section-content h2:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.composer-output.summary-mode h3,
.composer-output.summary-mode .section-content h3 {
  font-size: 1.125rem;
  color: #57534e;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.composer-output.summary-mode p,
.composer-output.summary-mode .section-content p {
  display: block !important;
  font-size: 1rem;
  line-height: 1.8;
  color: #292524;
  margin-bottom: 1.25rem;
  text-align: left;
}

.composer-output.summary-mode strong,
.composer-output.summary-mode .section-content strong {
  color: #1c1917;
  font-weight: 600;
}

.composer-output.summary-mode ul,
.composer-output.summary-mode ol,
.composer-output.summary-mode .section-content ul,
.composer-output.summary-mode .section-content ol {
  margin-left: 1.75rem;
  margin-bottom: 1.5rem;
  padding-left: 0;
}

.composer-output.summary-mode li,
.composer-output.summary-mode .section-content li {
  font-size: 1rem;
  line-height: 1.8;
  color: #292524;
  margin-bottom: 0.75rem;
}

.theme-title {
  font-size: 1.75rem;
  font-weight: 500;
  color: #1c1917;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.output-section {
  line-height: 1.7;
  color: #292524;
}

.section-label {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #78716c;
  margin-bottom: 0.75rem;
}

.section-content {
  font-size: 1.0625rem;
  line-height: 1.7;
}

/* Response Area */
.response-area {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e7e5e4;
}
```

---

## responsive.css

```css
/**
 * Responsive Styles
 * Media queries and responsive design adjustments
 */

@media (max-width: 768px) {
  .header-center-logo {
    height: 28px;
  }

  .page-header {
    padding: 0.75rem 1rem;
    gap: 0.75rem;
  }

  .header-title {
    font-size: 0.8125rem;
    max-width: 35%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-state {
    font-size: 0.75rem;
  }

  /* Hide theme position on very small screens */
  .theme-position {
    display: none;
  }

  /* Content area */
  .content-area {
    margin-top: 55px;
  }

  .field-container {
    padding: 1rem 1rem 2.5rem 1rem;
    gap: 2rem;
  }

  .field-container.summary-container {
    max-width: 100%;
  }

  /* Protocol selection */
  .protocol-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .protocol-card {
    padding: 1rem;
  }

  .protocol-card-title {
    font-size: 1rem;
  }

  .protocol-card-purpose {
    font-size: 0.875rem;
  }

  .protocol-selection-title {
    font-size: 1.25rem;
  }

  .protocol-selection-subtitle {
    font-size: 0.9375rem;
  }

  /* Entry view */
  .entry-view {
    min-height: 50vh;
  }

  .entry-input {
    font-size: 1.125rem;
    padding: 1rem 0;
  }

  #protocol-title {
    font-size: 1.25rem !important;
  }

  /* Walk interface */
  .response-input {
    font-size: 0.9375rem;
    padding: 0.875rem 0;
    min-height: 60px;
  }

  .response-hint {
    font-size: 0.75rem;
  }

  .theme-title {
    font-size: 1.25rem;
    margin-bottom: 0.875rem;
  }

  .section-label {
    font-size: 0.75rem;
  }

  .section-content {
    font-size: 0.9375rem;
  }

  .output-section {
    gap: 1rem;
  }

  /* Buttons */
  .walk-button {
    padding: 1rem 1.25rem;
    font-size: 0.8125rem;
    width: 100%;
  }

  .walk-control {
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Summary mode - compact for mobile */
  .composer-output.summary-mode {
    padding: 1.25rem;
    border-radius: 0;
  }

  .composer-output.summary-mode .theme-title {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
  }

  .composer-output.summary-mode h2,
  .composer-output.summary-mode .section-content h2 {
    font-size: 1.125rem;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }

  .composer-output.summary-mode h3,
  .composer-output.summary-mode .section-content h3 {
    font-size: 0.9375rem;
    margin-top: 1.5rem;
  }

  .composer-output.summary-mode p,
  .composer-output.summary-mode .section-content p {
    font-size: 0.875rem;
    line-height: 1.7;
    margin-bottom: 1rem;
  }

  .composer-output.summary-mode li,
  .composer-output.summary-mode .section-content li {
    font-size: 0.875rem;
  }

  /* Completion buttons - stack on mobile */
  #walk-control .walk-button,
  .completion-container .walk-button {
    width: 100%;
  }

  /* Entry logo size */
  #lichen-logo {
    height: 60px !important;
  }

  /* Section reveal buttons */
  .section-reveal-btn {
    font-size: 0.75rem;
    padding: 0.75rem 0.875rem;
  }

  /* Response area */
  .response-area {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
  }
}
```

---

## views.css

```css
/**
 * View Styles
 * Intro flow, entry view, walk view, and completion view
 */

.intro-continue-btn:focus-visible {
  outline: 2px solid #57534e;
  outline-offset: 2px;
}

.intro-continue-hint {
  font-size: 0.8125rem;
  color: #a8a29e;
  margin-top: 0.5rem;
}

.intro-protocol-list-page {
  display: none;
  flex-direction: column;
  align-items: center;
  padding-top: calc(33% - 70px + 120px);
  max-width: 900px;
  margin: 0 auto;
  min-height: 100vh;
}

.intro-protocol-list-page.visible {
  display: flex;
}

/* Live region for screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* ========================================
           MOBILE RESPONSIVE STYLES
           ======================================== */

/* Tablets and small screens */
@media (max-width: 768px) {
  /* Show mobile version, hide desktop version */
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: block !important;
  }

  /* Logo adjustments */
  .logo-spin-intro {
    width: 80px;
    height: 80px;
  }

  .intro-logo-container {
    top: calc(40vh - 40px);
  }

  /* Typography scaling - mobile version only */
  .intro-quote.mobile-only {
    position: relative !important;
    font-size: 1.0625rem;
    white-space: normal !important;
    left: auto !important;
    right: auto !important;
    margin-left: 7.5% !important;
    margin-right: 7.5% !important;
    transform: none !important;
    display: block !important;
    width: auto !important;
    line-height: 1.5 !important;
    top: auto !important;
  }

  .intro-text-line {
    font-size: 1.0625rem;
    white-space: normal !important;
    left: 7.5% !important;
    right: 7.5% !important;
    transform: translateX(0) !important;
    display: block !important;
    width: auto !important;
    line-height: 1.5 !important;
  }

  .intro-orientation {
    font-size: 1.0625rem;
    white-space: normal !important;
    left: 7.5% !important;
    right: 7.5% !important;
    transform: none !important;
    display: block !important;
    width: auto !important;
    line-height: 1.5 !important;
  }

  /* Adjust spacing for smaller screens */
  .intro-flow-view {
    padding: 1.5rem;
  }

  /* Safari fix: Force explicit width calculation for absolutely positioned children */
  .intro-content {
    width: 100vw !important;
    max-width: 100vw !important;
    left: 0 !important;
    right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .intro-protocol-list-page {
    padding-top: calc(28vh - 70px + 100px);
  }

  /* Protocol cards */
  .intro-protocol-card {
    max-width: 100%;
    padding: 1.25rem;
  }

  .intro-protocol-deck {
    gap: 1.5rem;
    margin-top: 2rem;
  }

  /* Buttons - ensure touch targets */
  .intro-disclosure-btn,
  .intro-walk-btn {
    padding: 0.75rem 1rem;
    min-height: 44px;
  }

  .intro-continue-btn {
    padding: 1rem 2rem;
    min-height: 44px;
  }

  /* Adjust vertical spacing */
  .intro-continue-container {
    top: calc(28vh + 160px);
  }

  /* === PROTOCOL WALK INTERFACE === */

  /* Header adjustments for walk mode */
  .header-center-logo {
    height: 36px;
  }

  .page-header {
    gap: 1rem;
  }

  .theme-position {
    font-size: 0.75rem;
  }

  /* Truncate header title to prevent overlap with center logo */
  .header-title {
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Content area */
  .content-area {
    margin-top: 60px;
  }

  .field-container {
    padding: 1.5rem 1.5rem 3rem 1.5rem;
    gap: 2.5rem;
  }

  /* Protocol selection page */
  .protocol-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .protocol-card {
    padding: 1.25rem;
  }

  .protocol-selection-title {
    font-size: 1.375rem;
  }

  /* Entry view */
  .entry-input {
    font-size: 1.25rem;
    padding: 1.25rem 0;
  }

  /* Walk interface */
  .response-input {
    font-size: 1rem;
    padding: 1rem 0;
    min-height: 70px;
  }

  .theme-title {
    font-size: 1.5rem;
  }

  .section-content {
    font-size: 1rem;
  }

  /* Buttons */
  .walk-button {
    padding: 0.875rem 1.5rem;
    min-height: 44px;
    font-size: 0.875rem;
  }

  /* Summary mode */
  .composer-output.summary-mode {
    padding: 2rem;
  }

  .composer-output.summary-mode .theme-title {
    font-size: 2rem;
  }

  .composer-output.summary-mode h2,
  .composer-output.summary-mode .section-content h2 {
    font-size: 1.25rem;
  }

  .composer-output.summary-mode h3,
  .composer-output.summary-mode .section-content h3 {
    font-size: 1rem;
  }

  .composer-output.summary-mode p,
  .composer-output.summary-mode .section-content p {
    font-size: 0.9375rem;
  }

  /* Protocol guidance */
  .intro-protocol-guidance {
    font-size: 0.875rem;
    margin-bottom: 2rem;
    padding: 0 0.75rem;
  }
}

/* Mobile phones */
@media (max-width: 480px) {
  /* Show mobile version, hide desktop version */
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: block !important;
  }

  /* Further logo reduction */
  .logo-spin-intro {
    width: 64px;
    height: 64px;
  }

  .intro-logo-container {
    top: calc(40vh - 32px);
  }

  /* Typography - even smaller - mobile version only */
  .intro-quote.mobile-only {
    position: relative !important;
    font-size: 1rem;
    line-height: 1.4 !important;
    left: auto !important;
    right: auto !important;
    margin-left: 5% !important;
    margin-right: 5% !important;
    transform: none !important;
    padding: 0 0.5rem;
    box-sizing: border-box;
    display: block !important;
    white-space: normal !important;
    width: auto !important;
    top: auto !important;
  }

  .intro-text-line {
    font-size: 1rem;
    line-height: 1.4 !important;
    left: 5% !important;
    right: 5% !important;
    transform: translateX(0) !important;
    padding: 0 0.5rem;
    box-sizing: border-box;
    display: block !important;
    white-space: normal !important;
    width: auto !important;
  }

  .intro-orientation {
    font-size: 1rem;
    line-height: 1.4 !important;
    left: 5% !important;
    right: 5% !important;
    transform: none !important;
    padding: 0 0.5rem;
    box-sizing: border-box;
    display: block !important;
    white-space: normal !important;
    width: auto !important;
  }

  /* Tighter spacing */
  .intro-flow-view {
    padding: 1rem;
  }

  /* Safari fix: Force explicit width calculation for absolutely positioned children */
  .intro-content {
    width: 100vw !important;
    max-width: 100vw !important;
    left: 0 !important;
    right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .intro-protocol-list-page {
    padding-top: calc(25vh - 60px + 90px);
  }

  /* Cards - full width with minimal padding */
  .intro-protocol-card {
    padding: 1rem;
    font-size: 0.9375rem;
  }

  .intro-protocol-title {
    font-size: 1rem;
  }

  .intro-protocol-deck {
    gap: 1.25rem;
    margin-top: 1.5rem;
  }

  .intro-disclosure-content {
    font-size: 0.875rem;
  }

  /* Adjust button text size */
  .intro-disclosure-btn,
  .intro-walk-btn {
    font-size: 0.75rem;
    padding: 0.875rem 1rem;
  }

  .intro-continue-btn {
    font-size: 0.9375rem;
    padding: 0.875rem 1.5rem;
  }

  /* Continue button position */
  .intro-continue-container {
    top: calc(25vh + 140px);
  }

  .intro-continue-hint {
    font-size: 0.75rem;
  }

  /* Protocol guidance */
  .intro-protocol-guidance {
    font-size: 0.8125rem;
    margin-bottom: 1.5rem;
    padding: 0 0.5rem;
  }

  /* Header adjustments */
  .page-header {
    padding: 1rem 1.25rem;
  }

  /* Reduce line spacing on mobile */
  .intro-content {
    gap: 3rem;
  }
}
```

---

**End of Document**
