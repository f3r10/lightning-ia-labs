# Security rules of this course

These rules apply to every lab. The checks test some of them for you.

## 1. Keys and connection strings live on the server, never in the page

Anyone can read what a web page sends to the browser. So API keys and NWC connection strings must stay on your server, in environment variables. The page asks your server, and your server talks to the wallet.

## 2. The NWC connection string is a secret

An NWC connection string (`nostr+walletconnect://...`) works like a key to your wallet:

- Anyone who has it can spend up to the budget of that connection.
- Never paste it into a chat, including a chat with your agent.
- Never put it on a public page, in a screenshot or in a git commit.
- Give it to the MCP server through its configuration, not through the conversation.
- If it leaks, delete that connection in the wallet and create a new one.

## 3. The limit belongs in the wallet

A model can make mistakes or be tricked, for example by text in a web page it reads. So do not rely on the model to protect your money.

- An MCP server has the same permissions as its credential. If the connection can spend without limit, so can the agent.
- Give each agent its own connection, with a small budget.
- Only allow the permissions it needs.
- Budgets in the wallet still apply when the model is wrong.

## 4. Never commit secrets

- Put real values in `.env`. Git ignores this file.
- Put only fake values in `.env.example`.
- If a secret reaches a commit, treat it as public: replace the secret. Deleting the commit is not enough.

## 5. Test networks first, tiny amounts on mainnet

- Use regtest, signet or mutinynet until your app works.
- Mainnet steps in these labs are optional, and are marked clearly.
- Mainnet payments are final. Use amounts that you can afford to lose.
