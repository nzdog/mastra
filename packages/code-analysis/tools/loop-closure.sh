#!/usr/bin/env bash
set -euo pipefail

# loop-closure.sh
# Idempotent post-analysis task that registers SYN files in the proof chain.
# Can be run standalone or as part of analyze.sh.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANALYSIS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# macOS/Linux compatibility
if command -v sha256sum >/dev/null 2>&1; then
  SHA256() { sha256sum "$@"; }
else
  SHA256() { shasum -a 256 "$@"; }
fi

# Canonical hash: strip volatile timestamp and hash lines
canon_hash() {
  local FILE="$1"
  grep -vE "^(timestamp:|Report generated:|Signed at:|completed_at:|started_at:|generated:|Content hash:)|\"timestamp\":|\"started_at\":|\"completed_at\":" "${FILE}" \
    | SHA256 \
    | awk '{print $1}'
}

# Find latest report directory
LATEST_REPORT=$(find "${ANALYSIS_ROOT}/reports" -maxdepth 1 -type d -name "*-*" | sort -r | head -1)

if [ -z "${LATEST_REPORT}" ]; then
  echo "❌ No report directory found. Run analysis first."
  exit 1
fi

REPORT_DIR="${LATEST_REPORT}"
echo "🔄 Loop-closure for: $(basename "${REPORT_DIR}")"

# Extract metadata from executive summary
if [ ! -f "${REPORT_DIR}/SYN-executive-summary.md" ]; then
  echo "❌ SYN-executive-summary.md not found. Analysis incomplete."
  exit 1
fi

RUN_SHA=$(grep "^run_sha:" "${REPORT_DIR}/SYN-executive-summary.md" | awk '{print $2}')
RUN_TIMESTAMP=$(grep "^timestamp:" "${REPORT_DIR}/SYN-executive-summary.md" | awk '{print $2}')
COMPOSITE_SCORE=$(grep "^composite_score:" "${REPORT_DIR}/SYN-executive-summary.md" | awk '{print $2}')

# Back up existing SYN-next-actions.md if it exists
if [ -f "${REPORT_DIR}/SYN-next-actions.md" ]; then
  BACKUP_PATH="${REPORT_DIR}/SYN-next-actions.md.bak.$(date +%s)"
  cp "${REPORT_DIR}/SYN-next-actions.md" "${BACKUP_PATH}"
  echo "  ✓ Backed up existing SYN-next-actions.md"
fi

# Ensure SYN-next-actions.md exists
if [ ! -f "${REPORT_DIR}/SYN-next-actions.md" ]; then
  echo "⚠️  SYN-next-actions.md missing. Creating placeholder..."
  cat > "${REPORT_DIR}/SYN-next-actions.md" << EOF
---
generated: ${RUN_TIMESTAMP}
from_analysis: ${RUN_SHA}
analysis_version: "2025-01-v1"
stone_code: SYN
composite_score: ${COMPOSITE_SCORE}
---

# Prioritized Action Items

Analysis incomplete. Re-run analysis to generate full action items.
EOF
fi

# Register SYN proofs (idempotent)
register_syn_proof() {
  local FILE="$1"
  local FILENAME=$(basename "${FILE}")

  if [ ! -f "${FILE}" ]; then
    echo "⚠️  ${FILENAME} not found, skipping"
    return 0
  fi

  # Remove existing entries (idempotent)
  grep -v "${FILENAME}" "${REPORT_DIR}/checksums.raw" > "${REPORT_DIR}/checksums.raw.tmp" 2>/dev/null || touch "${REPORT_DIR}/checksums.raw.tmp"
  grep -v "${FILENAME}" "${REPORT_DIR}/checksums.canonical" > "${REPORT_DIR}/checksums.canonical.tmp" 2>/dev/null || touch "${REPORT_DIR}/checksums.canonical.tmp"

  # Compute and append hashes
  local RAW_HASH=$(SHA256 "${FILE}" | awk '{print $1}')
  local CANON_HASH=$(canon_hash "${FILE}")

  echo "${RAW_HASH}  ${FILENAME}" >> "${REPORT_DIR}/checksums.raw.tmp"
  echo "${CANON_HASH}  ${FILENAME}" >> "${REPORT_DIR}/checksums.canonical.tmp"

  mv "${REPORT_DIR}/checksums.raw.tmp" "${REPORT_DIR}/checksums.raw"
  mv "${REPORT_DIR}/checksums.canonical.tmp" "${REPORT_DIR}/checksums.canonical"

  echo "  ✓ ${FILENAME}: ${RAW_HASH:0:16}..."
}

echo "📝 Registering SYN proofs..."
register_syn_proof "${REPORT_DIR}/SYN-executive-summary.md"
register_syn_proof "${REPORT_DIR}/SYN-next-actions.md"

# Build checksums.manifest as sha256sum -c compatible format (raw hashes, deterministically sorted)
echo "📦 Building checksums.manifest..."
sort "${REPORT_DIR}/checksums.raw" > "${REPORT_DIR}/checksums.manifest"

# Also create canonical manifest for reproducibility verification
sort "${REPORT_DIR}/checksums.canonical" > "${REPORT_DIR}/checksums.manifest.canonical"

# Compute manifest hashes (hash of the entire sorted checksum list)
MANIFEST_RAW_HASH=$(SHA256 "${REPORT_DIR}/checksums.manifest" | awk '{print $1}')
MANIFEST_CANON_HASH=$(SHA256 "${REPORT_DIR}/checksums.manifest.canonical" | awk '{print $1}')

echo "  ✓ Manifest raw:       ${MANIFEST_RAW_HASH:0:16}..."
echo "  ✓ Manifest canonical: ${MANIFEST_CANON_HASH:0:16}..."

# Verify manifest with sha256sum -c
echo "🔍 Verifying checksums.manifest..."
cd "${REPORT_DIR}" && SHA256 -c checksums.manifest >/dev/null 2>&1 && echo "  ✓ All checksums verified" || echo "  ⚠️  Verification failed"
cd "${ANALYSIS_ROOT}"

# Append to ledger (idempotent: check if entry exists)
LEDGER_FILE="${ANALYSIS_ROOT}/reports/.analysis-ledger.jsonl"
touch "${LEDGER_FILE}"

# Check if this run already recorded (by run_sha + timestamp)
if grep -q "\"run_sha\":\"${RUN_SHA}\",\"timestamp\":\"${RUN_TIMESTAMP}\"" "${LEDGER_FILE}" 2>/dev/null; then
  echo "📚 Ledger entry already exists for this run, skipping append"
else
  echo "📚 Appending to analysis ledger..."

  # Count files registered
  FILE_COUNT=$(wc -l < "${REPORT_DIR}/checksums.raw" | tr -d ' ')

  # Build JSON line
  cat >> "${LEDGER_FILE}" << LEDGEREOF
{"run_sha":"${RUN_SHA}","timestamp":"${RUN_TIMESTAMP}","version":"2025-01-v1","composite_score":${COMPOSITE_SCORE},"files_registered":${FILE_COUNT},"manifest_hash":"${MANIFEST_RAW_HASH}","manifest_canon_hash":"${MANIFEST_CANON_HASH}"}
LEDGEREOF

  echo "  ✓ Ledger updated"
fi

echo ""
echo "✅ Loop-closure complete!"
echo ""
echo "📊 Summary:"
echo "   Run:       ${RUN_SHA} (${RUN_TIMESTAMP})"
echo "   Score:     ${COMPOSITE_SCORE}/100"
echo "   Files:     $(wc -l < "${REPORT_DIR}/checksums.raw" | tr -d ' ') registered"
echo "   Manifest:  ${MANIFEST_RAW_HASH:0:16}..."
echo "   Ledger:    $(wc -l < "${LEDGER_FILE}" | tr -d ' ') entries"
echo ""
