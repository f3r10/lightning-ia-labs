# Lightning + AI: labs

Hands-on labs for the course **"Lightning + AI: Tools to Build"**, course 7 of Lightning Path by B4OS. There are four classes of 90 minutes each.

You do not need to be a software engineer. You build with your own coding agent, and each lab gives you prompts, checkpoints and a command that tells you whether it worked.

## What you need

- Docker Desktop, or Docker Engine with Compose v2
- git
- Node.js 20 or newer
- your coding agent, such as Claude Code

On Windows, run everything inside WSL 2.

## How to start

```bash
git clone https://github.com/f3r10/lightning-ia-labs.git
cd lightning-ia-labs
make up
make help
```

`make up` starts a private test network called **regtest**. Its coins have no value. It runs Bitcoin Core, two Lightning nodes (a "shop" and a "customer"), an open channel between them, and a relay.

| Command | What it does |
| --- | --- |
| `make up` | Start the test network |
| `make status` | Show what is running |
| `make mine BLOCKS=6` | Mine blocks |
| `make invoice AMOUNT=1000` | Create an invoice on the shop node |
| `make pay INVOICE=lnbcrt...` | Pay an invoice from the customer node |
| `make reset` | Delete all local test data and start clean |

## Labs

| Lab | Class | What you do |
| --- | --- | --- |
| [Lab 1: Agent with a budget](labs/01-agent-with-a-budget/README.md) | 1 | Connect your agent to a wallet, and see the wallet refuse a payment above the budget |
| [Lab 2: Sell](labs/02-sell/README.md) | 2 | Build a store that marks an order as paid only after the invoice settles |

More labs are added here as each one passes its check from a clean clone.

## To explore

- [Lightning Ecommerce](https://github.com/f3r10/lightning-ecommerce): an idea from the course author, still in development.

## Security

Read [docs/security.md](docs/security.md). The main rule: API keys and NWC connection strings live on the server, never in the page and never in a chat.

## More documents

- [Versions](docs/VERSIONS.md)
- [Gotchas](docs/GOTCHAS.md)

## License

[MIT](LICENSE)
