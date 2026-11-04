// Creates the two invoices for the exercise on the shop node.
import { lncli, saveState } from "./common.mjs";

const SMALL = 100;
const LARGE = 5000;
const create = (amt, memo) => {
  const invoice = lncli("lnd-shop", "addinvoice", "--amt", String(amt), "--memo", memo);
  return { amount: amt, bolt11: invoice.payment_request, paymentHash: invoice.r_hash };
};
const invoices = { small: create(SMALL, "Lab 1 small invoice"), large: create(LARGE, "Lab 1 large invoice") };
saveState("invoices.json", invoices);
console.log(`SMALL invoice (${SMALL} sats). The budget allows it:\n${invoices.small.bolt11}\n`);
console.log(`LARGE invoice (${LARGE} sats). It is above the budget:\n${invoices.large.bolt11}`);
