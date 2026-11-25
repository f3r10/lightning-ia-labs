// Transparency tools: what the labs need, what they would download, and how to remove it all.
//   node infra/tools.mjs doctor              read-only: what is installed, free disk, busy ports
//   node infra/tools.mjs plan LAB            read-only: what "just up-LAB" would download and write
//   node infra/tools.mjs uninstall [yes]     without "yes", only shows what it would remove
//   node infra/tools.mjs inventory [--check] writes the generated part of docs/what-gets-installed.md
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statfsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readAdded, forgetAll, REGISTRY } from "./mcp-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => relative(ROOT, p) || ".";

// ---- What each lab uses. Everything else is read from the compose files and lockfiles. ----

const COMPOSE = {
  regtest: "infra/regtest/docker-compose.yml",
  lab1: "labs/01-agent-with-a-budget/docker-compose.yml",
  lab2: "labs/02-sell/docker-compose.yml",
};

const LABS = {
  regtest: {
    title: "Shared regtest stack (just up)",
    compose: ["regtest"],
    npm: [],
    writes: ["Docker volumes lnlabs-bitcoind, lnlabs-lnd-shop, lnlabs-lnd-customer, lnlabs-relay"],
    hosts: ["Docker Hub (registry-1.docker.io), only to download the images"],
    accounts: [],
  },
  lab1: {
    title: "Lab 1: Agent with a budget (just up-lab1)",
    compose: ["regtest", "lab1"],
    npm: ["labs/01-agent-with-a-budget"],
    writes: [
      "labs/01-agent-with-a-budget/.env and .state/ (your local test secrets)",
      "labs/01-agent-with-a-budget/node_modules/",
      "Docker volume lnlabs-lnbits-agent",
      "Only when you run just lab1-mcp: one MCP entry in your agent's settings (user scope: in your home folder; project scope: in this folder)",
    ],
    hosts: [
      "Docker Hub, to download the images",
      "the npm registry (registry.npmjs.org), to download the packages",
      "github.com, once during setup, for the LNbits extension nwcprovider 1.1.3 (exact release archive)",
    ],
    accounts: [],
  },
  lab2: {
    title: "Lab 2a: Sell with LNbits (just up-lab2)",
    compose: ["regtest", "lab2"],
    npm: ["labs/02-sell/solution/store"],
    writes: [
      "labs/02-sell/.env",
      "Docker volume lnlabs-lnbits-shop",
      "LNbits extensions tpos, events, inventory and orders, downloaded from GitHub into that volume",
      "Only when you run just lab2-solution: labs/02-sell/solution/store/node_modules/ (the QR code package)",
      "Only if your agent installs packages for your store: labs/02-sell/my-store/node_modules/",
    ],
    hosts: [
      "Docker Hub, to download the images",
      "github.com, once during setup, for the four LNbits extensions (exact release archives)",
      "the npm registry, only when you run just lab2-solution, or when your agent installs a package",
    ],
    accounts: [],
  },
  lab2b: {
    title: "Lab 2b: Sell with moneydevkit (optional)",
    compose: [],
    npm: ["labs/02-sell/solution/mdk-store"],
    writes: ["your own my-store folder, outside this repository", "my-store/.env.local, with your moneydevkit secrets"],
    hosts: ["the npm registry", "moneydevkit (moneydevkit.com) and its Lightning service provider, on mainnet", "Vercel"],
    accounts: ["Vercel (free account)", "moneydevkit (free account)"],
    npx: ["create-next-app@16.4.5", "vercel@65.12.1", "@moneydevkit/create@0.22.0"],
  },
};

// Who publishes each image, and where its source is. Checked on 2026-11-19.
const IMAGE_INFO = {
  "bitcoin/bitcoin": {
    who: "Unofficial: built by CI in willcl-ark/bitcoin-core-docker, not by the Bitcoin Core project. Its Debian images use Bitcoin Core's release binaries, checked against guix.sigs during the build.",
    source: "https://github.com/willcl-ark/bitcoin-core-docker",
  },
  "lightninglabs/lnd": { who: "Official, by Lightning Labs.", source: "https://github.com/lightningnetwork/lnd" },
  "dockurr/strfry": {
    who: "Third party: dockur builds it from source in CI. Not by strfry's author (hoytech).",
    source: "https://github.com/dockur/strfry (upstream: https://github.com/hoytech/strfry)",
  },
  "lnbits/lnbits": { who: "Official, by LNbits.", source: "https://github.com/lnbits/lnbits" },
  node: { who: "Docker Official Image.", source: "https://github.com/nodejs/docker-node" },
};

const OVERRIDE = {
  "bitcoin/bitcoin": "LNLABS_BITCOIND_IMAGE",
  "lightninglabs/lnd": "LNLABS_LND_IMAGE",
  "dockurr/strfry": "LNLABS_RELAY_IMAGE",
  "lnbits/lnbits": "LNLABS_LNBITS_IMAGE",
  node: "LNLABS_NODE_IMAGE",
};

// ---- Helpers ----

function run(cmd, args, options = {}) {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
  } catch {
    return null;
  }
}

// Like run(), but throws with the command's own message, so uninstall can report it.
function runOrThrow(cmd, args, options = {}) {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  } catch (error) {
    const said = String(error.stderr || error.message).trim().split("\n").slice(-2).join(" ");
    throw new Error(`"${cmd} ${args.join(" ")}" failed: ${said}`);
  }
}

// Removes one server from a JSON settings file that a lab helper wrote, and keeps the rest.
function removeFromSettingsFile(file, name) {
  if (!existsSync(file)) return;
  const settings = JSON.parse(readFileSync(file, "utf8"));
  if (!settings.mcpServers?.[name]) return;
  delete settings.mcpServers[name];
  writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
}

function composeConfig(name) {
  const args = ["compose", "-f", join(ROOT, COMPOSE[name]), "--profile", "solution", "config", "--format", "json"];
  // Lab 2's reference store needs this value only to render the file, not to run.
  const out = run("docker", args, { env: { ...process.env, LNBITS_INVOICE_KEY: process.env.LNBITS_INVOICE_KEY || "x" } });
  return out ? JSON.parse(out) : null;
}

function imagesOf(name) {
  const config = composeConfig(name);
  if (!config) return [];
  return Object.entries(config.services).map(([service, s]) => ({ service, ref: s.image, ports: s.ports || [] }));
}

// Default image references, read from the files (not from any LNLABS_*_IMAGE you set).
function pinnedImages(names) {
  const seen = new Map();
  for (const name of names) {
    const text = readFileSync(join(ROOT, COMPOSE[name]), "utf8");
    for (const m of text.matchAll(/image: \$\{(LNLABS_[A-Z_]+):-([^}]+)\}/g)) {
      const ref = m[2];
      if (!seen.has(ref)) seen.set(ref, { ref, variable: m[1], repo: ref.split(":")[0] });
    }
  }
  return [...seen.values()];
}

function lockSummary(dir) {
  const lock = JSON.parse(readFileSync(join(ROOT, dir, "package-lock.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"));
  const entries = Object.entries(lock.packages).filter(([k]) => k);
  const withScripts = entries.filter(([, v]) => v.hasInstallScript).map(([k]) => k.replace(/^.*node_modules\//, ""));
  const npmrc = join(ROOT, dir, ".npmrc");
  const scriptsOff = existsSync(npmrc) && /^ignore-scripts\s*=\s*true$/m.test(readFileSync(npmrc, "utf8"));
  return {
    dir,
    count: entries.length,
    direct: { ...pkg.dependencies, ...pkg.devDependencies },
    withScripts,
    scriptsOff,
  };
}

function imageSizeMB(ref) {
  const arch = { aarch64: "arm64", x86_64: "amd64" }[run("docker", ["info", "--format", "{{.Architecture}}"])] || "amd64";
  const out = run("docker", ["manifest", "inspect", "-v", ref]);
  if (!out) return null;
  const list = [].concat(JSON.parse(out));
  const match = list.find((m) => m.Descriptor?.platform?.architecture === arch) || list[0];
  const layers = (match.SchemaV2Manifest || match.OCIManifest || {}).layers || [];
  return layers.reduce((sum, l) => sum + l.size, 0) / 1e6;
}

const imagePresent = (ref) => run("docker", ["image", "inspect", ref, "--format", "{{.Id}}"]) !== null;
const ok = (s) => console.log(`  OK    ${s}`);
const note = (s) => console.log(`  NOTE  ${s}`);
const bad = (s) => console.log(`  MISSING  ${s}`);

// ---- doctor: read-only ----

function doctor() {
  console.log("Doctor: this only reads. It installs and changes nothing.\n");
  console.log("Tools you need:");
  const need = [
    ["docker", ["--version"]],
    ["git", ["--version"]],
    ["node", ["--version"]],
    ["just", ["--version"]],
  ];
  for (const [cmd, args] of need) {
    const v = run(cmd, args);
    v ? ok(`${cmd}: ${v.split("\n")[0]}`) : bad(`${cmd}: not found`);
  }
  const compose = run("docker", ["compose", "version", "--short"]);
  compose ? ok(`docker compose: ${compose}`) : bad("docker compose v2: not found");
  run("docker", ["info", "--format", "{{.ServerVersion}}"]) ? ok("the Docker daemon is running") : bad("the Docker daemon is not running. Start Docker Desktop or the Docker service.");
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 22) bad(`Node.js ${process.versions.node} is too old. The labs need Node.js 22 or newer.`);

  console.log("\nCoding agents (you need one):");
  for (const [cmd, label] of [["claude", "Claude Code"], ["codex", "Codex CLI"], ["gemini", "Gemini CLI"], ["grok", "Grok Build"]]) {
    const v = run(cmd, ["--version"]);
    v ? ok(`${label}: ${v.split("\n")[0]}`) : note(`${label}: not installed`);
  }

  console.log("\nDisk:");
  const fs = statfsSync(ROOT);
  const freeGB = (fs.bavail * fs.bsize) / 1e9;
  (freeGB > 5 ? ok : note)(`${freeGB.toFixed(1)} GB free on this disk. The Lab 1 and Lab 2 images take about 600 MB, plus a little test data.`);

  console.log("\nImages (pinned by digest):");
  for (const img of pinnedImages(Object.keys(COMPOSE))) {
    (imagePresent(img.ref) ? ok : note)(`${img.ref.replace(/@sha256:(.{12}).*/, "@sha256:$1...")} ${imagePresent(img.ref) ? "is downloaded" : "is not downloaded yet"}`);
  }

  console.log("\nPorts the labs use (all on 127.0.0.1 only):");
  const ours = run("docker", ["ps", "--format", "{{.Names}} {{.Ports}}"]) || "";
  for (const name of Object.keys(COMPOSE)) {
    for (const { service, ports } of imagesOf(name)) {
      for (const p of ports) {
        const busy = run("lsof", ["-nP", `-iTCP:${p.published}`, "-sTCP:LISTEN"]);
        const byLab = ours.split("\n").some((l) => l.startsWith("lnlabs") && l.includes(`:${p.published}->`));
        if (!busy) ok(`${p.published} is free (for ${service})`);
        else if (byLab) ok(`${p.published} is used by this lab's ${service}`);
        else note(`${p.published} is used by another program. ${service} needs it.`);
      }
    }
  }

  console.log("\nLocal data from the labs:");
  const volumes = (run("docker", ["volume", "ls", "--format", "{{.Name}}"]) || "").split("\n").filter((v) => v.startsWith("lnlabs-"));
  volumes.length ? note(`Docker volumes: ${volumes.join(", ")}`) : ok("no Docker volumes yet");
  const added = readAdded();
  added.length ? note(`MCP servers added to agents: ${added.map((a) => `${a.name} (${a.agent}, ${a.scope})`).join(", ")}`) : ok("no MCP servers added to any agent");
}

// ---- plan: read-only ----

function plan(lab) {
  const spec = LABS[lab];
  if (!spec) {
    console.error(`ERROR: unknown lab "${lab}". Use one of: ${Object.keys(LABS).join(", ")}`);
    process.exit(1);
  }
  console.log(`Plan for ${spec.title}. This only reads; nothing is downloaded.\n`);
  const images = pinnedImages(spec.compose);
  if (images.length) {
    console.log("Docker images (asking Docker Hub for their sizes, a few seconds each):");
    let total = 0;
    for (const img of images) {
      const present = imagePresent(img.ref);
      const size = present ? null : imageSizeMB(img.ref);
      if (size) total += size;
      const onDisk = present ? Number(run("docker", ["image", "inspect", img.ref, "--format", "{{.Size}}"])) / 1e6 : 0;
      const what = present ? `already downloaded (${onDisk.toFixed(0)} MB on disk)` : size ? `${size.toFixed(0)} MB to download (compressed)` : "size unknown";
      console.log(`  ${img.ref.split("@")[0].padEnd(36)} ${what}`);
    }
    if (total) console.log(`  Total to download: about ${total.toFixed(0)} MB`);
  }
  for (const dir of spec.npm) {
    const s = lockSummary(dir);
    console.log(`\nnpm packages in ${dir}: ${s.count} in total, exact versions from package-lock.json.`);
    if (lab === "lab2b") console.log("  This is the reference solution. Your own my-store gets a similar set from create-next-app and your agent.");
    console.log(`  Direct: ${Object.entries(s.direct).map(([k, v]) => `${k}@${v}`).join(", ")}`);
    console.log(`  Install scripts: ${s.scriptsOff ? "turned off (.npmrc has ignore-scripts=true)" : "allowed"}. Packages that have one: ${s.withScripts.join(", ") || "none"}`);
  }
  if (spec.npx) console.log(`\nTools run with npx (exact versions): ${spec.npx.join(", ")}`);
  console.log("\nIt writes:");
  for (const w of spec.writes) console.log(`  - ${w}`);
  console.log("\nIt connects to:");
  for (const h of spec.hosts) console.log(`  - ${h}`);
  if (spec.accounts.length) {
    console.log("\nAccounts you need:");
    for (const a of spec.accounts) console.log(`  - ${a}`);
  }
  console.log("\nTo read the exact commands first: just --show up   (or any other recipe name)");
}

// ---- uninstall: shows the plan unless confirmed ----

function uninstall(confirm) {
  const doIt = confirm === "yes";
  console.log(doIt ? "Uninstalling.\n" : "Uninstall plan. Nothing is removed yet. To do it, run: just uninstall yes\n");
  const steps = [];

  for (const name of Object.keys(COMPOSE).reverse()) {
    steps.push({
      what: `Stop the containers of ${COMPOSE[name]} and delete their Docker volumes`,
      do: () => runOrThrow("docker", ["compose", "-f", join(ROOT, COMPOSE[name]), "--profile", "solution", "down", "-v", "--remove-orphans"], { env: { ...process.env, LNBITS_INVOICE_KEY: "x" } }),
    });
  }
  for (const img of pinnedImages(Object.keys(COMPOSE))) {
    if (!imagePresent(img.ref)) continue;
    steps.push({ what: `Delete the image ${img.ref.split("@")[0]}`, do: () => runOrThrow("docker", ["image", "rm", img.ref]) });
  }
  for (const dir of ["labs/01-agent-with-a-budget/node_modules", "labs/02-sell/solution/store/node_modules", "labs/02-sell/solution/mdk-store/node_modules"]) {
    if (existsSync(join(ROOT, dir))) steps.push({ what: `Delete ${dir}`, do: () => rmSync(join(ROOT, dir), { recursive: true, force: true }) });
  }
  for (const a of readAdded()) {
    steps.push({
      what: `Remove the MCP server "${a.name}" from ${a.agent} (${a.scope} scope): ${a.file ? `delete it from ${a.file}` : a.remove}`,
      do: () => {
        if (a.file) return removeFromSettingsFile(a.file, a.name);
        const [cmd, ...args] = a.remove.split(" ");
        runOrThrow(cmd, args);
      },
    });
  }
  for (const f of ["labs/01-agent-with-a-budget/.env", "labs/01-agent-with-a-budget/.state", "labs/02-sell/.env"]) {
    if (existsSync(join(ROOT, f))) steps.push({ what: `Delete ${f}`, do: () => rmSync(join(ROOT, f), { recursive: true, force: true }) });
  }
  if (existsSync(dirname(REGISTRY))) {
    steps.push({ what: `Delete ${rel(dirname(REGISTRY))}/`, do: () => { forgetAll(); rmSync(dirname(REGISTRY), { recursive: true, force: true }); } });
  }

  const failed = [];
  for (const s of steps) {
    console.log(`  - ${s.what}`);
    if (!doIt) continue;
    try {
      s.do();
    } catch (error) {
      console.log(`    FAILED: ${error.message}`);
      failed.push(s.what);
    }
  }

  console.log("\nNot removed (you installed these yourself, or they are yours):");
  const kept = [
    "Docker, git, Node.js, just and your coding agent",
    `the npm download cache (${join(homedir(), ".npm")}), and Docker's build cache`,
    "copies like settings.json.bak that the helpers made of your agent settings",
    "your own code, for example labs/02-sell/my-store or your Lab 2b my-store folder",
    "accounts you created: Vercel, moneydevkit, Breez",
    "this repository folder. Delete it yourself when you are done.",
  ];
  for (const k of kept) console.log(`  - ${k}`);
  if (doIt && failed.length) {
    console.log(`\nFAIL: ${failed.length} step(s) did not work. Read the messages above, fix the cause, and run just uninstall yes again.`);
    process.exit(1);
  }
  if (doIt) console.log("\nOK: uninstalled.");
}

// ---- inventory: the generated part of docs/what-gets-installed.md ----

function inventory(check) {
  const lines = [];
  lines.push("### Docker images", "");
  lines.push("Each image is pinned by tag and digest. Docker refuses an image whose content does not match the digest.", "");
  lines.push("| Image | Pinned reference | Who publishes it | Source | Replace it with |", "| --- | --- | --- | --- | --- |");
  for (const img of pinnedImages(Object.keys(COMPOSE))) {
    const info = IMAGE_INFO[img.repo] || { who: "?", source: "?" };
    lines.push(`| \`${img.repo}\` | \`${img.ref}\` | ${info.who} | ${info.source} | \`${img.variable}\` |`);
  }
  lines.push("", "### Ports", "");
  lines.push("Every port listens on 127.0.0.1 only, so other computers cannot reach it.", "");
  lines.push("| Port | Service | Lab |", "| --- | --- | --- |");
  for (const name of Object.keys(COMPOSE)) {
    for (const { service, ports } of imagesOf(name)) {
      for (const p of ports) lines.push(`| ${p.host_ip}:${p.published} | ${service} | ${name} |`);
    }
  }
  lines.push("", "### npm packages", "");
  for (const dir of ["labs/01-agent-with-a-budget", "labs/02-sell/solution/store", "labs/02-sell/solution/mdk-store"]) {
    const s = lockSummary(dir);
    lines.push(`**${dir}**: ${s.count} packages, exact versions and integrity hashes in \`package-lock.json\`.`, "");
    lines.push(`- Direct dependencies: ${Object.entries(s.direct).map(([k, v]) => `\`${k}@${v}\``).join(", ")}`);
    lines.push(`- Install scripts: ${s.scriptsOff ? "turned off by `.npmrc` (`ignore-scripts=true`)" : "allowed"}. Packages that have one: ${s.withScripts.map((x) => `\`${x}\``).join(", ") || "none"}.`, "");
  }
  lines.push("### Per lab", "");
  for (const spec of Object.values(LABS)) {
    lines.push(`**${spec.title}**`, "");
    lines.push(`- Writes: ${spec.writes.join("; ")}.`);
    lines.push(`- Connects to: ${spec.hosts.join("; ")}.`);
    if (spec.npx) lines.push(`- Runs with npx: ${spec.npx.map((x) => `\`${x}\``).join(", ")}.`);
    lines.push(`- Accounts: ${spec.accounts.join("; ") || "none"}.`, "");
  }

  const file = join(ROOT, "docs/what-gets-installed.md");
  const text = readFileSync(file, "utf8");
  const start = "<!-- inventory:start (generated by: just inventory) -->";
  const end = "<!-- inventory:end -->";
  const before = text.slice(0, text.indexOf(start) + start.length);
  const after = text.slice(text.indexOf(end));
  if (text.indexOf(start) < 0 || text.indexOf(end) < 0) {
    console.error("ERROR: docs/what-gets-installed.md has no inventory markers.");
    process.exit(1);
  }
  const next = `${before}\n\n${lines.join("\n")}\n${after}`;
  if (check) {
    if (next !== text) {
      console.error("FAIL: docs/what-gets-installed.md is out of date. Run: just inventory");
      process.exit(1);
    }
    console.log("OK: docs/what-gets-installed.md matches the compose files and lockfiles.");
  } else {
    writeFileSync(file, next);
    console.log("OK: updated docs/what-gets-installed.md");
  }
}

const [command, arg] = process.argv.slice(2);
if (command === "doctor") doctor();
else if (command === "plan") plan(arg || "lab1");
else if (command === "uninstall") uninstall(arg);
else if (command === "inventory") inventory(arg === "--check");
else {
  console.error("Usage: node infra/tools.mjs doctor | plan LAB | uninstall [yes] | inventory [--check]");
  process.exit(1);
}
