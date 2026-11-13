# Lab 1: Agent with a budget

## Goal

Connect your agent to a wallet with a small budget over MCP, and see that **the wallet sets the spending limit, not the model**. This lab goes with Class 1.

## What you will build

No app yet. You will connect these parts:

```
Your agent -> Alby MCP server -> NWC messages -> relay -> LNbits wallet -> Lightning payment
```

Some words used in this lab:

- **MCP (Model Context Protocol):** a standard way to give tools to an agent.
- **NWC (Nostr Wallet Connect):** a way for an app to use a wallet, with limits set by the wallet's owner.
- **Connection string:** the secret text that lets an app use a wallet through NWC. It starts with `nostr+walletconnect://`.
- **Relay:** a small server that passes NWC messages between the app and the wallet.
- **Regtest:** a private test network on your computer. Its coins have no value.

## Before class

Install these:

- Docker Desktop, or Docker Engine with Compose v2
- git
- Node.js 20 or newer
- your coding agent

Then run this once, with a good internet connection. It downloads the images and takes a few minutes:

```bash
git clone https://github.com/f3r10/lightning-ia-labs.git
cd lightning-ia-labs
make up-lab1
```

## Start

```bash
make up-lab1
```

You should see this at the end:

```
OK: the wallet "agent-wallet" has 20000 sats.
```

## Steps

1. **Create a connection with a budget of 1,000 sats.**

   ```bash
   make lab1-connection BUDGET=1000
   ```

   ✅ You see `OK: created an NWC connection with a budget of 1000 sats.` The secret is saved in `.env`, and it is not shown on screen.

2. **Connect the wallet to your agent.** Use one of these options.

   **Claude Code:**

   ```bash
   make lab1-mcp-claude-code
   ```

   Restart Claude Code and type `/mcp`.

   **Claude Desktop:**

   ```bash
   make lab1-mcp-config
   ```

   This writes `labs/01-agent-with-a-budget/.state/mcp-config.json`. Copy its `alby-lab1` entry into `mcpServers` in Claude Desktop's `claude_desktop_config.json`. Find that file in Claude Desktop under Settings, Developer, Edit Config. Then restart Claude Desktop.

   **Any other MCP client:** run `make lab1-mcp-config` and add the same entry to your client's MCP settings. The entry has this shape:

   ```json
   {
     "mcpServers": {
       "alby-lab1": {
         "command": "/full/path/to/node",
         "args": ["/full/path/to/node_modules/@getalby/mcp/build/index.js"],
         "env": { "NWC_CONNECTION_STRING": "nostr+walletconnect://fake-example" }
       }
     }
   }
   ```

   ✅ Your agent lists the server `alby-lab1` and tools such as `get_balance` and `pay_invoice`.

3. **Ask your agent for the balance.** Use the first prompt below.

   ✅ The agent reports about 20,000 sats. The balance is higher than the budget. That matters later.

4. **Create two invoices on the shop node.**

   ```bash
   make lab1-invoices
   ```

   ✅ You see one SMALL invoice (100 sats) and one LARGE invoice (5,000 sats).

5. **Ask your agent to pay the small invoice.** Use the second prompt below.

   ✅ The agent reports a preimage. A preimage is the proof of payment.

6. **Ask your agent to pay the large invoice.** Use the third prompt below.

   ✅ The agent reports the error `The wallet has exceeded its spending quota.` The wallet has enough sats, but the budget does not allow this payment. The model did not decide this: the wallet did.

7. **Optional: see the connection in the wallet.** Open http://127.0.0.1:5001 and log in. The user and password are in `labs/01-agent-with-a-budget/.env`. In the left menu, click "NWC Service Provider". If a dialog says "Important!", click "I understand". Then choose `agent-wallet` in the Wallet list.

   ✅ You see your connection, "Lab 1 agent, budget 1000 sats", in the table.

### Optional: a real Alby wallet (real money)

This path is not needed to pass the lab. It uses real sats, so keep the amounts tiny.

1. In your Alby account or Alby Hub, create a new app connection with a budget of at most 1,000 sats.
2. Add it to your agent as in step 2, using your own connection string.
3. Repeat steps 3, 5 and 6 with invoices that you create in another wallet. The large invoice must be above the budget.

`make check-lab1` does not cover this path, because it can only see the local wallet.

## Prompts for your agent

Check the balance:

```text
Use the alby-lab1 MCP tools. Call get_balance and tell me the wallet balance in sats.
Do not read any .env file, and do not ask me for the connection string.
```

Pay the small invoice (replace `PASTE_SMALL_INVOICE` with the invoice):

```text
Use the alby-lab1 MCP tools to pay this test invoice with pay_invoice: PASTE_SMALL_INVOICE
Report what the tool returned.
Do not read any .env file, and do not ask me for the connection string.
```

Pay the large invoice (replace `PASTE_LARGE_INVOICE` with the invoice):

```text
Use the alby-lab1 MCP tools to pay this test invoice with pay_invoice: PASTE_LARGE_INVOICE
Report exactly what the tool returned. If the wallet refuses, do not retry and do not look for another way to pay.
Do not read any .env file, and do not ask me for the connection string.
```

Explore (optional). The agent should read the server's documentation first:

```text
Read https://github.com/getAlby/mcp and list the tools of the alby-lab1 server.
Tell me which of them can spend money. Do not call any tool that spends money.
```

## How to know it worked

```bash
make check-lab1
```

The check talks to the wallet and the shop node directly, not to your agent. It also tries one over-budget payment by itself. Expected output:

```
Lab 1 check: agent with a budget

  PASS  The wallet answers over NWC. Its balance is 19900 sats.
  PASS  The small invoice (100 sats) was paid. The shop node confirms it.
  PASS  The large invoice (5000 sats) was not paid. The shop node confirms it.
  PASS  The wallet has a budget for this connection: 100 of 1000 sats used.
  PASS  The wallet refused 901 sats with QUOTA_EXCEEDED, although it holds 19900 sats. The limit is in the wallet.
  PASS  No real NWC connection string is in a tracked file, and git ignores .env.

RESULT: Lab 1 passed. The wallet set the limit, not the model.
```

The check cannot see whether your agent tried the large invoice. Only your agent's answer in step 6 shows that.

## If something fails

| What you see | What to do |
| --- | --- |
| `Cannot connect to the Docker daemon` | Start Docker Desktop and try again. |
| `port is already allocated` | Another program uses port 5001 or 7777. Stop that program, then run `make up-lab1`. |
| The agent does not list `alby-lab1` | Restart the agent. In Claude Code, type `/mcp`. Run `make lab1-mcp-claude-code` again if needed. |
| `no info event (kind 13194) returned from relay` | The wallet is not connected to the relay. Run `make up-lab1`, then try again. |
| `The wallet has exceeded its spending quota` on the small invoice | You used the budget. Run `make lab1-connection BUDGET=1000`, connect the agent again (step 2) and run `make lab1-invoices`. |
| `FAIL The small invoice ... is not paid`, but you paid it | You created new invoices after paying. Pay the new small invoice. |
| `timed out ... waiting for: the shop node to sync` | Update your copy with `git pull`, then run `make up-lab1` again. Older copies could not restart a chain that was left for a day. |
| You have two copies of this repository | They share the same Docker containers. Run `make down` in the other copy first. |
| Anything else | Run `make reset`, then start this lab again. |

## Clean up

```bash
make down-lab1                                  # stop the Lab 1 wallet
claude mcp remove --scope user alby-lab1        # if you used Claude Code
make reset                                      # delete all local test data
```
