// Prepares the Lab 2 shop: LNbits account, selling extensions and a wallet.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LNbits } from "../../../infra/lnbits/lnbits-client.mjs";
import { labFiles } from "../../../infra/lnbits/lab-common.mjs";

// Exact versions from the LNbits catalog that work with LNbits 1.6.2.
const release = (id, version) => ({ id, version, archive: `https://github.com/lnbits/${id}/archive/refs/tags/v${version}.zip` });
const EXTENSIONS = [release("tpos", "1.6.1"), release("events", "1.6.9"), release("inventory", "0.3.1"), release("orders", "0.1.0")];

const { readEnv, setEnv } = labFiles(join(dirname(fileURLToPath(import.meta.url)), ".."));
const env = readEnv();
const lnbits = new LNbits(env.LNBITS_URL);

await lnbits.waitUntilHealthy();
await lnbits.loginOrInstall(env.LNBITS_ADMIN_USER, env.LNBITS_ADMIN_PASSWORD);

const { data: active } = await lnbits.request("GET", "/api/v1/extension");
for (const extension of EXTENSIONS) {
  if (!active.some((e) => e.code === extension.id)) {
    await lnbits.installExtension(extension);
  }
  console.log(`Extension ready: ${extension.id} ${extension.version}`);
}

const wallet = await lnbits.findOrCreateWallet("shop-wallet");
setEnv("LNBITS_INVOICE_KEY", wallet.inkey);

console.log('OK: the wallet "shop-wallet" is ready, and its invoice key is saved in labs/02-sell/.env');
console.log(`Open LNbits at ${env.LNBITS_URL}`);
console.log(`Log in with user "${env.LNBITS_ADMIN_USER}". The password is in labs/02-sell/.env`);
