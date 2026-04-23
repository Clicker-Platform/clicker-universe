#!/bin/bash
set -e

GCP_KEY=$(cat "$(dirname "$0")/../clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json" 2>/dev/null || cat "/Users/mac/Documents/AI Project/clicker-platform/clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json")
GCP_KEY_INLINE=$(echo "$GCP_KEY" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)))")

ENV_VARS="NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
NEXT_PUBLIC_BASE_DOMAIN=stg-clicker-core.web.app
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app
WA_WEBHOOK_VERIFY_TOKEN=clicker-wa-verify-2024
WA_ENCRYPTION_KEY=clicker-wa-enc-key-staging-32chars"

for app in backyard clicker-platform-v2; do
  echo "Building $app..."
  printf '%s\n' "$ENV_VARS" > "$app/.env.production.local"
  printf 'GCP_SERVICE_ACCOUNT_KEY=%s\n' "$GCP_KEY_INLINE" >> "$app/.env.production.local"
  cd "$app"
  npm run build
  cd ..
done

# auth-gateway gets its own BASE_DOMAIN (its own hosting site)
echo "Building auth-gateway..."
AUTH_GATEWAY_ENV_VARS="NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
NEXT_PUBLIC_BASE_DOMAIN=stg-clicker-auth.web.app
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app"
echo "$AUTH_GATEWAY_ENV_VARS" > "auth-gateway/.env.production.local"
cd auth-gateway
npm run build
cd ..

echo "Deploying hosting to staging..."
export FIREBASE_CLI_EXPERIMENTS=webframeworks
firebase deploy --project clicker-universe-stagging --only hosting:core,hosting:auth,hosting:backyard --non-interactive
