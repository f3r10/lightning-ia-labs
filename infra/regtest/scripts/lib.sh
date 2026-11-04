#!/usr/bin/env bash
# Shared helpers for the regtest scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/infra/regtest/docker-compose.yml")

btc() { "${COMPOSE[@]}" exec -T bitcoind bitcoin-cli -regtest -rpcuser=regtest -rpcpassword=regtest "$@"; }
miner() { btc -rpcwallet=miner "$@"; }
shop() { "${COMPOSE[@]}" exec -T lnd-shop lncli --network=regtest "$@"; }
customer() { "${COMPOSE[@]}" exec -T lnd-customer lncli --network=regtest "$@"; }

# json_get FIELD: read one field from JSON on stdin. Uses Node.js, so no extra tools are needed.
json_get() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];console.log(v===undefined||v===null?"":v)})' "$1"
}

# wait_for DESCRIPTION TIMEOUT_SECONDS COMMAND...: poll until COMMAND succeeds, or stop with a clear message.
wait_for() {
  local what="$1" timeout="$2"; shift 2
  local start=$SECONDS
  until "$@" >/dev/null 2>&1; do
    if (( SECONDS - start >= timeout )); then
      echo "ERROR: timed out after ${timeout}s waiting for: $what" >&2
      echo "Try: make logs   (to see errors), or: make reset   (to start again)" >&2
      exit 1
    fi
    sleep 1
  done
}

mine() {
  local address
  address="$(miner getnewaddress)"
  miner generatetoaddress "${1:-1}" "$address" >/dev/null
}
