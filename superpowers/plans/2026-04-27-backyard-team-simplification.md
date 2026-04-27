# Backyard Team Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti PermissionEditor matrix (none/view/full per-route) dengan simple module checkboxes di TenantMembersCard backyard, hapus PermissionEditor.tsx, dan simplify role dropdown.

**Architecture:** Satu file dimodifikasi (`TenantMembersCard.tsx`) — import `SYSTEM_MODULES` langsung, ganti state `permValue` dengan `checkedModules: Set<string>`, save dengan shape baru `{ permissions: [...ids], moduleAccess: {} }`. Backward compat: saat buka modal member lama dengan granular `moduleAccess`, collapse ke checked jika ada route `'full'` atau `'view'`.

**Tech Stack:** Next.js 16, React, Firebase Firestore client SDK, Tailwind CSS, Lucide React

---

## File Map

| Action | File |
|---|---|
| Modify | `dev/backyard/components/tenant/TenantMembersCard.tsx` |
| Delete | `dev/backyard/components/PermissionEditor.tsx` |

---

## Task 1: Update imports dan state di TenantMembersCard

**Files:**
- Modify: `dev/backyard/components/tenant/TenantMembersCard.tsx:1-50`

- [ ] **Step 1: Ganti imports**

Buka `dev/backyard/components/tenant/TenantMembersCard.tsx`. Cari baris import ini:

```tsx
import { UserX, UserPlus, Loader2, Settings, X, Save } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { PermissionEditor } from '@/components/PermissionEditor';
import { ModuleAccess } from '@/lib/modules/types';
```

Ganti dengan:

```tsx
import { UserX, UserPlus, Loader2, Settings, X, Save } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
```

- [ ] **Step 2: Update interface Member**

Cari:

```tsx
interface Member {
    uid: string;
    displayName?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    moduleAccess?: Record<string, ModuleAccess>;
}
```

Ganti dengan (hapus `ModuleAccess` type reference):

```tsx
interface Member {
    uid: string;
    displayName?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    moduleAccess?: Record<string, Record<string, string>>;
}
```

- [ ] **Step 3: Ganti state permValue dengan checkedModules**

Cari:

```tsx
    // Permissions modal
    const [permTarget, setPermTarget] = useState<Member | null>(null);
    const [permValue, setPermValue] = useState<{ permissions: string[]; moduleAccess: Record<string, ModuleAccess> }>({
        permissions: [],
        moduleAccess: {},
    });
    const [savingPerm, setSavingPerm] = useState(false);
```

Ganti dengan:

```tsx
    // Permissions modal
    const [permTarget, setPermTarget] = useState<Member | null>(null);
    const [checkedModules, setCheckedModules] = useState<Set<string>>(new Set());
    const [savingPerm, setSavingPerm] = useState(false);
```

- [ ] **Step 4: Tambah computed activeModules dan helper getModuleDisplay**

Tambahkan tepat setelah semua `useState` declarations (sebelum `useEffect`):

```tsx
    const activeModules = SYSTEM_MODULES.filter(m => siteModules?.[m.id]);

    const getModuleDisplay = (permissions: string[] = []) => {
        const names = permissions
            .map(id => activeModules.find(m => m.id === id)?.displayName || id)
            .filter(Boolean);
        if (names.length === 0) return null;
        if (names.length <= 3) return names.join(', ');
        return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
    };
```

---

## Task 2: Update openPermissions, handleAdd auto-open, dan handleSavePermissions

**Files:**
- Modify: `dev/backyard/components/tenant/TenantMembersCard.tsx:65-143`

- [ ] **Step 1: Update openPermissions**

Cari:

```tsx
    const openPermissions = (member: Member) => {
        setPermTarget(member);
        setPermValue({
            permissions: member.permissions || [],
            moduleAccess: member.moduleAccess || {},
        });
    };
```

Ganti dengan (backward compat: collapse granular moduleAccess ke checked):

```tsx
    const openPermissions = (member: Member) => {
        setPermTarget(member);
        const initial = new Set<string>(
            (member.permissions || []).filter(id => siteModules?.[id])
        );
        Object.entries(member.moduleAccess || {}).forEach(([moduleId, access]) => {
            if (siteModules?.[moduleId] && Object.values(access).some(v => v === 'full' || v === 'view')) {
                initial.add(moduleId);
            }
        });
        setCheckedModules(initial);
    };
```

- [ ] **Step 2: Update auto-open setelah handleAdd**

Cari di dalam `handleAdd`:

```tsx
            // Auto-open permissions modal for non-owner roles
            if (newUid && addedRole !== 'owner') {
                setPermTarget({ uid: newUid, email: addedEmail, displayName: addedName, role: addedRole });
                setPermValue({ permissions: [], moduleAccess: {} });
            }
```

Ganti dengan:

```tsx
            // Auto-open permissions modal for non-owner roles
            if (newUid && addedRole !== 'owner') {
                setPermTarget({ uid: newUid, email: addedEmail, displayName: addedName, role: addedRole });
                setCheckedModules(new Set());
            }
```

- [ ] **Step 3: Update handleSavePermissions**

Cari:

```tsx
    const handleSavePermissions = async () => {
        if (!permTarget) return;
        setSavingPerm(true);
        try {
            await setDoc(
                doc(db, 'sites', siteId, 'members', permTarget.uid),
                {
                    permissions: permValue.permissions,
                    moduleAccess: permValue.moduleAccess,
                },
                { merge: true }
            );
            toast.success('Permissions saved');
            setPermTarget(null);
        } catch (err: any) {
            toast.error('Save failed', { description: err.message });
        } finally {
            setSavingPerm(false);
        }
    };
```

Ganti dengan (tulis shape baru, `moduleAccess: {}` untuk collapse granular):

```tsx
    const handleSavePermissions = async () => {
        if (!permTarget) return;
        setSavingPerm(true);
        try {
            await setDoc(
                doc(db, 'sites', siteId, 'members', permTarget.uid),
                {
                    permissions: [...checkedModules],
                    moduleAccess: {},
                },
                { merge: true }
            );
            toast.success('Permissions saved');
            setPermTarget(null);
        } catch (err: any) {
            toast.error('Save failed', { description: err.message });
        } finally {
            setSavingPerm(false);
        }
    };
```

---

## Task 3: Update add member form (hapus manager) dan modules column

**Files:**
- Modify: `dev/backyard/components/tenant/TenantMembersCard.tsx` (JSX section)

- [ ] **Step 1: Simplify role dropdown di add form**

Cari di form add member:

```tsx
                    <select value={role} onChange={e => setRole(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-brand-dark bg-white">
                        <option value="owner">Owner</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                    </select>
```

Ganti dengan (hapus `manager`):

```tsx
                    <select value={role} onChange={e => setRole(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-brand-dark bg-white">
                        <option value="owner">Owner</option>
                        <option value="staff">Staff</option>
                    </select>
```

- [ ] **Step 2: Update modules column di member table**

Cari di dalam `{members.map(m => {`:

```tsx
                                const moduleCount = (m.permissions || []).length;
```

Hapus baris `moduleCount` tersebut (tidak lagi dipakai).

- [ ] **Step 3: Update tampilan modules column**

Cari:

```tsx
                                    <td className="px-4 py-2.5 text-xs text-gray-500">
                                        {m.role === 'owner' ? (
                                            <span className="font-semibold text-brand-dark">Full access</span>
                                        ) : moduleCount > 0 ? (
                                            <span>{moduleCount} module{moduleCount > 1 ? 's' : ''}</span>
                                        ) : (
                                            <span className="text-gray-300">No access</span>
                                        )}
                                    </td>
```

Ganti dengan:

```tsx
                                    <td className="px-4 py-2.5 text-xs text-gray-500">
                                        {m.role === 'owner' ? (
                                            <span className="font-semibold text-brand-dark">Full access</span>
                                        ) : getModuleDisplay(m.permissions) ? (
                                            <span className="text-gray-600">{getModuleDisplay(m.permissions)}</span>
                                        ) : (
                                            <span className="text-gray-300">No access</span>
                                        )}
                                    </td>
```

---

## Task 4: Ganti PermissionEditor di permissions modal dengan module checkboxes

**Files:**
- Modify: `dev/backyard/components/tenant/TenantMembersCard.tsx` (permissions modal JSX)

- [ ] **Step 1: Ganti isi modal permissions**

Cari di dalam modal permissions (di dalam `{permTarget && (...)}`):

```tsx
                        <div className="flex-1 overflow-y-auto p-6">
                            {permTarget.role === 'owner' ? (
                                <div className="text-center py-8">
                                    <p className="text-sm font-semibold text-brand-dark mb-1">Owner has full access</p>
                                    <p className="text-xs text-gray-400">Owners always have access to all enabled modules. Per-module permissions only apply to Manager and Staff roles.</p>
                                </div>
                            ) : (
                                <PermissionEditor
                                    value={permValue}
                                    onChange={setPermValue}
                                    siteModules={siteModules}
                                />
                            )}
                        </div>
```

Ganti dengan:

```tsx
                        <div className="flex-1 overflow-y-auto p-6">
                            {permTarget.role === 'owner' ? (
                                <div className="text-center py-8">
                                    <p className="text-sm font-semibold text-brand-dark mb-1">Owner has full access</p>
                                    <p className="text-xs text-gray-400">Owners always have access to all enabled modules.</p>
                                </div>
                            ) : activeModules.length === 0 ? (
                                <p className="text-center py-8 text-sm text-gray-400">No modules enabled for this tenant.</p>
                            ) : (
                                <div className="space-y-2">
                                    {activeModules.map(module => (
                                        <label key={module.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-dark/20 hover:bg-gray-50 cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-brand-dark"
                                                checked={checkedModules.has(module.id)}
                                                onChange={e => {
                                                    const next = new Set(checkedModules);
                                                    if (e.target.checked) next.add(module.id);
                                                    else next.delete(module.id);
                                                    setCheckedModules(next);
                                                }}
                                            />
                                            <div>
                                                <div className="text-sm font-bold text-gray-800">{module.displayName}</div>
                                                {module.description && (
                                                    <div className="text-xs text-gray-400">{module.description}</div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
```

---

## Task 5: Hapus PermissionEditor.tsx

**Files:**
- Delete: `dev/backyard/components/PermissionEditor.tsx`

- [ ] **Step 1: Verifikasi tidak ada import lain ke PermissionEditor**

```bash
grep -r "PermissionEditor" "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard/" --include="*.tsx" --include="*.ts"
```

Expected output: **kosong** (tidak ada hasil). Jika masih ada, perbaiki import tersebut dulu.

- [ ] **Step 2: Hapus file**

```bash
rm "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard/components/PermissionEditor.tsx"
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform"
git add dev/backyard/components/tenant/TenantMembersCard.tsx
git add dev/backyard/components/PermissionEditor.tsx
git commit -m "feat(backyard): simplify team permissions — module checkboxes replace ACL matrix

- TenantMembersCard: PermissionEditor → simple per-module checkboxes
- Save shape: permissions[moduleId], moduleAccess: {} (legacy fallback path)
- Backward compat: granular moduleAccess collapsed to checked on open
- Role dropdown: remove manager (owner/staff binary)
- Module column: display names instead of count
- Delete PermissionEditor.tsx (~280 lines removed)"
```

---

## Task 6: Manual Verification

- [ ] **Step 1: Jalankan dev server backyard**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard"
pnpm dev
```

Buka `http://localhost:3011`

- [ ] **Step 2: Test add staff member baru**

1. Buka tenant detail page → Members card
2. Klik "Add Member" → pastikan dropdown hanya ada **Owner** dan **Staff** (tidak ada Manager)
3. Isi form, pilih Staff → klik Add
4. Pastikan modal permissions muncul otomatis dengan **daftar module checkboxes**
5. Centang beberapa modul → klik "Save Permissions"
6. Di Firestore console, buka `sites/{siteId}/members/{uid}` → verifikasi:
   ```json
   { "permissions": ["byod_pos", "inventory"], "moduleAccess": {} }
   ```

- [ ] **Step 3: Test edit member lama (backward compat)**

1. Buka member yang punya granular `moduleAccess` (dari data lama)
2. Klik "Permissions" button
3. Modal harus terbuka dengan **checkboxes sudah tercentang** untuk module yang sebelumnya punya akses `'full'` atau `'view'`
4. Save tanpa ubah apapun
5. Firestore doc harus berubah ke shape baru (`permissions[]`, `moduleAccess: {}`)

- [ ] **Step 4: Test tampilan modules column**

1. Member dengan 2 modul → tampil: `"Self Order, Inventory"`
2. Member dengan 4 modul → tampil: `"Self Order, Inventory, Reservation (+1 more)"`
3. Member tanpa modul → tampil: `"No access"` (abu-abu)
4. Owner → tampil: `"Full access"` (bold brand-dark)

- [ ] **Step 5: Verifikasi tidak ada TypeScript error**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard"
pnpm tsc --noEmit
```

Expected: no errors.
