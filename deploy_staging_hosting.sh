#!/bin/bash
set -e

# Deploy staging ke clicker-universe-stagging
# Env sudah dikonfigurasi di masing-masing .env.production per app
# Jalankan dari directory dev/

# Force webpack bundler — Next.js 16 defaults to Turbopack which ignores
# serverExternalPackages for firebase-admin, causing runtime module resolution errors.
export IS_WEBPACK_TEST=1

APPS=${1:-"core,auth,backyard"}

declare -A APP_DIRS
APP_DIRS[core]="clicker-platform-v2"
APP_DIRS[auth]="auth-gateway"
APP_DIRS[backyard]="backyard"

IFS=',' read -ra TARGETS <<< "$APPS"

for target in "${TARGETS[@]}"; do
  dir="${APP_DIRS[$target]}"
  echo "Building $dir..."
  cd "$dir"
  pnpm run build
  cd ..
done

echo "Deploying hosting: $APPS..."
export FIREBASE_CLI_EXPERIMENTS=webframeworks
export IS_WEBPACK_TEST=1
HOSTING_TARGETS=$(echo "$APPS" | sed 's/\([^,]*\)/hosting:\1/g')
firebase deploy --project clicker-universe-stagging --only "$HOSTING_TARGETS" --non-interactive
