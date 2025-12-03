# Lichen Coherence Engine Dashboard

React-based testing dashboard for the Coherence Engine.

## Features

✨ **Interactive State Builder**

- Visual dropdowns for all founder state fields
- Real-time input validation
- Custom tension keyword input

🎯 **Quick Test Scenarios**

- Pre-loaded test cases (urgency, shame, overwhelm, etc.)
- One-click scenario loading
- 6 common founder states

📊 **Visual Classification Results**

- Color-coded integrity states
- Protocol routing display
- Stabilisation cue highlighting
- Exit precursor warnings

🔍 **Drift Detection Test**

- Test any text for forbidden language
- Real-time violation detection
- Detailed violation breakdown

## Quick Start

### Prerequisites

Backend must be running on port 3000.

### Install & Run

```bash
npm install
npm run dev
```

Dashboard runs on **http://localhost:3001**

## Usage

1. **Select founder state** using dropdowns or load a test scenario
2. **Click "Classify State"** to get results
3. **View classification** with color-coded integrity state
4. **Test drift detection** with custom text

## Architecture

- **React 18** with TypeScript
- **Vite** for fast dev server and builds
- **CSS Variables** for theming
- **Proxy** to backend API (port 3000)

## Color Coding

- 🟢 **STABLE** — Green (coherent, no intervention needed)
- 🟡 **DRIFT** — Amber (urgency, avoidance, wobble)
- 🔴 **DISTORTION** — Red (shame, fear, overwhelm)
- 🔴 **PRE_COLLAPSE** — Dark Red (numbness, shutdown)

## Test Scenarios

1. ⚡ **Urgency Spike** — Deadline pressure, tight rhythm
2. 🔄 **Avoidance** — Busy, constricted, avoiding
3. 😔 **Shame Spike** — Failure keyword, oscillating
4. 🌊 **Overwhelm** — Too much, fragmented, agitated
5. ❄️ **Numbness** — Numb, fog, shutdown imminent
6. ✨ **Calm & Coherent** — Open, steady, clear

## API Integration

All requests proxy through Vite to the backend:

- `/coherence/stabilise-only` → Classification
- `/coherence/debug/drift-check` → Drift detection
- `/health` → Health check

## Building for Production

```bash
npm run build
npm run preview
```

Outputs to `dist/` directory.

---

**Status:** Fully Functional ✅
