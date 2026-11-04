// Helpers shared by the lab scripts. They use only Node.js built-ins.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync, chmodSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Run lncli on one of the regtest nodes and return its JSON answer.
export function lncli(node, ...args) {
  const output = execFileSync(
    "docker",
    ["compose", "-f", join(ROOT, "infra/regtest/docker-compose.yml"), "exec", "-T", node, "lncli", "--network=regtest", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(output);
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

// Tools for one lab folder: its .env file and its .state folder.
export function labFiles(labDir) {
  const envPath = join(labDir, ".env");
  const stateDir = join(labDir, ".state");

  function setEnv(key, value) {
    const lines = readFileSync(envPath, "utf8").split("\n");
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    writeFileSync(envPath, lines.join("\n"), { mode: 0o600 });
  }

  // Creates .env from .env.example the first time, with a new random password.
  function readEnv() {
    if (!existsSync(envPath)) {
      copyFileSync(join(labDir, ".env.example"), envPath);
      chmodSync(envPath, 0o600);
      setEnv("LNBITS_ADMIN_PASSWORD", randomBytes(12).toString("hex"));
    }
    const env = {};
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2];
    }
    return env;
  }

  function saveState(name, value) {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, name), JSON.stringify(value, null, 2), { mode: 0o600 });
  }

  function loadState(name) {
    const path = join(stateDir, name);
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  }

  return { envPath, stateDir, readEnv, setEnv, saveState, loadState };
}

// Prints PASS and FAIL lines in the same style for every lab.
export function reporter(labName, successMessage) {
  let failures = 0;
  return {
    pass: (message) => console.log(`  PASS  ${message}`),
    fail: (message, fix) => {
      failures += 1;
      console.log(`  FAIL  ${message}\n        What to do: ${fix}`);
    },
    finish: () => {
      console.log("");
      if (failures === 0) {
        console.log(`RESULT: ${labName} passed. ${successMessage}`);
        process.exit(0);
      }
      console.log(`RESULT: ${labName} is not finished yet. ${failures} check(s) failed.`);
      process.exit(1);
    },
  };
}
