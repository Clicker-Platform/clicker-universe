# Changelog — Team Simplification & Dev Performance
**Date:** 2026-04-27
**Session scope:** Backyard team permission simplification + dev server performance fixes

---

## 1. Performance — React Compiler dinonaktifkan

**Masalah:** Dev server kompilasi lambat dan RAM terus naik karena `reactCompiler: true` aktif.
React Compiler melakukan analisis statis ke seluruh komponen setiap hot-reload — sangat memory-intensive untuk development.

| File | Perubahan |
|---|---|
| `dev/backyard/next.config.ts` | `reactCompiler: true` → `false` |
| `dev/auth-gateway/next.config.ts` | `reactCompiler: true` → `false` |

`dev/clicker-platform-v2/next.config.mjs` — tidak terpengaruh, tidak pernah mengaktifkan React Compiler.

---

## 2. Backyard — Simplifikasi Team Permissions (Surface A)

**Konteks:** Team permission UI sebelumnya menggunakan matrix ACL granular (per-modul → per-route → none/view/full), padahal role system sudah binary (owner vs staff) dari awal. Matrix menciptakan kompleksitas yang tidak diperlukan untuk segmen F&B SME Indonesia.

**Referensi:** `dev/clicker-platform-v2/Docs/TEAM_SIMPLIFICATION_PLAN.md`

### 2a. `TenantMembersCard.tsx` — Replace PermissionEditor dengan module checkboxes

**File:** `dev/backyard/components/tenant/TenantMembersCard.tsx`

- Hapus import `PermissionEditor` dan `ModuleAccess`
- Tambah import `SYSTEM_MODULES` dari `@/lib/modules/definitions`
- Ganti state `permValue: { permissions[], moduleAccess }` → `checkedModules: Set<string>`
- Tambah `activeModules` computed (filter SYSTEM_MODULES by `siteModules`)
- Tambah `getModuleDisplay()` helper — nama module + truncate "(+N more)"
- `openPermissions()` sekarang populate `checkedModules` dari:
  - `member.permissions[]` (new shape)
  - `member.moduleAccess` granular (backward compat — collapse jika ada route `full`/`view`)
- `handleSavePermissions()` tulis shape baru: `{ permissions: [...checkedModules], moduleAccess: {} }`
- Role dropdown add form: hapus `manager` (owner/staff saja)
- `roleColor()`: hapus branch `manager`
- Modules column: tampil nama module (`"Self Order, Inventory"`) bukan angka (`"2 modules"`)
- Modal permissions: daftar checkbox per module (bukan PermissionEditor matrix)

**Data shape baru:**
```json
{ "permissions": ["byod_pos", "inventory"], "moduleAccess": {} }
```

**Backward compat:** Member lama dengan `moduleAccess` granular tetap berfungsi. Saat di-edit, granular di-collapse ke format baru saat Save.

### 2b. `PermissionEditor.tsx` — Dihapus

**File:** `dev/backyard/components/PermissionEditor.tsx` — **DELETED** (~280 baris)

Commit: `2255166 feat(backyard): simplify team permissions — module checkboxes replace ACL matrix`

---

## 3. Backyard — UsersTab Fixes

**File:** `dev/backyard/components/access/UsersTab.tsx`

### 3a. Hapus opsi Manager dari role dropdown

Modal "Assign to Tenant" sebelumnya menawarkan Owner/Manager/Staff. `manager` dihapus karena tidak pernah dibaca kode (confirmed oleh AUTH_RBAC_REVIEW_2026-04-26).

### 3b. Fix Assign to Tenant — tidak muncul di Members card

**Masalah:** `handleAssign` sebelumnya hanya memanggil `setCustomClaims` (Firebase Auth claims). Members card membaca dari Firestore `sites/{siteId}/members`, bukan dari custom claims — sehingga user yang di-assign tidak pernah muncul.

**Fix:** `handleAssign` sekarang memanggil:
1. `createUser` Cloud Function → buat Firestore member doc (akses nyata)
2. `setCustomClaims` → set `siteId` di claims untuk tracking UI state di UsersTab

### 3c. Tambah Revoke button

**Masalah:** Setelah user di-assign ke tenant, tidak ada cara revoke dari UsersTab — hanya ada link "Manage in tenant".

**Fix:** Tambah `handleRevoke()` + tombol **Revoke** di action column:
- `removeUserFromSite` Cloud Function → hapus Firestore member doc
- `setCustomClaims` dengan `claims: {}` → clear siteId dari Auth claims
- UI baris kembali ke state "Assign to tenant"

**Action column sekarang:**
- User tanpa tenant → `[Assign to tenant]`
- User dengan tenant → `[Manage →]` `[Revoke]`

---

## Ringkasan File yang Berubah

| File | Action |
|---|---|
| `dev/backyard/next.config.ts` | Modified — disable React Compiler |
| `dev/auth-gateway/next.config.ts` | Modified — disable React Compiler |
| `dev/backyard/components/tenant/TenantMembersCard.tsx` | Modified — checkboxes + role simplification |
| `dev/backyard/components/PermissionEditor.tsx` | **Deleted** |
| `dev/backyard/components/access/UsersTab.tsx` | Modified — fix assign flow + revoke button |

**Net lines:** ~−280 (PermissionEditor deleted) + minor additions di UsersTab
