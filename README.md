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

## Static Analysis

Semgrep with community rule packs (`p/default`, `p/typescript`, `p/javascript`, `p/react`, `p/nextjs`, `p/owasp-top-ten`, `p/security-audit`). Rule list pinned in `Makefile` and `.github/workflows/semgrep.yml`.

```bash
make semgrep-install   # brew install semgrep (one-time)
make semgrep           # scan from repo root
make semgrep-secrets   # separate p/secrets sweep
make semgrep-sarif     # emit semgrep.sarif
```

CI runs the same scan on PRs to `main` and on merges; results land in **Security → Code scanning**. Non-blocking by default — add `--error` to the workflow's semgrep command to gate merges.

## Env

```
{app}/.env.local                # shared (prod Firebase credentials)
{app}/.env.development.local    # override dev (staging Firebase, localhost URLs)
```

## Docs

- [CLAUDE.md](./CLAUDE.md) — Rules, auth flow, skills index
- [ARCHITECTURE.md](./clicker-platform-v2/Docs/ARCHITECTURE.md) — Full architecture reference
- [.agents/README.md](./.agents/README.md) — Claude Code skills
