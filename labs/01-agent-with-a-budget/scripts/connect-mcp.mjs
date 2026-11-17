// Connects the Alby MCP server to an MCP client, without printing the secret.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readEnv, saveState, STATE_DIR, connectionKey, validName, DEFAULT_NAME } from "./common.mjs";

// The MCP server's name in your agent. Use different names to keep several wallets side by side.
const SERVER_NAME = process.argv[3] || DEFAULT_NAME;
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
// "user" scope: the server is available in every folder, not only in this repository.
const SECRET = `NWC_CONNECTION_STRING=${CONNECTION}`;
const AGENTS = {
  "claude-code": {
    label: "Claude Code",
    bin: "claude",
    remove: ["mcp", "remove", "--scope", "user", SERVER_NAME],
    add: ["mcp", "add", "--scope", "user", SERVER_NAME, "--env", SECRET, "--", NODE, server],
    check: `claude mcp list   (look for ${SERVER_NAME} ... Connected)`,
  },
  codex: {
    label: "Codex",
    bin: "codex",
    remove: ["mcp", "remove", SERVER_NAME],
    add: ["mcp", "add", SERVER_NAME, "--env", SECRET, "--", NODE, server],
    check: `codex mcp list   (look for ${SERVER_NAME}, enabled)`,
  },
  gemini: {
    label: "Gemini CLI",
    bin: "gemini",
    // Not "gemini mcp add": version 0.68.0 cuts an -e value at its second "=", and NWC strings
    // contain "relay=" and "secret=". So this script writes the same entry into settings.json.
    file: join(homedir(), ".gemini", "settings.json"),
    remove: ["mcp", "remove", "--scope", "user", SERVER_NAME],
    check: `gemini mcp list   (look for ${SERVER_NAME} ... Connected; if it says Disabled, trust this folder first: see the guide for other agents)`,
  },
  grok: {
    label: "Grok Build",
    bin: "grok",
    remove: ["mcp", "remove", "--scope", "user", SERVER_NAME],
    add: ["mcp", "add", "--scope", "user", "-e", SECRET, SERVER_NAME, NODE, server],
    check: `grok mcp doctor   (look for ${SERVER_NAME}), or: grok mcp list`,
  },
};

const target = process.argv[2];
const agent = AGENTS[target];
if (agent) {
  const run = (args) => execFileSync(agent.bin, args, { stdio: "pipe", encoding: "utf8" });
  if (agent.file) {
    writeEntryToFile(agent.file);
  } else {
    try {
      run(agent.remove);
    } catch {
      // Nothing to remove the first time.
    }
    addWithCommand(run);
  }
  const removeCommand = [agent.bin, ...agent.remove].join(" ");
  console.log(`OK: ${agent.label} now has the MCP server "${SERVER_NAME}".`);
  console.log(`Check it with: ${agent.check}`);
  console.log(`Then restart ${agent.label}, or open a new session, and type /mcp to see its tools.`);
  console.log(`To remove it later: ${removeCommand}`);
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

function addWithCommand(run) {
  try {
    run(agent.add);
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
