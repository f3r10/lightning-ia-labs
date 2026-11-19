#!/usr/bin/env bash
# Watches the lab containers for connections to the internet.
# For SECONDS, it reads each running lnlabs container's TCP table (/proc/net/tcp and tcp6)
# five times a second, and reports every connection to a public address. It only reads.
set -euo pipefail
DUR="${1:-60}"
if ! [[ "$DUR" =~ ^[0-9]+$ ]]; then echo "ERROR: SECONDS must be a whole number. Example: just netwatch 120" >&2; exit 1; fi
# A plain loop, because macOS comes with bash 3.2, which has no "mapfile".
CONTAINERS=()
while IFS= read -r name; do CONTAINERS+=("$name"); done < <(docker ps --format '{{.Names}}' | grep '^lnlabs' || true)
if [ "${#CONTAINERS[@]}" -eq 0 ]; then echo "ERROR: no lab containers are running. Start a lab first, for example: just up-lab1" >&2; exit 1; fi
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
echo "Watching ${#CONTAINERS[@]} containers for $DUR seconds: ${CONTAINERS[*]}"
echo "Use the lab as usual in another terminal."
for c in "${CONTAINERS[@]}"; do
  docker exec "$c" sh -c "end=\$(( \$(date +%s) + $DUR )); while [ \$(date +%s) -lt \$end ]; do cat /proc/net/tcp /proc/net/tcp6 2>/dev/null; sleep 0.2; done" > "$OUT/$c.txt" 2>/dev/null &
done
wait
for c in "${CONTAINERS[@]}"; do
  node -e '
const lines = require("fs").readFileSync(process.argv[1], "utf8").split("\n");
const seen = new Set();
const v4 = (h) => [3, 2, 1, 0].map((i) => parseInt(h.substr(i * 2, 2), 16)).join(".");
for (const l of lines) {
  const f = l.trim().split(/\s+/);
  if (f.length < 4 || !f[2]?.includes(":")) continue;
  const [ip, port] = f[2].split(":");
  if (!["01", "02"].includes(f[3])) continue; // established, or connecting
  let addr;
  if (ip.length === 8) addr = v4(ip);
  else if (ip.startsWith("0000000000000000FFFF0000")) addr = v4(ip.slice(24));
  else addr = "IPv6 " + ip;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(addr) || addr === "IPv6 00000000000000000000000001000000") continue;
  seen.add(`${addr} port ${parseInt(port, 16)}`);
}
console.log(`  ${process.argv[2]}: ${seen.size ? "CONNECTED TO " + [...seen].join(", ") : "no connections to public addresses"}`);
' "$OUT/$c.txt" "$c"
done
