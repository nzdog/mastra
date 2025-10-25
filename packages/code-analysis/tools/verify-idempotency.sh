#!/usr/bin/env bash
# Verify idempotency between two analysis runs

RUN2="reports/97b561c-20251025T045124"
RUN3="reports/97b561c-20251025T045623"

echo "=== IDEMPOTENCY VERIFICATION ==="
echo "Comparing $RUN2 vs $RUN3"
echo ""

for file in INT-integrity-report.md EMP-empathy-report.md RHY-rhythm-report.md TEC-technical-health.json SYN-executive-summary.md SYN-next-actions.md; do
  h2=$(sed -E '/^timestamp:|^Report generated:|^Signed at:|^completed_at:|^started_at:|^generated:|^Content hash:|"timestamp":|"started_at":|"completed_at":/d' "$RUN2/$file" 2>/dev/null | shasum -a 256 | awk '{print $1}')
  h3=$(sed -E '/^timestamp:|^Report generated:|^Signed at:|^completed_at:|^started_at:|^generated:|^Content hash:|"timestamp":|"started_at":|"completed_at":/d' "$RUN3/$file" 2>/dev/null | shasum -a 256 | awk '{print $1}')

  if [ "$h2" = "$h3" ]; then
    echo "✅  $file"
    echo "    $h2"
  else
    echo "❌  $file"
    echo "    RUN2: $h2"
    echo "    RUN3: $h3"
  fi
done

echo ""
echo "=== LEDGER VERIFICATION ==="
cat reports/.analysis-ledger.jsonl | jq -r '.run_sha + " @ " + .timestamp + " = " + (.composite_score|tostring) + "/100"'
