// Connects the Alby MCP server to an MCP client, without printing the secret.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readEnv, saveState, STATE_DIR } from "./common.mjs";

const SERVER_NAME = "alby-lab1";
const env = readEnv();
if (!env.NWC_CONNECTION_STRING) {
  console.error("ERROR: there is no NWC connection yet. Run: make lab1-connection BUDGET=1000");
  process.exit(1);
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
      env: { NWC_CONNECTION_STRING: env.NWC_CONNECTION_STRING },
    },
  },
};

// Always write the file: it holds the exact entry for any MCP client.
saveState("mcp-config.json", config);
const configPath = join(STATE_DIR, "mcp-config.json");

if (process.argv[2] === "claude-code") {
  const run = (args) => execFileSync("claude", args, { stdio: "pipe", encoding: "utf8" });
  try {
    run(["mcp", "remove", "--scope", "user", SERVER_NAME]);
  } catch {
    // Nothing to remove the first time.
  }
  try {
    run(["mcp", "add", "--scope", "user", SERVER_NAME, "--env", `NWC_CONNECTION_STRING=${env.NWC_CONNECTION_STRING}`, "--", NODE, server]);
  } catch (error) {
    console.error(`ERROR: could not run the "claude" command. Is Claude Code installed? ${error.code ?? ""}`);
    console.error(`You can still use the config file: ${configPath}`);
    process.exit(1);
  }
  console.log(`OK: Claude Code now has the MCP server "${SERVER_NAME}".`);
  console.log("Check it with: claude mcp list   (look for alby-lab1 ... Connected)");
  console.log("Then restart Claude Code, or open a new session, and type /mcp to see its tools.");
  console.log(`To remove it later: claude mcp remove --scope user ${SERVER_NAME}`);
} else {
  console.log(`OK: the MCP config is in ${configPath}`);
  console.log("That file contains your secret. Do not share it or paste it into a chat.");
}
