// Lab 2a feature check. It tests the features of Prompts 3 to 7 from the outside,
// like a customer with curl would. A feature you have not built yet shows NOT YET.
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labFiles, lncli, pollUntil } from "../../../infra/lnbits/lab-common.mjs";

const { readEnv } = labFiles(join(dirname(fileURLToPath(import.meta.url)), ".."));
const env = readEnv();
const STORE = process.env.STORE_URL || env.STORE_URL;
const only = process.argv[2]; // optional: qr, cart, receipt, kitchen or tips

let failures = 0;
const done = [];
const pass = (m) => console.log(`  PASS     ${m}`);
const fail = (m, fix) => { failures += 1; console.log(`  FAIL     ${m}\n           What to do: ${fix}`); };
const notYet = (m) => console.log(`  NOT YET  ${m}`);

async function api(method, path, body, headers = {}) {
  const res = await fetch(STORE + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, type: res.headers.get("content-type") || "", text, json };
}
const amountOf = (bolt11) => Number(lncli("lnd-customer", "decodepayreq", bolt11).num_satoshis);
const hashOf = (bolt11) => lncli("lnd-customer", "decodepayreq", bolt11).payment_hash;
const pay = (bolt11) => lncli("lnd-customer", "payinvoice", "--force", "--json", bolt11).status === "SUCCEEDED";
const created = (r) => r.status >= 200 && r.status < 300 && r.json?.bolt11;
const refused = (r) => r.status >= 400 && r.status < 500 && !r.json?.bolt11;

console.log(`Lab 2a feature check. Store address: ${STORE}\n`);

let base;
try {
  base = await api("POST", "/api/orders", { item: "coffee" });
} catch {
  console.log(`Your store does not answer at ${STORE}. Start it, then run this again.`);
  process.exit(1);
}
if (!created(base)) {
  console.log('POST /api/orders with {"item":"coffee"} did not create an order. Run: just check-lab2');
  process.exit(1);
}
const coffee = amountOf(base.json.bolt11);

// Prompt 3: QR code
if (!only || only === "qr") {
  console.log("QR code (Prompt 3)");
  const r = await api("GET", `/api/orders/${base.json.id}/qr.svg`);
  if (r.status === 404) notYet(`GET /api/orders/ID/qr.svg answered 404.`);
  else if (r.status === 200 && r.text.includes("<svg")) { pass("The store serves a QR code image for an order."); done.push("QR code"); }
  else fail(`GET /api/orders/ID/qr.svg answered HTTP ${r.status}, not an SVG image.`, "Give your agent this message.");
}

// Prompt 4: cart and quantity
if (!only || only === "cart") {
  console.log("Cart and quantity (Prompt 4)");
  const r = await api("POST", "/api/orders", { items: [{ item: "coffee", quantity: 2 }] });
  if (!created(r)) {
    notYet('POST /api/orders with {"items":[{"item":"coffee","quantity":2}]} did not create an order.');
  } else {
    const before = failures;
    const amount = amountOf(r.json.bolt11);
    if (amount === 2 * coffee) pass(`2 coffees: the invoice is ${amount} sats, 2 x ${coffee}.`);
    else fail(`2 coffees: the invoice is ${amount} sats, but one coffee is ${coffee}.`, "The server must multiply the price by the quantity.");
    const bad = [-1, 0, 1.5, 1000000, "2", null];
    const accepted = [];
    for (const quantity of bad) {
      const a = await api("POST", "/api/orders", { items: [{ item: "coffee", quantity }] });
      if (!refused(a)) accepted.push(`${JSON.stringify(quantity)} (HTTP ${a.status}${a.json?.bolt11 ? `, invoice of ${amountOf(a.json.bolt11)} sats` : ""})`);
    }
    if (accepted.length === 0) pass(`The store refuses the quantities ${bad.map((q) => JSON.stringify(q)).join(", ")} with an error.`);
    else fail(`The store accepted these quantities: ${accepted.join("; ")}.`, "Allow only whole numbers in a range, and check them on the server.");
    const cheat = await api("POST", "/api/orders", { items: [{ item: "coffee", quantity: 1, priceSats: 1 }], amountSats: 1, total: 1 });
    if (created(cheat) && amountOf(cheat.json.bolt11) === coffee) pass("The store ignores a price or total sent by the browser.");
    else if (created(cheat)) fail(`With a price of 1 from the browser, the invoice was ${amountOf(cheat.json.bolt11)} sats.`, "Take prices only from the server.");
    else pass("The store refuses a request that sends its own price.");
    if (failures === before) done.push("cart");
  }
}

// Prompt 5: receipt with the payment proof
if (!only || only === "receipt") {
  console.log("Receipt (Prompt 5)");
  const o = await api("POST", "/api/orders", { item: "coffee" });
  const before = await api("GET", `/api/orders/${o.json.id}`);
  if (!pay(o.json.bolt11)) fail("The customer node could not pay.", "Run: just status");
  else {
    const after = await pollUntil("the order to become paid", 30, async () => {
      const r = await api("GET", `/api/orders/${o.json.id}`);
      return r.json?.status === "paid" && r;
    }).catch(() => null);
    if (!after) fail("The order did not become paid.", "Run: just check-lab2");
    else if (!after.json.preimage) notYet('A paid order has no "preimage" in GET /api/orders/ID.');
    else {
      const proof = createHash("sha256").update(Buffer.from(String(after.json.preimage), "hex")).digest("hex");
      if (proof === hashOf(o.json.bolt11)) { pass("A paid order shows its preimage, and its SHA-256 is the invoice's payment hash."); done.push("receipt"); }
      else fail("The preimage of the order does not match its invoice.", "Show the preimage that LNbits returns for this order's payment hash.");
      if (before.json?.preimage) fail("An unpaid order already shows a preimage.", "Show the preimage only after the order is paid.");
    }
  }
}

// Prompt 6: kitchen screen
if (!only || only === "kitchen") {
  console.log("Kitchen screen (Prompt 6)");
  const basic = (password) => ({ authorization: "Basic " + Buffer.from(`kitchen:${password}`).toString("base64") });
  const open = await api("GET", "/kitchen");
  if (open.status === 404) notYet("GET /kitchen answered 404.");
  else if (open.status !== 401) fail(`GET /kitchen without a password answered HTTP ${open.status}.`, "Ask for KITCHEN_PASSWORD with HTTP Basic auth, and answer 401 without it.");
  else {
    pass("The kitchen screen asks for a password.");
    const wrong = await api("GET", "/kitchen", undefined, basic("wrong-password"));
    if (wrong.status === 401) pass("A wrong password is refused.");
    else fail(`A wrong password got HTTP ${wrong.status}.`, "Compare the password with KITCHEN_PASSWORD.");
    if (!env.KITCHEN_PASSWORD) fail("labs/02-sell/.env has no KITCHEN_PASSWORD.", "Run: just up-lab2");
    else {
      const right = await api("GET", "/kitchen", undefined, basic(env.KITCHEN_PASSWORD));
      if (right.status === 200) pass("The right password opens the kitchen screen.");
      else fail(`The right password got HTTP ${right.status}.`, "Read KITCHEN_PASSWORD from the environment.");
      // Pay an order that nobody opens. The kitchen must still learn about it.
      const o = await api("POST", "/api/orders", { item: "coffee" });
      if (!pay(o.json.bolt11)) fail("The customer node could not pay.", "Run: just status");
      else {
        const seen = await pollUntil("the kitchen to show the order", 20, async () => {
          const k = await api("GET", "/api/kitchen/orders", undefined, basic(env.KITCHEN_PASSWORD));
          return Array.isArray(k.json) && k.json.some((x) => x.id === o.json.id);
        }).catch(() => false);
        if (seen) { pass("A paid order reached the kitchen, although nobody opened its page."); done.push("kitchen"); }
        else fail("A paid order did not appear in GET /api/kitchen/orders within 20 seconds. Nobody opened its page.", "The server must find paid orders by itself, for example by asking LNbits every few seconds.");
      }
    }
  }
}

// Prompt 7: tips
if (!only || only === "tips") {
  console.log("Tips (Prompt 7)");
  const r = await api("POST", "/api/orders", { item: "coffee", tipSats: 100 });
  const amount = created(r) ? amountOf(r.json.bolt11) : null;
  if (amount === coffee) notYet('A tip of 100 sats ({"item":"coffee","tipSats":100}) did not change the invoice.');
  else if (amount === coffee + 100) {
    pass(`A coffee with a 100-sat tip: the invoice is ${amount} sats.`);
    const bad = [-100, 1.5, 100000000, "100"];
    const accepted = [];
    for (const tipSats of bad) {
      const a = await api("POST", "/api/orders", { item: "coffee", tipSats });
      if (!refused(a)) accepted.push(`${JSON.stringify(tipSats)} (HTTP ${a.status}${a.json?.bolt11 ? `, invoice of ${amountOf(a.json.bolt11)} sats` : ""})`);
    }
    if (accepted.length === 0) { pass(`The store refuses the tips ${bad.map((t) => JSON.stringify(t)).join(", ")}.`); done.push("tips"); }
    else fail(`The store accepted these tips: ${accepted.join("; ")}.`, "Allow only whole numbers from 0 to a maximum, and check them on the server.");
  } else if (amount === null) notYet('POST /api/orders with {"item":"coffee","tipSats":100} did not create an order.');
  else fail(`A coffee with a 100-sat tip gave an invoice of ${amount} sats.`, `It should be ${coffee} + 100.`);
}

console.log("");
if (failures > 0) {
  console.log(`RESULT: ${failures} problem(s) to fix. Give your agent the FAIL lines.`);
  process.exit(1);
}
console.log(`RESULT: no problems found. Features working: ${done.length ? done.join(", ") : "none yet"}.`);
