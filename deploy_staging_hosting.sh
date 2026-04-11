#!/bin/bash
set -e

# Deploy staging ke clicker-universe-stagging
# Env sudah dikonfigurasi di masing-masing .env.production per app
# Jalankan dari directory dev/

for app in backyard clicker-platform-v2 auth-gateway; do
  echo "Building $app..."
  cd "$app"
  pnpm run build
  cd ..
done

echo "Deploying hosting to staging..."
export FIREBASE_CLI_EXPERIMENTS=webframeworks
firebase deploy --project clicker-universe-stagging --only hosting:core,hosting:auth,hosting:backyard --non-interactive
