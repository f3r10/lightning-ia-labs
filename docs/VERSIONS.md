# Versions

Everything below was checked on **2026-11-04**. Tools change quickly, so check again before each course edition.

## Shared regtest stack

| Tool | Version | Pinned digest | Network |
| --- | --- | --- | --- |
| Bitcoin Core (`bitcoin/bitcoin`) | 31.2 | `sha256:e1311441eb589e69588060cc7cc0868bc999ab1f359160d7c31fd6d16862a92d` | regtest |
| LND (`lightninglabs/lnd`) | v0.21.6-beta | `sha256:54b3c87ad0bc3fea3fab8af23ace6421147ea97e6b56bf3911592d7853c185b8` | regtest |
| strfry relay (`dockurr/strfry`) | 1.1.3 | `sha256:599ab3500dbfbe6cb78c668e1892cd9802c192d066df4660e8e3175034a8344d` | local |

## Lab 1

| Tool | Version | Notes |
| --- | --- | --- |
| LNbits (`lnbits/lnbits`) | v1.6.2, `sha256:284b9c2a0df9a1f867b4c52b694699fccade513c09368879922ff90bc7bf850e` | Latest stable. v1.7.0-rc1 also exists, but it is a release candidate. |
| LNbits NWC Service Provider extension | 1.1.3 | Works with LNbits 1.4.0 up to 1.7.0-rc1. Version 1.2.0 needs LNbits 1.7.0-rc1 or newer. |
| `@getalby/mcp` | 1.1.2 | Tools: `get_wallet_service_info`, `get_info`, `make_invoice`, `pay_invoice`, `get_balance`, `lookup_invoice`, `list_transactions`, `fetch_l402`, `fiat_to_sats`, `parse_invoice`, `request_invoice`. Installed from the lab's `package-lock.json`. |
| `@getalby/sdk` | 9.0.0 | Used by the check. The MCP server has its own copy, version 5.1.2. |
| `@modelcontextprotocol/sdk` | 1.32.2 | Used by the reference solution. |
| Alby Hub | v1.24.4 | Evaluated from its source only. Not used. See `GOTCHAS.md`. |

## Lab 2

| Tool | Version | Notes |
| --- | --- | --- |
| LNbits extensions | `tpos` 1.6.1, `events` 1.6.9, `inventory` 0.3.1, `orders` 0.1.0 | Exact catalog versions that work with LNbits 1.6.2. |
| `node` image | 22.21.1-alpine, `sha256:0340fa682d72068edf603c305bfbc10e23219fb0e40df58d9ea4d6f33a9798bf` | Runs the reference store. |
| `@moneydevkit/nextjs`, `@moneydevkit/create`, `@moneydevkit/core` | 0.22.0 | Published 2026-08-10. Tested on signet staging: checkout, webhook signature and order status work; payment failed (see `GOTCHAS.md`). |
| `@moneydevkit/lightning-js` | 0.1.87 | Installed by `@moneydevkit/nextjs` 0.22.0. Uses LSPS4 through a forked ldk-node. |
| `standardwebhooks` | 1.1.1 | Verifies moneydevkit's webhook signatures. |
| Next.js (`create-next-app`) | 16.4.5 | With React 19.3.0. Creating an app took 9.6 minutes on our test machine. |
| Vercel CLI (`vercel`) | 65.12.1 | Used to link, set environment variables and deploy. |
