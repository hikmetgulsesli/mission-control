#!/bin/bash
# Unstick a stuck antfarm workflow run via Mission Control API
# Usage: unstick.sh <run-id> [step-id]

MC_URL="${MC_URL:-http://127.0.0.1:3080}"
RUN_ID="$1"
STEP_ID="$2"

if [ -z "$RUN_ID" ]; then
  echo "Usage: unstick.sh <run-id> [step-id]"
  echo ""
  echo "List stuck runs:"
  curl -s "$MC_URL/api/runs/stuck" | jq .
  exit 1
fi

BODY='{}'
if [ -n "$STEP_ID" ]; then
  BODY="{\"stepId\":\"$STEP_ID\"}"
fi

echo "Unsticking run $RUN_ID..."
curl -s -X POST "$MC_URL/api/runs/$RUN_ID/unstick" \
  -H "Content-Type: application/json" \
  -d "$BODY" | jq .
