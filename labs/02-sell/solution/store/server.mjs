// Reference store for Lab 2. It has no dependencies.
// The invoice key stays here on the server. The page only talks to this server.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const { LNBITS_URL, LNBITS_INVOICE_KEY, PORT = "3002" } = process.env;
if (!LNBITS_URL || !LNBITS_INVOICE_KEY) {
  console.error("ERROR: set LNBITS_URL and LNBITS_INVOICE_KEY.");
  process.exit(1);
}

const PRODUCTS = {
  coffee: { name: "Coffee", priceSats: 500 },
  sticker: { name: "Sticker", priceSats: 100 },
};
const orders = new Map();
const page = readFileSync(new URL("./index.html", import.meta.url));

async function lnbits(method, path, body) {
  const res = await fetch(LNBITS_URL + path, {
    method,
    headers: { "content-type": "application/json", "x-api-key": LNBITS_INVOICE_KEY },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LNbits answered HTTP ${res.status}`);
  return res.json();
}

// The status comes only from LNbits. No request from a browser can change it.
async function refresh(order) {
  if (order.status !== "paid") {
    const payment = await lnbits("GET", `/api/v1/payments/${order.paymentHash}`);
    if (payment.paid === true) order.status = "paid";
  }
  return order;
}

const publicOrder = ({ id, item, amountSats, bolt11, status }) => ({ id, item, amountSats, bolt11, status });

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let text = "";
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    if (req.method === "GET" && pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    if (req.method === "GET" && pathname === "/api/products") {
      return send(res, 200, PRODUCTS);
    }
    if (req.method === "POST" && pathname === "/api/orders") {
      const { item } = await readJson(req);
      const product = PRODUCTS[item];
      if (!product) return send(res, 400, { error: "Unknown item" });
      const invoice = await lnbits("POST", "/api/v1/payments", {
        out: false,
        amount: product.priceSats,
        memo: `Order: ${product.name}`,
      });
      const order = {
        id: randomUUID(),
        item,
        amountSats: product.priceSats,
        bolt11: invoice.bolt11,
        paymentHash: invoice.payment_hash,
        status: "pending",
      };
      orders.set(order.id, order);
      return send(res, 201, publicOrder(order));
    }
    const match = pathname.match(/^\/api\/orders\/([\w-]+)$/);
    if (req.method === "GET" && match) {
      const order = orders.get(match[1]);
      if (!order) return send(res, 404, { error: "Unknown order" });
      return send(res, 200, publicOrder(await refresh(order)));
    }
    return send(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "Server error" });
  }
}).listen(Number(PORT), "0.0.0.0", () => console.log(`Store running on port ${PORT}`));
