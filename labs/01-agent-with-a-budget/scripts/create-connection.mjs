// Creates an NWC connection with a budget, permissions and a renewal period.
// Usage: node create-connection.mjs [budgetSats] [name] [permissions] [renew]
//   permissions: "all", or a comma list of: pay, invoice, lookup, history, balance, info
//   renew: never, daily, weekly or monthly
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { LNbits } from "../../../infra/lnbits/lnbits-client.mjs";
import { readEnv, setEnv, connectionKey, validName, DEFAULT_NAME } from "./common.mjs";

const ALL_PERMISSIONS = ["pay", "invoice", "lookup", "history", "balance", "info"];
const RENEW_SECONDS = { never: 0, daily: 86400, weekly: 604800, monthly: 2592000 };

const budgetSats = Number(process.argv[2] ?? 1000);
const name = process.argv[3] || DEFAULT_NAME;
const permissionsArg = (process.argv[4] || "all").toLowerCase();
const renew = (process.argv[5] || "never").toLowerCase();

const stop = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};
if (!Number.isInteger(budgetSats) || budgetSats <= 0) stop("the budget must be a whole number of sats. Example: just lab1-connection 1000");
if (!validName(name)) stop("the name may only use letters, numbers, - and _. Example: just lab1-connection 1000 alby-readonly");
const permissions = permissionsArg === "all" ? ALL_PERMISSIONS : permissionsArg.split(",").map((p) => p.trim()).filter(Boolean);
const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
if (permissions.length === 0 || unknown.length) stop(`unknown permission "${unknown.join(", ")}". Use "all" or a comma list of: ${ALL_PERMISSIONS.join(", ")}`);
if (!(renew in RENEW_SECONDS)) stop(`the renewal must be one of: ${Object.keys(RENEW_SECONDS).join(", ")}`);

const env = readEnv();
const lnbits = new LNbits(env.LNBITS_URL);
await lnbits.loginOrInstall(env.LNBITS_ADMIN_USER, env.LNBITS_ADMIN_PASSWORD);
const wallet = await lnbits.findOrCreateWallet("agent-wallet");

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);
const now = Math.floor(Date.now() / 1000);
await lnbits.request("PUT", `/nwcprovider/api/v1/nwc/${pubkey}`, {
  apiKey: wallet.adminkey,
  body: {
    description: `${name}: budget ${budgetSats} sats (${renew}), permissions ${permissions.join(", ")}`,
    expires_at: 0,
    permissions,
    budgets: [{ pubkey, budget_msats: budgetSats * 1000, refresh_window: RENEW_SECONDS[renew], created_at: now }],
  },
});
const { data: pairingUrl } = await lnbits.request("GET", `/nwcprovider/api/v1/pairing/${Buffer.from(secretKey).toString("hex")}`, {
  apiKey: wallet.inkey,
});
setEnv(connectionKey(name), pairingUrl);

console.log(`OK: created the NWC connection "${name}".`);
console.log(`  Budget:      ${budgetSats} sats, renewed: ${renew}`);
console.log(`  Permissions: ${permissions.join(", ")}`);
console.log("The connection string is a secret, so it is saved in labs/01-agent-with-a-budget/.env and not shown here.");
if (name !== DEFAULT_NAME) console.log(`Connect it with: just lab1-mcp-claude-code ${name}   (or, for another agent: just lab1-mcp codex ${name})`);
