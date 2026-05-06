#!/usr/bin/env bash
# Syncs lib/email/ from the platform into auth-gateway.
# Run after any edit to lib/email/. CI will fail if drift exists.

set -euo pipefail

SRC="clicker-platform-v2/lib/email"
DST="auth-gateway/lib/email"

if [ ! -d "$SRC" ]; then
  echo "Source directory $SRC not found. Run from repo root." >&2
  exit 1
fi

# Wipe destination and copy fresh.
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/." "$DST/"

# Drop tests; auth-gateway has no vitest setup.
rm -rf "$DST/__tests__"

echo "Synced $SRC -> $DST (tests excluded)."
