# Protocol Validation & Normalization - Acceptance Tests

## Overview

Manual acceptance tests to verify the key guarantee: **protocols only appear on the protocol list page if they PASS validation, even if added after startup** (discovery-time validation).

## Prerequisites

1. Server must be running: `npm run server`
2. CLI tool available: `npm run validate:protocols`

## Test A: Valid Protocol Added After Startup

**Goal**: Verify that a valid protocol file added while server is running appears in `/api/protocols` after cache expiry.

### Steps

1. **Start server**:
   ```bash
   npm run server
   ```

2. **Record initial protocol count**:
   ```bash
   curl -s http://localhost:3000/api/protocols | jq '.protocols | length'
   ```
   Note the count (e.g., 6 protocols).

3. **Create a valid test protocol**:
   Create file `protocols/test_valid_protocol.md`:
   ```markdown
   ---
   schema_version: 1
   id: test_valid_protocol
   title: Test Valid Protocol
   version: 1.0.0
   entry_keys:
     - purpose
   entry_sections:
     - title: Purpose
       marker: '## Purpose'
     - title: Themes Section
       marker: '## Themes'
   themes:
     - index: 1
       title: Test Theme
   stones:
     - Stone 1: Test Stone
   ---

   # Test Valid Protocol

   ## Purpose

   This is a test protocol to verify validation.

   ## Themes

   ### 1. Test Theme _(Stone 1: Test Stone)_

   **Purpose:** Test purpose text.

   **Why this matters:** Test why it matters text.

   **Outcomes:**
   - **Poor:** Test poor outcome
   - **Expected:** Test expected outcome
   - **Excellent:** Test excellent outcome
   - **Transcendent:** Test transcendent outcome

   **Guiding Questions:**
   - Question 1?
   - Question 2?
   - Question 3?

   **Completion Prompt:** Test completion prompt.
   ```

4. **Validate the new protocol**:
   ```bash
   npm run validate:protocols -- --file protocols/test_valid_protocol.md
   ```
   Should output: "✅ test_valid_protocol.md: Valid"

5. **Wait for cache expiry** (5 minutes) OR restart server.

6. **Check protocol list again**:
   ```bash
   curl -s http://localhost:3000/api/protocols | jq '.protocols | length'
   ```
   Count should increase by 1.

7. **Verify new protocol appears**:
   ```bash
   curl -s http://localhost:3000/api/protocols | jq '.protocols[] | select(.id == "test_valid_protocol")'
   ```
   Should return the test protocol metadata.

8. **Cleanup**:
   ```bash
   rm protocols/test_valid_protocol.md
   ```

**Expected Result**: ✅ Valid protocol appears in `/api/protocols` after cache expiry.

---

## Test B: Invalid Protocol Added After Startup

**Goal**: Verify that an invalid protocol file added while server is running does NOT appear in `/api/protocols` after cache expiry.

### Steps

1. **Start server**:
   ```bash
   npm run server
   ```

2. **Record initial protocol count**:
   ```bash
   curl -s http://localhost:3000/api/protocols | jq '.protocols | length'
   ```
   Note the count.

3. **Create an invalid test protocol**:
   Create file `protocols/test_invalid_protocol.md` (missing `schema_version` and `Completion Prompt`):
   ```markdown
   ---
   id: test_invalid_protocol
   title: Test Invalid Protocol
   version: 1.0.0
   entry_keys:
     - purpose
   entry_sections:
     - title: Purpose
       marker: '## Purpose'
     - title: Themes Section
       marker: '## Themes'
   themes:
     - index: 1
       title: Test Theme
   ---

   # Test Invalid Protocol

   ## Purpose

   This is an invalid test protocol (missing schema_version and incomplete theme).

   ## Themes

   ### 1. Test Theme

   **Purpose:** Test purpose text.

   **Guiding Questions:**
   - Question 1?
   - Question 2?
   - Question 3?
   ```

4. **Validate the new protocol** (should fail):
   ```bash
   npm run validate:protocols -- --file protocols/test_invalid_protocol.md
   ```
   Should output errors like:
   - "❌ Missing required field: schema_version"
   - "❌ Theme 1: Missing semantic field 'Why this matters'"
   - "❌ Theme 1: Missing semantic field 'Outcomes'"
   - "❌ Theme 1: Missing semantic field 'Completion Prompt'"

5. **Wait for cache expiry** (5 minutes) OR restart server.

6. **Check server logs** for validation warnings:
   Should see:
   ```
   ⚠️  LOADER (PERMISSIVE): Skipping invalid protocol: test_invalid_protocol.md
      Errors: 4
   ```

7. **Check protocol list**:
   ```bash
   curl -s http://localhost:3000/api/protocols | jq '.protocols | length'
   ```
   Count should remain the same (not increase).

8. **Verify invalid protocol does NOT appear**:
   ```bash
   curl -s http://localhost:3000/api/protocols | jq '.protocols[] | select(.id == "test_invalid_protocol")'
   ```
   Should return nothing (empty).

9. **Cleanup**:
   ```bash
   rm protocols/test_invalid_protocol.md
   ```

**Expected Result**: ✅ Invalid protocol does NOT appear in `/api/protocols`.

---

## Test C: Production Strict Mode Startup Validation

**Goal**: Verify that server exits with code 1 in production strict mode when invalid protocols are present at boot.

### Steps

1. **Create an invalid protocol** (same as Test B):
   Create `protocols/test_invalid_strict.md` with missing `schema_version`.

2. **Validate it's invalid**:
   ```bash
   npm run validate:protocols -- --file protocols/test_invalid_strict.md
   ```
   Should show errors.

3. **Start server in strict mode**:
   ```bash
   PROTOCOL_VALIDATION_STRICT=true npm run server
   ```

4. **Observe server startup**:
   Should see:
   ```
   📋 Validating protocol files at startup...
   ❌ Protocol validation errors at startup:
     - test_invalid_strict.md: 4 error(s)
       • Missing required field: schema_version
       • ...

   ❌ Server startup aborted due to invalid protocols
      Environment: development
      Mode: STRICT
      Run "npm run validate:protocols" for detailed diagnostics
   ```

5. **Verify server exited**:
   Server should not be running. Exit code should be 1.

6. **Cleanup**:
   ```bash
   rm protocols/test_invalid_strict.md
   ```

**Expected Result**: ✅ Server exits with code 1 in strict mode when invalid protocols are present.

---

## Test D: CLI Tool - Validation and Normalization

**Goal**: Verify CLI tool flags work correctly.

### Steps

1. **Validate all protocols**:
   ```bash
   npm run validate:protocols
   ```
   Shows validation results for all protocols.

2. **Validate specific file**:
   ```bash
   npm run validate:protocols -- --file protocols/field_diagnostic.md
   ```
   Shows results for single file.

3. **Create protocol with formatting issues**:
   Create `protocols/test_formatting.md`:
   ```markdown
   ---
   schema_version: 1
   id: test_formatting
   title: Test Formatting
   version: 1.0.0
   entry_sections:
     - title: Purpose
       marker: '## Purpose'
     - title: Themes
       marker: '## Themes'
   ---

   # Test Formatting

   ##Purpose
   Test content with bad spacing.

   ## Themes

   ### 1. Test Theme

   **Purpose:** test

   **Why this matters:** test

   **Outcomes:**
   -  poor: test
   -expected: test
   - Excellent: test
   - Transcendent: test

   **Guiding Questions:**
   - Q1?
   - Q2?
   - Q3?

   **Completion Prompt:** test
   ```

4. **Test dry-run normalization**:
   ```bash
   npm run validate:protocols -- --file protocols/test_formatting.md --fix --dry-run
   ```
   Should show proposed changes (heading spacing, bullet spacing, outcomes casing, trailing whitespace).

5. **Apply fixes**:
   ```bash
   npm run validate:protocols -- --file protocols/test_formatting.md --fix --yes
   ```
   Should apply changes without prompt.

6. **Verify backup created**:
   ```bash
   ls -la protocols/test_formatting.md.backup
   ```
   Backup file should exist.

7. **Run normalization again** (idempotency test):
   ```bash
   npm run validate:protocols -- --file protocols/test_formatting.md --fix --dry-run
   ```
   Should show "No formatting issues found" (idempotent).

8. **Cleanup**:
   ```bash
   rm protocols/test_formatting.md protocols/test_formatting.md.backup
   ```

**Expected Result**: ✅ CLI normalization works correctly and is idempotent.

---

## Environment Behavior Matrix Verification

| Test Scenario | NODE_ENV | PROTOCOL_VALIDATION_STRICT | Expected Behavior |
|---------------|----------|---------------------------|-------------------|
| Dev default | development | (not set) | Permissive: warn, skip invalid, continue |
| Dev strict | development | true | Strict: error, block startup |
| Dev permissive | development | false | Permissive: warn, skip invalid, continue |
| Prod default | production | (not set) | Strict: error, block startup |
| Prod strict | production | true | Strict: error, block startup |
| Prod permissive | production | false | Permissive: warn, skip invalid, continue |

---

## Summary

All acceptance tests should pass to confirm:
- ✅ Discovery-time validation in loader filters invalid protocols
- ✅ Invalid protocols NEVER appear in `/api/protocols`, even if added after startup
- ✅ Startup validation provides fast-fail in strict mode
- ✅ CLI tool validates and normalizes correctly
- ✅ Environment-aware behavior works as specified
