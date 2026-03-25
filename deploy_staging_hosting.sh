#!/bin/bash
set -e

ENV_VARS="NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
NEXT_PUBLIC_BASE_DOMAIN=stg-clicker-core.web.app
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app"

for app in backyard clicker-platform-v2 auth-gateway; do
  echo "Building $app..."
  echo "$ENV_VARS" > "$app/.env.production.local"
  cd "$app"
  npm run build
  cd ..
done

echo "Deploying hosting to staging..."
export FIREBASE_CLI_EXPERIMENTS=webframeworks
firebase deploy --project clicker-universe-stagging --only hosting --non-interactive
