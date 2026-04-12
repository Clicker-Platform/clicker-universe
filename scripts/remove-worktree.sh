#!/usr/bin/env bash
# remove-worktree.sh — Hapus feature worktree dan branch-nya
# Usage: ./scripts/remove-worktree.sh dev-marketing
# Example: ./scripts/remove-worktree.sh dev-marketing

set -euo pipefail

WORKTREE_NAME="${1:-}"

if [ -z "$WORKTREE_NAME" ]; then
  echo "Usage: ./scripts/remove-worktree.sh dev-nama"
  echo "Example: ./scripts/remove-worktree.sh dev-marketing"
  echo ""
  echo "Available worktrees:"
  git worktree list
  exit 1
fi

# Prevent removing protected worktrees
if [ "$WORKTREE_NAME" = "main" ] || [ "$WORKTREE_NAME" = "dev" ]; then
  echo "ERROR: Cannot remove protected worktree '$WORKTREE_NAME'."
  exit 1
fi

# Find repo root (where .bare is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

WORKTREE_PATH="$REPO_ROOT/$WORKTREE_NAME"

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Worktree '$WORKTREE_PATH' not found."
  echo ""
  echo "Available worktrees:"
  git worktree list
  exit 1
fi

# Get the branch name from the worktree
cd "$REPO_ROOT"
BRANCH=$(git worktree list --porcelain | grep -A2 "$WORKTREE_PATH" | grep "branch" | sed 's|branch refs/heads/||' || echo "")

echo "Removing worktree '$WORKTREE_NAME'..."
if [ -n "$BRANCH" ]; then
  echo "  Branch: $BRANCH"
fi
echo "  Path:   $WORKTREE_PATH"
echo ""

# Remove worktree
git worktree remove "$WORKTREE_PATH" --force

# Offer to delete the branch
if [ -n "$BRANCH" ]; then
  read -r -p "Delete local branch '$BRANCH'? (y/N) " CONFIRM
  if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
    git branch -d "$BRANCH" 2>/dev/null || git branch -D "$BRANCH"
    echo "Branch '$BRANCH' deleted."

    # Offer to delete remote branch
    read -r -p "Delete remote branch 'origin/$BRANCH'? (y/N) " CONFIRM_REMOTE
    if [ "$CONFIRM_REMOTE" = "y" ] || [ "$CONFIRM_REMOTE" = "Y" ]; then
      git push origin --delete "$BRANCH" 2>/dev/null && echo "Remote branch deleted." || echo "Remote branch not found or already deleted."
    fi
  fi
fi

# Prune stale worktree references
git worktree prune

echo ""
echo "Done. Worktree '$WORKTREE_NAME' removed."
