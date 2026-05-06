# Resend SDK Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus sisa-sisa Resend SDK (`resend-client.ts` dan package `resend`) dari platform dan auth-gateway, karena kita sudah migrasi ke HTTP API langsung via `fetch`.

**Architecture:** `sender.ts` sudah menggunakan `fetch('https://api.resend.com/emails', ...)` secara langsung — tidak ada lagi ketergantungan pada Resend SDK. `resend-client.ts` adalah dead code dari implementasi lama. Package `resend` di `package.json` tidak lagi dibutuhkan.

**Tech Stack:** pnpm, Next.js (clicker-platform-v2 + auth-gateway)

---

## File Map

| Action | File |
|--------|------|
| Delete | `dev/clicker-platform-v2/lib/email/resend-client.ts` |
| Delete | `dev/auth-gateway/lib/email/resend-client.ts` |
| Modify | `dev/clicker-platform-v2/package.json` — hapus `"resend"` dari dependencies |
| Modify | `dev/auth-gateway/package.json` — hapus `"resend"` dari dependencies |
| Run    | `pnpm install` di kedua app untuk regenerate lockfile |
| Verify | `dev/clicker-platform-v2/lib/email/sender.ts` — pastikan tidak import resend-client |
| Verify | `dev/auth-gateway/lib/email/sender.ts` — pastikan tidak import resend-client |

---

### Task 1: Verifikasi tidak ada import aktif ke resend-client atau SDK

**Files:**
- Read: `dev/clicker-platform-v2/lib/email/sender.ts`
- Read: `dev/auth-gateway/lib/email/sender.ts`

- [ ] **Step 1: Grep semua import ke resend-client di platform**

```bash
grep -r "resend-client\|getResendClient\|from 'resend'" \
  dev/clicker-platform-v2 \
  --include="*.ts" --include="*.tsx" -l
```

Expected output:
```
dev/clicker-platform-v2/lib/email/resend-client.ts
```
(hanya file itu sendiri — tidak ada yang import dari luar)

- [ ] **Step 2: Grep di auth-gateway**

```bash
grep -r "resend-client\|getResendClient\|from 'resend'" \
  dev/auth-gateway \
  --include="*.ts" --include="*.tsx" -l
```

Expected output:
```
dev/auth-gateway/lib/email/resend-client.ts
```

Jika ada file lain yang muncul selain `resend-client.ts` itu sendiri, **STOP** dan update file tersebut dulu sebelum lanjut.

---

### Task 2: Hapus resend-client.ts dari kedua app

**Files:**
- Delete: `dev/clicker-platform-v2/lib/email/resend-client.ts`
- Delete: `dev/auth-gateway/lib/email/resend-client.ts`

- [ ] **Step 1: Hapus dari platform**

```bash
rm "dev/clicker-platform-v2/lib/email/resend-client.ts"
```

- [ ] **Step 2: Hapus dari auth-gateway**

```bash
rm "dev/auth-gateway/lib/email/resend-client.ts"
```

- [ ] **Step 3: Verifikasi tidak ada file tersisa**

```bash
find dev -name "resend-client.ts" -type f
```

Expected output: (kosong / no output)

---

### Task 3: Hapus package `resend` dari package.json platform

**Files:**
- Modify: `dev/clicker-platform-v2/package.json`

- [ ] **Step 1: Hapus baris `"resend"` dari dependencies**

Buka `dev/clicker-platform-v2/package.json`, cari baris:
```json
"resend": "^6.12.2",
```
Hapus baris tersebut.

- [ ] **Step 2: Jalankan pnpm install untuk sync lockfile**

```bash
cd dev/clicker-platform-v2 && pnpm install
```

Expected: package `resend` tidak lagi muncul di `node_modules`, lockfile terupdate.

- [ ] **Step 3: Verifikasi resend tidak ada di node_modules**

```bash
ls dev/clicker-platform-v2/node_modules/resend 2>&1
```

Expected output:
```
ls: dev/clicker-platform-v2/node_modules/resend: No such file or directory
```

---

### Task 4: Hapus package `resend` dari package.json auth-gateway

**Files:**
- Modify: `dev/auth-gateway/package.json`

- [ ] **Step 1: Hapus baris `"resend"` dari dependencies**

Buka `dev/auth-gateway/package.json`, cari baris:
```json
"resend": "^6.12.2",
```
Hapus baris tersebut.

- [ ] **Step 2: Jalankan pnpm install untuk sync lockfile**

```bash
cd dev/auth-gateway && pnpm install
```

- [ ] **Step 3: Verifikasi resend tidak ada di node_modules**

```bash
ls dev/auth-gateway/node_modules/resend 2>&1
```

Expected output:
```
ls: dev/auth-gateway/node_modules/resend: No such file or directory
```

---

### Task 5: Jalankan test suite untuk konfirmasi tidak ada regresi

**Files:**
- Test: `dev/clicker-platform-v2/lib/email/__tests__/sender.test.tsx`

- [ ] **Step 1: Jalankan test email di platform**

```bash
cd dev/clicker-platform-v2 && pnpm test lib/email
```

Expected output:
```
✓ sender.test.tsx (5 tests)
✓ config.test.ts
✓ context.test.ts
✓ guard.test.ts
```

Semua test harus PASS. Jika ada yang fail, investigasi sebelum lanjut.

- [ ] **Step 2: Jalankan TypeScript check**

```bash
cd dev/clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: no errors.

```bash
cd dev/auth-gateway && pnpm tsc --noEmit
```

Expected: no errors.

---

### Task 6: Commit di branch dev

- [ ] **Step 1: Stage perubahan**

```bash
git -C dev add \
  clicker-platform-v2/lib/email/resend-client.ts \
  auth-gateway/lib/email/resend-client.ts \
  clicker-platform-v2/package.json \
  auth-gateway/package.json \
  clicker-platform-v2/pnpm-lock.yaml \
  auth-gateway/pnpm-lock.yaml
```

- [ ] **Step 2: Commit**

```bash
git -C dev commit -m "chore(email): remove resend SDK — use fetch directly"
```

---

### Task 7: Sync ke worktree main

- [ ] **Step 1: Cherry-pick commit ke main**

```bash
# Ambil hash commit terakhir dari dev
HASH=$(git -C dev log -1 --format="%H")

# Cherry-pick ke main
git -C main cherry-pick $HASH
```

- [ ] **Step 2: Verifikasi main bersih**

```bash
git -C main status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 3: Push kedua branch**

Konfirmasi ke user sebelum push.
