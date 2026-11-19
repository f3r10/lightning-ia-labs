# What gets installed, and how to check it yourself

You should know what runs on your computer before you run it. This page lists everything the labs download and write, who publishes it, and how to check it. It also shows how to do each step yourself, and how to remove everything at the end.

The short version:

- Labs 1 and 2a run on **regtest**, a private test network on your own computer. Its coins have no value. No real wallet and no real key is needed.
- Every Docker image is pinned by **digest**, and every npm package by **exact version and integrity hash**.
- **npm install scripts are turned off.** No package runs code while it installs.
- Every port listens on **127.0.0.1** only. Other computers cannot reach it.
- After setup, **the lab containers make no connections to the internet.** We measured it, and you can too: `just netwatch`.
- Only optional steps use real money or third-party accounts, and they are marked clearly.

## Look before you install

These commands only read. They download and change nothing.

| Command | What it shows |
| --- | --- |
| `just doctor` | The tools you have, free disk space, busy ports, which images are already downloaded |
| `just plan lab1` | What `just up-lab1` would download (with sizes), write, and connect to. Also `regtest`, `lab2` and `lab2b` |
| `just --show up-lab1` | The recipe itself |
| `just --dry-run up-lab1` | The exact commands it would run, in order, without running them |
| `just netwatch 120` | For 120 seconds, any connection from the running lab containers to the internet |

Every recipe is a short wrapper around plain `docker compose`, `node` and `bash` commands, in the `justfile` and in the `scripts/` folders. You can run them one by one instead of using `just`.

## What you install yourself

The labs never install these for you. Get them from their official sources, and verify them the way you usually do.

| Tool | Official source | Notes |
| --- | --- | --- |
| Docker Desktop or Docker Engine with Compose v2 | https://docs.docker.com/get-docker/ | |
| git | https://git-scm.com | |
| Node.js 22 or newer | https://nodejs.org | Release files are signed; see "Verifying binaries" on that site |
| just | https://github.com/casey/just | Prebuilt releases with checksums, or `cargo install just`, or your package manager |
| A coding agent | see [other-agents.md](other-agents.md) | Some installers are `curl ... \| bash`. You can download the script, read it, then run it |

## Docker images

`docker compose` checks each image against its pinned digest, and refuses an image whose content is different.

To look at an image before you download it:

```bash
docker buildx imagetools inspect bitcoin/bitcoin:31.2@sha256:e1311441eb589e69588060cc7cc0868bc999ab1f359160d7c31fd6d16862a92d
```

### Use your own images

Two of the images are not built by the project that wrote the software: Bitcoin Core (`bitcoin/bitcoin`) and the relay (`dockurr/strfry`). See the table below. If you prefer, build or choose your own image and set its variable before you start:

```bash
export LNLABS_BITCOIND_IMAGE=my-bitcoind:31.2
just up
```

The variables are `LNLABS_BITCOIND_IMAGE`, `LNLABS_LND_IMAGE`, `LNLABS_RELAY_IMAGE`, `LNLABS_LNBITS_IMAGE` and `LNLABS_NODE_IMAGE`. Your image must work with the same command line and paths as the default one. For example, a Bitcoin Core image must provide `bitcoind` and `bitcoin-cli`, and keep its data in `/home/bitcoin/.bitcoin`. Read `infra/regtest/docker-compose.yml` for each service's flags and paths. Then run `just check-lab1` or `just check-lab2` to see that everything still works.

## npm packages

- `npm ci` installs the exact versions in `package-lock.json`, and checks each package against its integrity hash.
- `.npmrc` in each Node.js folder sets `ignore-scripts=true`, so packages do not run install scripts.
- To check the registry signatures yourself: `cd labs/01-agent-with-a-budget && npm audit signatures`. On 2026-11-19 it reported 142 packages with verified registry signatures, and 31 with verified attestations.

**Three Lab 1 packages have install scripts, and none of them runs.** They come from Alby's MCP server (`@getalby/mcp` → `websocket-polyfill` → `websocket`):

- `bufferutil` and `utf-8-validate` would compile a native add-on. Without their scripts, they use the prebuilt binary shipped in the package if there is one for your system, or else their plain JavaScript version (`fallback.js`). Both work.
- `es5-ext` only prints a message in its install script.

## What the containers contact while they run

Downloads happen only during setup: the images from Docker Hub, the npm packages, and the LNbits extensions from GitHub (exact release archives). After that, nothing in the labs needs the internet.

**LNbits calls outside services by default,** and the labs turn this off:

- With its default settings, LNbits asks price services for the bitcoin exchange rate (for example `price.lnbits.com`), and downloads its extension catalogs from GitHub every 10 minutes. In our test, it connected to both within 90 seconds of starting.
- The compose files turn off the price lookups (`LNBITS_PRICE_AGGREGATOR_ENABLED=false`, `LNBITS_EXCHANGE_RATE_PROVIDERS=[]`).
- The setup scripts turn off the catalogs after installing the extensions, because LNbits checks each release against the catalog when it installs it.

**What we measured (2026-11-19):** after setup, we watched every lab container for 330 seconds while running Lab 1, and again for Lab 2. No container connected to a public address: not bitcoind, the two LND nodes, the relay, LNbits or the reference store.

Measure it yourself while you work. It reads each container's connection table five times a second, and changes nothing:

```bash
just netwatch 300
```

Bitcoin Core and LND do not look for peers on regtest. If you use your own images, run `just netwatch` again.

Your coding agent is not a container of the labs: it sends your prompts, and the files it reads, to its provider.

## MCP: what changes in your agent's settings

Only Lab 1 touches your agent, and only when you run `just lab1-mcp` (or `just lab1-mcp-claude-code`). It adds one MCP server entry, which contains that connection's string. You choose where:

- `user` scope (the default): in the agent's settings in your home folder. The agent sees the wallet in every folder.
- `project` scope: in this folder only, in a file that git ignores. Start your agent from this folder.

```bash
just lab1-mcp-claude-code alby-lab1 project   # writes .mcp.json here; Claude Code asks you to approve it
just lab1-mcp gemini alby-lab1 project        # writes .gemini/settings.json here
just lab1-mcp grok alby-lab1 project          # writes .grok/config.toml here; Grok needs the folder trusted
```

Codex only has user scope in this helper. Every entry the helpers add is listed in `.lnlabs/mcp-added.json` (no secrets), so `just uninstall` can remove exactly those.

## Remove everything

```bash
just uninstall       # shows the list; removes nothing
just uninstall yes   # removes it
```

It stops the containers, and deletes the Docker volumes, the pinned images, `node_modules`, the local `.env` files and the MCP entries that the helpers added. It also lists what it does not remove: the tools you installed yourself, the npm cache, your own code and your accounts.

## Isolation

See [security.md](security.md#6-where-to-run-the-labs). In short: the labs need no real wallet, so keep real wallets and seed phrases off the computer you use for them. If you want more separation, use a separate user account or a virtual machine.

## Inventory

This part is generated from the compose files and lockfiles. A check fails when it no longer matches them.

<!-- inventory:start (generated by: just inventory) -->

### Docker images

Each image is pinned by tag and digest. Docker refuses an image whose content does not match the digest.

| Image | Pinned reference | Who publishes it | Source | Replace it with |
| --- | --- | --- | --- | --- |
| `lightninglabs/lnd` | `lightninglabs/lnd:v0.21.6-beta@sha256:54b3c87ad0bc3fea3fab8af23ace6421147ea97e6b56bf3911592d7853c185b8` | Official, by Lightning Labs. | https://github.com/lightningnetwork/lnd | `LNLABS_LND_IMAGE` |
| `bitcoin/bitcoin` | `bitcoin/bitcoin:31.2@sha256:e1311441eb589e69588060cc7cc0868bc999ab1f359160d7c31fd6d16862a92d` | Unofficial: built by CI in willcl-ark/bitcoin-core-docker, not by the Bitcoin Core project. Its Debian images use Bitcoin Core's release binaries, checked against guix.sigs during the build. | https://github.com/willcl-ark/bitcoin-core-docker | `LNLABS_BITCOIND_IMAGE` |
| `dockurr/strfry` | `dockurr/strfry:1.1.3@sha256:599ab3500dbfbe6cb78c668e1892cd9802c192d066df4660e8e3175034a8344d` | Third party: dockur builds it from source in CI. Not by strfry's author (hoytech). | https://github.com/dockur/strfry (upstream: https://github.com/hoytech/strfry) | `LNLABS_RELAY_IMAGE` |
| `lnbits/lnbits` | `lnbits/lnbits:v1.6.2@sha256:284b9c2a0df9a1f867b4c52b694699fccade513c09368879922ff90bc7bf850e` | Official, by LNbits. | https://github.com/lnbits/lnbits | `LNLABS_LNBITS_IMAGE` |
| `node` | `node:22.21.1-alpine@sha256:0340fa682d72068edf603c305bfbc10e23219fb0e40df58d9ea4d6f33a9798bf` | Docker Official Image. | https://github.com/nodejs/docker-node | `LNLABS_NODE_IMAGE` |

### Ports

Every port listens on 127.0.0.1 only, so other computers cannot reach it.

| Port | Service | Lab |
| --- | --- | --- |
| 127.0.0.1:7777 | relay | regtest |
| 127.0.0.1:5001 | lnbits-agent | lab1 |
| 127.0.0.1:5002 | lnbits-shop | lab2 |
| 127.0.0.1:3002 | store-solution | lab2 |

### npm packages

**labs/01-agent-with-a-budget**: 142 packages, exact versions and integrity hashes in `package-lock.json`.

- Direct dependencies: `@getalby/mcp@1.1.2`, `@getalby/sdk@9.0.0`, `@modelcontextprotocol/sdk@1.32.2`, `nostr-tools@2.25.5`
- Install scripts: turned off by `.npmrc` (`ignore-scripts=true`). Packages that have one: `bufferutil`, `es5-ext`, `utf-8-validate`.

**labs/02-sell/solution/mdk-store**: 516 packages, exact versions and integrity hashes in `package-lock.json`.

- Direct dependencies: `@moneydevkit/core@0.22.0`, `@moneydevkit/nextjs@0.22.0`, `next@16.4.5`, `react@19.3.0`, `react-dom@19.3.0`, `standardwebhooks@1.1.1`, `@types/node@20.19.43`, `@types/react@19.3.0`, `@types/react-dom@19.3.0`, `eslint@9.39.5`, `eslint-config-next@16.4.5`, `typescript@5.9.3`
- Install scripts: turned off by `.npmrc` (`ignore-scripts=true`). Packages that have one: none.

### Per lab

**Shared regtest stack (just up)**

- Writes: Docker volumes lnlabs-bitcoind, lnlabs-lnd-shop, lnlabs-lnd-customer, lnlabs-relay.
- Connects to: Docker Hub (registry-1.docker.io), only to download the images.
- Accounts: none.

**Lab 1: Agent with a budget (just up-lab1)**

- Writes: labs/01-agent-with-a-budget/.env and .state/ (your local test secrets); labs/01-agent-with-a-budget/node_modules/; Docker volume lnlabs-lnbits-agent; Only when you run just lab1-mcp: one MCP entry in your agent's settings (user scope: in your home folder; project scope: in this folder).
- Connects to: Docker Hub, to download the images; the npm registry (registry.npmjs.org), to download the packages; github.com, once during setup, for the LNbits extension nwcprovider 1.1.3 (exact release archive).
- Accounts: none.

**Lab 2a: Sell with LNbits (just up-lab2)**

- Writes: labs/02-sell/.env; Docker volume lnlabs-lnbits-shop; LNbits extensions tpos, events, inventory and orders, downloaded from GitHub into that volume.
- Connects to: Docker Hub, to download the images; github.com, once during setup, for the four LNbits extensions (exact release archives).
- Accounts: none.

**Lab 2b: Sell with moneydevkit (optional)**

- Writes: your own my-store folder, outside this repository; my-store/.env.local, with your moneydevkit secrets.
- Connects to: the npm registry; moneydevkit staging (staging.moneydevkit.com) and its Lightning service provider; Vercel.
- Runs with npx: `create-next-app@16.4.5`, `vercel@65.12.1`, `@moneydevkit/create@0.22.0`.
- Accounts: Vercel (free account); moneydevkit (account on its signet staging service).

<!-- inventory:end -->
