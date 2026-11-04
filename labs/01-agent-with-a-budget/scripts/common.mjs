import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync, chmodSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LAB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = join(LAB_DIR, "..", "..");
const ENV_PATH = join(LAB_DIR, ".env");
export const STATE_DIR = join(LAB_DIR, ".state");

export function readEnv() {
  if (!existsSync(ENV_PATH)) {
    copyFileSync(join(LAB_DIR, ".env.example"), ENV_PATH);
    chmodSync(ENV_PATH, 0o600);
    setEnv("LNBITS_ADMIN_PASSWORD", randomBytes(12).toString("hex"));
    setEnv("NWC_CONNECTION_STRING", "");
  }
  const env = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export function setEnv(key, value) {
  const lines = readFileSync(ENV_PATH, "utf8").split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(ENV_PATH, lines.join("\n"), { mode: 0o600 });
}

// Run lncli on one of the regtest nodes and return its JSON answer.
export function lncli(node, ...args) {
  const output = execFileSync(
    "docker",
    ["compose", "-f", join(ROOT, "infra/regtest/docker-compose.yml"), "exec", "-T", node, "lncli", "--network=regtest", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(output);
}

export function saveState(name, value) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, name), JSON.stringify(value, null, 2), { mode: 0o600 });
}

export function loadState(name) {
  const path = join(STATE_DIR, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

export async function pollUntil(description, timeoutSeconds, fn) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out after ${timeoutSeconds}s waiting for ${description}.${last ? ` Last error: ${last.message}` : ""}`);
}
