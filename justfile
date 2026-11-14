# One entry point for every command. Run "just" to see them all.
# Install just: https://just.systems (on a Mac: brew install just)

set shell := ["bash", "-euo", "pipefail", "-c"]

regtest := "docker compose -f infra/regtest/docker-compose.yml"
lab1_dir := "labs/01-agent-with-a-budget"
lab1 := "docker compose -f " + lab1_dir + "/docker-compose.yml"
lab2_dir := "labs/02-sell"
lab2 := "docker compose -f " + lab2_dir + "/docker-compose.yml"

# Show every command
[private]
default:
    @just --list --unsorted

# ---- Shared regtest stack ----

# Start bitcoind, two Lightning nodes and the relay, with an open channel
[group('regtest')]
up:
    @{{regtest}} up -d --wait
    @infra/regtest/scripts/bootstrap.sh

# Stop everything but keep the data
[group('regtest')]
down:
    @{{lab1}} down 2>/dev/null || true
    @LNBITS_INVOICE_KEY=x {{lab2}} --profile solution down 2>/dev/null || true
    @{{regtest}} down

# Delete all local test data and start clean (regtest coins have no value)
[group('regtest')]
reset:
    @{{lab1}} down -v 2>/dev/null || true
    @LNBITS_INVOICE_KEY=x {{lab2}} --profile solution down -v 2>/dev/null || true
    @{{regtest}} down -v
    @rm -rf {{lab1_dir}}/.state {{lab1_dir}}/.env {{lab2_dir}}/.env
    @echo "OK: everything was reset. Start again with: just up"

# Show which services are running, and the channel balance
[group('regtest')]
status:
    @{{regtest}} ps --format 'table {{{{.Service}}\t{{{{.Status}}'
    @infra/regtest/scripts/status.sh

# Show recent logs from the regtest stack
[group('regtest')]
logs:
    @{{regtest}} logs --tail 50

# Mine blocks on regtest. Example: just mine 6
[group('regtest')]
mine blocks="1":
    @infra/regtest/scripts/mine.sh "{{blocks}}"

# Pay an invoice from the customer node. Example: just pay lnbcrt...
[group('regtest')]
pay invoice:
    @infra/regtest/scripts/pay.sh "{{invoice}}"

# Create an invoice on the shop node. Example: just invoice 1000
[group('regtest')]
invoice amount memo="just invoice":
    @infra/regtest/scripts/invoice.sh "{{amount}}" "{{memo}}"

# ---- Lab 1: agent with a budget ----

# Start the Lab 1 wallet
[group('lab 1')]
up-lab1: up
    @cd {{lab1_dir}} && npm ci --no-audit --no-fund --silent
    @{{lab1}} up -d
    @node {{lab1_dir}}/scripts/setup.mjs

# Stop the Lab 1 wallet
[group('lab 1')]
down-lab1:
    @{{lab1}} down

# Create an NWC connection with a budget. Example: just lab1-connection 1000
[group('lab 1')]
lab1-connection budget="1000":
    @node {{lab1_dir}}/scripts/create-connection.mjs "{{budget}}"

# Create the small and the large invoice on the shop node
[group('lab 1')]
lab1-invoices:
    @node {{lab1_dir}}/scripts/make-invoices.mjs

# Connect the wallet to Claude Code. Example: just lab1-mcp-claude-code alby-live
[group('lab 1')]
lab1-mcp-claude-code name="alby-lab1":
    @node {{lab1_dir}}/scripts/connect-mcp.mjs claude-code "{{name}}"

# Write an MCP config file for Claude Desktop or another client
[group('lab 1')]
lab1-mcp-config name="alby-lab1":
    @node {{lab1_dir}}/scripts/connect-mcp.mjs config "{{name}}"

# Reference solution: run the exercise without a model
[group('lab 1')]
lab1-simulate:
    @node {{lab1_dir}}/solution/simulated-agent.mjs

# Check whether Lab 1 worked
[group('lab 1')]
check-lab1:
    @{{lab1_dir}}/check.sh

# ---- Lab 2: sell ----

# Start the Lab 2 shop wallet
[group('lab 2')]
up-lab2: up
    @LNBITS_INVOICE_KEY=x {{lab2}} up -d lnbits-shop
    @node {{lab2_dir}}/scripts/setup.mjs

# Stop the Lab 2 shop wallet and the reference store
[group('lab 2')]
down-lab2:
    @LNBITS_INVOICE_KEY=x {{lab2}} --profile solution down

# Start the reference store on http://127.0.0.1:3002
[group('lab 2')]
lab2-solution:
    @docker compose --env-file {{lab2_dir}}/.env -f {{lab2_dir}}/docker-compose.yml --profile solution up -d store-solution
    @echo "OK: the reference store is at http://127.0.0.1:3002"

# Check whether Lab 2a worked
[group('lab 2')]
check-lab2:
    @{{lab2_dir}}/check.sh

# Check your deployed moneydevkit store. Example: just check-lab2b https://you.vercel.app path/.env.local
[group('lab 2')]
check-lab2b store_url env_file="":
    @node {{lab2_dir}}/scripts/check-2b.mjs "{{store_url}}" "{{env_file}}"
