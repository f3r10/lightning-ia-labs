# One entry point for every command. Run "make help" to see them.
SHELL := /bin/bash
REGTEST := docker compose -f infra/regtest/docker-compose.yml
LAB1_DIR := labs/01-agent-with-a-budget
LAB1 := docker compose -f $(LAB1_DIR)/docker-compose.yml
LAB2_DIR := labs/02-sell
LAB2 := docker compose --env-file $(LAB2_DIR)/.env -f $(LAB2_DIR)/docker-compose.yml

.DEFAULT_GOAL := help
.PHONY: help up down reset status logs mine pay invoice \
	up-lab1 down-lab1 check-lab1 lab1-connection lab1-invoices lab1-simulate lab1-mcp-config lab1-mcp-claude-code \
	up-lab2 down-lab2 check-lab2 lab2-solution

help: ## Show this list
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-22s %s\n", $$1, $$2}'

## ---- Shared regtest stack ----
up: ## Start bitcoind, two Lightning nodes and the relay, with an open channel
	@$(REGTEST) up -d --wait
	@infra/regtest/scripts/bootstrap.sh

down: ## Stop everything but keep the data
	@$(LAB1) down 2>/dev/null || true
	@docker compose -f $(LAB2_DIR)/docker-compose.yml --profile solution down 2>/dev/null || true
	@$(REGTEST) down

reset: ## Delete all local test data and start clean (regtest coins have no value)
	@$(LAB1) down -v 2>/dev/null || true
	@LNBITS_INVOICE_KEY=x docker compose -f $(LAB2_DIR)/docker-compose.yml --profile solution down -v 2>/dev/null || true
	@$(REGTEST) down -v
	@rm -rf $(LAB1_DIR)/.state $(LAB1_DIR)/.env $(LAB2_DIR)/.env
	@echo "OK: everything was reset. Start again with: make up"

status: ## Show which services are running, and the channel balance
	@$(REGTEST) ps --format 'table {{.Service}}\t{{.Status}}'
	@infra/regtest/scripts/status.sh

logs: ## Show recent logs from the regtest stack
	@$(REGTEST) logs --tail 50

mine: ## Mine blocks on regtest. Example: make mine BLOCKS=6
	@infra/regtest/scripts/mine.sh $(or $(BLOCKS),1)

pay: ## Pay an invoice from the customer node. Example: make pay INVOICE=lnbcrt...
	@infra/regtest/scripts/pay.sh "$(INVOICE)"

invoice: ## Create an invoice on the shop node. Example: make invoice AMOUNT=1000
	@infra/regtest/scripts/invoice.sh "$(AMOUNT)" "$(MEMO)"

## ---- Lab 1: agent with a budget ----
up-lab1: up ## Start the Lab 1 wallet
	@cd $(LAB1_DIR) && npm ci --no-audit --no-fund --silent
	@$(LAB1) up -d
	@node $(LAB1_DIR)/scripts/setup.mjs

down-lab1: ## Stop the Lab 1 wallet
	@$(LAB1) down

lab1-connection: ## Create an NWC connection with a budget. Example: make lab1-connection BUDGET=1000
	@node $(LAB1_DIR)/scripts/create-connection.mjs $(or $(BUDGET),1000)

lab1-invoices: ## Create the small and the large invoice on the shop node
	@node $(LAB1_DIR)/scripts/make-invoices.mjs

lab1-mcp-claude-code: ## Connect the wallet to Claude Code through the Alby MCP server
	@node $(LAB1_DIR)/scripts/connect-mcp.mjs claude-code

lab1-mcp-config: ## Write an MCP config file for Claude Desktop or another MCP client
	@node $(LAB1_DIR)/scripts/connect-mcp.mjs config

lab1-simulate: ## Reference solution: run the exercise without a model
	@node $(LAB1_DIR)/solution/simulated-agent.mjs

check-lab1: ## Check whether Lab 1 worked
	@$(LAB1_DIR)/check.sh

## ---- Lab 2: sell ----
up-lab2: up ## Start the Lab 2 shop wallet
	@LNBITS_INVOICE_KEY=x docker compose -f $(LAB2_DIR)/docker-compose.yml up -d lnbits-shop
	@node $(LAB2_DIR)/scripts/setup.mjs

down-lab2: ## Stop the Lab 2 shop wallet and the reference store
	@LNBITS_INVOICE_KEY=x docker compose -f $(LAB2_DIR)/docker-compose.yml --profile solution down

lab2-solution: ## Start the reference store on http://127.0.0.1:3002
	@$(LAB2) --profile solution up -d store-solution
	@echo "OK: the reference store is at http://127.0.0.1:3002"

check-lab2: ## Check whether Lab 2a worked
	@$(LAB2_DIR)/check.sh
