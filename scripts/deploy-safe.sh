#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG_DIR="$ROOT_DIR/.tmp-firebase-config"

mkdir -p "$CFG_DIR/configstore" "$CFG_DIR/firebase"
[ -f "$HOME/.config/configstore/firebase-tools.json" ] && cp "$HOME/.config/configstore/firebase-tools.json" "$CFG_DIR/configstore/" || true
[ -f "$HOME/.config/firebase/firebase-tools.json" ] && cp "$HOME/.config/firebase/firebase-tools.json" "$CFG_DIR/firebase/" || true
[ -f "$HOME/.config/firebase/kukuhadafi99_gmail_com_application_default_credentials.json" ] && cp "$HOME/.config/firebase/kukuhadafi99_gmail_com_application_default_credentials.json" "$CFG_DIR/firebase/" || true

cleanup() {
  rm -rf "$CFG_DIR"
}
trap cleanup EXIT

export XDG_CONFIG_HOME="$CFG_DIR"
export CI=true
export NO_UPDATE_NOTIFIER=true

npx -y firebase-tools@latest experiments:enable webframeworks >/dev/null 2>&1 || true

FIREBASE_ALIAS="default"
if [ "${1:-}" != "" ] && [[ "${1:-}" != --* ]]; then
  FIREBASE_ALIAS="$1"
  shift
fi

npx -y firebase-tools@latest use "$FIREBASE_ALIAS" >/dev/null
npx -y firebase-tools@latest deploy --force "$@"
