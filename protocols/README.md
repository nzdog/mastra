# Lichen Protocols

This directory contains protocol markdown files for the Lichen Protocol system.

## Protocol Format

All protocols follow a standardized markdown format that the system automatically parses. See
`PROTOCOL_TEMPLATE.md` for a complete template.

### Structure

Each protocol consists of:

1. **Frontmatter** (YAML) - Metadata about the protocol
2. **Entry Content** - Purpose, Why, When, and Outcomes
3. **Themes** - Individual exploration themes with questions

### Frontmatter Fields

```yaml
---
id: unique_protocol_slug # Machine-readable identifier
title: Human Readable Title # Display name
version: 1.0.0 # Semantic version
entry_keys: # Required entry sections
  - purpose
  - why
  - use_when
  - outcomes_overall
themes: # Theme metadata
  - index: 1
    title: Theme Name
  - index: 2
    title: Theme Name
stones: # Stone references
  - Stone N: Stone Name
---
```

### Entry Sections

The entry content includes:

- **Purpose** - What the protocol does
- **Why This Matters** - Significance and impact
- **Use This When** - Situations for using this protocol
- **Outcomes** - Four levels: Poor, Expected, Excellent, Transcendent

### Theme Structure

Each theme follows this format:

```markdown
### N. Theme Title _(Stone Reference)_

**Purpose:** [What this theme does] **Why this matters:** [Why it's important] **Outcomes:**

- Poor: ...
- Expected: ...
- Excellent: ...
- Transcendent: ... **Guiding Questions:**
- Question 1
- Question 2
- Question 3

**Completion Prompt:** [Completion statement]
```

## Creating a New Protocol

1. Copy `PROTOCOL_TEMPLATE.md`
2. Rename to `your_protocol_name.md`
3. Fill in all sections
4. Place in this `/protocols` directory
5. The system will automatically parse it

## Validation

The system validates:

- ✅ Frontmatter is properly formatted YAML
- ✅ Entry sections are present
- ✅ Themes are numbered sequentially
- ✅ Each theme has all required fields
- ✅ Guiding questions are present (typically 3 per theme)
- ✅ Completion prompts are present

## Current Protocols

- `field_diagnostic.md` - Field Diagnostic Protocol (5 themes)

## Tips

- Use **exactly 3 guiding questions** per theme for consistency
- Keep completion prompts as "I" statements users can affirm
- Reference specific Stones in theme headers
- Maintain the 4-level outcome structure (Poor/Expected/Excellent/Transcendent)
- Use the frontmatter `themes` array to list all themes for validation
