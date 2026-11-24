// Reference store for Lab 2, with the features of Prompts 1 to 8.
// The invoice key stays here on the server. The page only talks to this server.
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import QRCode from "qrcode";

const { LNBITS_URL, LNBITS_INVOICE_KEY, KITCHEN_PASSWORD, PORT = "3002" } = process.env;
if (!LNBITS_URL || !LNBITS_INVOICE_KEY) {
  console.error("ERROR: set LNBITS_URL and LNBITS_INVOICE_KEY.");
  process.exit(1);
}
// How long a customer has to pay. Shorter values help you test expiry: ORDER_EXPIRY_SECS=30
const EXPIRY_SECS = Number(process.env.ORDER_EXPIRY_SECS || 600);

// Prices live here, on the server. The page never sends a price.
const PRODUCTS = {
  coffee: { name: "Coffee", priceSats: 500 },
  sticker: { name: "Sticker", priceSats: 100 },
  cake: { name: "Cake", priceSats: 800 },
};
const MAX_QUANTITY = 20;
const MAX_TIP_SATS = 5000;

const orders = new Map();
const page = readFileSync(new URL("./index.html", import.meta.url));
const kitchenPage = readFileSync(new URL("./kitchen.html", import.meta.url));

async function lnbits(method, path, body) {
  const res = await fetch(LNBITS_URL + path, {
    method,
    headers: { "content-type": "application/json", "x-api-key": LNBITS_INVOICE_KEY },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LNbits answered HTTP ${res.status}`);
  return res.json();
}

// The status comes only from LNbits and the clock. No request from a browser can change it.
async function refresh(order) {
  if (order.status !== "pending") return order;
  const payment = await lnbits("GET", `/api/v1/payments/${order.paymentHash}`);
  if (payment.paid === true) {
    order.status = "paid";
    order.paidAt = new Date().toISOString();
    order.preimage = payment.preimage; // the payment proof, for the receipt
  } else if (Date.now() > Date.parse(order.expiresAt)) {
    order.status = "expired";
  }
  return order;
}

// The kitchen must know even if the customer closes the page:
// every 2 seconds, ask LNbits about every pending order.
setInterval(async () => {
  for (const order of orders.values()) {
    if (order.status === "pending") await refresh(order).catch((e) => console.error(e.message));
  }
}, 2000);

const publicOrder = ({ id, lines, tipSats, amountSats, bolt11, status, createdAt, expiresAt, paidAt, preimage, paymentHash }) => ({
  id, lines, tipSats, amountSats, bolt11, status, createdAt, expiresAt,
  ...(status === "paid" ? { paidAt, preimage, paymentHash } : {}),
});

// Turn the request into order lines. Every number is checked here, on the server.
function readCart(body) {
  const wanted = Array.isArray(body.items) ? body.items : [{ item: body.item, quantity: body.quantity ?? 1 }];
  if (wanted.length === 0 || wanted.length > Object.keys(PRODUCTS).length) throw new Error("Choose at least one product.");
  const lines = [];
  for (const { item, quantity } of wanted) {
    // Object.hasOwn: names like "__proto__" or "toString" are not products.
    const product = typeof item === "string" && Object.hasOwn(PRODUCTS, item) ? PRODUCTS[item] : undefined;
    if (!product) throw new Error("Unknown item");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new Error(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
    if (lines.some((l) => l.item === item)) throw new Error("Each product only once. Use the quantity.");
    lines.push({ item, name: product.name, quantity, priceSats: product.priceSats });
  }
  const tipSats = body.tipSats ?? 0;
  if (!Number.isInteger(tipSats) || tipSats < 0 || tipSats > MAX_TIP_SATS) throw new Error(`The tip must be a whole number from 0 to ${MAX_TIP_SATS} sats.`);
  return { lines, tipSats };
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 10_000) throw new Error("Request too large");
  }
  return text ? JSON.parse(text) : {};
}

// The kitchen screen asks for a password (HTTP Basic auth, any user name).
function kitchenAllowed(req) {
  if (!KITCHEN_PASSWORD) return false;
  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const given = Buffer.from(Buffer.from(encoded, "base64").toString().split(":").slice(1).join(":"));
  const expected = Buffer.from(KITCHEN_PASSWORD);
  return given.length === expected.length && timingSafeEqual(given, expected);
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
      let cart;
      try {
        cart = readCart(await readJson(req));
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
      const amountSats = cart.lines.reduce((sum, l) => sum + l.priceSats * l.quantity, 0) + cart.tipSats;
      const memo = "Order: " + cart.lines.map((l) => `${l.quantity} x ${l.name}`).join(", ") + (cart.tipSats ? `, tip ${cart.tipSats}` : "");
      const invoice = await lnbits("POST", "/api/v1/payments", { out: false, amount: amountSats, memo, expiry: EXPIRY_SECS });
      const now = Date.now();
      const order = {
        id: randomUUID(),
        ...cart,
        amountSats,
        bolt11: invoice.bolt11,
        paymentHash: invoice.payment_hash,
        status: "pending",
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + EXPIRY_SECS * 1000).toISOString(),
      };
      orders.set(order.id, order);
      return send(res, 201, publicOrder(order));
    }
    const qr = pathname.match(/^\/api\/orders\/([\w-]+)\/qr\.svg$/);
    if (req.method === "GET" && qr) {
      const order = orders.get(qr[1]);
      if (!order) return send(res, 404, { error: "Unknown order" });
      // Upper case makes a smaller QR code. "lightning:" lets a phone open its wallet.
      const svg = await QRCode.toString(`lightning:${order.bolt11}`.toUpperCase(), { type: "svg", margin: 2 });
      res.writeHead(200, { "content-type": "image/svg+xml" });
      return res.end(svg);
    }
    const match = pathname.match(/^\/api\/orders\/([\w-]+)$/);
    if (req.method === "GET" && match) {
      const order = orders.get(match[1]);
      if (!order) return send(res, 404, { error: "Unknown order" });
      return send(res, 200, publicOrder(await refresh(order)));
    }
    if (req.method === "GET" && (pathname === "/kitchen" || pathname === "/api/kitchen/orders")) {
      if (!KITCHEN_PASSWORD) return send(res, 503, { error: "Set KITCHEN_PASSWORD to open the kitchen screen." });
      if (!kitchenAllowed(req)) {
        res.writeHead(401, { "www-authenticate": 'Basic realm="kitchen"', "content-type": "text/plain" });
        return res.end("Password needed");
      }
      if (pathname === "/kitchen") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(kitchenPage);
      }
      const paid = [...orders.values()].filter((o) => o.status === "paid").sort((a, b) => b.paidAt.localeCompare(a.paidAt));
      return send(res, 200, paid.map(({ id, lines, tipSats, amountSats, paidAt }) => ({ id, lines, tipSats, amountSats, paidAt })));
    }
    return send(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "Server error" });
  }
}).listen(Number(PORT), "0.0.0.0", () => console.log(`Store running on port ${PORT}`));
