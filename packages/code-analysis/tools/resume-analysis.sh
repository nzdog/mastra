#!/bin/bash
STATE_FILE="${1:-./analysis-state.yaml}"
if [ ! -f "$STATE_FILE" ]; then
  echo "❌ No state file found. Start fresh analysis."
  exit 1
fi

CURRENT_PHASE=$(grep "current_phase:" "$STATE_FILE" | cut -d'"' -f2)
echo "🔄 Resuming from phase: $CURRENT_PHASE"

case $CURRENT_PHASE in
  "setup")      exec bash ./analyze.sh --phase=integrity ;;
  "integrity")  exec bash ./analyze.sh --phase=empathy ;;
  "empathy")    exec bash ./analyze.sh --phase=rhythm ;;
  "rhythm")     exec bash ./analyze.sh --phase=technical ;;
  "technical")  exec bash ./analyze.sh --phase=synthesis ;;
  *) echo "✓ Analysis already complete or in unknown state" ;;
esac
