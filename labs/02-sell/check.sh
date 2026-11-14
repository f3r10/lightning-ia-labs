#!/usr/bin/env bash
# Tells you, in plain English, whether Lab 2a worked.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "Lab 2 is not started yet. Run: just up-lab2"
  exit 1
fi
exec node scripts/check.mjs
