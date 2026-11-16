// Creates an invoice in shop-wallet, with a short expiry, for the "Late payment" exercise.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labFiles } from "../../../infra/lnbits/lab-common.mjs";

const [amount = "100", expiry = "30"] = process.argv.slice(2);
const sats = Number(amount), seconds = Number(expiry);
if (!Number.isInteger(sats) || sats < 1) {
  console.error(`ERROR: "${amount}" is not a number of sats. Example: just lab2-invoice 100 30`);
  process.exit(1);
}
if (!Number.isInteger(seconds) || seconds < 10) {
  console.error(`ERROR: the expiry must be a whole number of seconds, at least 10. You gave "${expiry}".`);
  process.exit(1);
}

const { readEnv } = labFiles(join(dirname(fileURLToPath(import.meta.url)), ".."));
const env = readEnv();
if (!env.LNBITS_INVOICE_KEY) {
  console.error("ERROR: no invoice key. Run: just up-lab2");
  process.exit(1);
}
const res = await fetch(`${env.LNBITS_URL}/api/v1/payments`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": env.LNBITS_INVOICE_KEY },
  body: JSON.stringify({ out: false, amount: sats, memo: `Expires in ${seconds} seconds`, expiry: seconds }),
}).catch(() => null);
if (!res?.ok) {
  console.error(`ERROR: LNbits did not create the invoice${res ? ` (HTTP ${res.status})` : ""}. Is it running? Try: just up-lab2`);
  process.exit(1);
}
const invoice = await res.json();
console.log(`OK: a ${sats}-sat invoice in shop-wallet. It expires ${seconds} seconds from now:`);
console.log(invoice.bolt11);
