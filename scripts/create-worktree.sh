#!/usr/bin/env bash
# create-worktree.sh — Buat feature worktree baru dari branch dev
# Usage: ./scripts/create-worktree.sh feat/nama-fitur
# Example: ./scripts/create-worktree.sh feat/marketing

set -euo pipefail

BRANCH="${1:-}"

if [ -z "$BRANCH" ]; then
  echo "Usage: ./scripts/create-worktree.sh feat/nama-fitur"
  echo "Example: ./scripts/create-worktree.sh feat/marketing"
  exit 1
fi

# Derive worktree directory name from branch
# feat/marketing → dev-marketing
# fix/auth-bug   → dev-auth-bug
WORKTREE_NAME="dev-$(echo "$BRANCH" | sed 's|.*/||')"

# Find repo root (where .bare is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

ENV_STAGING="$REPO_ROOT/.env.staging"

# Validate .env.staging exists
if [ ! -f "$ENV_STAGING" ]; then
  echo "ERROR: .env.staging not found at $ENV_STAGING"
  echo "Cannot setup staging environment for new worktree."
  exit 1
fi

WORKTREE_PATH="$REPO_ROOT/$WORKTREE_NAME"

# Check worktree directory doesn't already exist
if [ -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Directory '$WORKTREE_PATH' already exists."
  echo "Choose a different branch name or remove the existing worktree first."
  exit 1
fi

echo "Creating worktree '$WORKTREE_NAME' from branch 'dev'..."
echo "  Branch: $BRANCH"
echo "  Path:   $WORKTREE_PATH"
echo ""

# Create worktree + new branch from dev
cd "$REPO_ROOT"
git worktree add "$WORKTREE_PATH" -b "$BRANCH" dev

# Copy staging env to all apps
APPS=("clicker-platform-v2" "auth-gateway" "backyard")
for APP in "${APPS[@]}"; do
  APP_DIR="$WORKTREE_PATH/$APP"
  if [ -d "$APP_DIR" ]; then
    cp "$ENV_STAGING" "$APP_DIR/.env.local"
    echo "  -> Copied .env.local to $APP/"
  fi
done

echo ""
echo "Done! Worktree ready at: $WORKTREE_PATH"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_NAME/clicker-platform-v2"
echo "  pnpm install"
echo "  pnpm dev"
