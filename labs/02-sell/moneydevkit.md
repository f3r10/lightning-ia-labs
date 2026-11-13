# Lab 2b: Sell with moneydevkit, and deploy to Vercel

## Goal

Build a store with a moneydevkit checkout **only by giving prompts to your agent**, and publish it on Vercel. This is the second path of Class 2. It also works as the script for a live "vibe coding" session.

## What you will build

```
Browser -> your store on Vercel -> moneydevkit (checkout) -> your own Lightning node (inside your app)
                                                                      ^
                                     moneydevkit's LSP opens the channel (LSPS4)
```

- **moneydevkit** gives you a hosted checkout page and webhooks.
- Your app runs its **own Lightning node**, and **you hold the keys**: the seed phrase is in `MDK_MNEMONIC`.
- moneydevkit's **LSP** gives you inbound liquidity with **LSPS4**, a draft variant of just-in-time channels. You configure nothing for this.
- A **webhook** is a message that moneydevkit sends to your server when something happens, for example "this checkout was paid".
- **Vercel** hosts your app at a public address that does not change, which moneydevkit needs to reach your app.

Some words used in this guide:

- **Environment variable:** a value that your app reads on the server. Secrets go here, never in the page.
- **Signet staging:** moneydevkit's test environment. It runs on MutinyNet, a public test network whose coins have no value.
- **Deploy:** publish a new version of your app on Vercel.

## Before class

Do these steps at home. Together they take about 20 minutes, mostly waiting for downloads.

1. **Accounts.** Create a free account at https://vercel.com. You also need a moneydevkit account; you will create it in step 4.
2. **Create the app.** This download takes about 10 minutes:

   ```bash
   npx create-next-app@16.4.5 my-store --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm --yes
   cd my-store
   ```

3. **Get your public address.** Log in to Vercel and publish the empty app once:

   ```bash
   npx vercel@65.12.1 login
   npx vercel@65.12.1 deploy --prod --yes
   ```

   ✅ The last lines show an address like `https://my-store-abc.vercel.app`. Write down the shortest one. This is **YOUR_URL**.

4. **Get moneydevkit credentials for signet staging.** Replace YOUR_URL:

   ```bash
   npx @moneydevkit/create@0.22.0 --base-url https://staging.moneydevkit.com --webhook-url YOUR_URL --env-target .env.local --no-clipboard
   ```

   A browser page opens. Sign in and click **Authorize**.

   ✅ The terminal says `Authorized successfully!`. `.env.local` now has `MDK_ACCESS_TOKEN` and `MDK_MNEMONIC`.

   Two known problems with version 0.22.0:
   - It copies your secrets to the clipboard even with `--no-clipboard`. Copy any other text afterwards to clear it.
   - It may print `Next.js scaffolding failed`. That is fine: your agent adds those files in class.

5. **Add the staging settings.** Copy the lines under "Signet staging only" from [solution/mdk-store/.env.example](solution/mdk-store/.env.example) to the end of your `.env.local`.

6. **Back up your seed phrase.** `MDK_MNEMONIC` controls your node's funds. Never paste it into a chat, a page or a commit.

## Start

Open your agent in the `my-store` folder. Check that `.env.local` exists and that git ignores it:

```bash
git check-ignore .env.local
```

✅ It prints `.env.local`.

## Steps

In our test (2026-11-07), a real agent followed prompts 1 to 3 in about 4 minutes in total: 102 seconds to build, 79 to publish and 29 to deploy again. The dashboard step and a purchase add a few more minutes, so this fits the 27-minute build segment, as long as the before-class steps are done.

1. **Build the store.** Use [Prompt 1: build the store](#prompt-1-build-the-store).

   ✅ `npm run dev` starts, and http://localhost:3000 shows a "Buy" button.

2. **Publish it.** Use [Prompt 2: publish on Vercel](#prompt-2-publish-on-vercel).

   ✅ YOUR_URL shows your store. The agent reports HTTP 200 for "/". A 500 from `/api/webhooks/mdk` is expected now: its secret comes in the next step.

3. **Connect the webhook.** You do this step, not the agent. In the moneydevkit staging dashboard (https://staging.moneydevkit.com), open your app:
   - Check that the app's webhook address is YOUR_URL, without anything after it.
   - Under Webhooks, add the endpoint `YOUR_URL/api/webhooks/mdk` for the event `checkout.completed`.
   - Copy its signing secret (it starts with `whsec_`). In Vercel, open your project, then Settings, then Environment Variables. Add `MDK_WEBHOOK_SECRET` with that value, for Production.

   Then use [Prompt 3: deploy again after the secret](#prompt-3-deploy-again-after-the-secret).

   ✅ The agent reports that the webhook answers `401 Invalid signature` to an unsigned message.

4. **Buy something.** Open YOUR_URL, click Buy, and look at the checkout page.

   ✅ You see a Lightning invoice that starts with `lntbs`, and the order status is `pending`.

5. **Run the check.**

   ```bash
   make check-lab2b STORE_URL=YOUR_URL ENV_FILE=/full/path/to/my-store/.env.local
   ```

   Run it from the `lightning-ia-labs` folder. ✅ The last line starts with `RESULT: Lab 2b passed.` If a line says FAIL, give that line and its "What to do" line to your agent, and ask it to fix the store and deploy again.

6. **Optional: pay.** Pay the invoice from the MutinyNet faucet, https://faucet.mutinynet.com (it asks you to sign in with GitHub).

   **Known problem (tested on 2026-11-07):** on signet staging, the faucet's payment failed with `FailureReasonNoRoute`, twice. Our store had already registered with moneydevkit's staging LSP through LSPS4, as its logs show. But when the payment came, the LSP never called our store to open the channel. The problem is between the faucet and moneydevkit's staging LSP, outside your app. On mainnet, moneydevkit uses a different LSP. We did not test mainnet in this lab.

## Prompts for your agent

### Prompt 1: build the store

```text
Read the moneydevkit Next.js guide at https://docs.moneydevkit.com/nextjs.md and its webhook guide at https://docs.moneydevkit.com/webhooks.md.

In this Next.js App Router project, build a store that sells one coffee for 500 sats:
- Install exact versions: @moneydevkit/nextjs@0.22.0, @moneydevkit/core@0.22.0 and standardwebhooks@1.1.1.
- Wrap next.config.ts with withMdkCheckout from @moneydevkit/nextjs/next-plugin.
- app/api/mdk/route.ts: export { POST } from "@moneydevkit/nextjs/server/route".
- app/page.tsx: a "Buy coffee" button that calls createCheckout from useCheckout() with type "AMOUNT", amount 500, currency "SAT", successUrl "/checkout/success", then goes to result.data.checkoutUrl.
- app/checkout/[id]/page.tsx: renders <Checkout id={id} />. Put the client component that reads params inside <Suspense>, because this project has Cache Components turned on.
- app/api/orders/[id]/route.ts: a GET route that calls getCheckout(id) from @moneydevkit/core on the server and answers {"id", "status"}. The status is "paid" only when the checkout status is "PAYMENT_RECEIVED", "expired" for "EXPIRED", and "pending" otherwise. If getCheckout throws for any reason, answer 404 with {"error": "Unknown order"}.
- app/checkout/success/page.tsx: reads the "checkout-id" query parameter and shows the status from /api/orders/ID, asking every 2 seconds. Wrap it in <Suspense>.
- app/api/webhooks/mdk/route.ts: verifies the signature with the standardwebhooks library and MDK_WEBHOOK_SECRET. Answer 401 if the signature is invalid, and 500 if the secret is missing. On "checkout.completed", log the order and its amount.

Rules:
- MDK_* values are secrets. Read them only in server code. Never in a client component, never in the page.
- Never print, show or commit .env.local, and never paste its values into this chat.
- Do not store orders in a file or in memory: on Vercel, files do not persist. moneydevkit is the source of truth.
Run npm run build at the end and fix any error.
```

### Prompt 2: publish on Vercel

```text
Publish this app on Vercel with the Vercel CLI, version 65.12.1 (npx vercel@65.12.1).
1. Link the project if it is not linked yet.
2. For each line in .env.local whose name starts with MDK_ and whose value is not empty, add it as a Production environment variable with "vercel env add NAME production". Pass the value through standard input. Never print the values.
3. Deploy to production with "vercel deploy --prod --yes".
4. Open the production address with curl and tell me the HTTP status of "/" and of a POST to "/api/webhooks/mdk".
Do not change any code in this step.
```

### Prompt 3: deploy again after the secret

Use it after you add `MDK_WEBHOOK_SECRET` in Vercel (step 3).

```text
I added MDK_WEBHOOK_SECRET in Vercel. Deploy to production again with npx vercel@65.12.1 deploy --prod --yes.
Then send a POST with the body {} to /api/webhooks/mdk on the production address, and tell me the status. It should be 401.
```

### Prompt 4 (optional): make it your own project

```text
Change the store to sell MY_PRODUCT_IDEA. Keep all the routes and rules the same.
Run npm run build, deploy to production, and tell me when it is done.
```

## How to know it worked

```bash
make check-lab2b STORE_URL=YOUR_URL ENV_FILE=/full/path/to/my-store/.env.local
```

Expected output:

```
Lab 2b check: moneydevkit store at YOUR_URL

  PASS  Your store page loads.
  PASS  The page and its 9 script file(s) contain no moneydevkit secret.
  PASS  The webhook refuses a fake checkout.completed without a valid signature.
  PASS  moneydevkit created a checkout through your /api/mdk route.
  PASS  A new order is pending before anyone pays. Its status comes from moneydevkit.
  PASS  An unknown order is not found.

  NOTE  This check does not pay. On signet staging, payments from the MutinyNet faucet failed with NoRoute in our tests (see the README).

RESULT: Lab 2b passed. Your store is deployed, keeps its secrets on the server, and only moneydevkit can mark an order as paid.
```

The number of script files can be different. The reference solution is in [solution/mdk-store](solution/mdk-store).

## If something fails

| What you see | What to do |
| --- | --- |
| `Merchant webhook did not respond within the spin-up window` | The app's webhook address in the moneydevkit dashboard is wrong. Set it to YOUR_URL, without anything after it. |
| `Error occurred prerendering page "/checkout/[id]"` during the build | Put the component that reads `params` inside `<Suspense>`. |
| `MDK_WEBHOOK_SECRET is not set` after you added it | Deploy again. Vercel only reads new variables on a new deployment. |
| Your store page answers 401 | You opened a preview address. Use the production address. |
| `FailureReasonNoRoute` when you pay on staging | This is the known staging problem from step 6. Your store is fine. |
| `Maximum 10 apps per organization` during step 4 of Before class | Delete old apps in the staging dashboard. |

## Clean up

- To stop the public store, remove it from Vercel: open the project, then Settings, then Delete Project.
- In the moneydevkit dashboard, delete the app if you do not need it.
- Keep your `MDK_MNEMONIC` backup until you are sure the node holds no funds.
