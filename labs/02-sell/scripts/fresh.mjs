// Start Lab 2a again from an empty my-store folder.
// It stops your store (only if it runs from my-store), and moves my-store to old-stores/.
// It deletes nothing.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(LAB, "my-store");
const OLD = path.join(LAB, "old-stores");
const PORT = 3002;

function run(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}

// 1. Stop the store that listens on port 3002, if it runs from my-store.
const hasLsof = run("sh", ["-c", "command -v lsof"]).trim() !== "";
if (!hasLsof) console.log(`lsof is not installed, so this could not check port ${PORT}. Stop your store yourself if it is running.`);
const pids = hasLsof ? run("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"]).split("\n").filter(Boolean) : [];
for (const pid of new Set(pids)) {
  // The process's working folder ("cwd") tells us where it was started.
  const cwd = run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]).split("\n").find((l) => l.startsWith("n"))?.slice(1);
  if (cwd && (cwd === STORE || cwd.startsWith(STORE + path.sep))) {
    process.kill(Number(pid), "SIGTERM");
    console.log(`Stopped your store (process ${pid}) on port ${PORT}.`);
  } else {
    console.log(`Port ${PORT} is used by process ${pid}, which does not run from my-store. Left it running.`);
    console.log("  If it is the reference store, run: just down-lab2");
  }
}

// 2. Move my-store out of the way.
if (!fs.existsSync(STORE)) {
  console.log("There is no my-store folder. You can start with Prompt 1.");
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const target = path.join(OLD, `my-store-${stamp}`);
fs.mkdirSync(OLD, { recursive: true });
fs.renameSync(STORE, target);
console.log(`Moved your store to ${path.relative(process.cwd(), target)}`);
console.log("OK: my-store is empty now. Start again with Prompt 1 of Lab 2.");
console.log("  Nothing was deleted. To delete the old stores: rm -rf labs/02-sell/old-stores");
