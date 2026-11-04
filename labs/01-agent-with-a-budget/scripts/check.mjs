// Lab 1 check. It talks to the wallet and the shop node directly, never to the agent.
import "websocket-polyfill";
import { execSync } from "node:child_process";
import { NWCClient } from "@getalby/sdk";
import { getPublicKey } from "nostr-tools/pure";
import { LNbits } from "../../../infra/lnbits/lnbits-client.mjs";
import { lncli, loadState, readEnv, LAB_DIR, ROOT } from "./common.mjs";

// The SDK prints every wallet refusal as an error. A refusal is what this check expects, so hide that noise.
console.error = () => {};
console.warn = () => {};

let failures = 0;
const pass = (message) => console.log(`  PASS  ${message}`);
const fail = (message, fix) => {
  failures += 1;
  console.log(`  FAIL  ${message}\n        What to do: ${fix}`);
};
const finish = () => {
  console.log("");
  if (failures === 0) {
    console.log("RESULT: Lab 1 passed. The wallet set the limit, not the model.");
    process.exit(0);
  }
  console.log(`RESULT: Lab 1 is not finished yet. ${failures} check(s) failed.`);
  process.exit(1);
};

const env = readEnv();
console.log("Lab 1 check: agent with a budget\n");

const invoiceState = (hash) => lncli("lnd-shop", "lookupinvoice", hash).state;

// 1. The wallet answers over NWC.
if (!env.NWC_CONNECTION_STRING) {
  fail("There is no NWC connection.", "Run: make lab1-connection BUDGET=1000");
  finish();
}
const client = new NWCClient({ nostrWalletConnectUrl: env.NWC_CONNECTION_STRING });
let balanceSats;
try {
  balanceSats = Math.floor((await client.getBalance()).balance / 1000);
  pass(`The wallet answers over NWC. Its balance is ${balanceSats} sats.`);
} catch (error) {
  fail(`The wallet does not answer over NWC: ${error.message}`, "Run: make up-lab1. Then run this check again.");
  client.close();
  finish();
}

// 2. The agent's work: the small invoice is paid, and the large one is not.
const invoices = loadState("invoices.json");
if (!invoices) {
  fail("The two invoices do not exist yet.", "Run: make lab1-invoices");
} else {
  if (invoiceState(invoices.small.paymentHash) === "SETTLED") {
    pass(`The small invoice (${invoices.small.amount} sats) was paid. The shop node confirms it.`);
  } else {
    fail(`The small invoice (${invoices.small.amount} sats) is not paid.`, "Ask your agent to pay the SMALL invoice from: make lab1-invoices");
  }
  if (invoiceState(invoices.large.paymentHash) !== "SETTLED") {
    pass(`The large invoice (${invoices.large.amount} sats) was not paid. The shop node confirms it.`);
  } else {
    fail(`The large invoice (${invoices.large.amount} sats) was paid, so no budget stopped it.`, "Create a new connection with: make lab1-connection BUDGET=1000. Then create new invoices with: make lab1-invoices");
  }
}

// 3. The wallet itself refuses: this check tries an over-budget payment directly, with no agent.
const pubkey = getPublicKey(Buffer.from(new URL(env.NWC_CONNECTION_STRING).searchParams.get("secret"), "hex"));
const lnbits = new LNbits(env.LNBITS_URL);
await lnbits.loginOrInstall(env.LNBITS_ADMIN_USER, env.LNBITS_ADMIN_PASSWORD);
const wallet = await lnbits.findOrCreateWallet("agent-wallet");
const { data: connections } = await lnbits.request("GET", "/nwcprovider/api/v1/nwc?calculate_spent_budget=true", { apiKey: wallet.adminkey });
const budget = connections.find((c) => c.data.pubkey === pubkey)?.budgets?.[0];
if (!budget) {
  fail("This connection has no budget.", "Run: make lab1-connection BUDGET=1000");
} else {
  const budgetSats = budget.budget_msats / 1000;
  const usedSats = budget.used_budget_msats / 1000;
  pass(`The wallet has a budget for this connection: ${usedSats} of ${budgetSats} sats used.`);
  const testAmount = budgetSats - usedSats + 1;
  if (balanceSats < testAmount) {
    fail("The wallet has too few sats for this test, so a refusal would prove nothing.", "Run: make reset, then: make up-lab1");
  } else {
    const probe = lncli("lnd-shop", "addinvoice", "--amt", String(testAmount), "--memo", "Lab 1 check: over budget");
    let code = "";
    try {
      await client.payInvoice({ invoice: probe.payment_request });
    } catch (error) {
      code = error.code ?? error.message;
    }
    const settled = invoiceState(probe.r_hash) === "SETTLED";
    if (code === "QUOTA_EXCEEDED" && !settled) {
      pass(`The wallet refused ${testAmount} sats with QUOTA_EXCEEDED, although it holds ${balanceSats} sats. The limit is in the wallet.`);
    } else {
      fail(`The wallet did not refuse the budget test as expected (answer: ${code || "paid"}).`, "Create a new connection with: make lab1-connection BUDGET=1000");
    }
  }
}
client.close();

// 4. The secret is not in anything git would publish.
try {
  const tracked = execSync(`git -C "${ROOT}" grep -lE 'nostr\\+walletconnect://[0-9a-f]{64}' -- . || true`, { encoding: "utf8" }).trim();
  const leaked = tracked.split("\n").filter(Boolean);
  const ignored = execSync(`git -C "${LAB_DIR}" check-ignore .env || true`, { encoding: "utf8" }).trim();
  if (leaked.length === 0 && ignored) {
    pass("No real NWC connection string is in a tracked file, and git ignores .env.");
  } else {
    fail(`A real NWC connection string may be exposed: ${leaked.join(", ") || ".env is not ignored"}`, "Remove it from the file, then make a new connection, because the old one is no longer secret.");
  }
} catch {
  console.log("  SKIP  This folder is not a git clone, so the secret check did not run.");
}
finish();
