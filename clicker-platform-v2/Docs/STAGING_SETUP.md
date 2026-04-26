# Staging Environment Setup Guide

Panduan ini untuk developer yang ingin mengarahkan `dev/` worktree ke Firebase **staging** (`clicker-universe-stagging`).

---

## 1. Sync Repository

Pastikan local sudah up-to-date dengan remote:

```bash
cd dev
git pull
```

> Tidak perlu `git checkout` — worktree sudah otomatis di branch `dev`.

---

## 2. Buat File `.env.production`

File env **tidak ikut di-push ke git** (hanya `.env*.local` yang di-ignore, tapi praktiknya env tetap perlu dibuat manual per developer).

Buat file berikut dengan isi persis seperti di bawah:

### `dev/clicker-platform-v2/.env.production`

```env
NEXT_PUBLIC_BASE_DOMAIN=stg-clicker-core.web.app
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
GCP_SERVICE_ACCOUNT_KEY=../clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json
```

### `dev/auth-gateway/.env.production`

```env
NEXT_PUBLIC_BASE_DOMAIN=stg-clicker-core.web.app
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
GCP_SERVICE_ACCOUNT_KEY=../clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json
```

### `dev/backyard/.env.production`

```env
NEXT_PUBLIC_BASE_DOMAIN=stg-clicker-core.web.app
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://stg-clicker-auth.web.app
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clicker-universe-stagging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe-stagging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clicker-universe-stagging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=603624012885
NEXT_PUBLIC_FIREBASE_APP_ID=1:603624012885:web:2098c7fd9b1f06f440e8dc
GCP_SERVICE_ACCOUNT_KEY=../clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json
```

> **Penting:** Ketiga file ini isinya sama persis. Pastikan tidak ada `.env.local` yang masih berisi config prod — kalau ada, hapus.

---

## 3. Tambah Service Account Key Staging

Download dari Firebase Console:
1. Buka [Firebase Console](https://console.firebase.google.com) → project **clicker-universe-stagging**
2. Project Settings → Service Accounts → **Generate new private key**
3. Rename file menjadi: `clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json`
4. Taruh di folder `dev/` (sejajar dengan `clicker-platform-v2/`, `auth-gateway/`, `backyard/`)

```
dev/
├── clicker-platform-v2/
├── auth-gateway/
├── backyard/
├── clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json  ← taruh di sini
└── deploy_staging_hosting.sh
```

---

## 4. Install Dependencies

```bash
cd dev/clicker-platform-v2 && pnpm install && cd ..
cd auth-gateway && pnpm install && cd ..
cd backyard && pnpm install && cd ..
```

---

## 5. Hapus `.env.local` Lama (Jika Ada)

Kalau sebelumnya pernah pakai `.env.local` yang berisi config prod, hapus dulu:

```bash
rm -f dev/clicker-platform-v2/.env.local
rm -f dev/auth-gateway/.env.local
rm -f dev/backyard/.env.local
```

---

## 6. Deploy ke Staging

```bash
cd dev
bash deploy_staging_hosting.sh
```

Script ini akan build semua app lalu deploy ke Firebase staging targets:
- `hosting:core` → `stg-clicker-core.web.app`
- `hosting:auth` → `stg-clicker-auth.web.app`
- `hosting:backyard` → `stg-clicker-backyard.web.app`

---

## Catatan Routing Staging

Staging menggunakan **path-based routing** (bukan subdomain), karena domain `stg-clicker-core.web.app` tidak support subdomain.

| URL | Keterangan |
|-----|------------|
| `https://stg-clicker-core.web.app/{tenant}` | Biolink tenant |
| `https://stg-clicker-core.web.app/{tenant}/admin` | Admin dashboard tenant |
| `https://stg-clicker-auth.web.app` | Auth gateway |
| `https://stg-clicker-backyard.web.app` | Backyard (superadmin) |

---

## Akun Staging

Semua user dari prod sudah di-clone ke staging dengan password seragam:

```
Password: B1774sjo
```

> **God mode (clickerplatform@gmail.com)** dibuat manual — tanya admin untuk aksesnya.
