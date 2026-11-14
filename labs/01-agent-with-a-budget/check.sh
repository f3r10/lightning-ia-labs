#!/usr/bin/env bash
# Tells you, in plain English, whether Lab 1 worked.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Lab 1 is not started yet. Run: just up-lab1"
  exit 1
fi
exec node scripts/check.mjs
