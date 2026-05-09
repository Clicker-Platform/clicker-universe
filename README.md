# Clicker Universe — Dev Monorepo

Repository pengembangan untuk seluruh **Clicker Universe** ecosystem. Monorepo berisi 3 aplikasi Next.js + Firebase Functions yang saling terhubung melalui satu Firebase project (staging: `clicker-universe-stagging`).

---

## 📂 Project Structure

| Folder | Port | Deskripsi |
|---|---|---|
| [`clicker-platform-v2/`](./clicker-platform-v2) | **3000** | Core Multi-Tenant SaaS Platform (admin dashboard tenant) |
| [`auth-gateway/`](./auth-gateway) | **3012** | Thin auth layer — login + handoff ke platform |
| [`backyard/`](./backyard) | **3013** | Super-admin "God Mode" dashboard |
| [`functions/`](./functions) | — | Firebase Cloud Functions (admin operations) |
| [`scripts/`](./scripts) | — | Utility scripts (seeders, debug, migrations) |
| [`superpowers/`](./superpowers) | — | Design specs, implementation plans, audit notes |

---

## 🚀 Getting Started

Setiap app punya `package.json` dan `node_modules` sendiri. Jalankan masing-masing di terminal terpisah:

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
- **Form register publik**: http://localhost:3000/register
- **Auth login**: http://localhost:3012
- **Super-admin**: http://localhost:3013

---

## 🔧 Environment Variables

Setiap app punya **2 file `.env`** saja (gitignored, aman untuk secret):

```
{app}/.env.development.local   # untuk pnpm dev
{app}/.env.production.local    # untuk pnpm build / deploy
```

Format env file: dokumentasi inline `# VAR_NAME` + deskripsi singkat. Lihat file existing untuk template.

**Variable groups:**
- Service URLs (BASE_DOMAIN, AUTH_GATEWAY, BACKYARD)
- Firebase Client SDK (`NEXT_PUBLIC_FIREBASE_*`)
- Firebase Admin SDK (`GCP_SERVICE_ACCOUNT_KEY`, server-only)
- Resend email (`RESEND_API_KEY`, template aliases)
- Notifikasi internal (`ADMIN_NOTIFICATION_EMAIL`)
- Feature flags (`NEXT_PUBLIC_ENABLE_WHATSAPP`, dll)

---

## 🏗️ Architecture

### Multi-tenancy

Platform-v2 melayani banyak tenant dari single codebase. Setiap tenant punya `siteId` (slug) dan data terisolasi di `sites/{siteId}/...` Firestore subcollection.

URL pattern:
- **Dev**: `localhost:3000/{slug}` (path-based)
- **Staging**: `https://stg-clicker-core.web.app/{slug}` (path-based)
- **Production** (custom domain): `https://clicker.id/{slug}` (path-based)

### Auth Flow

Lihat diagram lengkap di [`CLAUDE.md`](./CLAUDE.md). Ringkasnya:

```
User → auth.clicker.id (login) → custom token + siteId → redirect ke platform/admin
```

### Module System

Modul (POS, Reservation, Membership, Promo, dll) terdaftar di Firestore `modules/{id}` dan ter-toggle per-tenant via `sites/{siteId}.modules.{moduleId} = true`.

Adding new module: lihat [`CLAUDE.md`](./CLAUDE.md) Critical Rule #7.

### Registration Flow (added 2026-05-09)

User self-service register di `/register` → Backyard activate → email kredensial:

```
[1] User submit /register
    └─ Email konfirmasi → user (review max 3 jam)
    └─ Email notif → admin internal

[2] Admin Activate di Backyard
    └─ Form Create Tenant prefilled (modules, password auto-generate)
    └─ tempPassword disimpan di registrationRequests doc

[3] Admin test login manual

[4] Admin click "Kirim Kredensial"
    └─ Email kredensial → user dengan login URL + password
    └─ tempPassword dihapus, credentialsSent: true
```

Spec: [`superpowers/specs/2026-05-09-registration-email-and-modules-design.md`](./superpowers/specs/2026-05-09-registration-email-and-modules-design.md)

---

## 🌐 Firebase Hosting Targets

```
.firebaserc → clicker-universe-stagging:
  core      → stg-clicker-core      (platform-v2)
  auth      → stg-clicker-auth      (auth-gateway)
  backyard  → stg-clicker-backyard  (backyard)
```

URL staging:
- https://stg-clicker-core.web.app
- https://stg-clicker-auth.web.app
- https://stg-clicker-backyard.web.app

---

## 🚢 Deploy ke Staging

```bash
cd dev

# Switch ke staging project (PENTING)
firebase use staging

# Deploy semua hosting + rules + indexes
firebase deploy --only hosting,firestore:rules,firestore:indexes

# Atau per-target
firebase deploy --only hosting:core
firebase deploy --only hosting:backyard
firebase deploy --only hosting:auth
```

**Catatan deploy:**
- `.env.production.local` di-whitelist di `firebase.json` (`!.env.production.local`) — Cloud Build akan baca env saat build
- Untuk deploy ke production, ganti ke `firebase use prod`

---

## 🧪 Testing

```bash
cd clicker-platform-v2
pnpm test              # Vitest run all
pnpm test lib/registration   # specific path
pnpm test:watch        # watch mode
```

Backyard belum punya test runner — verifikasi via `pnpm build` + manual smoke test.

---

## 📚 Documentation

- [`CLAUDE.md`](./CLAUDE.md) — Architecture rules, auth flow, module system
- [`AGENTS.md`](./AGENTS.md) — Full architecture reference (kalau ada)
- [`.agents/README.md`](./.agents/README.md) — Index dari semua Claude Code skills
- [`superpowers/specs/`](./superpowers/specs/) — Feature design specs
- [`superpowers/plans/`](./superpowers/plans/) — Implementation plans
- [`clicker-platform-v2/Docs/ARCHITECTURE.md`](./clicker-platform-v2/Docs/ARCHITECTURE.md) — Detail arsitektur platform

---

## 🛠️ Common Commands

```bash
# Run seeder platform config (modules catalog)
cd clicker-platform-v2 && pnpm dlx tsx scripts/seed-platform-config.ts

# Build all
cd clicker-platform-v2 && pnpm build
cd backyard && pnpm build
cd auth-gateway && pnpm build

# Lint
pnpm lint

# Firestore: deploy rules & indexes
firebase deploy --only firestore:rules,firestore:indexes
```
