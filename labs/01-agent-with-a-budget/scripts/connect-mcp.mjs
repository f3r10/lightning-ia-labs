// Connects the Alby MCP server to an MCP client, without printing the secret.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readEnv, saveState, STATE_DIR, connectionKey, validName, DEFAULT_NAME, ROOT } from "./common.mjs";
import { recordAdded } from "../../../infra/mcp-registry.mjs";

// The MCP server's name in your agent. Use different names to keep several wallets side by side.
const SERVER_NAME = process.argv[3] || DEFAULT_NAME;
// "user": the agent sees the server in every folder; its settings file is in your home folder.
// "project": only inside this repository; the settings file stays in this folder (git ignores it).
const SCOPE = process.argv[4] || "user";
if (!["user", "project"].includes(SCOPE)) {
  console.error(`ERROR: SCOPE must be "user" or "project", not "${SCOPE}".`);
  process.exit(1);
}
if (!validName(SERVER_NAME)) {
  console.error("ERROR: NAME may only use letters, numbers, - and _. Example: just lab1-mcp codex alby-live");
  process.exit(1);
}
const env = readEnv();
// Use the connection made under this name. If there is none, use the main connection.
const ownConnection = env[connectionKey(SERVER_NAME)];
const CONNECTION = ownConnection || env.NWC_CONNECTION_STRING;
if (!CONNECTION) {
  console.error("ERROR: there is no NWC connection yet. Run: just lab1-connection 1000");
  process.exit(1);
}
if (!ownConnection && SERVER_NAME !== DEFAULT_NAME) {
  console.log(`Note: there is no connection named "${SERVER_NAME}", so this uses the main connection (alby-lab1).`);
}
// Use the "node" found on your PATH (for example /opt/homebrew/bin/node), not the exact
// versioned folder Node.js runs from. That folder disappears when Node.js is updated.
function stableNodePath() {
  try {
    const found = execFileSync("sh", ["-c", "command -v node"], { encoding: "utf8" }).trim();
    if (found) return found;
  } catch {
    // Fall back below.
  }
  return process.execPath;
}
const NODE = stableNodePath();
const require = createRequire(import.meta.url);
const server = join(dirname(require.resolve("@getalby/mcp/package.json")), "build/index.js");
const config = {
  mcpServers: {
    [SERVER_NAME]: {
      command: NODE,
      args: [server],
      env: { NWC_CONNECTION_STRING: CONNECTION },
    },
  },
};

// Always write the file: it holds the exact entry for any MCP client.
const configFile = `mcp-config-${SERVER_NAME}.json`;
saveState(configFile, config);
const configPath = join(STATE_DIR, configFile);

// How each coding agent adds and removes a local (stdio) MCP server, with its own command.
const SECRET = `NWC_CONNECTION_STRING=${CONNECTION}`;
const AGENTS = {
  "claude-code": {
    label: "Claude Code",
    bin: "claude",
    // Claude's project scope is the file .mcp.json in this folder. Claude asks you to approve it.
    scopes: { user: "user", project: "project" },
    remove: (scope) => ["mcp", "remove", "--scope", scope, SERVER_NAME],
    add: (scope) => ["mcp", "add", "--scope", scope, SERVER_NAME, "--env", SECRET, "--", NODE, server],
    check: `claude mcp list   (look for ${SERVER_NAME} ... Connected)`,
  },
  codex: {
    label: "Codex",
    bin: "codex",
    scopes: { user: "user" },
    remove: () => ["mcp", "remove", SERVER_NAME],
    add: () => ["mcp", "add", SERVER_NAME, "--env", SECRET, "--", NODE, server],
    check: `codex mcp list   (look for ${SERVER_NAME}, enabled)`,
  },
  gemini: {
    label: "Gemini CLI",
    bin: "gemini",
    scopes: { user: "user", project: "project" },
    // Not "gemini mcp add": version 0.68.0 cuts an -e value at its second "=", and NWC strings
    // contain "relay=" and "secret=". So this script writes the same entry into settings.json.
    file: (scope) => join(scope === "user" ? homedir() : ROOT, ".gemini", "settings.json"),
    remove: (scope) => ["mcp", "remove", "--scope", scope, SERVER_NAME],
    check: `gemini mcp list   (look for ${SERVER_NAME} ... Connected; if it says Disabled, trust this folder first: see docs/other-agents.md)`,
  },
  grok: {
    label: "Grok Build",
    bin: "grok",
    // Grok starts project-scoped servers only in a folder you trust.
    scopes: { user: "user", project: "project" },
    remove: (scope) => ["mcp", "remove", "--scope", scope, SERVER_NAME],
    add: (scope) => ["mcp", "add", "--scope", scope, "-e", SECRET, SERVER_NAME, NODE, server],
    check: `grok mcp doctor   (look for ${SERVER_NAME}), or: grok mcp list`,
  },
};

const target = process.argv[2];
const agent = AGENTS[target];
if (agent) {
  const scope = agent.scopes[SCOPE];
  if (!scope) {
    console.error(`ERROR: ${agent.label} has no "${SCOPE}" scope in this helper. Use: just lab1-mcp ${target} ${SERVER_NAME} user`);
    process.exit(1);
  }
  // Run the agent's command from the repository folder, so "project" means this folder.
  const run = (args) => execFileSync(agent.bin, args, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
  if (agent.file) {
    writeEntryToFile(agent.file(scope));
  } else {
    try {
      run(agent.remove(scope));
    } catch {
      // Nothing to remove the first time.
    }
    addWithCommand(run, scope);
  }
  const removeCommand = [agent.bin, ...agent.remove(scope)].join(" ");
  // For an entry this helper wrote into a file itself, "just uninstall" also removes it from that file.
  recordAdded({ agent: target, name: SERVER_NAME, scope, remove: removeCommand, ...(agent.file && { file: agent.file(scope) }) });
  console.log(`OK: ${agent.label} now has the MCP server "${SERVER_NAME}" (${scope} scope).`);
  if (scope === "project") console.log("It is saved in this folder only, and git ignores the file. Start your agent from this folder.");
  console.log(`Check it with: ${agent.check}`);
  console.log(`Then restart ${agent.label}, or open a new session, and type /mcp to see its tools.`);
  console.log(`To remove it later: ${removeCommand}   (or: just uninstall)`);
} else if (target === "config") {
  console.log(`OK: the MCP config is in ${configPath}`);
  console.log("That file contains your secret. Do not share it or paste it into a chat.");
} else {
  console.error(`ERROR: unknown agent "${target}". Use one of: ${Object.keys(AGENTS).join(", ")}.`);
  console.error("For any other agent, run: just lab1-mcp-config   and copy the entry into its MCP settings.");
  process.exit(1);
}

// Adds or replaces this server in a JSON settings file, and keeps everything else in it.
function writeEntryToFile(file) {
  let settings = {};
  if (existsSync(file)) {
    try {
      settings = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      console.error(`ERROR: could not read ${file} as plain JSON (it may contain comments). It was not changed.`);
      console.error(`Copy the "${SERVER_NAME}" entry from ${configPath} into its "mcpServers" by hand.`);
      process.exit(1);
    }
    copyFileSync(file, `${file}.bak`);
    console.log(`Note: saved a copy of your old settings in ${file}.bak`);
  }
  settings.mcpServers = { ...settings.mcpServers, ...config.mcpServers };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
}

function addWithCommand(run, scope) {
  try {
    run(agent.add(scope));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`ERROR: could not find the "${agent.bin}" command. Is ${agent.label} installed?`);
    } else {
      // Show the agent's own message, without the secret, which is part of the command line.
      const said = String(error.stderr || error.stdout || error.message).split(CONNECTION).join("<secret>").trim();
      console.error(`ERROR: "${agent.bin} mcp add" failed. It said:\n${said}`);
    }
    console.error(`You can still use the config file: ${configPath}`);
    process.exit(1);
  }
}
