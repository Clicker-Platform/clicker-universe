# Team Settings Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti matrix ACL 4-tab di `/admin/settings/team` dengan checkbox sederhana per modul — satu checkbox per modul yang diaktifkan site.

**Architecture:** Hapus `PermissionEditor` component sepenuhnya. Ganti dengan inline checkbox list di dalam `team/page.tsx` yang subscribe ke `subscribeToEnabledModules`. State `memberModuleAccess` dihapus — save selalu menulis `permissions: [...checkedIds]` dan `moduleAccess: {}`.

**Tech Stack:** Next.js 14 App Router, React, Firestore client SDK, `@/lib/modules/registry` (subscribeToEnabledModules)

---

## File Map

| File | Action | Keterangan |
|---|---|---|
| `app/admin/(dashboard)/settings/team/page.tsx` | Modify | Hapus PermissionEditor, tambah inline checkbox, bersihkan debug |
| `components/admin/settings/PermissionEditor.tsx` | Delete | ~307 baris, tidak dipakai setelah task ini |

---

## Task 1: Hapus debug artifacts dari team/page.tsx

**Files:**
- Modify: `app/admin/(dashboard)/settings/team/page.tsx`

- [ ] **Step 1: Hapus debug useEffect (lines 207–215)**

Hapus block berikut dari `team/page.tsx`:
```tsx
// HAPUS SELURUH BLOCK INI:
useEffect(() => {
    const timer = setTimeout(() => {
        if (loading) {
            logger.warn('admin.team.members.load.timeout', { siteId });
        }
    }, 8000);
    return () => clearTimeout(timer);
}, [loading]);
```

- [ ] **Step 2: Hapus debug siteId pill dari JSX**

Hapus block berikut dari dalam `return (...)`:
```tsx
// HAPUS SELURUH BLOCK INI:
{/* Debug Info (Can remove later) */}
<div className="fixed bottom-4 right-4 text-xs text-gray-300 dark:text-neutral-700 pointer-events-none">
    {siteId}
</div>
```

- [ ] **Step 3: Hapus siteId dari loading state UI**

Ubah loading UI dari:
```tsx
<div className="text-sm text-gray-400 dark:text-neutral-600">
    Loading Team... <br />
    Site ID: {siteId || 'Waiting...'}
</div>
```
Menjadi:
```tsx
<div className="text-sm text-gray-400 dark:text-neutral-600">
    Loading Team...
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(dashboard\)/settings/team/page.tsx
git commit -m "chore(team): remove debug artifacts — timeout useEffect, siteId pill, loading text"
```

---

## Task 2: Ganti PermissionEditor dengan inline ModuleCheckboxList

**Files:**
- Modify: `app/admin/(dashboard)/settings/team/page.tsx`

- [ ] **Step 1: Tambah import yang dibutuhkan**

Ubah baris import di bagian atas file:

Hapus baris:
```tsx
import { PermissionEditor, ModuleAccess } from '@/components/admin/settings/PermissionEditor';
```

Tambah baris (setelah import `{ Plus, Mail, Shield, Trash2, X, Loader2, User, Clock }` dari lucide-react):
```tsx
import { ModuleDefinition } from '@/lib/modules/types';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
```

- [ ] **Step 2: Update Member interface — hapus moduleAccess type**

Ubah interface `Member`:
```tsx
// SEBELUM:
interface Member {
    uid: string;
    email: string;
    role: 'owner' | 'admin' | 'staff';
    permissions?: string[];
    moduleAccess?: Record<string, ModuleAccess>;
    displayName?: string;
    photoURL?: string;
    status: 'active' | 'suspended';
    joinedAt: any;
}

// SESUDAH:
interface Member {
    uid: string;
    email: string;
    role: 'owner' | 'admin' | 'staff';
    permissions?: string[];
    moduleAccess?: Record<string, Record<string, string>>;
    displayName?: string;
    photoURL?: string;
    status: 'active' | 'suspended';
    joinedAt: any;
}
```

- [ ] **Step 3: Hapus state memberModuleAccess, tambah state modules**

Hapus baris:
```tsx
const [memberModuleAccess, setMemberModuleAccess] = useState<Record<string, any>>({}); // Assuming 'any' for ModuleAccess type
```

Tambah di bawah `const [memberPermissions, setMemberPermissions] = useState<string[]>([]);`:
```tsx
const [enabledModules, setEnabledModules] = useState<ModuleDefinition[]>([]);
```

- [ ] **Step 4: Tambah useEffect untuk subscribe ke enabled modules**

Tambah useEffect baru setelah block useEffect yang subscribe ke site doc (setelah line `return () => unsubSite();`):

```tsx
// Subscribe to enabled modules list
useEffect(() => {
    const unsubscribe = subscribeToEnabledModules((fetched) => {
        const active = fetched.filter(m => siteModules[m.id] && !HIDDEN_MODULES.includes(m.id));
        setEnabledModules(active);
    });
    return () => unsubscribe();
}, [JSON.stringify(siteModules)]);
```

- [ ] **Step 5: Update openAddModal — hapus setMemberModuleAccess**

Ubah fungsi `openAddModal`:
```tsx
// SEBELUM:
const openAddModal = () => {
    setEditingMember(null);
    setMemberEmail('');
    setMemberPassword('');
    setMemberPermissions([]);
    setMemberModuleAccess({});
    setIsMemberModalOpen(true);
};

// SESUDAH:
const openAddModal = () => {
    setEditingMember(null);
    setMemberEmail('');
    setMemberPassword('');
    setMemberPermissions([]);
    setIsMemberModalOpen(true);
};
```

- [ ] **Step 6: Update openEditModal — derive checked modules dari data lama**

Ubah fungsi `openEditModal`:
```tsx
// SEBELUM:
const openEditModal = (member: Member) => {
    setEditingMember(member);
    setMemberEmail(member.email);
    setMemberPassword('');
    setMemberPermissions(member.permissions || []);
    setMemberModuleAccess(member.moduleAccess || {});
    setIsMemberModalOpen(true);
};

// SESUDAH:
const openEditModal = (member: Member) => {
    setEditingMember(member);
    setMemberEmail(member.email);
    setMemberPassword('');

    // Derive checked modules dari kedua field (permissions[] dan granular moduleAccess)
    // Modul dianggap aktif jika ada di permissions[] ATAU ada route dengan level 'full'/'view'
    const fromPermissions = new Set(member.permissions || []);
    const fromModuleAccess = new Set(
        Object.entries(member.moduleAccess || {})
            .filter(([_, routes]) => Object.values(routes).some(v => v === 'full' || v === 'view'))
            .map(([moduleId]) => moduleId)
    );
    setMemberPermissions(Array.from(new Set([...fromPermissions, ...fromModuleAccess])));
    setIsMemberModalOpen(true);
};
```

- [ ] **Step 7: Update handleSaveMember — selalu kirim moduleAccess: {}**

Ubah body JSON di dalam `handleSaveMember`:
```tsx
// SEBELUM:
body: JSON.stringify({
    email: memberEmail,
    password: memberPassword || undefined,
    role: 'staff',
    permissions: memberPermissions,
    moduleAccess: memberModuleAccess
}),

// SESUDAH:
body: JSON.stringify({
    email: memberEmail,
    password: memberPassword || undefined,
    role: 'staff',
    permissions: memberPermissions,
    moduleAccess: {}
}),
```

- [ ] **Step 8: Ganti PermissionEditor di JSX modal dengan inline checkbox list**

Di dalam form modal, ubah section `Access Permissions`:
```tsx
// SEBELUM (lines 365–379):
<div>
    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2">Access Permissions</label>
    <PermissionEditor
        value={{
            permissions: memberPermissions,
            moduleAccess: memberModuleAccess
        }}
        onChange={(val) => {
            setMemberPermissions(val.permissions);
            setMemberModuleAccess(val.moduleAccess);
        }}
        siteModules={siteModules}
    />
    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">Select which features this staff member can access.</p>
</div>

// SESUDAH:
<div>
    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2">Modul yang bisa diakses</label>
    {enabledModules.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-neutral-600 py-4 text-center">
            Belum ada modul aktif. Aktifkan modul di Site Settings terlebih dahulu.
        </p>
    ) : (
        <div className="space-y-2 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
            {enabledModules.map(module => (
                <label key={module.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 dark:border-neutral-600 text-studio-blue focus:ring-studio-blue dark:bg-neutral-800"
                        checked={memberPermissions.includes(module.id)}
                        onChange={(e) => {
                            setMemberPermissions(prev =>
                                e.target.checked
                                    ? [...prev, module.id]
                                    : prev.filter(p => p !== module.id)
                            );
                        }}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 group-hover:text-gray-900 dark:group-hover:text-neutral-100 transition-colors">
                        {module.displayName || module.id}
                    </span>
                </label>
            ))}
        </div>
    )}
    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">Pilih fitur mana yang bisa diakses staff ini.</p>
</div>
```

- [ ] **Step 9: Jalankan dev server dan cek tidak ada TypeScript error**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: no errors. Jika ada error terkait `ModuleAccess` type — pastikan semua referensinya sudah diganti dengan `Record<string, Record<string, string>>` atau dihapus.

- [ ] **Step 10: Commit**

```bash
git add app/admin/\(dashboard\)/settings/team/page.tsx
git commit -m "feat(team): replace PermissionEditor matrix with simple module checkbox list"
```

---

## Task 3: Update member list display — badge cluster → comma-separated

**Files:**
- Modify: `app/admin/(dashboard)/settings/team/page.tsx`

- [ ] **Step 1: Tambah helper untuk format module list display**

Tambah fungsi helper di bawah `formatPermission`:
```tsx
const formatModuleList = (permissions: string[]) => {
    const visible = permissions
        .filter(p => !HIDDEN_MODULES.includes(p))
        .map(p => MODULE_LABELS[p] || p.replace(/_/g, ' ').replace(/-/g, ' '));
    if (visible.length <= 3) return visible.join(', ');
    return `${visible.slice(0, 3).join(', ')} (+${visible.length - 3} lagi)`;
};
```

- [ ] **Step 2: Ganti badge cluster di member list dengan teks sederhana**

Cari dan ubah section member permissions display di member list. Ubah dari block badge cluster:

```tsx
// SEBELUM (lines 285–295):
{member.role !== 'owner' && member.permissions && member.permissions.length > 0 && (
    <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
        {member.permissions
            .filter(p => siteModules[p] !== false)
            .map(p => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 bg-brand-green/20 text-brand-dark rounded font-medium capitalize truncate max-w-[100px]" title={formatPermission(p)}>
                    {formatPermission(p)}
                </span>
            ))}
    </div>
)}

// SESUDAH:
{member.role !== 'owner' && member.permissions && member.permissions.length > 0 && (
    <p className="text-xs text-gray-500 dark:text-neutral-500 text-right max-w-[200px]">
        {formatModuleList(member.permissions)}
    </p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(dashboard\)/settings/team/page.tsx
git commit -m "feat(team): simplify member list — replace badge cluster with comma-separated module names"
```

---

## Task 4: Hapus PermissionEditor.tsx

**Files:**
- Delete: `components/admin/settings/PermissionEditor.tsx`

- [ ] **Step 1: Verifikasi tidak ada file lain yang import PermissionEditor**

```bash
grep -r "PermissionEditor" /Users/mac/Documents/AI\ Project/clicker-platform/dev/clicker-platform-v2/ --include="*.tsx" --include="*.ts" -l
```

Expected: tidak ada hasil (semua referensi sudah dihapus di Task 2).

Jika masih ada file lain yang import — update file tersebut sebelum lanjut.

- [ ] **Step 2: Hapus file**

```bash
rm "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/components/admin/settings/PermissionEditor.tsx"
```

- [ ] **Step 3: Pastikan build masih bersih**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -u components/admin/settings/PermissionEditor.tsx
git commit -m "chore(team): delete PermissionEditor component — replaced by inline checkbox list"
```

---

## Task 5: Validasi manual di browser

**Files:** (tidak ada perubahan kode — validasi saja)

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm dev
```

- [ ] **Step 2: Validasi — add staff baru dengan POS saja**

1. Login sebagai owner
2. Buka `/admin/settings/team`
3. Klik `Add Member`
4. Isi email + password
5. Centang hanya `POS`
6. Klik `Add Member`
7. Buka Firestore console → `sites/{siteId}/members/{uid}`
8. Verify doc: `permissions: ['byod_pos']`, `moduleAccess: {}`
9. Login sebagai staff tersebut → sidebar hanya tampil POS

- [ ] **Step 3: Validasi — edit existing staff dengan granular moduleAccess lama**

1. Buat member test dengan data lama (via Firestore console langsung):
```json
{
  "role": "staff",
  "email": "test@test.com",
  "permissions": [],
  "moduleAccess": {
    "byod_pos": { "cashier": "full", "kds": "view" },
    "inventory": { "stock": "none" }
  },
  "status": "active"
}
```
2. Buka edit modal member tersebut
3. Verify: checkbox `POS` ter-centang (karena ada route 'full'/'view'), `Inventory` tidak ter-centang (semua 'none')
4. Klik `Update Member` tanpa mengubah apapun
5. Verify Firestore: `permissions: ['byod_pos']`, `moduleAccess: {}`

- [ ] **Step 4: Validasi — owner tidak berubah**

1. Owner row di member list masih menampilkan badge `OWNER`
2. Owner login masih punya akses penuh ke semua modul

- [ ] **Step 5: Validasi — member list display**

1. Staff dengan banyak modul (misal 5 modul) → tampil `POS, Inventory, Reservations (+2 lagi)`
2. Staff dengan 1–3 modul → tampil nama lengkap semua modul

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - ✅ Hapus `<PermissionEditor>` import dan usage → Task 2 Step 1, Step 8
  - ✅ Hapus state `memberModuleAccess` → Task 2 Step 3
  - ✅ Tambah inline checkbox list → Task 2 Step 8
  - ✅ Filter ke `siteModules[m.id] === true`, hide `HIDDEN_MODULES` → Task 2 Step 4
  - ✅ Save: `permissions: [...checkedIds]`, `moduleAccess: {}` → Task 2 Step 7
  - ✅ Member list: comma-separated + truncate → Task 3
  - ✅ Debug artifacts dihapus → Task 1
  - ✅ Delete `PermissionEditor.tsx` → Task 4
  - ✅ Edit existing: derive checkboxes dari granular moduleAccess lama → Task 2 Step 6

- [x] **Placeholder scan:** Tidak ada TBD/TODO di plan ini
- [x] **Type consistency:** `ModuleDefinition` dipakai konsisten dari Task 2 awal sampai akhir. `Record<string, Record<string, string>>` menggantikan `Record<string, ModuleAccess>` di interface Member.
