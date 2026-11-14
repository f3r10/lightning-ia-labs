# Lab 2: Sell

## Goal

Build a page that sells something and marks an order as paid only when the invoice settles. This lab goes with Class 2.

## What you will build

A small store with two parts:

```
Browser -> your store's server -> LNbits wallet -> shop Lightning node
```

The browser only talks to your server. Your server keeps the **invoice key**, a secret that lets it create invoices and read their status.

Some words used in this lab:

- **LNbits:** an open-source wallet and accounts system with extensions for shops.
- **Settle:** a Lightning invoice settles when the payment is final and the receiver has the money.
- **Environment variable:** a value that a program reads when it starts. It is not part of the code.

### First: who opens the channel?

To receive a Lightning payment, you need **inbound liquidity**: a channel with funds on the other side. A new merchant has no channels, so at first nobody can pay them.

A **Lightning Service Provider (LSP)** solves this. An LSP is a well-connected node that opens channels to its customers.

With **LSPS2**, a *just-in-time channel*, the merchant needs no funds beforehand:

```
Customer --pays--> LSP --opens a new channel and forwards the payment, minus its fee--> Merchant
```

1. The merchant creates an invoice that goes through the LSP.
2. The first payment reaches the LSP.
3. The LSP opens a channel to the merchant right then, keeps its fee from that payment and forwards the rest.

LSPS2 is an open standard, [bLIP-52](https://github.com/lightning/blips/blob/master/blip-0052.md).

**moneydevkit uses LSPS4**, a variant of just-in-time channels, with its own LSP. LSPS4 is a [draft](https://github.com/ZmnSCPxj-jr/lsp/blob/db0e99e8b65641a18c2d9b9fdf22c2dbae2af32d/LSPS4/ephemeral.md), not an official standard. The moneydevkit SDK handles it for you: you do not configure anything for liquidity.

**The LNbits path in this lab does not use an LSP.** On regtest, the channel between the customer node and the shop node is already open when you run `just up`.

### The two paths

There are two paths:

- **2a, LNbits:** the main path, on regtest. It is required.
- **2b, moneydevkit:** a second path, built only with prompts and published on Vercel. It needs a moneydevkit account and a Vercel account. See [moneydevkit.md](moneydevkit.md).

## Before class

1. Install what the [main README](../../README.md) lists.
2. Run this once, with a good internet connection:

   ```bash
   just up-lab2
   ```

## Start

```bash
just up-lab2
```

You should see this at the end:

```
OK: the wallet "shop-wallet" is ready, and its invoice key is saved in labs/02-sell/.env
```

## Steps

### Path 2a: LNbits

1. **Look at the shop wallet.** Open http://127.0.0.1:5002 and log in. The user is `labadmin`, and the password is in `labs/02-sell/.env`.

   ✅ In the left menu you see the wallet `shop-wallet` and the extensions TPoS, Events, Inventory and Orders.

2. **Ask your agent to build the store.** Use [Prompt 1: build the store](#prompt-1-build-the-store). Your agent should create `labs/02-sell/my-store` and start it on port 3002.

   ✅ http://127.0.0.1:3002 shows your products.

3. **Buy something.** Click a product, then copy the invoice.

   ✅ The order status is `pending`.

4. **Pay as the customer.**

   ```bash
   just pay PASTE_THE_INVOICE_HERE
   ```

   ✅ The terminal shows `OK: paid.` Within a few seconds, the page shows `paid`.

5. **Run the check.**

   ```bash
   just check-lab2
   ```

   ✅ The last line starts with `RESULT: Lab 2a passed.`

6. **Optional: a ready-made point of sale.** In LNbits, open the TPoS extension and create a terminal for `shop-wallet`. Open it, enter an amount, and pay the invoice with `just pay`.

   ✅ The terminal shows that the payment arrived.

### Path 2b: moneydevkit

See [moneydevkit.md](moneydevkit.md).

## Prompts for your agent

### Prompt 1: build the store

```text
Read the LNbits API documentation at http://127.0.0.1:5002/docs. You need these two calls:
- POST /api/v1/payments with the body {"out": false, "amount": SATS, "memo": "TEXT"}. It creates an invoice. The answer includes bolt11 and payment_hash.
- GET /api/v1/payments/PAYMENT_HASH. The answer includes paid, which is true when the invoice has settled.
Send the header X-Api-Key with the invoice key on both calls.

Build a small store in labs/02-sell/my-store. Use Node.js with no framework, unless I ask for one.
Sell at least the product "coffee". Keep orders in memory.

Your server must offer exactly this:
- GET / returns the store page.
- POST /api/orders with the body {"item": "coffee"} creates an order and answers with JSON: {"id", "bolt11", "status": "pending"}.
- GET /api/orders/ID answers with JSON that includes "status", which is "pending" or "paid".
The page shows the invoice and updates the status by asking your server every second.

Rules:
- Read LNBITS_URL and LNBITS_INVOICE_KEY from environment variables. Start the server with: node --env-file=../.env server.mjs
- Listen on port 3002.
- Never put a key in the page or in any answer to the browser. The browser must never call LNbits.
- Only LNbits decides whether an order is paid. Ignore any status sent by the browser.
- Do not print any key, and do not show me the contents of .env.
- Do not commit anything.

Start the server in the background when you finish. Then tell me to run: just check-lab2
```

### Prompt 2 (optional): make it your own project

```text
Change the store in labs/02-sell/my-store to sell MY_PRODUCT_IDEA. Keep the routes and the rules the same.
Run just check-lab2 when you finish. Fix what it reports, but do not change the check.
```

## How to know it worked

```bash
just check-lab2
```

The check needs the item `coffee` in your store. It creates orders, pays one from the customer node, and asks LNbits directly. Expected output:

```
Lab 2a check: selling with LNbits. Store address: http://127.0.0.1:3002

  PASS  LNbits is running.
  PASS  Your store page loads.
  PASS  The page source and its 0 script file(s) contain no key.
  PASS  A new order is pending before anyone pays.
  PASS  A browser cannot mark an order as paid by sending status: paid.
  PASS  The invoice was created in the LNbits wallet shop-wallet.
  PASS  The customer node paid the invoice.
  PASS  The order shows as paid after settlement.
  PASS  LNbits confirms the payment settled.
  PASS  The other, unpaid order is still pending.

RESULT: Lab 2a passed. Your store marks an order as paid only after the invoice settles, and the page has no key.
```

The reference solution is in `solution/store`. To try it, stop your own store and run `just lab2-solution`. It uses the same port, 3002.

## To explore

- [Lightning Ecommerce](https://github.com/f3r10/lightning-ecommerce): an idea from the course author, still in development: your own node and your own keys, with no liquidity needed before your first sale.

## If something fails

| What you see | What to do |
| --- | --- |
| `Your store does not answer` | Start your store, or ask your agent to start it. Check that it uses port 3002. |
| `address already in use` on port 3002 | Another store is running. Run `just down-lab2`, stop your own store, and try again. |
| `The page source contains an LNbits key` | Move every LNbits call to your server. Then create a new wallet key, because the old one was exposed. |
| `POST /api/orders did not work` | Your store does not follow the routes above. Give your agent the failure message. |
| `The order did not become paid` | Your server must ask LNbits about the payment each time it reads an order. |
| `just pay` says `insufficient` or `no route` | Run `just status`. If the channel is not active, run `just reset` and start again. |
| Anything else | Run `just reset`, then start this lab again. |

## Clean up

```bash
just down-lab2   # stop the shop wallet and the reference store
just reset       # delete all local test data
```

Also stop your own store, if you started it. Your code in `my-store` stays on your disk.
