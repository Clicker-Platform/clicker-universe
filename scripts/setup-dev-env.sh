#!/usr/bin/env bash
# setup-dev-env.sh — Copy staging credentials ke semua apps di worktree ini
# Usage: ./scripts/setup-dev-env.sh
# Run dari dalam worktree (dev/, dev-marketing/, dll)

set -euo pipefail

# Find repo root (where .bare is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

ENV_STAGING="$REPO_ROOT/.env.staging"

if [ ! -f "$ENV_STAGING" ]; then
  echo "ERROR: .env.staging not found at $ENV_STAGING"
  exit 1
fi

WORKTREE_NAME="$(basename "$ROOT_DIR")"
echo "Setting up staging environment for worktree: $WORKTREE_NAME"
echo ""

APPS=("clicker-platform-v2" "auth-gateway" "backyard")
for APP in "${APPS[@]}"; do
  APP_DIR="$ROOT_DIR/$APP"
  if [ -d "$APP_DIR" ]; then
    cp "$ENV_STAGING" "$APP_DIR/.env.local"
    echo "  [OK] $APP/.env.local"
  else
    echo "  [SKIP] $APP/ not found"
  fi
done

echo ""
echo "Done. All apps now point to staging Firebase."
echo "Run 'make check-env' to verify."
