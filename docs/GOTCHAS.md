# Gotchas

Surprises found while building the labs, and what to do about them.

## Regtest stack

- **The strfry image blocks unknown authors by default.** The default config of `dockurr/strfry` runs a write policy with a fixed allow-list. The wallet's events are refused without a clear error on the wallet's side, and clients then report `no info event (kind 13194) returned from relay`. We mount `infra/regtest/strfry.conf`, which turns the policy off. Use that only for local testing.
- **The strfry image needs a database folder.** Without a volume at `/app/strfry-db`, it restarts forever with `mdb_env_open: No such file or directory`.

## Lab 1: which wallet service, and why LNbits

The class creates the budget in Alby. For a path with no real money we need a wallet service that runs locally on regtest and enforces budgets.

**Chosen: LNbits with the NWC Service Provider extension.**

- It enforces the budget on the server. `tracked_spend_nwc` adds up what was spent and refuses before paying.
- We tested this end to end. With a 1,000-sat budget and 100 sats already spent, 600 was paid, 600 was refused, 300 was paid and 150 was refused. The refusals were `QUOTA_EXCEEDED`, and the wallet held about 19,000 sats.
- Its `relay_alias` setting solves a Docker problem: the wallet reaches the relay as `ws://relay:7777`, while the agent, outside Docker, needs `ws://127.0.0.1:7777`.
- Lab 2 uses LNbits too, so students learn one tool and download one image.

**Not chosen: Alby Hub.** We read its source but did not run it on regtest. It also enforces budgets on the server (`QUOTA_EXCEEDED`) and it has a better budget page. But its `RELAY` setting is used both for its own connection and, from what we read, for the connection string. That is likely to need a workaround in Docker. It also adds a second tool to learn. It remains the natural choice for the optional real-money path.

## Lab 1: other surprises

- **The class script says "create the connection in Alby". The default path uses LNbits.** The MCP server is still Alby's, and it works with any NWC wallet.
- **Budgets count the invoice amount, not routing fees.** So total spending can be slightly above the budget.
- **`make_invoice` and budgets:** only payments use the budget. Receiving does not.
- **The extension's single-connection endpoint always reports 0 sats used.** `GET /api/v1/nwc/{pubkey}` does not calculate spending. Use `GET /api/v1/nwc?calculate_spent_budget=true`.
- **A relay change needs an extension restart.** The extension reads the relay address when it starts, so the setup script restarts it after saving the setting.
- **Before the first install, LNbits answers every route with a redirect**, including `/api/v1/health`. The setup script treats that as "up".
- **`@getalby/sdk` 9 changed its exports.** `import { nwc } from "@getalby/sdk"` fails. Use `import { NWCClient } from "@getalby/sdk"`.
- **NIP-04 warning.** The SDK prints `NIP-04 encryption is about to be deprecated`, because this version of the extension does not offer NIP-44. It works today. Check it again before each edition.
- **An MCP error is not always a budget refusal.** A broken relay also makes `pay_invoice` fail. So the check looks for the code `QUOTA_EXCEEDED`, not for any error.
- **Pinning.** `npx @getalby/mcp@1.1.2` pins only the top package, and its dependencies can still change. So the lab installs it with a lockfile and runs it from `node_modules`.

## Lab 2

- **No extension is simply called "webshop" in the LNbits catalog.** The class script lists a web shop. The catalog has `tpos`, `inventory`, `orders`, `events`, `lnticket`, `offlineshop`, `nostrmarket` and `shipping`. `nostrmarket` is the closest to a web shop. Its description is "Nostr Webshop/market on LNbits".
- **Each LNbits instance has one funding source.** Lab 1 uses the customer node and Lab 2 uses the shop node, so each lab runs its own LNbits container.
- **Regtest cannot be public.** The class script says "publish". On regtest, the store runs on your own computer. A public store needs a public network.
- **moneydevkit networks.** Its public docs do not state the networks. Its repository documents staging on signet (Mutinynet), selected with `MDK_NETWORK=signet` and other `MDK_*` variables in `STAGING-TESTING.md`. Mainnet is the default.
- **moneydevkit custody.** Its docs say "We never have access to your funds". The merchant holds `MDK_MNEMONIC`, and the node runs on the merchant's own hosting. moneydevkit's nodes provide the channels and inbound liquidity.
- **moneydevkit credentials need a person.** `@moneydevkit/create` shows a device code, and someone must click Authorize in a browser.
- **moneydevkit webhooks need a public address.** Its service calls your app to claim paid invoices, so local tests need a tunnel. Its own guide uses ngrok.
- **The 2% fee is not in moneydevkit's docs pages we read.** We found it only in a founder's public discussion. Confirm it before class.

## Lab 3a: Breez SDK and its test network

- **Breez's regtest has no Lightning.** It is run by Lightspark, free, and needs no API key. Breez's testing guide says to test Lightning send and receive on mainnet with small amounts. So Lab 3a receives test sats on regtest, and Lightning receive is an optional mainnet step.
- **Breez's local Spark setup is not public.** `regtest/local` in `breez/spark-sdk` builds its operators from `ghcr.io/breez/spark-operator`, which needs authentication.
- **open-ssp on MutinyNet did not work with Breez SDK (tested 2026-11-06).** With `@breeztech/breez-sdk-spark` 0.28.0 on signet, a wallet connected and created a real invoice. A faucet payment of 20,000 sats arrived, and its preimage matched. But every claim failed with `consensus claim transfer failed ... refund transaction validation`, and wallet sync failed with `Something went wrong`.
- **open-ssp's Breez fork has no signet.** The pinned commit (`benthecarman/spark-sdk` `2472fdc0`) accepts only `mainnet` and `regtest`. Using `regtest` with the MutinyNet config never saw the payment, and the operators answered `service rate limit exceeded`. The fork's `signet` branch (`b5c4ace6`) lacks open-ssp's fixes. open-ssp's note about MutinyNet seems to refer to a fork of Spark's JavaScript SDK instead.
- **open-ssp is still interesting** for a future lab about Spark itself. See `docs/slide-briefs/lab-03-breez-decision.md`.
- **The MutinyNet faucet's API needs a GitHub-login token.** Only its web page works without setup.

## Lab 2b: moneydevkit surprises

- **`@moneydevkit/create` 0.22.0 ignores `--no-clipboard` and `--no-open`.** It copied the secrets to the clipboard and did not print the authorization link.
- **Its Next.js setup step fails.** The error is `ENOENT ... @moneydevkit/create/template`, because the published package has no template folder. Add the files by hand, as the docs show.
- **Cloudflare quick tunnels expire.** Ours stopped after a few hours with `Tunnel not found`, and every new tunnel gets a new address. moneydevkit must then be told the new address.
- **`create-next-app` took 9.6 minutes on our test machine.** Do it before class.

## Testing with `claude -p`

- **`claude -p` can stay attached to a server that the agent started.** The store worked after about 30 seconds, but the command did not return. This affected only our automated test.

## Lab 4 warning (found during Lab 1 research)

- **`fetch_l402` in `@getalby/mcp` 1.1.2 refuses non-public addresses.** `assertPublicUrl` blocks `localhost` and private IPs. A local regtest API cannot be fetched directly with this tool.
