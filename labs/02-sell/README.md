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

   Your agent may stop the store after a while, or when you close it. To keep it running, start it yourself in a second terminal, and leave that terminal open:

   ```bash
   cd labs/02-sell/my-store && node --env-file=../.env server.mjs
   ```

   After each change, stop it with Ctrl+C and start it again.

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

### Add features

Your store works. Now make it better, one feature at a time, the way you would with a real shop. Each feature is one prompt for your agent. After each one:

- try it in the browser, as a customer;
- run `just check-lab2-features`. It tests the features from the outside, like a customer with `curl`. A feature you have not built yet shows `NOT YET`;
- run `just check-lab2` again. It must still pass: a new feature must not break the old rules.

In class, do steps 6, 7, 8 and 10. If you finish early, do steps 9 and 11. Steps 12 and 13 have no prompt: you write it. Do them in class if there is time, or at home. Your facilitator may choose differently.

6. **Make it yours.** Use [Prompt 2](#prompt-2-make-it-yours). Sell your own idea: your products, names and prices.

   ✅ The page shows your products, and `just check-lab2` still passes.

7. **A QR code and a wallet link.** Use [Prompt 3](#prompt-3-a-qr-code). Customers usually pay with a phone: they scan a QR code, or tap a link that opens their wallet.

   ✅ The page shows a QR code for each order. If you scan it with your phone's camera, the text starts with `LIGHTNING:LNBCRT`. A real wallet cannot pay it, because regtest coins exist only on your computer. `just check-lab2-features qr` shows `PASS`.

8. **A cart with quantities.** Use [Prompt 4](#prompt-4-a-cart). Buy 2 coffees and 1 other product in one order.

   ✅ `just decode` on the invoice shows the same total as the page. `just check-lab2-features cart` shows `PASS`: it also tries quantities like `-1` and `1.5`, and a price sent by the browser.

9. **A receipt with the payment proof** (if you finish early). Use [Prompt 5](#prompt-5-a-receipt). After you pay, the page shows a receipt with the **preimage**: the secret that only the shop could reveal, and only after it was paid.

   ✅ The receipt shows a preimage. This command prints `MATCH`:

   ```bash
   just lab1-verify-preimage PASTE_THE_PREIMAGE PASTE_THE_INVOICE
   ```

10. **A kitchen screen.** Use [Prompt 6](#prompt-6-a-kitchen-screen). The person who makes the coffee needs a list of paid orders, even when a customer closes the page right after paying.

    The screen asks for a password: `KITCHEN_PASSWORD` in `labs/02-sell/.env`. If that line is missing, run `just up-lab2` again. Open http://127.0.0.1:3002/kitchen in a second tab. Buy something in the first tab, pay it with `just pay`, and **close the first tab at once**.

    ✅ The order appears on the kitchen screen by itself. `just check-lab2-features kitchen` shows `PASS`.

11. **Tips** (if you finish early). Use [Prompt 7](#prompt-7-tips).

    ✅ A coffee with a 100-sat tip gives an invoice of the coffee's price plus 100. `just check-lab2-features tips` shows `PASS`.

### Write your own prompt

In these two steps there is no prompt to copy. You get the goal, and the **contract**: the exact names the check uses. You write the prompt yourself.

The check tests more than the contract. It also tests rules that a careful shop owner would think of, and that this page does not tell you. If the check shows `FAIL`, ask yourself: which rule did my prompt forget? Then improve **your prompt**, not only the code.

Before you write, answer the questions under each step. Look at Prompts 3 to 7: their rules are a good start.

12. **A discount code.** Customers who type the code `SATS10` get 10% off their order.

    The contract:
    - `POST /api/orders` accepts `"code"`, for example `{"item": "coffee", "code": "SATS10"}`.
    - With `SATS10`, the invoice is 10% lower. An unknown code is refused with HTTP 400.
    - The page has a field where the customer types the code.

    Think first:
    - Who calculates the new amount: the page, or the server? What if a customer sends their own discount with `curl`?
    - Where does the list of valid codes live? Who can read it?
    - What could a customer try, to get more than 10% off?

    ✅ `just check-lab2-features discount` shows `PASS`. Write down which rules your first prompt forgot, if any.

13. **Sales summary for the owner.** The owner wants to know how many orders were paid today, and how many sats came in.

    The contract:
    - `GET /api/summary` answers with JSON: `{"orders": N, "sats": N}`.

    Think first:
    - Which orders count: every order, or only some? What about an order nobody paid?
    - Who should be able to see these numbers?
    - The owner never opens the customers' pages. How does the server know an order was paid?

    ✅ `just check-lab2-features summary` shows `PASS`. Write down which rules your first prompt forgot, if any.

### After class (optional)

14. **Expired invoices.** Use [Prompt 8](#prompt-8-expired-invoices). Then ask your agent to restart your store with `ORDER_EXPIRY_SECS=30`. Buy something and wait 30 seconds without paying.

    ✅ The page says the invoice expired, and offers a new one. `just pay` with the old invoice fails with `invoice expired`.

15. **Orders that survive a restart.** Use [Prompt 9](#prompt-9-orders-that-survive-a-restart). Buy and pay something, then ask your agent to restart your store.

    ✅ After the restart, the order is still `paid`, and the kitchen screen still shows it.

16. **A ready-made point of sale.** In LNbits, open the TPoS extension and create a terminal for `shop-wallet`. Open it, enter an amount, and pay the invoice with `just pay`. Compare it with your own store: what does each one do better?

    ✅ The terminal shows that the payment arrived.

### Go further: questions

These questions use what you built to look at how Lightning payments behave. Each one changes one thing. **Write down your prediction before you run anything**, then write down what actually happened. Your agent may run commands for you, but the prediction must be yours. Your facilitator shares the solutions after class.

They work with your store or with the reference store (`just lab2-solution`). They do not break `just check-lab2`.

In the commands below, `127.0.0.1:3002` is your store. Use `127.0.0.1`, not `localhost`: on some computers, `localhost` can reach a different program.

**Q1. Pay it twice.** Create an order, then pay its invoice two times:

```bash
curl -s -X POST http://127.0.0.1:3002/api/orders -H 'content-type: application/json' -d '{"item":"coffee"}'
just decode PASTE_THE_BOLT11_HERE
just pay PASTE_THE_BOLT11_HERE
just pay PASTE_THE_BOLT11_HERE
```

Write down first: does the customer pay twice? Does your store need code to stop this?

✅ You wrote what each `just pay` answered, with the exact message, and which program you think answered it.

**Q2. Cheat the price.** Act as a dishonest customer. Send your store a price, or a strange item, in the request:

```bash
curl -s -X POST http://127.0.0.1:3002/api/orders -H 'content-type: application/json' -d '{"item":"coffee","amount":1,"priceSats":1}'
curl -s -X POST http://127.0.0.1:3002/api/orders -H 'content-type: application/json' -d '{"item":"__proto__"}'
curl -s -X POST http://127.0.0.1:3002/api/orders -H 'content-type: application/json' -d '{"item":"tea"}'
```

Run `just decode` on any invoice that comes back, and look at its amount. If you built the cart (step 8), attack it too, with your own `curl` commands: a quantity of `-1`, `0`, `1.5` and `1000000`.

✅ You wrote the amount of every invoice that came back, and what your store answered to each request. You checked it yourself, not only by asking your agent.

**Q3. How much can the shop receive?** Run `just status`. It shows how many sats are on each side of the only channel.

- Write down: what is the largest sale the shop can receive right now? Where in the output is that number?
- Try a sale that is too big, then a big one that fits:

  ```bash
  just pay $(just invoice 3000000 "too big")
  just pay $(just invoice 2000000 "big order")
  just status
  ```

- Write down: how much can the shop receive now? What does a shop do when this number gets close to zero?

Do this one last. Afterwards, small sales still work. `just reset` puts the channel back as it was.

✅ You wrote the numbers from `just status` before and after, and what happened to each payment.

**Q4. Restart the store.** Do this one before step 15. Create an order, pay it, and check that it shows `paid`. Then ask your agent to stop your store and start it again. For the reference store, run: `docker restart lnlabs-lab2-store-solution-1`. Ask for the same order:

```bash
curl -s http://127.0.0.1:3002/api/orders/PASTE_THE_ORDER_ID
```

Then open LNbits (step 1) and look at the payments of `shop-wallet`.

✅ You wrote what the store answered after the restart, and what LNbits shows.

**Q5. Late payment.** Create an invoice that expires in 30 seconds:

```bash
just lab2-invoice 100 30
just decode PASTE_THE_INVOICE
```

Wait until `just decode` says `EXPIRED`, then pay it with `just pay`.

Write down: why do invoices expire? Give two reasons.

✅ You wrote the exact message of the late payment, and your two reasons.

**Q6. Who tells the kitchen?** Use [Prompt 10](#prompt-10-what-runs-when-an-invoice-settles) on your store.

- Write down: in your store, when does the server find out that an order is paid? If you built the kitchen screen (step 10), how does it find out? What could go wrong with that design?
- Compare with Path 2b: read `solution/mdk-store`. How does that store find out about a payment?

✅ You wrote how your store learns about payments, and one thing that could go wrong.

### Path 2b: moneydevkit

See [moneydevkit.md](moneydevkit.md).

## Prompts for your agent

Prompts 3 to 9 end with the same rules. Keep them: they are what keeps your store safe while it grows.

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

### Prompt 2: make it yours

```text
Change the store in labs/02-sell/my-store to sell MY_PRODUCT_IDEA: products, names and prices.
Keep one product with the id "coffee", because just check-lab2 buys it.
Keep the routes and the rules of the store the same.
Restart the server when you finish. Run just check-lab2, and fix what it reports, without changing the check. Do not commit anything.
```

### Prompt 3: a QR code

```text
In my store in labs/02-sell/my-store, show the invoice of an order as a QR code.
- The QR code contains "lightning:" followed by the invoice, all in upper case, so a phone wallet can open it.
- Make the QR code on the server, as an SVG image at GET /api/orders/ID/qr.svg. The page must not load anything from another website.
- Add a link "Open in my wallet" to lightning:INVOICE, and a button that copies the invoice.

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Restart the server when you finish. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 4: a cart

```text
In my store in labs/02-sell/my-store, let a customer buy several products in one order, each with a quantity.
- POST /api/orders must also accept {"items": [{"item": "coffee", "quantity": 2}, {"item": "sticker", "quantity": 1}]}. The old body {"item": "coffee"} must still work, as one coffee.
- The invoice amount is the sum of price x quantity, computed on the server from the server's prices. Ignore any price or total sent by the browser.
- A quantity must be a whole number from 1 to 20. Refuse anything else with HTTP 400, and create no invoice.
- The page shows a quantity for each product, and the total.

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Restart the server when you finish. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 5: a receipt

```text
In my store in labs/02-sell/my-store, show a receipt on the page after an order is paid: the products, the amount, the time it was paid, and the payment proof.
- The payment proof is the preimage. Once a payment is paid, LNbits returns it as "preimage" in GET /api/v1/payments/PAYMENT_HASH.
- Add "preimage" and "paymentHash" to the answer of GET /api/orders/ID, but only when the status is "paid".

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Restart the server when you finish. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 6: a kitchen screen

```text
In my store in labs/02-sell/my-store, add a kitchen screen at GET /kitchen.
- It lists the paid orders, newest first, and updates by itself every few seconds.
- It must also show orders whose customer closed the page before it showed "paid". So the server must find paid orders by itself: for example, ask LNbits about every pending order every few seconds.
- The screen gets its data from GET /api/kitchen/orders. It answers with a JSON array of the paid orders. Each one has "id", its products, and the time it was paid.
- Protect both /kitchen and /api/kitchen/orders with HTTP Basic auth. The password is KITCHEN_PASSWORD from the environment; any user name works. Without the right password, answer 401.

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Do not print KITCHEN_PASSWORD or any key, and do not show me the contents of .env.
- Restart the server when you finish. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 7: tips

```text
In my store in labs/02-sell/my-store, let the customer add a tip: no tip, 50, 100 or 250 sats, chosen on the page.
- POST /api/orders accepts "tipSats". It must be a whole number from 0 to 5000. Refuse anything else with HTTP 400, and create no invoice.
- The invoice amount is the order plus the tip, computed on the server.
- Show the tip in the total, and on the receipt if there is one.

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Restart the server when you finish. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 8: expired invoices

```text
In my store in labs/02-sell/my-store, give each invoice a time limit.
- Read ORDER_EXPIRY_SECS from the environment. If it is not set, use 600.
- Create each invoice in LNbits with that expiry: POST /api/v1/payments accepts "expiry", in seconds.
- After that time, an unpaid order has the status "expired". The page shows "This invoice expired", and a button that creates a new order with the same products.

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Restart the server when you finish, with ORDER_EXPIRY_SECS=30. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 9: orders that survive a restart

```text
In my store in labs/02-sell/my-store, keep the orders when the store restarts.
- Save them in a file in labs/02-sell/my-store/data/.
- Save the payment hash of each order, so the store can always ask LNbits again. Never save a key or a password in that file.
- After a restart, a paid order is still paid, the kitchen screen still shows it, and a pending order is checked again with LNbits.

Rules:
- Keep everything that works now: the routes and the rules of the store. Prices and amounts are decided on the server.
- If you need an npm package, first tell me its name, its exact version and why, and wait for my yes. Install it with: npm install --save-exact --ignore-scripts NAME@VERSION
- Restart the server when you finish. Run just check-lab2 and just check-lab2-features. Fix what they report, without changing the checks.
- Do not commit anything.
```

### Prompt 10: what runs when an invoice settles?

For question Q6.

```text
Read the server code of my store in labs/02-sell/my-store. Do not change anything.
A customer pays an order and closes the page right away. Explain, step by step:
1. Which code in my server runs at the moment the invoice settles?
2. When does my server first find out that this order is paid?
3. If nobody ever opens that order again, does my server ever know it was paid?
Answer only from the code. Do not suggest changes or improvements: I will design them myself.
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

For the features of steps 7 to 13:

```bash
just check-lab2-features          # all features
just check-lab2-features cart     # only one: qr, cart, receipt, kitchen, tips, discount or summary
```

It pays a few small orders from the customer node. A feature you have not built yet shows `NOT YET`, which is fine. A `FAIL` line is a problem to fix: give it to your agent.

The reference solution is in `solution/store`. It has every feature of Prompts 1 to 8. Steps 12 and 13 have no reference solution, on purpose: they are yours to design. To try it, stop your own store and run `just lab2-solution`. It uses the same port, 3002. Its kitchen screen is at http://127.0.0.1:3002/kitchen.

## To explore

- [Lightning Ecommerce](https://github.com/f3r10/lightning-ecommerce): an idea from the course author, still in development: your own node and your own keys, with no liquidity needed before your first sale.

## If something fails

| What you see | What to do |
| --- | --- |
| `Your store does not answer` | Your agent may have stopped it: coding agents stop programs they started in the background after a while, or when you close them. Start it yourself in a second terminal: `cd labs/02-sell/my-store && node --env-file=../.env server.mjs`. Leave that terminal open. |
| `address already in use` on port 3002 | Another store is running. Run `just down-lab2`, stop your own store, and try again. |
| Your agent says `my-store` already exists | You built a store before. Run `just lab2-fresh` to start again with an empty folder. |
| `The page source contains an LNbits key` | Move every LNbits call to your server. Then create a new wallet key, because the old one was exposed. |
| `POST /api/orders did not work` | Your store does not follow the routes above. Give your agent the failure message. |
| `The order did not become paid` | Your server must ask LNbits about the payment each time it reads an order. |
| The kitchen screen always says the password is wrong | Your store needs `KITCHEN_PASSWORD` from `labs/02-sell/.env`. If that line is missing, run `just up-lab2`, then restart your store. |
| Your agent wants to install a package | Ask what it is for. Check it on https://www.npmjs.com before you say yes. Prompts 3 to 9 ask for an exact version and `--ignore-scripts`. |
| `just pay` says `insufficient` or `no route` | Run `just status`. If the channel is not active, run `just reset` and start again. |
| Anything else | Run `just reset`, then start this lab again. |

## Clean up

```bash
just down-lab2   # stop the shop wallet and the reference store
just reset       # delete all local test data
```

Also stop your own store, if you started it. Your code in `my-store` stays on your disk.

To do the lab again from the start:

```bash
just lab2-fresh   # stops your store, and moves my-store to old-stores/
```

It deletes nothing. Your old store stays in `labs/02-sell/old-stores/`.
