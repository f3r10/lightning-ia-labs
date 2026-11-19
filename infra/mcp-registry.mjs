// Remembers which MCP servers the lab helpers added to which agent, so "just uninstall"
// removes exactly those and nothing else. The file has no secrets and git ignores it.
// It is outside .state/ on purpose: "just reset" must not forget it.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), "..", ".lnlabs", "mcp-added.json");

export function readAdded() {
  if (!existsSync(REGISTRY)) return [];
  try {
    return JSON.parse(readFileSync(REGISTRY, "utf8"));
  } catch {
    return [];
  }
}

export function recordAdded(entry) {
  const list = readAdded().filter((e) => !(e.agent === entry.agent && e.name === entry.name && e.scope === entry.scope));
  list.push({ ...entry, added: new Date().toISOString() });
  mkdirSync(dirname(REGISTRY), { recursive: true });
  writeFileSync(REGISTRY, JSON.stringify(list, null, 2) + "\n");
}

export function forgetAll() {
  rmSync(REGISTRY, { force: true });
}
