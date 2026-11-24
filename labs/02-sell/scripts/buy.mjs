// Buy from your store and pay, like a customer, without copying the invoice by hand.
// Usage: node buy.mjs [ITEM]   (default: coffee)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labFiles, lncli, pollUntil } from "../../../infra/lnbits/lab-common.mjs";

const { readEnv } = labFiles(join(dirname(fileURLToPath(import.meta.url)), ".."));
const STORE = process.env.STORE_URL || readEnv().STORE_URL;
const item = process.argv[2] || "coffee";

let res;
try {
  res = await fetch(`${STORE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ item }),
  });
} catch {
  console.log(`Your store does not answer at ${STORE}. Start it first.`);
  process.exit(1);
}
const order = await res.json().catch(() => ({}));
if (!res.ok || !order.bolt11) {
  console.log(`The store did not create an order for "${item}": HTTP ${res.status} ${JSON.stringify(order).slice(0, 200)}`);
  const products = await fetch(`${STORE}/api/products`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (products && typeof products === "object") {
    const ids = Array.isArray(products) ? products.map((p) => p.id ?? p.item).filter(Boolean) : Object.keys(products);
    if (ids.length) {
      console.log(`Products in your store: ${ids.join(", ")}. Example: just lab2-buy ${ids[0]}`);
      process.exit(1);
    }
  }
  console.log("Use a product id from your store, for example: just lab2-buy coffee. Ask your agent which ids your store has.");
  process.exit(1);
}
const { num_satoshis: sats, description } = lncli("lnd-customer", "decodepayreq", order.bolt11);
console.log(`Order ${order.id}: ${sats} sats, "${description}". Status: ${order.status}`);

console.log("The customer node pays the invoice...");
const payment = lncli("lnd-customer", "payinvoice", "--force", "--json", order.bolt11);
if (payment.status !== "SUCCEEDED") {
  console.log(`The payment failed: ${payment.failure_reason || payment.status}. Run: just status`);
  process.exit(1);
}
console.log(`Paid. Preimage (the proof of payment): ${payment.payment_preimage}`);

try {
  await pollUntil("the order to show paid", 15, async () => {
    const r = await fetch(`${STORE}/api/orders/${order.id}`);
    return (await r.json()).status === "paid";
  });
  console.log(`OK: your store shows order ${order.id} as paid.`);
} catch {
  console.log("The invoice is paid, but your store does not show the order as paid after 15 seconds. Run: just check-lab2");
  process.exit(1);
}
