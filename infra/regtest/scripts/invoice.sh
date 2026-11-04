#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
if [ -z "${1:-}" ]; then
  echo "ERROR: no amount. Example: make invoice AMOUNT=1000" >&2
  exit 1
fi
shop addinvoice --amt "$1" --memo "${2:-make invoice}" | json_get payment_request
