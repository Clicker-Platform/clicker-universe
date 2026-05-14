# Security Auth Fix — Design Spec
Date: 2026-05-14

## Problem Summary

Semgrep AI scan menemukan missing authentication dan authorization di tiga app:
1. **Backyard** — semua `/api/*` routes exposed tanpa auth
2. **Auth Gateway** — `/api/token` menerima arbitrary UID → full account takeover
3. **Clicker Platform** — beberapa endpoint tanpa auth, beberapa dengan auth tapi tanpa site membership check (IDOR)

## Approach

Middleware-based Firebase ID token verification per app. Reuse existing `lib/api-auth.ts` pattern yang sudah ada di clicker-platform-v2.

---

## Section 1: Backyard Auth

### Problem
Tidak ada `middleware.ts` di backyard. Semua `/api/*` routes (secrets, email-config, ai-settings, registrations) accessible tanpa auth dari public internet.

### Fix

**Buat `dev/backyard/middleware.ts`:**
- Intercept semua `/api/*` routes
- Baca `Authorization: Bearer <token>` header
- Verify token via Firebase Admin → dapat decoded token
- Cek `decodedToken.email === process.env.SUPER_ADMIN_EMAIL`
- Return 401 jika tidak match

**Buat `dev/backyard/lib/require-superadmin.ts`:**
- Helper function untuk per-route verification (backup/reuse)
- Signature: `requireSuperadmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false; res: NextResponse }>`

**Update frontend fetch calls:**
- Semua `fetch('/api/...')` di backyard frontend tambah header:
  ```
  Authorization: Bearer <await user.getIdToken()>
  ```
- User object sudah available dari Firebase Auth session (magic link login)

### Env Var
```
SUPER_ADMIN_EMAIL=<email superadmin>
```
Sudah ada di codebase (hardcoded di functions) — pindah ke env var.

---

## Section 2: Auth Gateway `/api/token`

### Problem
`POST /api/token` menerima `uid` dari request body dan langsung buat Firebase custom token tanpa verifikasi caller. Siapapun bisa impersonate user manapun.

### Fix

**Update `dev/auth-gateway/app/api/token/route.ts`:**
- Baca `Authorization: Bearer <idToken>` header
- Verify ID token via Firebase Admin → dapat `uid` dari verified token
- **Ignore `uid` dari request body**
- Buat custom token untuk `uid` dari verified token

**Update `dev/auth-gateway/app/page.tsx`:**
- Saat call `/api/token`, tambah:
  ```typescript
  const idToken = await currentUser.getIdToken();
  fetch('/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ uid: currentUser.uid }), // uid di body bisa dihapus
  })
  ```
- `currentUser` sudah available di scope saat call ini — tidak perlu perubahan flow

### Impact
Minimal. Satu baris tambah di frontend, satu verify di backend. Tidak ada breaking change ke user flow.

---

## Section 3: Clicker Platform

### 3a. Endpoint Tanpa Auth

Tambah `requireAuthedMember` dari `lib/api-auth.ts` ke:

| Endpoint | File |
|----------|------|
| `POST /api/stocklens/scan` | `app/api/stocklens/scan/route.ts` |
| `POST /api/stocklens/check-sku` | `app/api/stocklens/check-sku/route.ts` |
| `POST /api/stocklens/settings` | `app/api/stocklens/settings/route.ts` |
| `GET /api/admin/ai-credits` | `app/api/admin/ai-credits/route.ts` |
| `GET /api/admin/ai-usage` | `app/api/admin/ai-usage/route.ts` |

Pattern fix (sama untuk semua):
```typescript
import { requireAuthedMember } from '@/lib/api-auth';

export async function POST/GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  
  const { siteId } = auth.session; // gunakan siteId dari verified session
  // ... rest of handler
}
```

Catatan: `siteId` diambil dari verified session, **bukan dari request body atau header** — eliminasi IDOR sekaligus.

### 3b. AI Marketing IDOR — Ganti custom `verify()`

File yang terdampak:
- `app/api/admin/modules/ai-marketing/campaigns/route.ts`
- `app/api/admin/modules/ai-marketing/campaigns/[id]/route.ts`
- `app/api/admin/modules/ai-marketing/config/route.ts`
- `app/api/admin/modules/ai-marketing/saved/route.ts`
- `app/api/admin/modules/ai-marketing/generate/route.ts`
- `app/api/admin/modules/ai-marketing/export/route.ts`
- `app/api/admin/modules/ai-marketing/assets/upload/route.ts`
- `app/api/admin/modules/ai-marketing/assets/analyze/route.ts`

Fix: Hapus custom `verify()` function di setiap file, ganti dengan `requireAuthedMember`. Pattern sama dengan 3a.

---

## Section 4: WhatsApp Webhook — HMAC Validation Gap

### Problem
`POST /api/webhook/whatsapp/route.ts` baris 61:
```typescript
if (appSecret && !validateSignature(...))
```
Kalau `META_APP_SECRET` kosong (tidak dikonfigurasi) atau `getSecret()` throw error, `appSecret` jadi string kosong → kondisi `if (appSecret && ...)` jadi `false` → **HMAC validation diskip total** → endpoint terima payload apapun tanpa verifikasi.

### Fix
**Ubah logic menjadi fail-closed:**
```typescript
if (!appSecret) {
  logger.error('wa.webhook.secret.missing', { siteId: 'platform' });
  return NextResponse.json({ ok: true }); // return early, jangan proses
}
if (!validateSignature(rawBody, signature, appSecret)) {
  logger.warn('wa.webhook.invalid.signature', { siteId: 'platform' });
  return NextResponse.json({ ok: true });
}
// lanjut proses payload
```
Kalau secret tidak ada → log error dan bail out (jangan proses). Tetap return 200 ke Meta agar tidak trigger flood retry, tapi payload tidak diproses.

---

## Section 5: Cloud Function `seedSiteData` — No Auth

### Problem
`functions/src/admin/site.ts` — `seedSiteData` adalah Firebase callable function yang tidak ada auth/authorization check. Siapapun yang authenticated (bahkan user biasa) bisa call function ini dengan arbitrary `siteId` dan `ownerId`, meng-overwrite semua data site tersebut dengan starter template.

### Fix
Tambah superadmin check di awal function — sama seperti pattern yang sudah dipakai di function lain di codebase (`createTenant`, `seedModules`):
```typescript
export const seedSiteData = functions.https.onCall(async (request) => {
  // Verify superadmin
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  const email = request.auth.token.email;
  if (email !== process.env.SUPER_ADMIN_EMAIL) {
    throw new functions.https.HttpsError('permission-denied', 'Superadmin only.');
  }

  const { siteId, ownerId } = request.data;
  // ... rest unchanged
});
```

---

## Out of Scope

- **Cloud Functions** (`functions/src/index.ts`) — `createUser`, `deleteUser`, `listUsers`, `removeUserFromSite` hanya cek auth bukan superadmin role. Ada comment di code yang acknowledge gap ini. Butuh understanding apakah functions ini dipanggil dari backyard atau tempat lain — separate investigation.
- **CBC→GCM encryption migration** di `lib/whatsapp/encryption.ts` — butuh migration strategy untuk existing encrypted tokens.

---

## Implementation Order

1. Auth Gateway `/api/token` — paling kritis, full account takeover
2. Backyard middleware — semua secrets/config exposed
3. WhatsApp webhook fail-closed — low effort, high impact
4. `seedSiteData` Cloud Function — data destruction vector
5. Stocklens endpoints — unauthenticated credit drain
6. AI credits/usage endpoints
7. AI Marketing IDOR endpoints

---

## Files Changed Summary

| App | Files |
|-----|-------|
| `auth-gateway` | `app/api/token/route.ts`, `app/page.tsx` |
| `backyard` | `middleware.ts` (baru), `lib/require-superadmin.ts` (baru), semua fetch calls di frontend |
| `clicker-platform-v2` | `app/api/webhook/whatsapp/route.ts`, 5 stocklens/credits routes, 8 ai-marketing routes |
| `functions` | `src/admin/site.ts` |
