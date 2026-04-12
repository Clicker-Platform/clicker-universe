# Development Workflow Guide — Clicker Platform

> Created: 2026-04-10
> Purpose: Panduan lengkap untuk tim development bekerja paralel dengan aman menggunakan git worktree dan staging Firestore

---

## Table of Contents

1. [Overview](#1-overview)
2. [Arsitektur Repository](#2-arsitektur-repository)
3. [Environment & Firebase Projects](#3-environment--firebase-projects)
4. [Setup Awal (One-Time)](#4-setup-awal-one-time)
5. [Membuat Feature Worktree](#5-membuat-feature-worktree)
6. [Daily Workflow](#6-daily-workflow)
7. [Push & Pull](#7-push--pull)
8. [Merge Feature ke Dev](#8-merge-feature-ke-dev)
9. [Release ke Production](#9-release-ke-production)
10. [Menghapus Feature Worktree](#10-menghapus-feature-worktree)
11. [Troubleshooting](#11-troubleshooting)
12. [Rules & Best Practices](#12-rules--best-practices)
13. [Command Reference](#13-command-reference)

---

## 1. Overview

### Kenapa Workflow Ini?

Tim Clicker Platform perlu bisa **kerja paralel di module berbeda tanpa takut crash production**. Solusinya:

1. **Staging Firestore terpisah** — dev environment connect ke `clicker-universe-stagging`, bukan production
2. **Feature worktrees** — setiap developer/module punya folder kerja sendiri, bisa jalan bersamaan
3. **Safety guards** — runtime protection agar dev server tidak mungkin nulis ke production Firestore

### Diagram Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Git Bare Repository                       │
│                      .bare/ (8MB)                           │
│              Shared git objects — NOT duplicated             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  main/                → branch: main                        │
│  ├── .env.production  → clicker-universe (PRODUCTION)       │
│  └── Deploy: clicker.id                                     │
│                                                             │
│  dev/                 → branch: dev                         │
│  ├── .env.local       → clicker-universe-stagging (STAGING) │
│  └── Deploy: stagging.clicker.id                            │
│                                                             │
│  dev-marketing/       → branch: feat/marketing              │
│  ├── .env.local       → clicker-universe-stagging (STAGING) │
│  └── Developer: Adi                                         │
│                                                             │
│  dev-ai/              → branch: feat/ai-agent               │
│  ├── .env.local       → clicker-universe-stagging (STAGING) │
│  └── Developer: Budi                                        │
│                                                             │
│  dev-pos/             → branch: feat/pos-receipt            │
│  ├── .env.local       → clicker-universe-stagging (STAGING) │
│  └── Developer: Caca                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Flow:
  dev-marketing/ ──┐
  dev-ai/      ────┼── merge ──► dev/ ──► test staging ──► main/ ──► production
  dev-pos/     ────┘
```

### Apa Itu Git Worktree?

Git worktree memungkinkan kamu punya **beberapa working directory** dari satu repository. Bukan copy/clone — semua worktree **share git objects** yang sama.

| Aspek | Worktree | Clone Ulang |
|-------|----------|-------------|
| Source files | 11MB per worktree | 11MB per clone |
| Git objects | **Shared** (8MB total) | **Duplicated** (8MB per clone) |
| node_modules | Hardlinks via pnpm (minimal extra disk) | Full copy (1.7GB per clone) |
| Git history | Shared | Independent |
| Branch conflict | Satu branch hanya bisa di satu worktree | Tidak ada conflict |

---

## 2. Arsitektur Repository

### Directory Structure

```
clicker-platform/              ← root (di mana .bare berada)
├── .bare/                     ← git objects (shared)
├── .env.staging               ← staging env template (committed to git)
│
├── main/                      ← PRODUCTION worktree (branch: main)
│   ├── clicker-platform-v2/   ← Main Next.js app (port 3000)
│   ├── auth-gateway/          ← Auth service (port 3012)
│   ├── backyard/              ← Superadmin dashboard (port 3011)
│   ├── functions/             ← Firebase Cloud Functions
│   ├── scripts/               ← Helper scripts
│   ├── Makefile               ← Shorthand commands
│   └── .firebaserc            ← default: clicker-universe (prod)
│
├── dev/                       ← STAGING worktree (branch: dev)
│   ├── clicker-platform-v2/
│   │   └── .env.local         ← staging credentials (gitignored)
│   ├── auth-gateway/
│   │   └── .env.local
│   ├── backyard/
│   │   └── .env.local
│   └── .firebaserc            ← default: clicker-universe-stagging
│
├── dev-marketing/             ← FEATURE worktree (branch: feat/marketing)
│   ├── clicker-platform-v2/
│   │   └── .env.local         ← staging credentials (auto-copied)
│   └── ...
│
└── dev-ai/                    ← FEATURE worktree (branch: feat/ai-agent)
    └── ...
```

### Apps dalam Monorepo

| App | Directory | Port | Purpose |
|-----|-----------|------|---------|
| Core Platform | `clicker-platform-v2/` | 3000 | Main Next.js app |
| Auth Gateway | `auth-gateway/` | 3012 | Authentication service |
| Backyard | `backyard/` | 3011 | Superadmin dashboard |
| Functions | `functions/` | 5001 | Firebase Cloud Functions |

---

## 3. Environment & Firebase Projects

### Firebase Projects

| Project ID | Alias | Domain | Purpose |
|-----------|-------|--------|---------|
| `clicker-universe` | prod | clicker.id | **PRODUCTION** — live users |
| `clicker-universe-stagging` | staging | stagging.clicker.id | **STAGING** — dev & testing |

### Environment Files

| File | Tracked? | Purpose |
|------|----------|---------|
| `.env.production` | Ya (git tracked) | Production Firebase credentials |
| `.env.local` | **Tidak** (gitignored) | Override ke staging — **ini yang kita pakai di dev** |
| `.env.staging` | Ya (git tracked) | Template staging credentials — source of truth |

### Kenapa `.env.local` dan Bukan `.env.production`?

Next.js load environment files dengan prioritas:
1. `.env.local` ← **highest priority, override semua**
2. `.env.production` / `.env.development`
3. `.env`

Kita pakai `.env.local` karena:
- **Gitignored** — tidak masuk ke git, tidak bisa accidentally merge ke production
- **Override** `.env.production` yang berisi production credentials
- **Per-worktree** — setiap worktree bisa punya `.env.local` sendiri

### Staging Credentials

Semua ada di `.env.staging` (committed ke git sebagai template):

```env
NEXT_PUBLIC_BASE_DOMAIN=stagging.clicker.id
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
GCP_SERVICE_ACCOUNT_KEY=../clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json
```

---

## 4. Setup Awal (One-Time)

### 4.1 Clone Repository (Developer Baru)

```bash
# Clone sebagai bare repository
git clone --bare https://github.com/Clicker-Platform/clicker-universe.git clicker-platform/.bare

cd clicker-platform

# Configure bare repo
git config core.bare false
git config core.worktree ..

# Buat worktree utama
git worktree add main main
git worktree add dev dev
```

### 4.2 Setup Staging Environment di Dev Worktree

```bash
# Dari root repo (di mana .bare berada)
cd dev

# Jalankan setup script
make setup-env

# Atau manual:
cp ../.env.staging clicker-platform-v2/.env.local
cp ../.env.staging auth-gateway/.env.local
cp ../.env.staging backyard/.env.local
```

### 4.3 Install Dependencies

```bash
cd dev
make install

# Atau manual per app:
cd clicker-platform-v2 && pnpm install
cd ../auth-gateway && pnpm install
cd ../backyard && pnpm install
```

### 4.4 Verifikasi Environment

```bash
cd dev
make check-env

# Expected output:
# clicker-platform-v2:     NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
# auth-gateway:            NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
# backyard:                NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
```

### 4.5 Test Dev Server

```bash
cd dev/clicker-platform-v2
pnpm dev

# Console harus menampilkan:
# [Firebase] Initialized with config: {
#   projectId: 'clicker-universe-stagging',    ← ✅ STAGING
#   authDomain: 'clicker-universe-stagging.firebaseapp.com'
# }
```

---

## 5. Membuat Feature Worktree

### 5.1 Menggunakan Script (Recommended)

```bash
# Dari root repo atau dari worktree manapun
./scripts/create-worktree.sh feat/marketing

# Output:
# Creating worktree 'dev-marketing' from branch 'dev'...
#   -> Copied .env.local to clicker-platform-v2/
#   -> Copied .env.local to auth-gateway/
#   -> Copied .env.local to backyard/
#
# Done! Worktree ready at: /path/to/clicker-platform/dev-marketing
#   cd dev-marketing/clicker-platform-v2 && pnpm install && pnpm dev
```

### 5.2 Manual (Kalau Script Belum Ada)

```bash
# Dari root repo (di mana .bare berada)

# 1. Buat worktree + branch
git worktree add dev-marketing -b feat/marketing dev

# 2. Copy staging env
cp .env.staging dev-marketing/clicker-platform-v2/.env.local
cp .env.staging dev-marketing/auth-gateway/.env.local
cp .env.staging dev-marketing/backyard/.env.local

# 3. Install dependencies
cd dev-marketing/clicker-platform-v2
pnpm install

# 4. Start dev server
pnpm dev
```

### 5.3 Naming Convention

| Branch Name | Worktree Directory | Use Case |
|------------|-------------------|----------|
| `feat/marketing` | `dev-marketing/` | New feature |
| `feat/ai-agent` | `dev-ai-agent/` | New feature |
| `feat/pos-receipt` | `dev-pos-receipt/` | New feature |
| `fix/auth-redirect` | `dev-auth-redirect/` | Bug fix |
| `chore/cleanup-deps` | `dev-cleanup-deps/` | Maintenance |

Pattern: `dev-{deskripsi}/` — selalu prefix `dev-` agar jelas ini development worktree.

---

## 6. Daily Workflow

### 6.1 Mulai Kerja

```bash
# Masuk ke worktree kamu
cd dev-marketing/clicker-platform-v2

# Start dev server
pnpm dev
```

### 6.2 Coding & Commit

```bash
# Cek status
git status

# Stage changes
git add lib/modules/marketing/
git add components/marketing/

# Commit dengan conventional commit
git commit -m "feat(marketing): add email campaign builder"
```

### 6.3 Sync dengan Dev Terbaru

Penting dilakukan secara rutin agar branch kamu tidak terlalu jauh dari `dev`:

```bash
# Fetch latest dari remote
git fetch origin

# Merge dev terbaru ke branch kamu
git merge origin/dev

# Atau rebase (kalau prefer linear history)
git rebase origin/dev
```

**Kapan sync?**
- Setiap pagi sebelum mulai kerja
- Sebelum buat PR / merge ke dev
- Ketika tim bilang ada update penting di dev

### 6.4 Resolve Conflicts

Kalau ada conflict saat merge/rebase:

```bash
# 1. Lihat file yang conflict
git status

# 2. Edit file yang conflict, cari marker <<<< ==== >>>>
# Pilih kode yang benar, hapus marker

# 3. Stage resolved files
git add <resolved-files>

# 4. Continue merge/rebase
git merge --continue
# atau
git rebase --continue
```

**Tips menghindari conflict:**
- Setiap developer fokus di module/folder berbeda
- Sync dengan dev secara rutin
- Hindari edit file shared (firebase.ts, layout.tsx) tanpa koordinasi

---

## 7. Push & Pull

### 7.1 Push Feature Branch ke GitHub

```bash
# Push pertama kali (set upstream)
git push -u origin feat/marketing

# Push selanjutnya
git push
```

### 7.2 Pull Update dari Remote

```bash
# Pull update di branch kamu sendiri (kalau tim lain push ke branch yang sama)
git pull

# Pull update dari dev (sync)
git fetch origin
git merge origin/dev
```

### 7.3 Melihat Semua Worktrees

```bash
# Dari directory manapun dalam repo
git worktree list

# Output:
# /path/clicker-platform/.bare     (bare)
# /path/clicker-platform/main      ef87867 [main]
# /path/clicker-platform/dev       174357f [dev]
# /path/clicker-platform/dev-marketing  abc1234 [feat/marketing]
# /path/clicker-platform/dev-ai    def5678 [feat/ai-agent]
```

### 7.4 Melihat Semua Remote Branches

```bash
git branch -a

# Output:
# * feat/marketing          ← branch aktif di worktree ini
#   dev
#   main
#   remotes/origin/dev
#   remotes/origin/main
#   remotes/origin/feat/marketing
#   remotes/origin/feat/ai-agent
```

---

## 8. Merge Feature ke Dev

### Option A: Via GitHub Pull Request (Recommended)

PR memberikan kesempatan untuk code review sebelum merge.

```bash
# 1. Push branch terbaru
cd dev-marketing
git push -u origin feat/marketing

# 2. Buat PR via CLI
gh pr create --base dev --head feat/marketing \
  --title "feat(marketing): email campaign builder" \
  --body "## Summary
- Add email campaign builder UI
- Integrate with template system
- Add campaign analytics dashboard

## Test Plan
- [ ] Create new campaign
- [ ] Send test email
- [ ] Check analytics after 1 hour"

# 3. Tim review & approve

# 4. Merge PR di GitHub (atau via CLI)
gh pr merge --merge --delete-branch
```

### Option B: Merge Langsung di Local

Untuk perubahan kecil atau ketika tidak perlu review:

```bash
# 1. Pastikan branch kamu up-to-date dengan dev
cd dev-marketing
git fetch origin
git merge origin/dev    # resolve conflicts jika ada

# 2. Pindah ke dev worktree
cd ../dev

# 3. Pull dev terbaru
git pull origin dev

# 4. Merge feature branch
git merge --no-ff feat/marketing
# --no-ff = selalu buat merge commit, agar history terlihat jelas

# 5. Push ke remote
git push origin dev
# Ini akan trigger GitHub Actions → deploy ke staging
```

### Setelah Merge

```bash
# Verifikasi di staging
# Buka https://stg-clicker-core.web.app dan test fitur

# Kalau OK, cleanup worktree (lihat section 10)
```

---

## 9. Release ke Production

Ketika semua fitur di dev sudah tested dan siap:

```bash
# 1. Pindah ke main worktree
cd main

# 2. Pull main terbaru
git pull origin main

# 3. Merge dev ke main
git merge --no-ff dev

# 4. Push ke remote
git push origin main

# 5. Deploy ke production
./scripts/deploy-safe.sh
# Script ini otomatis detect worktree 'main' → deploy ke clicker-universe (prod)
```

### Release Checklist

- [ ] Semua fitur di dev sudah tested di staging
- [ ] Tidak ada known bugs di staging
- [ ] Tim sudah approve release
- [ ] `make check-env` di main menunjukkan `clicker-universe` (production)
- [ ] Deploy berhasil tanpa error

---

## 10. Menghapus Feature Worktree

Setelah feature sudah merged ke dev:

### Menggunakan Script

```bash
./scripts/remove-worktree.sh dev-marketing

# Output:
# Removing worktree 'dev-marketing'...
# Delete branch 'feat/marketing'? (y/N) y
# Branch 'feat/marketing' deleted.
# Done.
```

### Manual

```bash
# 1. Hapus worktree
git worktree remove dev-marketing

# 2. Hapus branch lokal
git branch -d feat/marketing

# 3. Hapus branch remote (jika sudah merge via PR, ini otomatis)
git push origin --delete feat/marketing
```

---

## 11. Troubleshooting

### "Dev server pointing to PRODUCTION Firebase!"

**Penyebab:** `.env.local` belum ada atau salah isinya.

```bash
# Fix:
make setup-env

# Atau manual:
cp ../.env.staging clicker-platform-v2/.env.local
```

### "fatal: 'feat/marketing' is already checked out"

**Penyebab:** Branch sudah dipakai di worktree lain.

```bash
# Cek worktree mana yang pakai branch ini
git worktree list

# Solusi: pakai nama branch berbeda, atau hapus worktree lama dulu
```

### "pnpm install" lambat di worktree baru

**Penyebab:** Pertama kali install di worktree baru, pnpm perlu link dari global store.

```bash
# Biasanya cuma ~30 detik karena pnpm pakai hardlinks
# Kalau masih lambat, cek pnpm store
pnpm store status
```

### Conflict saat merge ke dev

```bash
# 1. Lihat files yang conflict
git diff --name-only --diff-filter=U

# 2. Untuk setiap file, resolve conflict
# Buka file, cari <<<< ==== >>>> markers
# Edit, simpan

# 3. Stage dan complete merge
git add .
git merge --continue
```

### Port sudah dipakai (EADDRINUSE)

Kalau kamu dan tim jalankan dev server di mesin yang sama:

```bash
# Jalankan di port berbeda
cd dev-marketing/clicker-platform-v2
pnpm dev -- -p 3001    # port 3001 instead of 3000

# Atau kill proses lama
lsof -i :3000
kill -9 <PID>
```

### Worktree state rusak / corrupt

```bash
# Repair worktree references
git worktree repair

# Kalau masih error, prune stale worktrees
git worktree prune
```

---

## 12. Rules & Best Practices

### WAJIB

1. **JANGAN PERNAH edit `.env.production`** — file ini tracked di git, berisi production credentials
2. **Selalu pakai `.env.local`** untuk override ke staging — file ini gitignored
3. **Selalu `make check-env` sebelum dev** — pastikan connect ke staging
4. **Satu developer = satu feature worktree** — jangan share worktree
5. **Sync dengan dev minimal 1x sehari** — `git fetch origin && git merge origin/dev`
6. **Pakai `--no-ff` saat merge** — agar history jelas

### RECOMMENDED

1. **Fokus di module sendiri** — kurangi edit file shared (layout, firebase.ts, etc.)
2. **Commit sering, push sering** — jangan simpan banyak uncommitted changes
3. **Pakai conventional commits** — `feat(module):`, `fix(module):`, `chore(module):`
4. **Buat PR untuk merge ke dev** — meskipun small team, review tetap valuable
5. **Test di staging sebelum merge ke main** — buka https://stg-clicker-core.web.app
6. **Cleanup worktree setelah merge** — jangan biarkan worktree lama menumpuk

### Module Isolation

Setiap developer sebaiknya kerja di **module yang berbeda** untuk meminimalkan conflict:

```
Developer A (dev-marketing/)  → lib/modules/marketing/
                               → components/marketing/
                               → app/admin/marketing/

Developer B (dev-ai/)         → lib/modules/ai_sales_agent/
                               → components/ai-sales-agent/
                               → app/admin/ai-agent/

Developer C (dev-pos/)        → lib/modules/byod_pos/
                               → components/pos/
                               → app/admin/pos/
```

File yang SHARED dan butuh koordinasi jika di-edit:
- `lib/modules/definitions.ts` — module registration
- `app/layout.tsx` — root layout
- `lib/firebase.ts` — Firebase initialization
- `components/admin/AdminSidebar.tsx` — sidebar navigation

---

## 13. Command Reference

### Scripts

| Command | Description |
|---------|------------|
| `./scripts/create-worktree.sh feat/xxx` | Buat feature worktree baru dari dev |
| `./scripts/remove-worktree.sh dev-xxx` | Hapus feature worktree + branch |
| `./scripts/setup-dev-env.sh` | Copy staging env ke semua apps |
| `./scripts/deploy-safe.sh` | Deploy ke Firebase (worktree-aware) |

### Makefile Targets

| Command | Description |
|---------|------------|
| `make dev` | Start main platform dev server (port 3000) |
| `make dev-auth` | Start auth gateway (port 3012) |
| `make dev-backyard` | Start backyard (port 3011) |
| `make install` | Install semua dependencies |
| `make build` | Build main platform |
| `make test` | Run tests |
| `make lint` | Run ESLint |
| `make setup-env` | Setup staging .env.local |
| `make check-env` | Cek Firebase project yang aktif |
| `make emulators` | Start Firebase emulators |
| `make clean` | Hapus .next caches |

### Git Worktree Commands

| Command | Description |
|---------|------------|
| `git worktree list` | Lihat semua worktrees |
| `git worktree add <path> -b <branch> dev` | Buat worktree baru dari dev |
| `git worktree remove <path>` | Hapus worktree |
| `git worktree repair` | Repair worktree references |
| `git worktree prune` | Cleanup stale worktrees |

### Git Branch Commands

| Command | Description |
|---------|------------|
| `git branch -a` | Lihat semua branches |
| `git fetch origin` | Fetch remote updates |
| `git merge origin/dev` | Sync branch dengan dev terbaru |
| `git merge --no-ff feat/xxx` | Merge feature ke dev |
| `git push -u origin feat/xxx` | Push feature branch pertama kali |
| `git branch -d feat/xxx` | Hapus branch lokal |
| `git push origin --delete feat/xxx` | Hapus branch remote |

### GitHub CLI (gh)

| Command | Description |
|---------|------------|
| `gh pr create --base dev` | Buat PR ke dev |
| `gh pr list` | Lihat semua open PRs |
| `gh pr merge --merge` | Merge PR |
| `gh pr checks` | Cek CI status |

---

## Appendix: Safety Guards

Untuk mencegah developer secara tidak sengaja nulis ke production Firestore, ada runtime guards di:

- `clicker-platform-v2/lib/firebase.ts` — Client SDK
- `clicker-platform-v2/lib/firebase-admin.ts` — Admin SDK  
- `auth-gateway/lib/firebase.ts` — Auth Gateway
- `backyard/lib/firebase.ts` — Backyard

Guard ini akan **throw error dan menolak start** jika:
- `NODE_ENV === 'development'` (dev server)
- `projectId === 'clicker-universe'` (production project)

Artinya: kalau kamu lupa setup `.env.local`, dev server akan **crash dengan pesan jelas** daripada diam-diam nulis ke production.

```
Error: Dev server pointing to PRODUCTION Firebase!
Create .env.local with staging credentials. Run: make setup-env
```

---

## Appendix: Disk Usage

| Component | Size | Shared? |
|-----------|------|---------|
| `.bare/` (git objects) | ~8MB | Ya — semua worktree share |
| Source code per worktree | ~11MB | Tidak — tapi kecil |
| `node_modules` per worktree | ~1.7GB (apparent) | Sebagian — pnpm hardlinks ke global store |
| pnpm global store | ~2.6GB | Ya — satu store untuk semua |

**Total actual extra disk per feature worktree ≈ 11MB + hardlink overhead**

`pnpm install` di worktree baru biasanya selesai dalam ~30 detik karena semua packages sudah ada di global store.
