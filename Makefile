# PolyBot Makefile
# Usage: make <target>

DEPLOY_DIR  := /opt/polybot
SERVICE     := polybot
NODE        := node
NPM         := npm

.PHONY: help install build-backend build-dashboard build start stop restart \
        logs status dev-backend dev-dashboard clean update

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Installation ──────────────────────────────────────────────────────────────

install: ## Install all dependencies (backend + dashboard)
	@echo "→ Installing backend dependencies..."
	cd backend && $(NPM) install
	@echo "→ Installing dashboard dependencies..."
	cd dashboard && $(NPM) install
	@echo "✓ Dependencies installed"

# ── Build ─────────────────────────────────────────────────────────────────────

build-backend: ## Compile TypeScript backend
	@echo "→ Building backend..."
	cd backend && $(NPM) run build
	@echo "✓ Backend built → backend/dist/"

build-dashboard: ## Build React dashboard for production
	@echo "→ Building dashboard..."
	cd dashboard && $(NPM) run build
	@echo "✓ Dashboard built → dashboard/dist/"

build: build-backend build-dashboard ## Build everything

# ── Run (Production) ──────────────────────────────────────────────────────────

start: ## Start PolyBot as a systemd service
	@sudo systemctl start $(SERVICE)
	@echo "✓ $(SERVICE) started"

stop: ## Stop PolyBot systemd service
	@sudo systemctl stop $(SERVICE)
	@echo "✓ $(SERVICE) stopped"

restart: ## Restart PolyBot systemd service
	@sudo systemctl restart $(SERVICE)
	@echo "✓ $(SERVICE) restarted"

enable: ## Enable PolyBot to start on boot
	@sudo systemctl enable $(SERVICE)
	@echo "✓ $(SERVICE) enabled on boot"

status: ## Show service status
	@sudo systemctl status $(SERVICE) --no-pager -l

logs: ## Tail live logs (Ctrl+C to exit)
	@sudo journalctl -u $(SERVICE) -f --no-pager

logs-all: ## Show last 200 log lines
	@sudo journalctl -u $(SERVICE) -n 200 --no-pager

# ── Development ───────────────────────────────────────────────────────────────

dev-backend: ## Run backend in watch mode (requires ts-node-dev)
	cd backend && $(NPM) run dev

dev-dashboard: ## Run dashboard dev server with HMR
	cd dashboard && $(NPM) run dev

# ── Deploy ────────────────────────────────────────────────────────────────────

deploy: build ## Build and deploy to $(DEPLOY_DIR)
	@echo "→ Deploying to $(DEPLOY_DIR)..."
	@sudo mkdir -p $(DEPLOY_DIR)/backend/dist
	@sudo mkdir -p $(DEPLOY_DIR)/dashboard/dist
	@sudo mkdir -p $(DEPLOY_DIR)/data
	@sudo mkdir -p $(DEPLOY_DIR)/logs
	@sudo cp -r backend/dist/      $(DEPLOY_DIR)/backend/
	@sudo cp    backend/package.json $(DEPLOY_DIR)/backend/
	@sudo cp -r dashboard/dist/    $(DEPLOY_DIR)/dashboard/
	@if [ ! -f $(DEPLOY_DIR)/.env ]; then \
		sudo cp .env.example $(DEPLOY_DIR)/.env; \
		echo "⚠  Created $(DEPLOY_DIR)/.env from example — edit it before starting!"; \
	fi
	@echo "→ Installing production dependencies..."
	@cd $(DEPLOY_DIR)/backend && sudo $(NPM) install --omit=dev
	@echo "→ Installing systemd service..."
	@sudo cp polybot.service /etc/systemd/system/$(SERVICE).service
	@sudo systemctl daemon-reload
	@echo "✓ Deployed! Run: sudo systemctl start $(SERVICE)"

# ── Maintenance ───────────────────────────────────────────────────────────────

update: ## Pull latest code, rebuild and restart
	git pull
	$(MAKE) build
	$(MAKE) restart
	@echo "✓ Update complete"

clean: ## Remove build artifacts
	rm -rf backend/dist
	rm -rf dashboard/dist
	@echo "✓ Clean"

db-shell: ## Open SQLite shell on the database
	sqlite3 data/polybot.db

db-backup: ## Backup the database
	@cp data/polybot.db data/polybot-backup-$$(date +%Y%m%d-%H%M%S).db
	@echo "✓ Database backed up"

.DEFAULT_GOAL := help
