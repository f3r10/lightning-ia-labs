// Checks a proof of payment: SHA-256(preimage) must equal the invoice's payment hash.
// Usage: node verify-preimage.mjs PREIMAGE INVOICE
import { createHash } from "node:crypto";
import { lncli } from "./common.mjs";

const [preimage, invoice] = process.argv.slice(2);
if (!/^[0-9a-f]{64}$/i.test(preimage ?? "") || !invoice) {
  console.error("Usage: just lab1-verify-preimage PREIMAGE INVOICE");
  console.error("The preimage has 64 hexadecimal characters. Your agent showed it after the payment.");
  process.exit(1);
}
const { payment_hash: paymentHash } = lncli("lnd-shop", "decodepayreq", invoice);
const hashOfPreimage = createHash("sha256").update(Buffer.from(preimage, "hex")).digest("hex");
console.log(`Payment hash in the invoice: ${paymentHash}`);
console.log(`SHA-256 of the preimage:     ${hashOfPreimage}`);
if (hashOfPreimage === paymentHash) {
  console.log("MATCH: this preimage proves that this invoice was paid.");
} else {
  console.log("NO MATCH: this preimage does not belong to this invoice.");
  process.exit(1);
}
