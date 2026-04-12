# Clicker Universe — Makefile
# Shorthand commands for common development tasks.
# Run `make help` to see all available commands.

PLATFORM_DIR = clicker-platform-v2
AUTH_DIR     = auth-gateway
BACKYARD_DIR = backyard

.PHONY: help dev build test lint install clean setup-env check-env emulators worktree-new worktree-list

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies for all apps
	cd $(PLATFORM_DIR) && pnpm install
	cd $(AUTH_DIR) && pnpm install
	cd $(BACKYARD_DIR) && pnpm install

dev: ## Start main platform dev server (port 3000)
	cd $(PLATFORM_DIR) && pnpm dev

dev-auth: ## Start auth gateway dev server
	cd $(AUTH_DIR) && pnpm dev

dev-backyard: ## Start backyard dev server
	cd $(BACKYARD_DIR) && pnpm dev

build: ## Build main platform for production
	cd $(PLATFORM_DIR) && pnpm build

test: ## Run all tests
	cd $(PLATFORM_DIR) && pnpm test

lint: ## Run ESLint on main platform
	cd $(PLATFORM_DIR) && pnpm lint

clean: ## Remove .next build caches
	cd $(PLATFORM_DIR) && rm -rf .next
	cd $(AUTH_DIR) && rm -rf .next
	cd $(BACKYARD_DIR) && rm -rf .next

setup-env: ## Copy staging credentials ke semua apps (.env.local)
	./scripts/setup-dev-env.sh

check-env: ## Verifikasi semua apps connect ke staging Firebase (bukan production)
	@echo "Checking Firebase project per app..."
	@for app in $(PLATFORM_DIR) $(AUTH_DIR) $(BACKYARD_DIR); do \
		if [ -f $$app/.env.local ]; then \
			PROJECT_ID=$$(grep NEXT_PUBLIC_FIREBASE_PROJECT_ID $$app/.env.local | cut -d= -f2); \
			if [ "$$PROJECT_ID" = "clicker-universe-stagging" ]; then \
				echo "  [OK]   $$app: $$PROJECT_ID"; \
			else \
				echo "  [WARN] $$app: $$PROJECT_ID  <-- BUKAN STAGING!"; \
			fi; \
		else \
			echo "  [MISSING] $$app/.env.local — run: make setup-env"; \
		fi; \
	done

emulators: ## Start Firebase emulators (Firestore, Auth, Functions)
	cd $(PLATFORM_DIR) && npx firebase emulators:start

worktree-new: ## Buat feature worktree baru. Usage: make worktree-new BRANCH=feat/nama
	@if [ -z "$(BRANCH)" ]; then echo "Usage: make worktree-new BRANCH=feat/nama"; exit 1; fi
	./scripts/create-worktree.sh $(BRANCH)

worktree-list: ## Lihat semua worktrees yang aktif
	@git worktree list
