// Lab 2a check. It tests your store from the outside, and it asks LNbits and the Lightning nodes directly.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LNbits } from "../../../infra/lnbits/lnbits-client.mjs";
import { labFiles, lncli, pollUntil, reporter } from "../../../infra/lnbits/lab-common.mjs";

const { readEnv } = labFiles(join(dirname(fileURLToPath(import.meta.url)), ".."));
const env = readEnv();
const { pass, fail, finish } = reporter("Lab 2a", "Your store marks an order as paid only after the invoice settles, and the page has no key.");
const STORE = env.STORE_URL;

console.log(`Lab 2a check: selling with LNbits. Store address: ${STORE}\n`);

const lnbits = new LNbits(env.LNBITS_URL);
let wallet;
try {
  await lnbits.loginOrInstall(env.LNBITS_ADMIN_USER, env.LNBITS_ADMIN_PASSWORD);
  wallet = await lnbits.findOrCreateWallet("shop-wallet");
  pass("LNbits is running.");
} catch (error) {
  fail(`LNbits does not answer: ${error.message}`, "Run: just up-lab2");
  finish();
}

const api = async (method, path, body) => {
  const res = await fetch(STORE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
};

// 1. The page loads, and nothing the browser receives contains a key.
let page;
try {
  page = await api("GET", "/");
  pass("Your store page loads.");
} catch {
  fail(`Your store does not answer at ${STORE}.`, "Start your store. To try the reference solution, run: just lab2-solution");
  finish();
}
const secrets = [wallet.inkey, wallet.adminkey, env.LNBITS_ADMIN_PASSWORD].filter(Boolean);
const scriptPaths = [...page.text.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]).filter((p) => p.startsWith("/"));
const browserFiles = [page.text];
for (const path of scriptPaths) browserFiles.push((await api("GET", path)).text);
const looksLikeKeyHeader = /x-api-key/i;
if (browserFiles.some((text) => secrets.some((s) => text.includes(s)) || looksLikeKeyHeader.test(text))) {
  fail("The page source contains an LNbits key or sends an X-Api-Key header.", "Move every LNbits call to your server. Keep the key in an environment variable.");
} else {
  pass(`The page source and its ${scriptPaths.length} script file(s) contain no key.`);
}

// 2. Orders start as pending, even if the browser claims that they are paid.
const createOrder = async (extra = {}) => {
  const res = await api("POST", "/api/orders", { item: "coffee", ...extra });
  const order = JSON.parse(res.text);
  if (secrets.some((s) => res.text.includes(s))) throw new Error("The answer contains a key.");
  if (!order.id || !order.bolt11 || !order.status) throw new Error(`The answer needs id, bolt11 and status. It was: ${res.text.slice(0, 200)}`);
  return order;
};
const getStatus = async (id) => JSON.parse((await api("GET", `/api/orders/${id}`)).text).status;

let order;
let other;
try {
  order = await createOrder();
  other = await createOrder({ status: "paid", paid: true });
} catch (error) {
  fail(`POST /api/orders did not work: ${error.message}`, "Your store must follow the contract in this lab's README. See: Prompts for your agent.");
  finish();
}
if (order.status === "pending" && (await getStatus(order.id)) === "pending") {
  pass("A new order is pending before anyone pays.");
} else {
  fail(`A new order has the status "${order.status}" before payment.`, 'A new order must have the status "pending".');
}
if ((await getStatus(other.id)) === "pending") {
  pass("A browser cannot mark an order as paid by sending status: paid.");
} else {
  fail("The store accepted status: paid from the browser.", "Ignore any status from the browser. Only LNbits decides.");
}

// 3. The invoice belongs to the shop wallet.
const { payment_hash: paymentHash } = lncli("lnd-customer", "decodepayreq", order.bolt11);
const lookup = () => lnbits.request("GET", `/api/v1/payments/${paymentHash}`, { apiKey: wallet.inkey });
try {
  const { data } = await lookup();
  if (data.paid) throw new Error("It is already paid.");
  pass("The invoice was created in the LNbits wallet shop-wallet.");
} catch (error) {
  fail(`LNbits does not know this invoice as unpaid: ${error.message}`, "Create invoices with the invoice key of shop-wallet.");
}

// 4. The customer node pays one order. Only that order becomes paid.
const payment = lncli("lnd-customer", "payinvoice", "--force", "--json", order.bolt11);
if (payment.status !== "SUCCEEDED") {
  fail(`The customer node could not pay: ${payment.status}`, "Run: just status. Then try: just reset, and just up-lab2.");
  finish();
}
pass("The customer node paid the invoice.");
try {
  await pollUntil("the order to become paid", 30, async () => (await getStatus(order.id)) === "paid");
  pass("The order shows as paid after settlement.");
} catch {
  fail("The order did not become paid within 30 seconds.", "Your server must ask LNbits about the payment when the order status is read.");
}
if ((await lookup()).data.paid === true) pass("LNbits confirms the payment settled.");
else fail("LNbits does not show the payment as settled.", "Run: just reset, and just up-lab2.");
if ((await getStatus(other.id)) === "pending") {
  pass("The other, unpaid order is still pending.");
} else {
  fail("An unpaid order became paid.", "Each order must follow its own invoice.");
}
finish();
