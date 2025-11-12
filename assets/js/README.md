# JavaScript Modules

This directory contains modular JavaScript for the Field Diagnostic Agent application.

## Status

✅ **Phase 1 Complete**: Modular extraction (6 modules, 729 lines)
✅ **Phase 2 Complete**: Integration and deployment (14 modules, 2111 lines)

## Architecture

All inline JavaScript has been removed from `index.html` and organized into a clean modular structure with a single entry point:

```html
<!-- Single entry point -->
<script type="module" src="/assets/js/app.js"></script>
```

## Module Structure

### Core Infrastructure
- **app.js** - Application entry point, orchestrates all modules
- **config.js** - API configuration, constants, and platform detection
- **constants.js** - Shared constants for timing, animations, and values
- **state.js** - Application state management with immutable updates
- **dom.js** - Centralized DOM element references

### Feature Modules
- **intro.js** - Intro flow logic and protocol card rendering
- **protocols.js** - Protocol loading and selection
- **entry.js** - Protocol entry view rendering with progressive disclosure
- **walk.js** - Walk flow logic, user interactions, and state rendering
- **completion.js** - Completion handling, summary, and PDF generation
- **markdown.js** - Markdown parsing and conversion to HTML

### Utilities
- **utils.js** - Common utility functions (animations, API calls, formatting)

## Module Dependencies

```
app.js
├── config.js
├── constants.js
├── state.js
├── dom.js
├── utils.js
├── intro.js
│   ├── protocols.js (protocol cards)
│   └── entry.js (protocol entry)
├── entry.js
│   └── walk.js (start walk)
└── walk.js
    ├── markdown.js (render output)
    └── completion.js (completion mode)
```

## Key Features

### Clean Separation of Concerns
- **Config**: API base URL, feature flags, platform detection
- **State**: Centralized state with immutable updates
- **DOM**: Single source of truth for element references
- **Constants**: Magic numbers extracted to named constants
- **Features**: Each flow (intro, entry, walk, completion) in its own module

### Animation Constants
All timing values are centralized in `constants.js`:

```javascript
export const ANIMATION_DELAYS = {
  FADE_COMPLETE: 1200,              // Fade-out animations
  SECTION_REVEAL_TRANSITION: 500,   // Section reveal
  SECTION_EXPAND_FADE: 1000,        // Expand all sections
  JIGSAW_ANIMATION_START: 100,      // Text reveal animation
  COMPLETION_OVERLAY_DISPLAY: 4000, // Completion overlay
};
```

### Error Handling
Robust error handling with user-friendly messages:
- Branch fetch errors (non-critical, continues)
- Intro flow errors (critical, stops initialization)
- Protocol loading errors (non-critical for intro)
- API call errors with fallback UI

## Development History

### Phase 1 (Extraction)
- Created 6 modules from inline JavaScript
- Extracted intro flow logic
- Set up module infrastructure

### Phase 2 (Integration & Deployment)
- Removed 2565 lines from index.html
- Added 2111 lines across 14 modules
- Fixed 7 deployment bugs during Railway testing:
  1. Duplicate function declarations
  2. CSS visibility issues
  3. CORS configuration
  4. Content area visibility
  5. Header intro-mode state
  6. Entry view element visibility
  7. Missing state imports
- Refactored entry.js to eliminate ~70% code duplication
- Extracted magic numbers to constants

## Benefits

✅ **Maintainability**: Code organized by feature, easy to find and modify
✅ **Testability**: Pure functions, clear dependencies
✅ **Reusability**: Utility functions shared across modules
✅ **Debugging**: Clear stack traces with named modules
✅ **Performance**: Better caching with separate files
✅ **Type Safety**: Consistent patterns, easier to add TypeScript later
✅ **Code Quality**: No duplication, constants instead of magic numbers

## Testing

Tested on Railway deployment: https://web-js-refactor.up.railway.app

**Verified flows:**
1. Intro animation sequence
2. Protocol list display and progressive disclosure
3. Protocol selection and entry view
4. Walk flow with AI interactions
5. Completion and summary generation

## Notes

- All modules use ES6 `import/export` syntax
- Modules loaded with `type="module"` for proper scoping
- State management uses immutable update pattern
- DOM elements cached once at module load time
- Error boundaries prevent cascading failures
- Constants prevent magic number proliferation

## Future Improvements

- Add unit tests for utility functions
- Add integration tests for user flows
- Add TypeScript for type safety
- Add bundler (Vite/esbuild) for optimization
- Add ESLint for code style enforcement
