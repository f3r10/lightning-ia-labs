// Plays the role of your agent: starts the real Alby MCP server and calls its tools,
// just as a coding agent does. The model is not involved, so the same wallet rules apply.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readEnv, loadState } from "../scripts/common.mjs";

const env = readEnv();
const invoices = loadState("invoices.json");
if (!invoices) {
  console.error("ERROR: no invoices yet. Run: just lab1-invoices");
  process.exit(1);
}
const require = createRequire(import.meta.url);
const server = join(dirname(require.resolve("@getalby/mcp/package.json")), "build/index.js");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [server],
  env: { ...process.env, NWC_CONNECTION_STRING: env.NWC_CONNECTION_STRING },
});
const client = new Client({ name: "lab1-simulated-agent", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name).join(", "));

async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.map((c) => c.text).join(" ");
  console.log(`\n${name} -> ${result.isError ? "REFUSED" : "OK"}\n${text}`);
  return result;
}

await call("get_balance", {});
await call("pay_invoice", { invoice: invoices.small.bolt11 });
await call("pay_invoice", { invoice: invoices.large.bolt11 });
await client.close();
