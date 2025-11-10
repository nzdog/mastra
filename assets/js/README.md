# JavaScript Modules - Phase 1: Intro Flow

This directory contains modular JavaScript extracted from `index.html`.

## Files

- **config.js** - API configuration, constants, and platform detection
- **state.js** - Application state management
- **dom.js** - Centralized DOM element references
- **utils.js** - Common utility functions (animations, API calls, formatting)
- **intro.js** - Complete intro flow logic and animations
- **main.js** - Application bootstrap and initialization

## Status

✅ **Phase 1 Complete**: Intro flow logic extracted into modules
⏳ **Phase 2 Pending**: Integration with index.html and walk/protocol logic extraction

## Integration Plan (Phase 2)

To integrate these modules into `index.html`:

### Step 1: Add Module Import

Replace the opening `<script type="module">` tag around line 259 with:

```html
<!-- Modular JavaScript -->
<script type="module" src="/assets/js/main.js"></script>

<!-- Inline Walk/Protocol Logic (temporary) -->
<script type="module">
  // Import from modules
  import { API_BASE, API_KEY } from './assets/js/config.js';
  import { state, setState } from './assets/js/state.js';
  import { getHeaders, showError /* ... */ } from './assets/js/utils.js';
  import { entryView, walkView /* ... */ } from './assets/js/dom.js';

  // Map state to local variables for compatibility
  let sessionId = state.sessionId;
  let selectedProtocol = state.selectedProtocol;

  // Listen for protocol selection from intro flow
  window.addEventListener('beginProtocolWalk', async (event) => {
    selectedProtocol = event.detail.protocol;
    setState({ selectedProtocol });
    // Start walk logic...
  });

  // Keep walk/protocol logic here temporarily...
</script>
```

### Step 2: Remove Duplicate Code

Delete from the inline script (lines ~260-870):

- API configuration (now in `config.js`)
- State variables (now in `state.js`)
- DOM element declarations (now in `dom.js`)
- Utility functions (now in `utils.js`)
- ALL intro flow logic (now in `intro.js` and `main.js`)

Keep only the walk/protocol logic (starting around line 870 "MAIN APP LOGIC").

### Step 3: Test

1. Test intro flow animations
2. Test protocol selection
3. Test walk functionality
4. Test all user interactions

### Step 4: Extract Walk Logic (Phase 3)

Create additional modules:

- `walk.js` - Protocol walk logic
- `entry.js` - Entry view logic
- `completion.js` - Completion view logic

## Benefits

- **Maintainability**: Code organized by feature
- **Testability**: Pure functions easier to test
- **Reusability**: Utility functions can be shared
- **Debugging**: Clearer stack traces with named modules
- **Performance**: Better caching with separate files

## Notes

- All modules use ES6 `import/export` syntax
- Modules are loaded with `type="module"` for proper scoping
- State management uses a simple object with helper functions
- DOM elements are cached once at module load time
