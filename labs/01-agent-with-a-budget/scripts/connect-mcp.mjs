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
const require = createRequire(import.meta.url);
const server = join(dirname(require.resolve("@getalby/mcp/package.json")), "build/index.js");
const config = {
  mcpServers: {
    [SERVER_NAME]: {
      command: process.execPath,
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
    run(["mcp", "add", "--scope", "user", SERVER_NAME, "--env", `NWC_CONNECTION_STRING=${env.NWC_CONNECTION_STRING}`, "--", process.execPath, server]);
  } catch (error) {
    console.error(`ERROR: could not run the "claude" command. Is Claude Code installed? ${error.code ?? ""}`);
    console.error(`You can still use the config file: ${configPath}`);
    process.exit(1);
  }
  console.log(`OK: Claude Code now has the MCP server "${SERVER_NAME}".`);
  console.log("Restart Claude Code, then type /mcp to see it.");
  console.log(`To remove it later: claude mcp remove --scope user ${SERVER_NAME}`);
} else {
  console.log(`OK: the MCP config is in ${configPath}`);
  console.log("That file contains your secret. Do not share it or paste it into a chat.");
}
