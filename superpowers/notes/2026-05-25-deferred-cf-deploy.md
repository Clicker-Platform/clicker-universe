# Deferred: Cloud Function deploy for digital_goods auto-page seeder

Date: 2026-05-25
Branch: `feat/digital-goods-plan-2`

## What's deferred

The updated `updateTenantModules` Cloud Function — it contains the `seedDigitalGoodsData` logic that auto-creates the Store custom page when a tenant flips Digital Goods ON. Source: `functions/src/admin/modules/seeding.ts` (committed in `b2dca63`).

## Why deferred

Local environment runs Node v24.11.1. The functions package pins Node 22, and Node 24 has a breaking change in `path-to-regexp` that crashes Express 4 (used by `firebase-functions` CLI tooling) during the deploy's source-analysis step. No Node version manager installed locally.

Error reproducer:
```
TypeError: pathRegexp is not a function
  at new Layer (express/lib/router/layer.js:45:17)
  at .../firebase-functions/lib/bin/firebase-functions.js:71:6
```

## Workaround used in the meantime

Manually created the Store custom page for tenant `go` via a one-off Admin SDK script:
- Doc: `sites/go/pages/digital-goods-store`
- Shape: `{ id, title: 'Store', slug: 'store', content: '', blocks: [{ id, type: 'digital_goods_product_grid', data: { title, subtitle, limit: 12, columns: 3 } }], createdAt, updatedAt }`

For any future tenant that toggles Digital Goods ON before the CF is deployed, re-run the same script with their siteId.

## How to deploy when ready

1. Install Node 22 alongside Node 24:
   ```bash
   brew install node@22
   ```

2. Build + deploy with Node 22 prepended to PATH:
   ```bash
   cd /Users/andre/Repository/clicker-universe/dev/functions && pnpm build
   cd /Users/andre/Repository/clicker-universe/dev && \
     PATH="/opt/homebrew/opt/node@22/bin:$PATH" \
     firebase deploy --only functions:updateTenantModules --project clicker-universe-stagging
   ```

3. Verify by toggling Digital Goods OFF then ON in Backyard for a fresh tenant — the Store page should auto-appear.

## Long-term

Consider installing `fnm` or `nvm` for easier Node version switching:
```bash
brew install fnm
fnm install 22
fnm use 22  # per-shell
```

Or pin Node 22 in `.tool-versions` / `.nvmrc` at repo root so version managers auto-switch on cd.
