#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
if [ -z "${1:-}" ]; then
  echo "ERROR: no invoice. Example: just pay lnbcrt..." >&2
  exit 1
fi
RESULT="$(customer payinvoice --force --json "$1" 2>&1)" || { echo "ERROR: the payment failed: $RESULT" >&2; exit 1; }
STATUS="$(echo "$RESULT" | json_get status)"
if [ "$STATUS" != "SUCCEEDED" ]; then
  echo "ERROR: the payment did not succeed. Status: $STATUS" >&2
  exit 1
fi
echo "OK: paid. Preimage (the proof of payment): $(echo "$RESULT" | json_get payment_preimage)"
