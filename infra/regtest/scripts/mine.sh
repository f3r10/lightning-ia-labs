#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
mine "${1:-1}"
echo "OK: mined ${1:-1} block(s). Height is now $(btc getblockcount)."
