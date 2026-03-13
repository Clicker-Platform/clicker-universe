#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG_DIR="$ROOT_DIR/.tmp-firebase-config"
WORKTREE_NAME="$(basename "$ROOT_DIR")"

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

if [ "$WORKTREE_NAME" = "main" ]; then
  EXPECTED_PROJECT_ID="clicker-universe"
  FIREBASE_ALIAS="prod"
elif [ "$WORKTREE_NAME" = "dev" ] || [ "$WORKTREE_NAME" = "feature" ] || [ "$WORKTREE_NAME" = "hotfix" ]; then
  EXPECTED_PROJECT_ID="clicker-universe-stagging"
  FIREBASE_ALIAS="staging"
else
  EXPECTED_PROJECT_ID=""
  FIREBASE_ALIAS="default"
fi

if [ "${1:-}" != "" ] && [[ "${1:-}" != --* ]]; then
  FIREBASE_ALIAS="$1"
  shift
fi

PROJECT_ID="$(python3 - "$ROOT_DIR/.firebaserc" "$FIREBASE_ALIAS" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
alias = sys.argv[2]
if not p.exists():
    print(alias)
    raise SystemExit
data = json.loads(p.read_text())
print(data.get("projects", {}).get(alias, alias))
PY
)"

if [ "$EXPECTED_PROJECT_ID" != "" ] && [ "${ALLOW_CROSS_PROJECT:-0}" != "1" ] && [ "$PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]; then
  echo "Refusing deploy from worktree '$WORKTREE_NAME' with alias '$FIREBASE_ALIAS' -> project '$PROJECT_ID'." >&2
  echo "Expected project: '$EXPECTED_PROJECT_ID'. Set ALLOW_CROSS_PROJECT=1 to bypass." >&2
  exit 1
fi

npx -y firebase-tools@latest use "$FIREBASE_ALIAS" >/dev/null
echo "Deploying from '$WORKTREE_NAME' with alias '$FIREBASE_ALIAS' to project '$PROJECT_ID'"
npx -y firebase-tools@latest deploy --force "$@"
