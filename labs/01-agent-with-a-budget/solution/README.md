# Lab 1 reference solution

`simulated-agent.mjs` plays the role of your agent. It starts the real Alby MCP server and calls the same tools your agent calls: `get_balance`, then `pay_invoice` twice. No model is involved.

You may read it or run it:

```bash
just lab1-invoices
just lab1-simulate
just check-lab1
```

CI uses this script because CI has no coding agent.
