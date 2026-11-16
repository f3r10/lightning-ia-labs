#!/usr/bin/env bash
# Show what an invoice asks for: amount, description, expiry and payment hash.
source "$(dirname "$0")/lib.sh"
if [ -z "${1:-}" ]; then
  echo "ERROR: no invoice. Example: just decode lnbcrt..." >&2
  exit 1
fi
RESULT="$(customer decodepayreq "$1" 2>&1)" || { echo "ERROR: this is not a valid regtest invoice: $RESULT" >&2; exit 1; }
echo "$RESULT" | node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const r = JSON.parse(s);
  const created = Number(r.timestamp), expiry = Number(r.expiry);
  const left = created + expiry - Math.floor(Date.now() / 1000);
  console.log(`Amount:       ${r.num_satoshis} sats`);
  console.log(`Description:  ${r.description || "(none)"}`);
  console.log(`Created:      ${new Date(created * 1000).toISOString()}`);
  console.log(`Expires in:   ${expiry} seconds after creation (${left > 0 ? left + " seconds left" : "EXPIRED"})`);
  console.log(`Payment hash: ${r.payment_hash}`);
});'
