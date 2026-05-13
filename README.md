# Clicker Universe — Monorepo

Multi-tenant SaaS platform. 3 Next.js apps + Firebase Functions → Firebase project `clicker-universe` (prod).

## Apps

| Folder | Port | Fungsi |
|--------|------|--------|
| `clicker-platform-v2/` | 3000 | Core platform (admin dashboard tenant) |
| `auth-gateway/` | 3012 | Auth layer — login + handoff |
| `backyard/` | 3013 | Super-admin God Mode |
| `functions/` | — | Firebase Cloud Functions |

## Dev

```bash
cd clicker-platform-v2 && pnpm dev   # localhost:3000
cd auth-gateway && pnpm dev           # localhost:3012
cd backyard && pnpm dev               # localhost:3013
```

## Branches

| Branch | Firebase Project | URL |
|--------|-----------------|-----|
| `main` | `clicker-universe` | clicker.id |
| `dev` | `clicker-universe-stagging` | stg-clicker-core.web.app |

## Deploy

```bash
./scripts/deploy-prod.sh              # semua ke prod
./scripts/deploy-prod.sh core         # platform saja
./scripts/deploy-prod.sh backyard
./scripts/deploy-prod.sh auth
./scripts/deploy-prod.sh functions
./scripts/deploy-prod.sh firestore

./scripts/deploy-staging.sh           # semua ke staging
./scripts/deploy-staging.sh core
```

## Modules

POS · Membership · Inventory · Stocklens · Reservation · Sales Pipeline · Service Records · Promo · Fintrack · AI Sales Agent · AI Marketing

Toggle per-tenant via `sites/{siteId}.modules.{moduleId} = true`. Detail: [ARCHITECTURE.md](./clicker-platform-v2/Docs/ARCHITECTURE.md)

## Env

```
{app}/.env.local                # shared (prod Firebase credentials)
{app}/.env.development.local    # override dev (staging Firebase, localhost URLs)
```

## Docs

- [CLAUDE.md](./CLAUDE.md) — Rules, auth flow, skills index
- [ARCHITECTURE.md](./clicker-platform-v2/Docs/ARCHITECTURE.md) — Full architecture reference
- [.agents/README.md](./.agents/README.md) — Claude Code skills
