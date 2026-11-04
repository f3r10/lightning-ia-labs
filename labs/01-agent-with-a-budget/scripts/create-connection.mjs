// Creates an NWC connection with a spending budget. Usage: node create-connection.mjs [budgetSats]
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { LNbits } from "../../../infra/lnbits/lnbits-client.mjs";
import { readEnv, setEnv } from "./common.mjs";

const budgetSats = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(budgetSats) || budgetSats <= 0) {
  console.error("ERROR: the budget must be a whole number of sats, for example: make lab1-connection BUDGET=1000");
  process.exit(1);
}

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
    description: `Lab 1 agent, budget ${budgetSats} sats`,
    expires_at: 0,
    permissions: ["pay", "invoice", "lookup", "history", "balance", "info"],
    budgets: [{ pubkey, budget_msats: budgetSats * 1000, refresh_window: 0, created_at: now }],
  },
});
const { data: pairingUrl } = await lnbits.request("GET", `/nwcprovider/api/v1/pairing/${Buffer.from(secretKey).toString("hex")}`, {
  apiKey: wallet.inkey,
});
setEnv("NWC_CONNECTION_STRING", pairingUrl);
console.log(`OK: created an NWC connection with a budget of ${budgetSats} sats.`);
console.log("The connection string is a secret, so it is saved in labs/01-agent-with-a-budget/.env and not shown here.");
