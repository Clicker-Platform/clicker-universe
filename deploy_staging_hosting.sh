#!/bin/bash
set -e

# Deploy staging ke clicker-universe-stagging
# Env sudah dikonfigurasi di masing-masing .env.production per app
# Jalankan dari directory dev/

# Force webpack bundler — Next.js 16 defaults to Turbopack which ignores
# serverExternalPackages for firebase-admin, causing runtime module resolution errors.
export IS_WEBPACK_TEST=1

for app in backyard clicker-platform-v2 auth-gateway; do
  echo "Building $app..."
  cd "$app"
  pnpm run build
  cd ..
done

echo "Deploying hosting to staging..."
export FIREBASE_CLI_EXPERIMENTS=webframeworks
firebase deploy --project clicker-universe-stagging --only hosting:core,hosting:auth,hosting:backyard --non-interactive
