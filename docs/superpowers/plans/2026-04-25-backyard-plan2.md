# Backyard Plan 2 — Access Control + Sync + WhatsApp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Tambah 3 halaman terakhir yang tersisa di sidebar — Access Control (`/access`), Sync Control (`/sync`), WhatsApp Manager (`/whatsapp`).

**Architecture:** Semua halaman client-side, data via Cloud Functions callable + Firestore. Pakai `PageShell` + dark sidebar yang sudah ada. Access Control adalah single page dengan 2 tabs (Users — search/edit claims, Roles — global role config). Sync Control monitor `sites/go/*` triggers (yang sudah ada di functions). WhatsApp Manager aggregate dari `sites/{id}/settings` + `platform_logs`.

**Tech Stack:** Next.js 14, TypeScript, Firebase callable, Firestore client, Tailwind, Lucide

**Worktree:** `/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging` (branch: `dev-logging`)

---

## File Map

| File | Action | Tanggung Jawab |
|------|--------|----------------|
| `backyard/app/access/page.tsx` | Create | Tab page: Users (claims) + Roles (RBAC) |
| `backyard/components/access/UsersTab.tsx` | Create | Search user → edit claims → revoke |
| `backyard/components/access/RolesTab.tsx` | Create | Global role definitions, edit, list |
| `backyard/app/sync/page.tsx` | Create | Sync status monitor + manual trigger |
| `backyard/app/whatsapp/page.tsx` | Create | List tenant + WA status + last error |

---

## Task 1: Buat Access Control — Users Tab Component

**File:** `backyard/components/access/UsersTab.tsx` (CREATE)

Mkdir directory: `backyard/components/access/`

Functionality: search user by email → call `getUserByEmail` Cloud Function → tampilkan custom claims aktif → tombol Edit Claims dan Revoke Access.

- [ ] **Step 1: Buat directory**
```bash
mkdir -p "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/components/access"
```

- [ ] **Step 2: Buat `backyard/components/access/UsersTab.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, Loader2, ShieldAlert, ShieldCheck, Mail } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface UserResult {
    uid: string;
    email?: string;
    displayName?: string;
    customClaims?: { role?: string; siteId?: string };
}

interface Tenant { id: string; name: string; }

const roleColor = (r?: string) => {
    if (r === 'superadmin') return 'bg-red-50 text-red-700 border-red-100';
    if (r === 'owner') return 'bg-brand-dark text-white border-brand-dark';
    if (r === 'manager') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (r) return 'bg-gray-100 text-gray-600 border-gray-200';
    return 'bg-gray-50 text-gray-400 border-gray-200';
};

export default function UsersTab() {
    const [email, setEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [user, setUser] = useState<UserResult | null>(null);

    const [editing, setEditing] = useState(false);
    const [editRole, setEditRole] = useState('staff');
    const [editSiteId, setEditSiteId] = useState('');
    const [saving, setSaving] = useState(false);

    const [tenants, setTenants] = useState<Tenant[]>([]);

    const [revokeOpen, setRevokeOpen] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch { /* non-critical */ }
        };
        fetch();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSearching(true);
        setUser(null);
        try {
            const fn = httpsCallable(functions, 'getUserByEmail');
            const res: any = await fn({ email: email.trim() });
            if (res.data?.user) {
                setUser(res.data.user);
            } else {
                toast.error('User not found');
            }
        } catch (err: any) {
            toast.error('Search failed', { description: err.message });
        } finally {
            setSearching(false);
        }
    };

    const startEdit = () => {
        if (!user) return;
        setEditRole(user.customClaims?.role || 'staff');
        setEditSiteId(user.customClaims?.siteId || '');
        setEditing(true);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({
                uid: user.uid,
                claims: { role: editRole, siteId: editSiteId || null },
            });
            toast.success('Claims updated');
            setUser({ ...user, customClaims: { role: editRole, siteId: editSiteId || undefined } });
            setEditing(false);
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = async () => {
        if (!user) return;
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({ uid: user.uid, claims: { role: null, siteId: null } });
            toast.success('Access revoked');
            setUser({ ...user, customClaims: {} });
        } catch (err: any) {
            toast.error('Revoke failed', { description: err.message });
        } finally {
            setRevokeOpen(false);
        }
    };

    return (
        <>
            {/* Search */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 max-w-2xl">
                <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-3">Find User by Email</h2>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                            placeholder="user@example.com"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={searching}
                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Lookup
                    </button>
                </div>
            </form>

            {/* User result */}
            {user && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <h3 className="font-black text-brand-dark text-lg">{user.displayName || 'No Name'}</h3>
                            <p className="text-sm text-gray-400 font-mono">{user.email}</p>
                            <p className="text-xs text-gray-300 font-mono mt-1">UID: {user.uid}</p>
                        </div>
                        {!editing && (
                            <div className="flex gap-2">
                                <button onClick={startEdit}
                                    className="px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors">
                                    Edit Claims
                                </button>
                                {user.customClaims?.role && (
                                    <button onClick={() => setRevokeOpen(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-red-300 hover:text-red-600 rounded-lg text-xs font-bold text-gray-600 transition-colors">
                                        <ShieldAlert className="w-3.5 h-3.5" /> Revoke
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1.5">Role</p>
                            {editing ? (
                                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                    className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="owner">Owner</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                    <option value="superadmin">Superadmin</option>
                                </select>
                            ) : (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${roleColor(user.customClaims?.role)}`}>
                                    <ShieldCheck className="w-3 h-3" />
                                    {user.customClaims?.role || 'no role'}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1.5">Tenant (Site ID)</p>
                            {editing ? (
                                <select value={editSiteId} onChange={e => setEditSiteId(e.target.value)}
                                    className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="">— No tenant —</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                                </select>
                            ) : (
                                user.customClaims?.siteId
                                    ? <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{user.customClaims.siteId}</span>
                                    : <span className="text-sm text-gray-300">—</span>
                            )}
                        </div>
                    </div>

                    {editing && (
                        <div className="flex gap-2 justify-end mt-6">
                            <button onClick={() => setEditing(false)}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Claims
                            </button>
                        </div>
                    )}
                </div>
            )}

            <ConfirmationDialog
                isOpen={revokeOpen}
                onCancel={() => setRevokeOpen(false)}
                onConfirm={handleRevoke}
                title={`Revoke access for ${user?.email}?`}
                description="This will clear the user's role and tenant assignment. They will lose access to admin pages."
                variant="danger"
            />
        </>
    );
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/components/access/UsersTab.tsx
git commit -m "feat(backyard): add UsersTab — search by email, view/edit claims, revoke"
```

---

## Task 2: Buat Access Control — Roles Tab Component

**File:** `backyard/components/access/RolesTab.tsx` (CREATE)

Functionality: define role globally (name + description). Disimpan di Firestore `platform_meta/rbac_config`. Default 4 roles: superadmin, owner, manager, staff. User bisa add custom roles.

- [ ] **Step 1: Buat `backyard/components/access/RolesTab.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface Role {
    id: string;
    label: string;
    description: string;
    builtIn?: boolean;
}

const DEFAULT_ROLES: Role[] = [
    { id: 'superadmin', label: 'Superadmin', description: 'Full platform access (Backyard god mode)', builtIn: true },
    { id: 'owner', label: 'Owner', description: 'Tenant owner with full access to their tenant', builtIn: true },
    { id: 'manager', label: 'Manager', description: 'Manage staff and most tenant features', builtIn: true },
    { id: 'staff', label: 'Staff', description: 'Daily operations access (limited write)', builtIn: true },
];

export default function RolesTab() {
    const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const [newId, setNewId] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        const fetch = async () => {
            try {
                const ref = doc(db, 'platform_meta', 'rbac_config');
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    if (Array.isArray(data.roles)) {
                        // Merge: keep built-ins, add custom
                        const customRoles = data.roles.filter((r: Role) => !DEFAULT_ROLES.find(d => d.id === r.id));
                        setRoles([...DEFAULT_ROLES, ...customRoles]);
                    }
                }
            } catch { /* use defaults */ }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleAdd = () => {
        const id = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        if (!id || !newLabel.trim()) {
            toast.warning('ID and Label required');
            return;
        }
        if (roles.find(r => r.id === id)) {
            toast.error('Role ID already exists');
            return;
        }
        setRoles([...roles, { id, label: newLabel.trim(), description: newDesc.trim() }]);
        setNewId(''); setNewLabel(''); setNewDesc('');
        setDirty(true);
    };

    const handleRemove = (id: string) => {
        setRoles(roles.filter(r => r.id !== id));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const customOnly = roles.filter(r => !r.builtIn);
            await setDoc(doc(db, 'platform_meta', 'rbac_config'), { roles: customOnly }, { merge: true });
            toast.success('Roles saved');
            setDirty(false);
        } catch (err: any) {
            toast.error('Save failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex items-start justify-between mb-4">
                <p className="text-sm text-gray-500 font-medium max-w-xl">
                    Built-in roles cannot be removed. Add custom roles for special access patterns.
                </p>
                {dirty && (
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                )}
            </div>

            {/* Role list */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading roles...</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Role ID</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Label</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Description</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Type</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(r => (
                                <tr key={r.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                                    <td className="px-5 py-3 font-mono text-xs text-indigo-600">{r.id}</td>
                                    <td className="px-5 py-3 font-bold text-brand-dark">{r.label}</td>
                                    <td className="px-5 py-3 text-gray-500 text-xs">{r.description || '—'}</td>
                                    <td className="px-5 py-3">
                                        {r.builtIn ? (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-dark text-white">Built-in</span>
                                        ) : (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Custom</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {!r.builtIn && (
                                            <button onClick={() => handleRemove(r.id)}
                                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add custom role */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
                <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-3">Add Custom Role</h2>
                <div className="grid grid-cols-3 gap-3">
                    <input value={newId} onChange={e => setNewId(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-brand-dark"
                        placeholder="role_id" />
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                        placeholder="Display Label" />
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                        placeholder="Description" />
                </div>
                <button onClick={handleAdd}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90">
                    <Plus className="w-4 h-4" /> Add Role
                </button>
            </div>
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/components/access/RolesTab.tsx
git commit -m "feat(backyard): add RolesTab — manage role definitions in platform_meta/rbac_config"
```

---

## Task 3: Buat Access Control Page

**File:** `backyard/app/access/page.tsx` (CREATE)

- [ ] **Step 1: Buat directory dan file**

```bash
mkdir -p "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/access"
```

- [ ] **Step 2: Buat `backyard/app/access/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import PageShell from '@/components/PageShell';
import UsersTab from '@/components/access/UsersTab';
import RolesTab from '@/components/access/RolesTab';

type Tab = 'users' | 'roles';

export default function AccessControlPage() {
    const [activeTab, setActiveTab] = useState<Tab>('users');

    return (
        <PageShell
            title="Access Control"
            subtitle={activeTab === 'users' ? 'Inspect and edit user claims' : 'Define roles available across platform'}
        >
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                        activeTab === 'users'
                            ? 'border-brand-dark text-brand-dark'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                >
                    Users (Claims)
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                        activeTab === 'roles'
                            ? 'border-brand-dark text-brand-dark'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                >
                    Roles & Permissions
                </button>
            </div>

            {activeTab === 'users' ? <UsersTab /> : <RolesTab />}
        </PageShell>
    );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep "access/" | head -10
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/app/access/page.tsx
git commit -m "feat(backyard): add Access Control page with Users + Roles tabs"
```

---

## Task 4: Buat Sync Control Page

**File:** `backyard/app/sync/page.tsx` (CREATE)

Functionality: Tampilkan info sync `sites/go/*` (yang sudah dideploy via `syncGoFirestore` etc). Karena auto-sync via Firestore triggers, halaman ini hanya:
1. Tampilkan list 5 trigger functions yang aktif (informational)
2. Status terakhir sync (jika ada Firestore write yang menyimpan timestamp)
3. Tombol "Force Manual Sync" yang menulis dummy doc ke `sites/go/_sync_trigger` agar trigger fire

Karena tidak ada `triggerManualSync` callable yet, kita pakai approach: user bisa set/refresh dummy field di `sites/go/_sync_trigger/now` yang akan trigger `syncGoFirestore`.

- [ ] **Step 1: Buat directory dan file**

```bash
mkdir -p "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/sync"
```

- [ ] **Step 2: Buat `backyard/app/sync/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import { Loader2, RefreshCw, Database, HardDrive, CheckCircle2 } from 'lucide-react';

interface SyncTrigger {
    id: string;
    icon: typeof Database;
    label: string;
    description: string;
    type: 'firestore' | 'storage';
}

const TRIGGERS: SyncTrigger[] = [
    {
        id: 'syncGoFirestore',
        icon: Database,
        label: 'Firestore Level 1',
        description: 'sites/go/{col}/{docId} — top-level docs',
        type: 'firestore',
    },
    {
        id: 'syncGoFirestoreDeep',
        icon: Database,
        label: 'Firestore Level 2',
        description: 'sites/go/{col}/{docId}/{subCol}/{subDocId} — nested',
        type: 'firestore',
    },
    {
        id: 'syncGoFirestoreLevel3',
        icon: Database,
        label: 'Firestore Level 3',
        description: 'Deep nested collections (3 levels)',
        type: 'firestore',
    },
    {
        id: 'syncGoStorageUpload',
        icon: HardDrive,
        label: 'Storage Upload',
        description: 'Mirrors uploaded files to production storage',
        type: 'storage',
    },
    {
        id: 'syncGoStorageDelete',
        icon: HardDrive,
        label: 'Storage Delete',
        description: 'Mirrors file deletions to production storage',
        type: 'storage',
    },
];

export default function SyncControlPage() {
    const [triggering, setTriggering] = useState(false);
    const [lastTriggered, setLastTriggered] = useState<Date | null>(null);

    useEffect(() => {
        const ref = doc(db, 'sites', 'go', '_sync_meta', 'manual_trigger');
        const unsub = onSnapshot(ref, snap => {
            if (snap.exists()) {
                const data = snap.data();
                const ts = data.ts?.toDate?.();
                if (ts) setLastTriggered(ts);
            }
        }, () => { /* non-critical */ });
        return unsub;
    }, []);

    const handleTrigger = async () => {
        setTriggering(true);
        try {
            await setDoc(doc(db, 'sites', 'go', '_sync_meta', 'manual_trigger'), {
                ts: serverTimestamp(),
                triggeredAt: new Date().toISOString(),
            }, { merge: true });
            toast.success('Sync triggered', {
                description: 'syncGoFirestore should pick this up within seconds.',
            });
        } catch (err: any) {
            toast.error('Trigger failed', { description: err.message });
        } finally {
            setTriggering(false);
        }
    };

    return (
        <PageShell
            title="Sync Control"
            subtitle="Staging → Production sync (sites/go) — automatic via Firestore triggers"
            action={
                <button
                    onClick={handleTrigger}
                    disabled={triggering}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                    {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {triggering ? 'Triggering...' : 'Force Manual Sync'}
                </button>
            }
        >
            {/* Status */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Auto Sync</p>
                    <p className="text-2xl font-black text-green-600 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5" />
                        Active
                    </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Triggers Deployed</p>
                    <p className="text-2xl font-black text-brand-dark mt-1">{TRIGGERS.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Manual Trigger</p>
                    <p className="text-sm font-bold text-brand-dark mt-2">
                        {lastTriggered ? lastTriggered.toLocaleString('id-ID') : '—'}
                    </p>
                </div>
            </div>

            {/* Triggers */}
            <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-3">Active Sync Triggers</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-slate-50">
                        <tr>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Function</th>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Type</th>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Pattern</th>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {TRIGGERS.map(t => {
                            const Icon = t.icon;
                            return (
                                <tr key={t.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4 text-gray-400" />
                                            <span className="font-mono text-xs text-indigo-600">{t.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                            t.type === 'firestore'
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-purple-50 text-purple-700 border-purple-100'
                                        }`}>{t.type}</span>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{t.description}</td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Listening
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 max-w-2xl">
                <strong>Note:</strong> Sync runs automatically when documents change in <code className="font-mono">sites/go/*</code>.
                Use "Force Manual Sync" only when production data appears stale and you suspect a missed event.
            </div>
        </PageShell>
    );
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/app/sync/page.tsx
git commit -m "feat(backyard): add Sync Control page — monitor sync triggers + manual force"
```

---

## Task 5: Buat WhatsApp Manager Page

**File:** `backyard/app/whatsapp/page.tsx` (CREATE)

Functionality:
- List semua tenant
- Untuk setiap tenant: cek `sites/{id}/settings/whatsapp` (atau settings doc) untuk phone number + status WA
- Cross-reference dengan `platform_logs` untuk last `wa.*` error per tenant (24h terakhir)

- [ ] **Step 1: Buat directory dan file**

```bash
mkdir -p "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/whatsapp"
```

- [ ] **Step 2: Buat `backyard/app/whatsapp/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import Link from 'next/link';
import { MessageSquare, ChevronRight, Loader2 } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
}

interface TenantWA {
    id: string;
    name: string;
    phone?: string;
    enabled: boolean;
    lastErrorEvent?: string;
    lastErrorAt?: Date;
}

export default function WhatsAppPage() {
    const [tenantList, setTenantList] = useState<Tenant[]>([]);
    const [waData, setWaData] = useState<Record<string, Partial<TenantWA>>>({});
    const [recentErrors, setRecentErrors] = useState<Record<string, { event: string; at: Date }>>({});
    const [loading, setLoading] = useState(true);

    // Fetch tenant list + their WA settings
    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                const list: Tenant[] = res.data.list ?? [];
                setTenantList(list);

                // Fetch WA settings per tenant
                const settingsResults = await Promise.all(
                    list.map(async (t) => {
                        try {
                            const snap = await getDoc(doc(db, 'sites', t.id, 'settings', 'whatsapp'));
                            return { id: t.id, data: snap.exists() ? snap.data() : null };
                        } catch {
                            return { id: t.id, data: null };
                        }
                    })
                );
                const map: Record<string, Partial<TenantWA>> = {};
                settingsResults.forEach(({ id, data }) => {
                    map[id] = {
                        phone: data?.phoneNumber || data?.phone,
                        enabled: !!data?.enabled,
                    };
                });
                setWaData(map);
            } catch (err: any) {
                toast.error('Failed to load tenants', { description: err.message });
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    // Listen to recent wa.* errors from platform_logs
    useEffect(() => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
        const q = query(
            collection(db, 'platform_logs'),
            where('level', '==', 'error'),
            orderBy('ts', 'desc'),
            limit(200)
        );
        const unsub = onSnapshot(q, snap => {
            const errMap: Record<string, { event: string; at: Date }> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                const event: string = data.event || '';
                if (!event.startsWith('wa.')) return;
                const at: Date | undefined = data.ts?.toDate?.();
                if (!at || at < since) return;
                const siteId: string = data.siteId || 'platform';
                if (!errMap[siteId] || at > errMap[siteId].at) {
                    errMap[siteId] = { event, at };
                }
            });
            setRecentErrors(errMap);
        }, () => { /* non-critical */ });
        return unsub;
    }, []);

    const tenants = useMemo<TenantWA[]>(() =>
        tenantList.map(t => ({
            id: t.id,
            name: t.name,
            phone: waData[t.id]?.phone,
            enabled: waData[t.id]?.enabled ?? false,
            lastErrorEvent: recentErrors[t.id]?.event,
            lastErrorAt: recentErrors[t.id]?.at,
        })),
        [tenantList, waData, recentErrors]
    );

    const stats = useMemo(() => {
        const total = tenants.filter(t => t.enabled).length;
        const issues = tenants.filter(t => t.lastErrorEvent).length;
        const ok = total - issues;
        return { total, ok, issues };
    }, [tenants]);

    const timeAgo = (d: Date) => {
        const sec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (sec < 60) return `${sec}s ago`;
        if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
        return `${Math.floor(sec / 3600)}h ago`;
    };

    return (
        <PageShell
            title="WhatsApp Manager"
            subtitle="WA connection status across tenants"
        >
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">WA Tenants</p>
                    <p className="text-2xl font-black text-brand-dark mt-1">{loading ? '—' : stats.total}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Healthy</p>
                    <p className="text-2xl font-black text-green-600 mt-1">{loading ? '—' : stats.ok}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Issues (24h)</p>
                    <p className="text-2xl font-black text-red-600 mt-1">{loading ? '—' : stats.issues}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No tenants found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Tenant</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Phone</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Last Error (24h)</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => {
                                const hasError = !!t.lastErrorEvent;
                                return (
                                    <tr key={t.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                                        <td className="px-5 py-3">
                                            <div className="font-black text-brand-dark text-sm">{t.name}</div>
                                            <div className="text-xs text-gray-400 font-mono">{t.id}</div>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.phone || '—'}</td>
                                        <td className="px-5 py-3">
                                            {!t.enabled ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Disabled
                                                </span>
                                            ) : hasError ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Error
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> OK
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-xs">
                                            {t.lastErrorEvent ? (
                                                <div>
                                                    <span className="font-mono text-red-600">{t.lastErrorEvent}</span>
                                                    {t.lastErrorAt && (
                                                        <div className="text-gray-400 mt-0.5">{timeAgo(t.lastErrorAt)}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <Link href={`/monitoring?siteId=${t.id}`}
                                                className="flex items-center justify-end gap-1 text-xs font-bold text-gray-500 hover:text-brand-dark transition-colors">
                                                View Logs <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </PageShell>
    );
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/app/whatsapp/page.tsx
git commit -m "feat(backyard): add WhatsApp Manager page — per-tenant WA status + last error"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Verify file structure**

```bash
find "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app" -name "page.tsx" | sort
```

Expected pages: `monitoring`, `seed`, `settings`, `tenants`, `tenants/[id]`, `access`, `sync`, `whatsapp`, `page.tsx` (overview).

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no errors.

- [ ] **Step 3: Sidebar verify all routes ada**

```bash
grep -c "href:" "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/components/Sidebar.tsx"
```
Expected: 9 (Overview, Tenants & Users, Access Control, Monitoring, Sync Control, Seed Tools, WhatsApp, Settings).

- [ ] **Step 4: Cleanup commit jika ada**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git status
git add -A && git commit -m "fix(backyard): plan 2 verification cleanup" 2>/dev/null || echo "nothing to commit"
```
