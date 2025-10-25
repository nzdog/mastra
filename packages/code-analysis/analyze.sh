#!/bin/bash
set -Eeuo pipefail
IFS=$'\n\t'
export LC_ALL=C LANG=C
umask 077  # keep reports private by default

# macOS Compatibility Layer
if command -v sha256sum >/dev/null 2>&1; then
  SHA256() { sha256sum "$@"; }
else
  SHA256() { shasum -a 256 "$@"; }
fi

# Set up traps early to catch failures
CURRENT_PHASE_SNAP="setup"
REPORT_DIR=""  # Will be set after we generate timestamp
trap 'echo "L Critical failure in phase ${CURRENT_PHASE_SNAP}"; \
      if [ -n "${REPORT_DIR}" ]; then \
        echo "Attempting loop-closure on partial analysis..."; \
        bash "./tools/loop-closure.sh" 2>/dev/null || true; \
        echo "Resume: bash ./tools/resume-analysis.sh ${REPORT_DIR}/.analysis-state.yaml"; \
      fi' ERR
trap 'if [ -n "${REPORT_DIR}" ] && [ -f "${REPORT_DIR}/logs/execution.log" ]; then \
        echo "=== Analysis Ended: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z") ===" >> "${REPORT_DIR}/logs/execution.log"; \
      fi' EXIT

# Initialize state file creation function
create_state_file() {
  cat > "${1}/.analysis-state.yaml" <<EOF
analysis_version: "2025-01-v1"
started_at: "${2}"
current_phase: "setup"
completed_phases: []
failed_phases: []
resume_checkpoint: null
environment_hash: null
EOF
}

# Canonicalization functions
canon_hash() {
  sed -E '/^timestamp:|^Report generated:|^Signed at:|^completed_at:|^started_at:|^generated:|^Content hash:|"timestamp":|"started_at":|"completed_at":/d' "$1" | \
    SHA256 | awk '{print $1}'
}

canonicalize_json() {
  if command -v jq >/dev/null 2>&1; then
    jq -S '.' "$1" > "$1.tmp" && mv "$1.tmp" "$1"
  fi
}

# Resume utility
create_resume_script() {
  cat > ./tools/resume-analysis.sh << 'RESUME_EOF'
#!/bin/bash
STATE_FILE="${1:-./analysis-state.yaml}"
if [ ! -f "$STATE_FILE" ]; then
  echo "L No state file found. Start fresh analysis."
  exit 1
fi

CURRENT_PHASE=$(grep "current_phase:" "$STATE_FILE" | cut -d'"' -f2)
echo "=� Resuming from phase: $CURRENT_PHASE"

case $CURRENT_PHASE in
  "setup")      exec bash ./analyze.sh --phase=integrity ;;
  "integrity")  exec bash ./analyze.sh --phase=empathy ;;
  "empathy")    exec bash ./analyze.sh --phase=rhythm ;;
  "rhythm")     exec bash ./analyze.sh --phase=technical ;;
  "technical")  exec bash ./analyze.sh --phase=synthesis ;;
  *) echo " Analysis already complete or in unknown state" ;;
esac
RESUME_EOF
  chmod +x ./tools/resume-analysis.sh
}

## Phase 0: SETUP AND PREREQUISITES

echo "= Lichen Protocol Analysis - Starting..."
echo ""

# 0.1 Verify workspace location
if [ "$(basename $(pwd))" != "code-analysis" ]; then
  echo "L ERROR: Must run from packages/code-analysis/ directory"
  echo "Current: $(pwd)"
  exit 1
fi

# 0.2 Check for clean working tree
cd ../.. # Go to repo root
if git diff --quiet && git diff --cached --quiet; then
  echo " Repository clean - reproducibility possible"
else
  echo "�  Working tree has uncommitted changes - analysis will still run"
  echo "   (Reproducibility requires clean tree)"
fi
cd - >/dev/null # Back to code-analysis

# 0.3 Generate run identifiers
export RUN_SHA=$(cd ../.. && git rev-parse --short HEAD 2>/dev/null || echo "no-git")
export RUN_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" | tr -d ':-' | tr '.' 'Z' | sed 's/Z000Z$//')
export REPORT_DIR="./reports/${RUN_SHA}-${RUN_TIMESTAMP}"

# 0.4 Create report structure
mkdir -p "${REPORT_DIR}/metrics"
mkdir -p "${REPORT_DIR}/logs"
mkdir -p "${REPORT_DIR}/scores"
mkdir -p "./reports/archive"
mkdir -p "./tools"
touch "./reports/.analysis-ledger.jsonl"

# 0.5 Check required tools
MISSING_TOOLS=()
for tool in jq find; do
  command -v "$tool" >/dev/null 2>&1 || MISSING_TOOLS+=("$tool")
done
if ((${#MISSING_TOOLS[@]})); then
  echo "�  Missing tools: ${MISSING_TOOLS[*]} - degraded mode"
fi

# 0.6 Create state file
create_state_file "${REPORT_DIR}" "${RUN_TIMESTAMP}"
create_resume_script

# 0.7 Capture environment fingerprint
cat > "${REPORT_DIR}/environment.json" << EOF
{
  "runtime": {
    "node_version": "$(node --version 2>/dev/null || echo 'missing')",
    "npm_version": "$(npm --version 2>/dev/null || echo 'missing')",
    "typescript_version": "$(npx tsc --version 2>/dev/null | cut -d' ' -f2 || echo 'missing')",
    "os": "$(uname -s)",
    "os_version": "$(uname -r)",
    "architecture": "$(uname -m)"
  },
  "analysis": {
    "version": "2025-01-v1",
    "timestamp": "${RUN_TIMESTAMP}",
    "working_dir": "$(pwd)"
  },
  "git": {
    "sha": "${RUN_SHA}",
    "branch": "$(cd ../.. && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'detached')",
    "dirty": $(cd ../.. && git diff --quiet && git diff --cached --quiet && echo "false" || echo "true")
  },
  "tools": {
    "jq": $(command -v jq >/dev/null 2>&1 && echo "true" || echo "false"),
    "sha256sum": $(command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 && echo "true" || echo "false"),
    "tsc": $(command -v tsc >/dev/null 2>&1 && echo "true" || echo "false"),
    "missing": $(if ((${#MISSING_TOOLS[@]})); then printf '"%s",' "${MISSING_TOOLS[@]}" | sed 's/,$//' | sed 's/^/[/' | sed 's/$/]/'; else echo '[]'; fi)
  }
}
EOF
canonicalize_json "${REPORT_DIR}/environment.json"
ENV_HASH=$(SHA256 "${REPORT_DIR}/environment.json" | cut -d' ' -f1)

# 0.8 Calculate input fingerprint
SRC_ROOT="../../src"
mapfile -d '' INPUT_FILES < <(
  find "$SRC_ROOT" \
    \( -path '*/node_modules' -o -path '*/.git' -o -path '*/dist' \) -prune -o \
    \( -name '*.ts' -o -name '*.js' -o -name '*.json' -o -name '*.yaml' -o -name '*.md' \) \
    -type f -print0
) 2>/dev/null || INPUT_FILES=()

INPUT_FINGERPRINT=$(
  {
    printf 'GIT_SHA:%s\n' "${RUN_SHA}"
    printf 'ANALYSIS_VERSION:%s\n' "2025-01-v1"
    printf 'ENV_HASH:%s\n' "${ENV_HASH}"
    if ((${#INPUT_FILES[@]})); then
      printf '%s\0' "${INPUT_FILES[@]}" | sort -z | xargs -0 SHA256 | SHA256 | awk '{print $1}'
    else
      echo "no-input-files"
    fi
  } | SHA256 | awk '{print $1}'
)

echo "${INPUT_FINGERPRINT}" > "${REPORT_DIR}/.input-fingerprint"

# 0.9 Initialize execution log
exec > >(tee -a "${REPORT_DIR}/logs/execution.log")
exec 2>&1
echo "=== Analysis Started: ${RUN_TIMESTAMP} ==="
echo "SHA: ${RUN_SHA}"
echo "Directory: ${REPORT_DIR}"
echo "Environment: ${ENV_HASH}"
echo "Input fingerprint: ${INPUT_FINGERPRINT}"

# 0.10 Update state with environment
sed -i.bak "s/environment_hash:.*/environment_hash: \"${ENV_HASH}\"/" "${REPORT_DIR}/.analysis-state.yaml"

# SUCCESS CRITERIA
[ -d "${REPORT_DIR}" ] && echo " Setup complete" || exit 1
echo "=� Setup finished  take a breath before integrity analysis."
sleep 1

# Verification helper function
verify_phase_output() {
  local PHASE=$1
  local OUTPUT_FILE=$2

  if [ ! -s "${OUTPUT_FILE}" ]; then
    echo "L Phase ${PHASE} output missing or empty"
    return 1
  fi

  # Calculate both hashes
  local RAW_HASH=$(SHA256 "${OUTPUT_FILE}" | awk '{print $1}')
  local CANON_HASH=$(canon_hash "${OUTPUT_FILE}")

  # Record both hashes
  echo "${RAW_HASH}  ${OUTPUT_FILE##*/}" >> "${REPORT_DIR}/checksums.raw"
  echo "${CANON_HASH}  ${OUTPUT_FILE##*/}" >> "${REPORT_DIR}/checksums.canonical"

  return 0
}

## Phase 1: INTEGRITY ANALYSIS [INT]

# Check if already completed
if [ -f "${REPORT_DIR}/INT-integrity-report.md" ]; then
  echo "�  Integrity analysis already exists, skipping..."
else
  echo ""
  echo "= Starting Integrity Analysis..."

  # Update state and phase tracker
  CURRENT_PHASE_SNAP="integrity"
  sed -i.bak 's/current_phase:.*/current_phase: "integrity"/' "${REPORT_DIR}/.analysis-state.yaml"

  # Run security audit
  cd ../..
  npm audit --json > "packages/code-analysis/${REPORT_DIR}/metrics/npm-audit.json" 2>/dev/null || echo '{}' > "packages/code-analysis/${REPORT_DIR}/metrics/npm-audit.json"
  cd - >/dev/null

  # Check for secrets
  grep -r "password\|secret\|api[_-]key\|token" --include="*.ts" --include="*.js" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    ../../src > "${REPORT_DIR}/metrics/potential-secrets.txt" 2>/dev/null || touch "${REPORT_DIR}/metrics/potential-secrets.txt"

  # Calculate normalized score
  HIGH_VULNS=$(jq '.metadata.vulnerabilities.high // 0' "${REPORT_DIR}/metrics/npm-audit.json" 2>/dev/null || echo 0)
  CRITICAL_VULNS=$(jq '.metadata.vulnerabilities.critical // 0' "${REPORT_DIR}/metrics/npm-audit.json" 2>/dev/null || echo 0)
  SECRETS_COUNT=$(wc -l < "${REPORT_DIR}/metrics/potential-secrets.txt" | tr -d ' ')

  INT_SCORE=$((100 - ($HIGH_VULNS * 10) - ($CRITICAL_VULNS * 25) - ($SECRETS_COUNT / 10)))
  [ $INT_SCORE -lt 0 ] && INT_SCORE=0

  # Save score
  echo "{\"stone\": \"INT\", \"score\": ${INT_SCORE}, \"timestamp\": \"${RUN_TIMESTAMP}\"}" > "${REPORT_DIR}/scores/INT-score.json"

  # Generate report
  cat > "${REPORT_DIR}/INT-integrity-report.md" << 'INTEOF'
---
run_sha: ${RUN_SHA}
timestamp: ${RUN_TIMESTAMP}
analysis_version: "2025-01-v1"
stone: "Integrity Is the Growth Strategy"
stone_code: INT
---

# Integrity Analysis Report

## Security Audit
- High vulnerabilities: ${HIGH_VULNS}
- Critical vulnerabilities: ${CRITICAL_VULNS}

## Potential Secrets
- Findings: ${SECRETS_COUNT}

## Normalized Score: ${INT_SCORE}/100

---
## Verification Block
Report generated: ${RUN_TIMESTAMP}
Analysis version: "2025-01-v1"
INTEOF

  # Replace variables in report
  sed -i.bak "s/\${RUN_SHA}/${RUN_SHA}/g" "${REPORT_DIR}/INT-integrity-report.md"
  sed -i.bak "s/\${RUN_TIMESTAMP}/${RUN_TIMESTAMP}/g" "${REPORT_DIR}/INT-integrity-report.md"
  sed -i.bak "s/\${HIGH_VULNS}/${HIGH_VULNS}/g" "${REPORT_DIR}/INT-integrity-report.md"
  sed -i.bak "s/\${CRITICAL_VULNS}/${CRITICAL_VULNS}/g" "${REPORT_DIR}/INT-integrity-report.md"
  sed -i.bak "s/\${SECRETS_COUNT}/${SECRETS_COUNT}/g" "${REPORT_DIR}/INT-integrity-report.md"
  sed -i.bak "s/\${INT_SCORE}/${INT_SCORE}/g" "${REPORT_DIR}/INT-integrity-report.md"

  # Calculate and append hash
  FILE_HASH=$(SHA256 "${REPORT_DIR}/INT-integrity-report.md" | cut -d' ' -f1)
  echo "Content hash: ${FILE_HASH}" >> "${REPORT_DIR}/INT-integrity-report.md"
  echo "---" >> "${REPORT_DIR}/INT-integrity-report.md"
fi

verify_phase_output "integrity" "${REPORT_DIR}/INT-integrity-report.md"
echo "=� Integrity phase complete"
sleep 1

## Phase 2: EMPATHY ANALYSIS [EMP]

if [ -f "${REPORT_DIR}/EMP-empathy-report.md" ]; then
  echo "�  Empathy analysis already exists, skipping..."
else
  echo ""
  echo "=� Starting Empathy Analysis..."

  CURRENT_PHASE_SNAP="empathy"
  sed -i.bak 's/current_phase:.*/current_phase: "empathy"/' "${REPORT_DIR}/.analysis-state.yaml"

  # Analyze file sizes and complexity
  find ../../src -name "*.ts" -exec wc -l {} \; 2>/dev/null | \
    awk '{sum+=$1; files++; if($1>1000) large++} END {
      if(files>0) print "{\"avg_file_length\": "int(sum/files)", \"total_files\": "files", \"large_files\": "large+0"}";
      else print "{\"avg_file_length\": 0, \"total_files\": 0, \"large_files\": 0}"}' \
    > "${REPORT_DIR}/metrics/complexity.json"

  # Find largest files
  find ../../src -name "*.ts" -type f -exec wc -l {} \; 2>/dev/null | \
    sort -rn | head -10 > "${REPORT_DIR}/metrics/largest-files.txt"

  # Documentation coverage
  TOTAL_FUNCS=$(grep -r "function\|const.*=.*=>\|async.*=>" --include="*.ts" ../../src 2>/dev/null | wc -l | tr -d ' \n' || echo 1)
  [ -z "$TOTAL_FUNCS" ] && TOTAL_FUNCS=1
  [ "$TOTAL_FUNCS" -eq 0 ] && TOTAL_FUNCS=1
  # Count JSDoc blocks (/** comments)
  # Each /** block indicates documented code
  DOCUMENTED=$(grep -r "/\*\*" --include="*.ts" ../../src 2>/dev/null | wc -l | tr -d ' \n' || echo 0)
  [ -z "$DOCUMENTED" ] && DOCUMENTED=0
  echo "{\"total_functions\": ${TOTAL_FUNCS}, \"documented\": ${DOCUMENTED}}" > "${REPORT_DIR}/metrics/docs.json"

  # Calculate score
  DOC_PERCENT=$((DOCUMENTED * 100 / TOTAL_FUNCS))
  LARGE_FILES=$(jq '.large_files' "${REPORT_DIR}/metrics/complexity.json")

  EMP_SCORE=$((DOC_PERCENT - (LARGE_FILES * 5)))
  [ $EMP_SCORE -gt 100 ] && EMP_SCORE=100
  [ $EMP_SCORE -lt 0 ] && EMP_SCORE=0

  echo "{\"stone\": \"EMP\", \"score\": ${EMP_SCORE}, \"timestamp\": \"${RUN_TIMESTAMP}\"}" > "${REPORT_DIR}/scores/EMP-score.json"

  # Generate report
  cat > "${REPORT_DIR}/EMP-empathy-report.md" << 'EMPEOF'
---
run_sha: ${RUN_SHA}
timestamp: ${RUN_TIMESTAMP}
stone: "Light Before Form"
stone_code: EMP
---

# Empathy Analysis Report

## Documentation: ${DOCUMENTED}/${TOTAL_FUNCS} (${DOC_PERCENT}%)
## Large Files: ${LARGE_FILES}

## Normalized Score: ${EMP_SCORE}/100
EMPEOF

  sed -i.bak "s/\${RUN_SHA}/${RUN_SHA}/g" "${REPORT_DIR}/EMP-empathy-report.md"
  sed -i.bak "s/\${RUN_TIMESTAMP}/${RUN_TIMESTAMP}/g" "${REPORT_DIR}/EMP-empathy-report.md"
  sed -i.bak "s/\${DOCUMENTED}/${DOCUMENTED}/g" "${REPORT_DIR}/EMP-empathy-report.md"
  sed -i.bak "s/\${TOTAL_FUNCS}/${TOTAL_FUNCS}/g" "${REPORT_DIR}/EMP-empathy-report.md"
  sed -i.bak "s/\${DOC_PERCENT}/${DOC_PERCENT}/g" "${REPORT_DIR}/EMP-empathy-report.md"
  sed -i.bak "s/\${LARGE_FILES}/${LARGE_FILES}/g" "${REPORT_DIR}/EMP-empathy-report.md"
  sed -i.bak "s/\${EMP_SCORE}/${EMP_SCORE}/g" "${REPORT_DIR}/EMP-empathy-report.md"

  FILE_HASH=$(SHA256 "${REPORT_DIR}/EMP-empathy-report.md" | cut -d' ' -f1)
  echo "Content hash: ${FILE_HASH}" >> "${REPORT_DIR}/EMP-empathy-report.md"
fi

verify_phase_output "empathy" "${REPORT_DIR}/EMP-empathy-report.md"
echo "=� Empathy phase complete"
sleep 1

## Phase 3: RHYTHM ANALYSIS [RHY]

if [ -f "${REPORT_DIR}/RHY-rhythm-report.md" ]; then
  echo "�  Rhythm analysis already exists, skipping..."
else
  echo ""
  echo "<� Starting Rhythm Analysis..."

  CURRENT_PHASE_SNAP="rhythm"
  sed -i.bak 's/current_phase:.*/current_phase: "rhythm"/' "${REPORT_DIR}/.analysis-state.yaml"

  # Count test files
  TEST_FILES=$(find ../../test -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  SRC_FILES=$(find ../../src -name "*.ts" 2>/dev/null | wc -l | tr -d ' ' || echo 1)
  [ $SRC_FILES -eq 0 ] && SRC_FILES=1  # Prevent division by zero
  TEST_RATIO=$((TEST_FILES * 100 / SRC_FILES))

  echo "{\"test_files\": ${TEST_FILES}, \"src_files\": ${SRC_FILES}, \"ratio\": ${TEST_RATIO}}" > "${REPORT_DIR}/metrics/test-coverage.json"

  # Technical debt markers
  DEBT_COUNT=$(grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" ../../src 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  echo "${DEBT_COUNT}" > "${REPORT_DIR}/metrics/tech-debt-count.txt"

  # Calculate score
  RHY_SCORE=$((85 - (DEBT_COUNT * 2)))
  [ $RHY_SCORE -gt 100 ] && RHY_SCORE=100
  [ $RHY_SCORE -lt 0 ] && RHY_SCORE=0

  echo "{\"stone\": \"RHY\", \"score\": ${RHY_SCORE}, \"timestamp\": \"${RUN_TIMESTAMP}\"}" > "${REPORT_DIR}/scores/RHY-score.json"

  # Generate report
  cat > "${REPORT_DIR}/RHY-rhythm-report.md" << 'RHYEOF'
---
run_sha: ${RUN_SHA}
timestamp: ${RUN_TIMESTAMP}
stone: "The System Walks With Us"
stone_code: RHY
---

# Rhythm Analysis Report

## Tests: ${TEST_FILES} files (${TEST_RATIO}% ratio)
## Tech Debt: ${DEBT_COUNT} markers

## Normalized Score: ${RHY_SCORE}/100
RHYEOF

  sed -i.bak "s/\${RUN_SHA}/${RUN_SHA}/g" "${REPORT_DIR}/RHY-rhythm-report.md"
  sed -i.bak "s/\${RUN_TIMESTAMP}/${RUN_TIMESTAMP}/g" "${REPORT_DIR}/RHY-rhythm-report.md"
  sed -i.bak "s/\${TEST_FILES}/${TEST_FILES}/g" "${REPORT_DIR}/RHY-rhythm-report.md"
  sed -i.bak "s/\${TEST_RATIO}/${TEST_RATIO}/g" "${REPORT_DIR}/RHY-rhythm-report.md"
  sed -i.bak "s/\${DEBT_COUNT}/${DEBT_COUNT}/g" "${REPORT_DIR}/RHY-rhythm-report.md"
  sed -i.bak "s/\${RHY_SCORE}/${RHY_SCORE}/g" "${REPORT_DIR}/RHY-rhythm-report.md"

  FILE_HASH=$(SHA256 "${REPORT_DIR}/RHY-rhythm-report.md" | cut -d' ' -f1)
  echo "Content hash: ${FILE_HASH}" >> "${REPORT_DIR}/RHY-rhythm-report.md"
fi

verify_phase_output "rhythm" "${REPORT_DIR}/RHY-rhythm-report.md"
echo "=� Rhythm phase complete"
sleep 1

## Phase 4: TECHNICAL VERIFICATION [TEC]

if [ -f "${REPORT_DIR}/TEC-technical-health.json" ]; then
  echo "�  Technical verification already exists, skipping..."
else
  echo ""
  echo "�  Starting Technical Verification..."

  CURRENT_PHASE_SNAP="technical"
  sed -i.bak 's/current_phase:.*/current_phase: "technical"/' "${REPORT_DIR}/.analysis-state.yaml"

  # TypeScript compilation check
  cd ../..
  npx tsc --noEmit --strict 2>&1 | tee "packages/code-analysis/${REPORT_DIR}/metrics/tsc-output.txt" || true
  TSC_ERRORS=$(grep "error TS" "packages/code-analysis/${REPORT_DIR}/metrics/tsc-output.txt" 2>/dev/null | wc -l | tr -d ' \n')
  [ -z "$TSC_ERRORS" ] && TSC_ERRORS=0
  cd - >/dev/null

  # Calculate score
  TEC_SCORE=$((100 - (TSC_ERRORS * 5)))
  [ $TEC_SCORE -gt 100 ] && TEC_SCORE=100
  [ $TEC_SCORE -lt 0 ] && TEC_SCORE=0

  echo "{\"stone\": \"TEC\", \"score\": ${TEC_SCORE}, \"timestamp\": \"${RUN_TIMESTAMP}\"}" > "${REPORT_DIR}/scores/TEC-score.json"

  # Generate JSON report
  cat > "${REPORT_DIR}/TEC-technical-health.json" << 'TECEOF'
{
  "run_sha": "${RUN_SHA}",
  "timestamp": "${RUN_TIMESTAMP}",
  "typescript_errors": ${TSC_ERRORS},
  "normalized_score": ${TEC_SCORE}
}
TECEOF

  sed -i.bak "s/\${RUN_SHA}/${RUN_SHA}/g" "${REPORT_DIR}/TEC-technical-health.json"
  sed -i.bak "s/\${RUN_TIMESTAMP}/${RUN_TIMESTAMP}/g" "${REPORT_DIR}/TEC-technical-health.json"
  sed -i.bak "s/\${TSC_ERRORS}/${TSC_ERRORS}/g" "${REPORT_DIR}/TEC-technical-health.json"
  sed -i.bak "s/\${TEC_SCORE}/${TEC_SCORE}/g" "${REPORT_DIR}/TEC-technical-health.json"

  canonicalize_json "${REPORT_DIR}/TEC-technical-health.json"
fi

verify_phase_output "technical" "${REPORT_DIR}/TEC-technical-health.json"
echo "=� Technical phase complete"
sleep 1

## Phase 5: SYNTHESIS [SYN]

echo ""
echo "=� Generating Executive Summary..."

CURRENT_PHASE_SNAP="synthesis"

# Collect all scores
INT_SCORE=$(jq '.score' "${REPORT_DIR}/scores/INT-score.json" 2>/dev/null || echo 0)
EMP_SCORE=$(jq '.score' "${REPORT_DIR}/scores/EMP-score.json" 2>/dev/null || echo 0)
RHY_SCORE=$(jq '.score' "${REPORT_DIR}/scores/RHY-score.json" 2>/dev/null || echo 0)
TEC_SCORE=$(jq '.score' "${REPORT_DIR}/scores/TEC-score.json" 2>/dev/null || echo 0)

# Calculate weighted composite
if command -v bc >/dev/null 2>&1; then
  COMPOSITE=$(echo "scale=0; ($INT_SCORE * 0.30) + ($EMP_SCORE * 0.20) + ($RHY_SCORE * 0.20) + ($TEC_SCORE * 0.30)" | bc)
else
  COMPOSITE=$((($INT_SCORE + $EMP_SCORE + $RHY_SCORE + $TEC_SCORE) / 4))
fi

# Generate executive summary
cat > "${REPORT_DIR}/SYN-executive-summary.md" << 'SYNEOF'
---
run_sha: ${RUN_SHA}
timestamp: ${RUN_TIMESTAMP}
composite_score: ${COMPOSITE}
---

# Executive Summary

## Overall Health: ${COMPOSITE}/100

| Stone | Score |
|-------|-------|
| INT   | ${INT_SCORE}/100 |
| EMP   | ${EMP_SCORE}/100 |
| RHY   | ${RHY_SCORE}/100 |
| TEC   | ${TEC_SCORE}/100 |

## Reports
- [INT-integrity-report.md](./INT-integrity-report.md)
- [EMP-empathy-report.md](./EMP-empathy-report.md)
- [RHY-rhythm-report.md](./RHY-rhythm-report.md)
- [TEC-technical-health.json](./TEC-technical-health.json)
SYNEOF

sed -i.bak "s/\${RUN_SHA}/${RUN_SHA}/g" "${REPORT_DIR}/SYN-executive-summary.md"
sed -i.bak "s/\${RUN_TIMESTAMP}/${RUN_TIMESTAMP}/g" "${REPORT_DIR}/SYN-executive-summary.md"
sed -i.bak "s/\${COMPOSITE}/${COMPOSITE}/g" "${REPORT_DIR}/SYN-executive-summary.md"
sed -i.bak "s/\${INT_SCORE}/${INT_SCORE}/g" "${REPORT_DIR}/SYN-executive-summary.md"
sed -i.bak "s/\${EMP_SCORE}/${EMP_SCORE}/g" "${REPORT_DIR}/SYN-executive-summary.md"
sed -i.bak "s/\${RHY_SCORE}/${RHY_SCORE}/g" "${REPORT_DIR}/SYN-executive-summary.md"
sed -i.bak "s/\${TEC_SCORE}/${TEC_SCORE}/g" "${REPORT_DIR}/SYN-executive-summary.md"

# Generate next actions (dynamically based on actual metrics)

# Read metrics from reports
DOCUMENTED=$(jq '.documented' "${REPORT_DIR}/metrics/docs.json" 2>/dev/null || echo 0)
TOTAL_FUNCS=$(jq '.total_functions' "${REPORT_DIR}/metrics/docs.json" 2>/dev/null || echo 1)
[ "$TOTAL_FUNCS" -eq 0 ] && TOTAL_FUNCS=1
DOC_PERCENT=$((DOCUMENTED * 100 / TOTAL_FUNCS))
LARGE_FILES=$(jq '.large_files' "${REPORT_DIR}/metrics/complexity.json" 2>/dev/null || echo 0)
DEBT_COUNT=$(cat "${REPORT_DIR}/metrics/tech-debt-count.txt" 2>/dev/null | tr -d ' \n' || echo 0)
[ -z "$DEBT_COUNT" ] && DEBT_COUNT=0
TSC_ERRORS=$(grep "error TS" "${REPORT_DIR}/metrics/tsc-output.txt" 2>/dev/null | wc -l | tr -d ' \n')
[ -z "$TSC_ERRORS" ] && TSC_ERRORS=0
TEST_RATIO=$(jq '.ratio' "${REPORT_DIR}/metrics/test-coverage.json" 2>/dev/null || echo 0)

# Start generating the file
cat > "${REPORT_DIR}/SYN-next-actions.md" << EOF
---
generated: ${RUN_TIMESTAMP}
from_analysis: ${RUN_SHA}
composite_score: ${COMPOSITE}
---

# Prioritized Action Items

EOF

# Build high priority section dynamically
echo "## 🔴 High Priority (Next Sprint)" >> "${REPORT_DIR}/SYN-next-actions.md"
echo "" >> "${REPORT_DIR}/SYN-next-actions.md"

HIGH_PRIORITY_COUNT=0

# Documentation (if < 80%)
if [ $DOC_PERCENT -lt 80 ]; then
  HIGH_PRIORITY_COUNT=$((HIGH_PRIORITY_COUNT + 1))
  TARGET_SCORE=$((DOC_PERCENT + 20))
  [ $TARGET_SCORE -gt 100 ] && TARGET_SCORE=100
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
### ${HIGH_PRIORITY_COUNT}. Add JSDoc Documentation [EMP]
**Current**: ${DOCUMENTED}/${TOTAL_FUNCS} functions documented (${DOC_PERCENT}%)
**Target**: 80%+ coverage

**Action**: Add JSDoc comments to public APIs
- Start with \`src/agent.ts\` exports
- Document \`src/memory-layer/\` public interfaces
- Include parameter types and return values
- Add usage examples for complex functions

**Impact**: Will raise EMP score toward ${TARGET_SCORE}+

EOF
fi

# Technical Debt (if > 5 markers)
if [ $DEBT_COUNT -gt 5 ]; then
  HIGH_PRIORITY_COUNT=$((HIGH_PRIORITY_COUNT + 1))
  TARGET_SCORE=$((RHY_SCORE + 10))
  [ $TARGET_SCORE -gt 100 ] && TARGET_SCORE=100
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
### ${HIGH_PRIORITY_COUNT}. Address Technical Debt Markers [RHY]
**Current**: ${DEBT_COUNT} TODO/FIXME markers
**Target**: <5 markers

**Action**: Review and resolve debt markers
- Complete unimplemented methods
- Fix critical-path TODOs
- Document intentional deferments with DEFERRED(Phase N)
- Remove or resolve remaining markers

**Impact**: Will raise RHY score toward ${TARGET_SCORE}+

EOF
fi

# TypeScript Errors (if > 0)
if [ $TSC_ERRORS -gt 0 ]; then
  HIGH_PRIORITY_COUNT=$((HIGH_PRIORITY_COUNT + 1))
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
### ${HIGH_PRIORITY_COUNT}. Fix TypeScript Compilation Errors [TEC]
**Current**: ${TSC_ERRORS} TypeScript errors
**Target**: 0 errors

**Action**: Fix type errors
- Review tsc output in metrics/tsc-output.txt
- Fix type mismatches and missing properties
- Ensure strict mode compliance

**Impact**: Will raise TEC score to 100/100

EOF
fi

# Large Files (if > 0)
if [ $LARGE_FILES -gt 0 ]; then
  HIGH_PRIORITY_COUNT=$((HIGH_PRIORITY_COUNT + 1))
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
### ${HIGH_PRIORITY_COUNT}. Split Large Files [EMP]
**Current**: ${LARGE_FILES} file(s) >1000 lines
**Target**: 0 files >1000 lines

**Action**: Refactor oversized modules
- Review largest files in metrics/largest-files.txt
- Extract helpers into focused modules
- Create single-responsibility modules
- Maintain existing interfaces

**Impact**: Will improve EMP score

EOF
fi

# If no high priority items, add a success message
if [ $HIGH_PRIORITY_COUNT -eq 0 ]; then
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
🎉 **No critical issues found!** All high-priority metrics are in excellent shape.

EOF
fi

# Medium Priority section
cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
## 🟡 Medium Priority (This Quarter)

EOF

# Test Coverage (if < 50%)
if [ $TEST_RATIO -lt 50 ]; then
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
### Increase Test Coverage [RHY]
**Current**: ${TEST_RATIO}% test-to-source ratio
**Target**: 50%+ coverage

**Action**: Add tests for critical paths
- Focus on memory-layer edge cases
- Add integration tests for agent workflows
- Test error handling and validation

EOF
fi

# Security (if INT < 98)
if [ $INT_SCORE -lt 98 ]; then
  cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
### Security Audit Follow-up [INT]
**Current**: ${INT_SCORE}/100
**Action**: Review potential security issues found in scan

EOF
fi

# Low Priority section
cat >> "${REPORT_DIR}/SYN-next-actions.md" << EOF
## 🟢 Low Priority (Backlog)

### Performance Optimization [TEC]
**Action**: Add APM instrumentation, consider caching

### Developer Experience [EMP]
**Action**: Create runbooks, contribution guide

## Current Metrics

- **Composite Score**: ${COMPOSITE}/100
- **Documentation Coverage**: ${DOC_PERCENT}% (${DOCUMENTED}/${TOTAL_FUNCS})
- **Technical Debt**: ${DEBT_COUNT} markers
- **Large Files**: ${LARGE_FILES}
- **TypeScript Errors**: ${TSC_ERRORS}
- **Test Ratio**: ${TEST_RATIO}%

## Next Analysis

Run after completing high-priority items:
\`\`\`bash
npm run analyze
\`\`\`
EOF

# Run loop-closure to register SYN files in proof chain
echo ""
echo "= Running loop-closure..."
bash "./tools/loop-closure.sh" || echo "⚠️  Loop-closure encountered errors but continuing..."

# Final state update
sed -i.bak 's/current_phase:.*/current_phase: "complete"/' "${REPORT_DIR}/.analysis-state.yaml"

# Create latest symlink
ln -sfn "$(basename "${REPORT_DIR}")" "./reports/latest" 2>/dev/null || true

echo ""
echo " Analysis complete! Results in ${REPORT_DIR}"
echo ""
echo "REVIEW: ${REPORT_DIR}/SYN-executive-summary.md"
echo ""
echo "=� The System Walks With Us - each analysis strengthens the whole."
