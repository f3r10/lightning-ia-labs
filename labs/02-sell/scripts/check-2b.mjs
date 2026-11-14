// Lab 2b check: tests your deployed moneydevkit store from the outside.
// Usage: node check-2b.mjs https://your-store.vercel.app [path/to/.env.local]
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { reporter } from "../../../infra/lnbits/lab-common.mjs";

const STORE = (process.argv[2] ?? "").replace(/\/$/, "");
const envFile = process.argv[3];
const { pass, fail, finish } = reporter("Lab 2b", "Your store is deployed, keeps its secrets on the server, and only moneydevkit can mark an order as paid.");

if (!/^https?:\/\//.test(STORE)) {
  console.log("Usage: just check-lab2b https://your-store.vercel.app");
  process.exit(1);
}
console.log(`Lab 2b check: moneydevkit store at ${STORE}\n`);

// Secret values to look for in the page, if you give the check your .env.local.
const secrets = [];
if (envFile && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^(MDK_ACCESS_TOKEN|MDK_MNEMONIC|MDK_WEBHOOK_SECRET)=(.+)$/);
    if (match && match[2].length > 8) secrets.push(match[2].trim());
  }
}

const get = async (path, init) => {
  const res = await fetch(STORE + path, { redirect: "manual", ...init });
  return { status: res.status, text: await res.text(), headers: res.headers };
};

// 1. The page loads.
let page;
try {
  page = await get("/");
} catch (error) {
  fail(`Your store does not answer: ${error.message}`, "Check the address. Deploy again with: npx vercel@65.12.1 deploy --prod");
  finish();
}
if (page.status === 200) pass("Your store page loads.");
else {
  fail(`Your store page answered HTTP ${page.status}.`, page.status === 401 ? "Vercel Deployment Protection is on. Open the production address, not a preview address." : "Open the address in a browser and look at the error.");
  finish();
}

// 2. Nothing the browser receives contains a secret.
const scriptPaths = [...page.text.matchAll(/<script[^>]+src="(\/[^"]+)"/g)].map((m) => m[1]);
const files = [page.text];
for (const path of scriptPaths) files.push((await get(path)).text);
const mnemonicLike = /\b(?:[a-z]{3,8} ){11}[a-z]{3,8}\b/;
const leaked =
  files.some((text) => secrets.some((s) => text.includes(s))) ||
  files.some((text) => /whsec_[A-Za-z0-9+/=]{20,}/.test(text) || /MDK_(ACCESS_TOKEN|MNEMONIC|WEBHOOK_SECRET)/.test(text)) ||
  mnemonicLike.test(page.text);
if (leaked) fail("The page or its scripts contain a moneydevkit secret.", "Read MDK_* values only in server code, never in a client component. Then create new credentials, because the old ones are exposed.");
else pass(`The page and its ${scriptPaths.length} script file(s) contain no moneydevkit secret${secrets.length ? "" : " (checked by pattern; pass your .env.local to check the exact values)"}.`);

// 3. The webhook refuses a message without moneydevkit's signature.
const fake = await get("/api/webhooks/mdk", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "checkout.completed", data: { amountSats: 500 } }),
});
if (fake.status === 401) pass("The webhook refuses a fake checkout.completed without a valid signature.");
else if (fake.status === 500 && /MDK_WEBHOOK_SECRET/.test(fake.text)) fail("The webhook has no signing secret.", "Add MDK_WEBHOOK_SECRET in Vercel (Settings, Environment Variables), then deploy again.");
else fail(`The webhook answered HTTP ${fake.status} to a fake, unsigned message.`, "Verify the signature with the standardwebhooks library before you trust the message.");

// 4. A new checkout starts as pending, and the browser cannot change that.
const token = randomBytes(16).toString("hex");
const created = await get("/api/mdk", {
  method: "POST",
  headers: { "content-type": "application/json", "x-moneydevkit-csrf-token": token, cookie: `mdk_csrf=${token}` },
  body: JSON.stringify({ handler: "create_checkout", params: { type: "AMOUNT", title: "Check", description: "Lab 2b check", amount: 500, currency: "SAT", successUrl: "/checkout/success" } }),
});
let checkoutId;
try {
  const body = JSON.parse(created.text);
  checkoutId = body.data?.id ?? body.id;
} catch {
  // Reported below.
}
if (created.status < 300 && checkoutId) {
  pass("moneydevkit created a checkout through your /api/mdk route.");
  const order = await get(`/api/orders/${checkoutId}`);
  let status;
  try {
    status = JSON.parse(order.text).status;
  } catch {
    // Reported below.
  }
  if (status === "pending") pass("A new order is pending before anyone pays. Its status comes from moneydevkit.");
  else fail(`GET /api/orders/${checkoutId} answered ${order.status} ${order.text.slice(0, 120)}`, 'The route must ask moneydevkit (getCheckout) and answer {"status": "pending"} until it reports PAYMENT_RECEIVED.');
  const unknown = await get("/api/orders/not-a-real-order");
  if (unknown.status === 404) pass("An unknown order is not found.");
  else fail(`An unknown order answered HTTP ${unknown.status}.`, "In app/api/orders/[id]/route.ts, if getCheckout throws for any reason, answer 404 with {\"error\": \"Unknown order\"}.");
} else {
  fail(`Creating a checkout failed: HTTP ${created.status} ${created.text.slice(0, 200)}`, "Check MDK_ACCESS_TOKEN, MDK_MNEMONIC and the staging variables in Vercel. Also check that your app's webhook address in the moneydevkit dashboard is your Vercel address.");
}

console.log("\n  NOTE  This check does not pay. On signet staging, payments from the MutinyNet faucet failed with NoRoute in our tests (see the README).");
finish();
