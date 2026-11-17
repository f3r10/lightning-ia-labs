# Following the labs with another agent

The labs are written and tested with **Claude Code**, and the class demos use it. You can also follow them with the coding agent of ChatGPT, Gemini or Grok. This page says what changes.

## First: use the coding agent, not the chat page

The chat pages in a browser (chatgpt.com, gemini.google.com, grok.com) cannot do these labs. They cannot run commands on your computer, and they cannot start the wallet's MCP server. Every company also has a **coding agent** that runs in your terminal. Use that one:

| Your account | Coding agent | Install | Tested version |
| --- | --- | --- | --- |
| Claude | Claude Code | https://claude.com/claude-code | the main path |
| ChatGPT | Codex CLI | `npm install -g @openai/codex@0.169.0` | 0.169.0 |
| Google Gemini (paid plan or API key) | Gemini CLI | `npm install -g @google/gemini-cli@0.68.0` | 0.68.0 |
| Google, free or Google One | Antigravity CLI | see https://antigravity.google/docs | not tested |
| Grok | Grok Build | `curl -fsSL https://x.ai/cli/install.sh \| bash` (see https://docs.x.ai/build/overview) | 1.0.70 |

Run the agent once and sign in before class. Google says that on 2026-06-18, Antigravity CLI replaced Gemini CLI for unpaid and Google One accounts.

## What stays the same

- **Every prompt.** Copy them as they are. They do not depend on the agent.
- **Every `just` command and every check.** `just check-lab1`, `just check-lab2` and the others test the wallet and your code directly. They do not ask the agent.
- **The rules.** Never paste a key, a seed phrase or a connection string into a chat, with any agent.

## What changes: connecting the wallet (Lab 1, step 2)

Lab 1 connects the wallet to your agent through **MCP** (Model Context Protocol). Each agent saves MCP servers in its own settings file, so there is one command per agent:

```bash
just lab1-mcp codex     # Codex CLI
just lab1-mcp gemini    # Gemini CLI
just lab1-mcp grok      # Grok Build
```

The helper never prints the connection string. Like Claude Code, each agent saves it in a settings file in your home folder.

To use another server name, add it at the end, for example `just lab1-mcp codex alby-trick`. In the Lab 1 README, wherever you see `just lab1-mcp-claude-code NAME`, use `just lab1-mcp AGENT NAME` instead.

### Check it, and see the tools

| Agent | Check from the terminal | ✅ What you should see | Inside the agent | Remove it later |
| --- | --- | --- | --- | --- |
| Codex CLI | `codex mcp list` | a line for `alby-lab1` | type `/mcp` | `codex mcp remove alby-lab1` |
| Gemini CLI | `gemini mcp list` | `✓ alby-lab1 ... Connected` | type `/mcp` | `gemini mcp remove --scope user alby-lab1` |
| Grok Build | `grok mcp doctor` | `✓ 11 tools discovered` under `alby-lab1` | type `/mcp` | `grok mcp remove --scope user alby-lab1` |

After you connect it, restart the agent or open a new session.

### Special cases

- **Gemini CLI says `Disabled`.** Gemini CLI starts MCP servers only in folders that you trust. Start `gemini` in the `lightning-ia-labs` folder. When it asks "Do you trust the files in this folder?", choose **Trust folder**. If it does not ask, type `/permissions trust` inside Gemini CLI. Then run `gemini mcp list` again.
- **Gemini CLI: do not use `gemini mcp add -e` for the connection string.** Version 0.68.0 keeps only the part of a value before its second `=`, and a connection string has several. The wallet then fails with `No relay URL found in connection string`. `just lab1-mcp gemini` avoids this: it writes the entry into `~/.gemini/settings.json` directly, and first saves your old file as `settings.json.bak`.
- **Grok Build also reads Claude Code's settings** (`~/.claude.json` and `.mcp.json`). If you use both agents, a server can show up twice. Give each one its own name, for example `just lab1-mcp grok alby-grok`.
- **Antigravity CLI** has no command to add a server. Run `just lab1-mcp-config`, then copy the `alby-lab1` entry from the file it names into `mcpServers` in `~/.gemini/config/mcp_config.json`. In the agent, type `/mcp` to check it. We did not test this path.
- **Any other agent** that supports local (stdio) MCP servers: run `just lab1-mcp-config`, and copy the entry into its MCP settings.

## Expect different answers

Each model reasons in its own way. In the "Think about it" exercises, your agent may not do what the README describes for Claude. For example, it may obey the invoice in Lab 1 step 9, or trust a price from the browser in Lab 2 step 8. That is not a reason to stop. Write down what happened and bring it to class. The wallet's budget and the checks still work the same with every agent, because they never trust the model.

## What we tested (2026-11-17)

- `just lab1-mcp` for Claude Code, Codex, Gemini CLI and Grok Build, each in an empty test home folder. Each agent saved the full connection string. Claude Code, Gemini CLI and Grok Build each started the wallet's MCP server and found its 11 tools.
- We did not run the lab prompts with Codex, Gemini or Grok models. Students who do: please tell your facilitator what happened.
