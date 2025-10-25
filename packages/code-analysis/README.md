# Lichen Protocol Code Analysis

Reproducible codebase analysis following the Lichen Protocol principles: **Integrity**, **Empathy**, and **Rhythm**.

## What is This?

This package provides automated, reproducible analysis of the Mastra Lichen Agent codebase across five dimensions:

1. **[INT] Integrity** - Security, cryptographic guarantees, invariants
2. **[EMP] Empathy** - Developer experience, documentation, cognitive load
3. **[RHY] Rhythm** - Technical debt, test coverage, sustainability
4. **[TEC] Technical** - Type safety, build health, performance
5. **[SYN] Synthesis** - Executive summary with actionable recommendations

## Quick Start

### Run Analysis

```bash
cd packages/code-analysis
bash ./analyze.sh
```

### View Results

```bash
# Executive summary
cat ./reports/latest/SYN-executive-summary.md

# Individual reports
cat ./reports/latest/INT-integrity-report.md
cat ./reports/latest/EMP-empathy-report.md
cat ./reports/latest/RHY-rhythm-report.md
cat ./reports/latest/TEC-technical-health.json
```

## Understanding Scores

All scores are normalized to **0-100** scale:
- **95-100**: Excellent
- **80-94**: Good
- **70-79**: Acceptable
- **<70**: Needs attention

### Composite Score

The overall health score is a weighted average:
- **INT**: 30% (security is critical)
- **EMP**: 20% (developer experience matters)
- **RHY**: 20% (sustainability is key)
- **TEC**: 30% (technical correctness is critical)

## Latest Analysis Results

**Composite**: 68.40/100

| Stone | Score | Status |
|-------|-------|--------|
| INT | 98/100 | ✅ Excellent |
| EMP | 0/100 | ⚠️  Needs work |
| RHY | 45/100 | ⚠️  Tech debt |
| TEC | 100/100 | ✅ Perfect |

**Key Findings:**
- ✅ Strong security posture
- ✅ Perfect TypeScript compilation
- ⚠️  Zero JSDoc documentation
- ⚠️  Technical debt markers present

## Reproducibility

Every analysis generates:
- **Input fingerprint**: SHA256 hash of all source files
- **Environment hash**: Runtime/tool versions
- **Canonical hashes**: Timestamp-independent verification
- **Audit ledger**: Historical tracking (`.analysis-ledger.jsonl`)

To verify an analysis:
```bash
cd reports/97b561c-20251025T041351/
shasum -a 256 -c checksums.manifest
```

## Loop-Closure Is Automatic

Every analysis run automatically completes the **Theme-5 loop closure**:

### What Happens Every Run

1. **SYN files registered** - `SYN-executive-summary.md` and `SYN-next-actions.md` added to proof chain
2. **Checksums computed** - Both raw (unique) and canonical (reproducible) hashes
3. **Manifest rebuilt** - `checksums.manifest` in `sha256sum -c` compatible format
4. **Ledger appended** - One JSON line added to `.analysis-ledger.jsonl` with dual manifest hashes
5. **Verification run** - Checksums verified with `sha256sum -c`

### Output Files (per run)

```
reports/<sha>-<timestamp>/
├── checksums.raw                  # Raw SHA256 hashes (include timestamps)
├── checksums.canonical            # Canonical hashes (reproducible)
├── checksums.manifest             # Verifiable with: shasum -a 256 -c
├── checksums.manifest.canonical   # Canonical manifest
└── SYN-next-actions.md.bak.*      # Backup of previous version
```

### Ledger Format

Each analysis appends one line to `reports/.analysis-ledger.jsonl`:

```jsonl
{"run_sha":"97b561c","timestamp":"20251025T045623","version":"2025-01-v1","composite_score":68.40,"files_registered":6,"manifest_hash":"e635e86b...","manifest_canon_hash":"8f3ddb5e..."}
```

### How to Verify Loop-Closure

```bash
# View ledger
cat reports/.analysis-ledger.jsonl | jq

# Verify checksums
cd reports/latest
shasum -a 256 -c checksums.manifest

# Check idempotency
bash tools/verify-idempotency.sh

# Re-run loop-closure manually (idempotent)
bash tools/loop-closure.sh
```

### Idempotency Guarantee

Running analysis twice on the same commit produces **identical canonical hashes** (timestamps stripped). This proves:
- ✅ Analysis is deterministic
- ✅ Results are reproducible
- ✅ Proofs are tamper-evident

### When Loop-Closure Runs

- ✅ After Phase 5 completes successfully
- ✅ After error (best-effort on partial analysis)
- ✅ Manually via `bash tools/loop-closure.sh`

### Guardrails

- **Backup**: Existing `SYN-next-actions.md` backed up before regeneration
- **Idempotent**: Safe to run multiple times (ledger checks for duplicates)
- **Non-destructive**: Never deletes historical reports
- **Append-only**: Ledger grows monotonically

## Configuration

Edit `config/thresholds.yaml` to adjust:
- Score targets per stone
- Metric thresholds
- Failure conditions
- Weights for composite score

## Analysis Phases

### Phase 0: Setup
- Verify workspace
- Generate run identifiers
- Calculate input fingerprint
- Capture environment

### Phase 1: Integrity [INT]
- Run `npm audit`
- Scan for hardcoded secrets
- Check CORS configuration
- Verify cryptographic guarantees

### Phase 2: Empathy [EMP]
- Measure documentation coverage
- Analyze file complexity
- Identify large files (>1000 lines)
- Calculate cognitive load

### Phase 3: Rhythm [RHY]
- Count test files
- Find technical debt markers (TODO/FIXME/HACK)
- Check dependency freshness
- Assess sustainability

### Phase 4: Technical [TEC]
- Run `tsc --noEmit --strict`
- Count TypeScript errors
- Verify build health
- Check type coverage

### Phase 5: Synthesis [SYN]
- Calculate composite score
- Generate executive summary
- Create actionable recommendations
- Build reproducibility certificate

## Tools Required

- `jq` - JSON processing
- `find` - File discovery
- `grep` - Pattern matching
- `shasum` (macOS) or `sha256sum` (Linux) - Hashing

## File Structure

```
packages/code-analysis/
├── analyze.sh                    # Main analysis script
├── config/
│   └── thresholds.yaml           # Score targets
├── docs/
│   └── lichen-protocol.md        # Protocol specification
├── reports/
│   ├── latest/                   # Symlink to most recent
│   ├── <sha>-<timestamp>/        # Timestamped analyses
│   └── .analysis-ledger.jsonl    # Historical log
└── tools/
    ├── loop-closure.sh           # Automatic proof registration
    ├── resume-analysis.sh        # Resume interrupted runs
    └── verify-idempotency.sh     # Test reproducibility
```

## Next Steps

Based on current analysis (68.40/100):

1. **Add JSDoc comments** - Target 80%+ coverage [EMP]
2. **Address TODO markers** - Prioritize by impact [RHY]
3. **Complete PostgresStore** - Implement missing methods [RHY]

## Philosophy

> "Each metric is a mirror, not a verdict."
> "The System Walks With Us - each analysis strengthens the whole."

This analysis tool embodies the Lichen Protocol principles:
- **Integrity**: Cryptographically verified, tamper-evident
- **Empathy**: Measures human experience, not just code
- **Rhythm**: Tracks sustainability over time

## License

Part of the Mastra Lichen Agent project.
