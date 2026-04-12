#!/usr/bin/env bash
# deploy-staging.sh — Deploy ke staging (clicker-universe-stagging)
# Harus dijalankan dari worktree dev/ atau dev-*/
#
# Usage:
#   ./scripts/deploy-staging.sh              # deploy semua (hosting + functions + firestore + indexes)
#   ./scripts/deploy-staging.sh hosting      # hosting saja
#   ./scripts/deploy-staging.sh functions    # functions saja
#   ./scripts/deploy-staging.sh firestore    # rules + indexes saja
#   ./scripts/deploy-staging.sh indexes      # indexes saja
#   ./scripts/deploy-staging.sh core         # hosting target: core saja
#   ./scripts/deploy-staging.sh backyard     # hosting target: backyard saja
#   ./scripts/deploy-staging.sh auth         # hosting target: auth saja

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_NAME="$(basename "$ROOT_DIR")"
TARGET="${1:-all}"

# ─── Safety Guard ────────────────────────────────────────────────────────────
# Hanya boleh dijalankan dari worktree dev/ atau dev-*/
if [ "$WORKTREE_NAME" = "main" ]; then
  echo ""
  echo "ERROR: Script ini tidak boleh dijalankan dari worktree 'main'!"
  echo "Gunakan deploy-safe.sh untuk deploy ke production."
  echo ""
  exit 1
fi

EXPECTED_PROJECT="clicker-universe-stagging"
echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│          DEPLOY TO STAGING                  │"
echo "│  Project : $EXPECTED_PROJECT  │"
echo "│  Worktree: $WORKTREE_NAME"
echo "│  Target  : $TARGET"
echo "└─────────────────────────────────────────────┘"
echo ""

# ─── Setup Firebase config ───────────────────────────────────────────────────
CFG_DIR="$ROOT_DIR/.tmp-firebase-config"
mkdir -p "$CFG_DIR/configstore" "$CFG_DIR/firebase"

[ -f "$HOME/.config/configstore/firebase-tools.json" ] && \
  cp "$HOME/.config/configstore/firebase-tools.json" "$CFG_DIR/configstore/" || true
[ -f "$HOME/.config/firebase/firebase-tools.json" ] && \
  cp "$HOME/.config/firebase/firebase-tools.json" "$CFG_DIR/firebase/" || true
[ -f "$HOME/.config/firebase/kukuhadafi99_gmail_com_application_default_credentials.json" ] && \
  cp "$HOME/.config/firebase/kukuhadafi99_gmail_com_application_default_credentials.json" "$CFG_DIR/firebase/" || true

cleanup() { rm -rf "$CFG_DIR"; }
trap cleanup EXIT

export XDG_CONFIG_HOME="$CFG_DIR"
export CI=true
export NO_UPDATE_NOTIFIER=true

npx -y firebase-tools@latest experiments:enable webframeworks >/dev/null 2>&1 || true
npx -y firebase-tools@latest use staging >/dev/null

# ─── Deploy berdasarkan target ───────────────────────────────────────────────
case "$TARGET" in

  all)
    echo "→ Deploying: firestore indexes + rules + functions + hosting (all)"
    npx -y firebase-tools@latest deploy \
      --only firestore:indexes,firestore:rules,functions,hosting \
      --force
    ;;

  hosting)
    echo "→ Deploying: hosting (all targets: core, auth, backyard)"
    npx -y firebase-tools@latest deploy \
      --only hosting \
      --force
    ;;

  core)
    echo "→ Deploying: hosting:core (stg-clicker-core)"
    npx -y firebase-tools@latest deploy \
      --only hosting:core \
      --force
    ;;

  backyard)
    echo "→ Deploying: hosting:backyard (stg-clicker-backyard)"
    npx -y firebase-tools@latest deploy \
      --only hosting:backyard \
      --force
    ;;

  auth)
    echo "→ Deploying: hosting:auth (stg-clicker-auth)"
    npx -y firebase-tools@latest deploy \
      --only hosting:auth \
      --force
    ;;

  functions)
    echo "→ Deploying: functions"
    npx -y firebase-tools@latest deploy \
      --only functions \
      --force
    ;;

  firestore)
    echo "→ Deploying: firestore rules + indexes"
    npx -y firebase-tools@latest deploy \
      --only firestore:rules,firestore:indexes \
      --force
    ;;

  indexes)
    echo "→ Deploying: firestore indexes only"
    npx -y firebase-tools@latest deploy \
      --only firestore:indexes \
      --force
    ;;

  rules)
    echo "→ Deploying: firestore rules only"
    npx -y firebase-tools@latest deploy \
      --only firestore:rules \
      --force
    ;;

  *)
    echo "ERROR: Target '$TARGET' tidak dikenal."
    echo ""
    echo "Pilihan target:"
    echo "  all        — semua (default)"
    echo "  hosting    — semua hosting targets"
    echo "  core       — hosting: clicker platform (stg-clicker-core)"
    echo "  backyard   — hosting: backyard superadmin (stg-clicker-backyard)"
    echo "  auth       — hosting: auth gateway (stg-clicker-auth)"
    echo "  functions  — Firebase Cloud Functions"
    echo "  firestore  — rules + indexes"
    echo "  indexes    — Firestore indexes saja"
    echo "  rules      — Firestore rules saja"
    exit 1
    ;;
esac

echo ""
echo "✓ Deploy staging selesai!"
echo "  Core    : https://stg-clicker-core.web.app"
echo "  Auth    : https://stg-clicker-auth.web.app"
echo "  Backyard: https://stg-clicker-backyard.web.app"
