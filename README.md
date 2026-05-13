# Clicker Universe — Monorepo

Repository utama **Clicker Universe** ecosystem. Monorepo berisi 3 aplikasi Next.js + Firebase Functions yang terhubung ke Firebase project production (`clicker-universe`).

---

## Project Structure

| Folder | Port | Deskripsi |
|--------|------|-----------|
| [`clicker-platform-v2/`](./clicker-platform-v2) | **3000** | Core Multi-Tenant SaaS Platform |
| [`auth-gateway/`](./auth-gateway) | **3012** | Thin auth layer — login + handoff ke platform |
| [`backyard/`](./backyard) | **3013** | Super-admin "God Mode" dashboard |
| [`functions/`](./functions) | — | Firebase Cloud Functions |
| [`scripts/`](./scripts) | — | Deploy scripts, seeders, utilities |
| [`superpowers/`](./superpowers) | — | Design specs, plans, audit notes |

---

## Getting Started

```bash
# Platform (port 3000)
cd clicker-platform-v2 && pnpm dev

# Auth Gateway (port 3012)
cd auth-gateway && pnpm dev

# Backyard (port 3013)
cd backyard && pnpm dev
```

Akses di browser:
- **Platform admin**: http://localhost:3000
- **Auth login**: http://localhost:3012
- **Super-admin**: http://localhost:3013

---

## Environment Variables

Setiap app punya file env (gitignored):

```
{app}/.env.local                # shared vars semua env
{app}/.env.development.local    # override untuk dev (staging Firebase, localhost URLs)
```

`clicker-platform-v2/.env.local` berisi prod Firebase credentials. `.env.development.local` override ke staging project untuk local dev.

---

## Branches

| Branch | Fungsi |
|--------|--------|
| `main` | Production — konek ke `clicker-universe` |
| `dev` | Development — konek ke `clicker-universe-stagging` |

---

## Deploy

### Production

```bash
# Semua (hosting + functions + firestore)
./scripts/deploy-prod.sh

# Per target
./scripts/deploy-prod.sh core
./scripts/deploy-prod.sh backyard
./scripts/deploy-prod.sh auth
./scripts/deploy-prod.sh functions
./scripts/deploy-prod.sh firestore
```

URL production:
- https://clicker.id (platform)
- https://auth.clicker.id (auth gateway)
- https://backyard.clicker.id (backyard)

### Staging

```bash
./scripts/deploy-staging.sh
./scripts/deploy-staging.sh core
```

URL staging:
- https://stg-clicker-core.web.app
- https://stg-clicker-auth.web.app
- https://stg-clicker-backyard.web.app

---

## Firebase Hosting Targets

```
clicker-universe (prod):
  core      → clickerapps           (platform-v2)
  auth      → clicker-auth-gateway  (auth-gateway)
  backyard  → clicker-backyard-app  (backyard)

clicker-universe-stagging (staging):
  core      → stg-clicker-core
  auth      → stg-clicker-auth
  backyard  → stg-clicker-backyard
```

---

## Architecture

### Multi-tenancy

Setiap tenant punya `siteId` (slug), data terisolasi di `sites/{siteId}/...` Firestore.

URL pattern:
- **Dev**: `{slug}.localhost:3000`
- **Production**: `{slug}.clicker.id`

### Auth Flow

```
User → auth.clicker.id → custom token + siteId → redirect ke {slug}.clicker.id/admin
```

Detail lengkap: [`CLAUDE.md`](./CLAUDE.md)

### Module System

Modul (POS, Reservation, Membership, Promo, dll) terdaftar di `modules/{id}` Firestore, toggle per-tenant via `sites/{siteId}.modules.{moduleId} = true`.

---

## Testing

```bash
cd clicker-platform-v2
pnpm test
pnpm test:watch
```

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — Architecture rules, auth flow, module system
- [`.agents/README.md`](./.agents/README.md) — Index semua Claude Code skills
- [`clicker-platform-v2/Docs/ARCHITECTURE.md`](./clicker-platform-v2/Docs/ARCHITECTURE.md) — Detail arsitektur platform
- [`superpowers/specs/`](./superpowers/specs/) — Feature design specs
