// Prepares the Lab 1 wallet: LNbits account, NWC extension, relay settings, and a funded wallet.
import { LNbits } from "../../../infra/lnbits/lnbits-client.mjs";
import { lncli, pollUntil, readEnv } from "./common.mjs";

const NWC_EXTENSION = {
  id: "nwcprovider",
  version: "1.1.3",
  archive: "https://github.com/lnbits/nwcprovider/archive/refs/tags/v1.1.3.zip",
};
const WALLET_NAME = "agent-wallet";
const WALLET_SATS = 20000;

const env = readEnv();
const lnbits = new LNbits(env.LNBITS_URL);

await lnbits.waitUntilHealthy();
await lnbits.loginOrInstall(env.LNBITS_ADMIN_USER, env.LNBITS_ADMIN_PASSWORD);

const installed = (await lnbits.request("GET", "/api/v1/extension")).data ?? [];
if (!installed.some?.((e) => e.code === NWC_EXTENSION.id && e.isInstalled !== false)) {
  await lnbits.installExtension(NWC_EXTENSION);
}
// The wallet connects to the relay by its Docker name. Your agent runs outside Docker,
// so the connection string uses the address that works from your computer (relay_alias).
await lnbits.request("POST", "/nwcprovider/api/v1/config", {
  body: { relay: "ws://relay:7777", relay_alias: "ws://127.0.0.1:7777" },
});
await lnbits.restartExtension(NWC_EXTENSION.id);

const wallet = await lnbits.findOrCreateWallet(WALLET_NAME);
if ((await lnbits.balanceSats(wallet)) < WALLET_SATS) {
  // Real funding over the Lightning channel: the shop node pays an invoice from this wallet.
  const invoice = await lnbits.createInvoice(wallet, WALLET_SATS, "Lab 1 funding");
  const bolt11 = invoice.bolt11 ?? invoice.payment_request;
  lncli("lnd-shop", "payinvoice", "--force", "--json", bolt11);
  await pollUntil("the wallet to receive its funds", 30, async () => (await lnbits.balanceSats(wallet)) >= WALLET_SATS);
}

console.log(`OK: the wallet "${WALLET_NAME}" has ${await lnbits.balanceSats(wallet)} sats.`);
console.log(`Open LNbits at ${env.LNBITS_URL}`);
console.log(`Log in with user "${env.LNBITS_ADMIN_USER}". The password is in labs/01-agent-with-a-budget/.env`);
