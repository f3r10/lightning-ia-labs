// Lab 2a feature check. It tests the features of Prompts 3 to 7, and of the two
// "your own prompt" exercises, from the outside, like a customer with curl would.
// A feature you have not built yet shows NOT YET.
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labFiles, lncli, pollUntil } from "../../../infra/lnbits/lab-common.mjs";

const { readEnv } = labFiles(join(dirname(fileURLToPath(import.meta.url)), ".."));
const env = readEnv();
const STORE = process.env.STORE_URL || env.STORE_URL;
const only = process.argv[2]; // optional: qr, cart, receipt, kitchen, tips, discount or summary

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

// Your own prompt 1 (step 12): a discount code. The README gives only the goal and the contract.
// The rules your prompt had to include are tested here.
if (!only || only === "discount") {
  console.log("Discount code (your own prompt, step 12)");
  const low = Math.floor(coffee * 0.9);
  const high = Math.ceil(coffee * 0.9);
  const discounted = (amount) => amount >= low && amount <= high;
  const r = await api("POST", "/api/orders", { item: "coffee", code: "SATS10" });
  const amount = created(r) ? amountOf(r.json.bolt11) : null;
  if (amount === coffee) notYet('The code SATS10 ({"item":"coffee","code":"SATS10"}) did not change the invoice.');
  else if (amount === null) notYet('POST /api/orders with {"item":"coffee","code":"SATS10"} did not create an order.');
  else if (!discounted(amount)) fail(`With SATS10, a coffee of ${coffee} sats gave an invoice of ${amount} sats.`, `10% off ${coffee} is ${coffee * 0.9}, so the invoice should be ${low === high ? low : `${low} or ${high}`} sats.`);
  else {
    const before = failures;
    pass(`With SATS10, the invoice is ${amount} sats instead of ${coffee}.`);
    const wrong = await api("POST", "/api/orders", { item: "coffee", code: "FREE100" });
    if (refused(wrong)) pass("An unknown code is refused with an error.");
    else fail(`An unknown code got HTTP ${wrong.status}${wrong.json?.bolt11 ? `, with an invoice of ${amountOf(wrong.json.bolt11)} sats` : ""}.`, "Refuse an unknown code with HTTP 400, so the customer knows it did not work.");
    // Rules the README did not write down.
    const fake = await api("POST", "/api/orders", { item: "coffee", discount: 100, discountPercent: 100, discountSats: coffee, amountSats: 1, total: 1 });
    if (refused(fake) || (created(fake) && amountOf(fake.json.bolt11) === coffee)) pass("A discount sent by the browser, without a code, is ignored.");
    else fail(`Without a code, but with "discountPercent": 100 from the browser, the invoice was ${amountOf(fake.json.bolt11)} sats.`, "Only the server decides the discount, from the code.");
    const twice = await api("POST", "/api/orders", { item: "coffee", code: ["SATS10", "SATS10"] });
    if (refused(twice) || (created(twice) && amountOf(twice.json.bolt11) >= low)) pass("Sending the code twice does not give a bigger discount.");
    else fail(`Sending ["SATS10","SATS10"] gave an invoice of ${amountOf(twice.json.bolt11)} sats.`, "Accept one code, as text, and refuse anything else.");
    const page = await api("GET", "/");
    const files = [page.text];
    for (const m of page.text.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) if (m[1].startsWith("/")) files.push((await api("GET", m[1])).text);
    const products = await api("GET", "/api/products");
    if (products.status === 200) files.push(products.text);
    if (files.some((t) => /sats10/i.test(t))) fail("The code SATS10 appears in what the browser receives (the page, its scripts or /api/products).", "Keep the list of codes on the server. Anyone can read the page source.");
    else pass("The code does not appear in the page, its scripts or the product list.");
    if (failures === before) done.push("discount");
  }
}

// Your own prompt 2 (step 13): the owner's sales summary.
if (!only || only === "summary") {
  console.log("Sales summary (your own prompt, step 13)");
  const basic = (password) => ({ authorization: "Basic " + Buffer.from(`owner:${password}`).toString("base64") });
  const open = await api("GET", "/api/summary");
  if (open.status === 404) notYet("GET /api/summary answered 404.");
  else if (open.status !== 401) fail(`GET /api/summary without a password answered HTTP ${open.status}.`, "Sales numbers are private. Ask for KITCHEN_PASSWORD, like the kitchen screen, and answer 401 without it.");
  else {
    const before = failures;
    pass("The summary asks for a password.");
    const wrong = await api("GET", "/api/summary", undefined, basic("wrong-password"));
    if (wrong.status === 401) pass("A wrong password is refused.");
    else fail(`A wrong password got HTTP ${wrong.status}.`, "Compare the password with KITCHEN_PASSWORD.");
    const read = async () => {
      const r = await api("GET", "/api/summary", undefined, basic(env.KITCHEN_PASSWORD));
      return r.status === 200 && Number.isFinite(r.json?.orders) && Number.isFinite(r.json?.sats) ? r.json : null;
    };
    const start = await read();
    if (!start) fail('With the right password, the summary did not answer {"orders": N, "sats": N}.', "Answer with JSON that has the numbers orders and sats.");
    else {
      // Two paid orders (one with a tip, if the store has tips), and one that nobody pays. Nobody opens their pages.
      const a = await api("POST", "/api/orders", { item: "coffee" });
      const b = await api("POST", "/api/orders", { item: "coffee", tipSats: 100 });
      const unpaid = await api("POST", "/api/orders", { item: "coffee" });
      const paidSats = amountOf(a.json.bolt11) + amountOf(b.json.bolt11);
      if (!unpaid.json?.bolt11 || !pay(a.json.bolt11) || !pay(b.json.bolt11)) fail("The check could not create and pay its test orders.", "Run: just check-lab2");
      else {
        const end = await pollUntil("the summary to count 2 more orders", 20, async () => {
          const now = await read();
          return now && now.orders - start.orders >= 2 && now;
        }).catch(() => null);
        await new Promise((r) => setTimeout(r, 3000)); // give an unpaid order the chance to be counted by mistake
        const last = (await read()) || end;
        const orders = last ? last.orders - start.orders : 0;
        const sats = last ? last.sats - start.sats : 0;
        if (!end) fail("After 2 orders were paid, the summary did not count them within 20 seconds. Nobody opened their pages.", "Count orders that the server knows are paid; it must find paid orders by itself, like the kitchen screen.");
        else if (orders > 2) fail(`The summary counted ${orders} new orders, but only 2 were paid. One more was created and not paid.`, "Count only paid orders.");
        else if (sats !== paidSats) fail(`The summary added ${sats} sats, but the 2 paid invoices were ${paidSats} sats.`, "Add the amounts of the paid invoices, tips included.");
        else pass(`2 paid orders added 2 orders and ${paidSats} sats to the summary. The unpaid order was not counted.`);
      }
    }
    if (failures === before) done.push("summary");
  }
}

console.log("");
if (failures > 0) {
  console.log(`RESULT: ${failures} problem(s) to fix. Give your agent the FAIL lines.`);
  process.exit(1);
}
console.log(`RESULT: no problems found. Features working: ${done.length ? done.join(", ") : "none yet"}.`);
