#!/usr/bin/env bash
set -e

# Deploy staging ke clicker-universe-stagging
# Env sudah dikonfigurasi di masing-masing .env.production per app
# Jalankan dari directory dev/

export IS_WEBPACK_TEST=1

APPS=${1:-"core,auth,backyard"}

get_dir() {
  case "$1" in
    core)    echo "clicker-platform-v2" ;;
    auth)    echo "auth-gateway" ;;
    backyard) echo "backyard" ;;
    *) echo ""; ;;
  esac
}

IFS=',' read -ra TARGETS <<< "$APPS"

for target in "${TARGETS[@]}"; do
  dir=$(get_dir "$target")
  if [ -z "$dir" ]; then
    echo "Unknown target: $target (valid: core, auth, backyard)"
    exit 1
  fi
  echo "Building $dir..."
  cd "$dir"
  pnpm run build
  cd ..
done

echo "Deploying hosting: $APPS..."
export FIREBASE_CLI_EXPERIMENTS=webframeworks
HOSTING_TARGETS=$(echo "$APPS" | sed 's/\([^,]*\)/hosting:\1/g')
firebase deploy --project clicker-universe-stagging --only "$HOSTING_TARGETS" --non-interactive
