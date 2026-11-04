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

## Lab 4 warning (found during Lab 1 research)

- **`fetch_l402` in `@getalby/mcp` 1.1.2 refuses non-public addresses.** `assertPublicUrl` blocks `localhost` and private IPs. A local regtest API cannot be fetched directly with this tool.
